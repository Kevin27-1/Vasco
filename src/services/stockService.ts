import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  writeBatch
} from 'firebase/firestore'
import { db } from '../lib/firebase'

export type StockStatus = 'In stock' | 'Low stock' | 'Sold'

export const TYRE_TYPES = [
  'Tubeless + Radial',
  'Tubeless + Nylon',
  'Tube-Type + Nylon',
  'Tube-Type + Radial'
] as const

export type TyreType = typeof TYRE_TYPES[number]

export interface TyreTypeQuantities {
  'Tubeless + Radial': number
  'Tubeless + Nylon': number
  'Tube-Type + Nylon': number
  'Tube-Type + Radial': number
}

export type TyreTypePrices = Record<TyreType, number>

export function defaultTypeQuantities(): TyreTypeQuantities {
  return {
    'Tubeless + Radial': 0,
    'Tubeless + Nylon': 0,
    'Tube-Type + Nylon': 0,
    'Tube-Type + Radial': 0
  }
}

export function defaultTypePrices(defaultPrice = 0): TyreTypePrices {
  const p = Math.max(0, Number(defaultPrice) || 0)
  return {
    'Tubeless + Radial': p,
    'Tubeless + Nylon': p,
    'Tube-Type + Nylon': p,
    'Tube-Type + Radial': p
  }
}

export function normalizeTypeQuantities(raw?: any, totalQty = 0): TyreTypeQuantities {
  if (raw && typeof raw === 'object') {
    return {
      'Tubeless + Radial': Math.max(0, Number(raw['Tubeless + Radial']) || 0),
      'Tubeless + Nylon': Math.max(0, Number(raw['Tubeless + Nylon']) || 0),
      'Tube-Type + Nylon': Math.max(0, Number(raw['Tube-Type + Nylon']) || 0),
      'Tube-Type + Radial': Math.max(0, Number(raw['Tube-Type + Radial']) || 0)
    }
  }
  return {
    'Tubeless + Radial': Math.max(0, totalQty || 0),
    'Tubeless + Nylon': 0,
    'Tube-Type + Nylon': 0,
    'Tube-Type + Radial': 0
  }
}

export function normalizeTypePrices(raw?: any, fallbackPrice = 0): TyreTypePrices {
  const fb = Math.max(0, Number(fallbackPrice) || 0)
  if (raw && typeof raw === 'object') {
    return {
      'Tubeless + Radial': Math.max(0, Number(raw['Tubeless + Radial'] ?? fb) || 0),
      'Tubeless + Nylon': Math.max(0, Number(raw['Tubeless + Nylon'] ?? fb) || 0),
      'Tube-Type + Nylon': Math.max(0, Number(raw['Tube-Type + Nylon'] ?? fb) || 0),
      'Tube-Type + Radial': Math.max(0, Number(raw['Tube-Type + Radial'] ?? fb) || 0)
    }
  }
  return defaultTypePrices(fb)
}

export function sumTypeQuantities(tq?: TyreTypeQuantities): number {
  if (!tq) return 0
  return (
    (Number(tq['Tubeless + Radial']) || 0) +
    (Number(tq['Tubeless + Nylon']) || 0) +
    (Number(tq['Tube-Type + Nylon']) || 0) +
    (Number(tq['Tube-Type + Radial']) || 0)
  )
}

export function computeTypeValuation(
  tq?: TyreTypeQuantities,
  tp?: TyreTypePrices,
  fallbackPrice = 0
): number {
  if (!tq) return 0
  return TYRE_TYPES.reduce((sum, type) => {
    const q = Math.max(0, Number(tq[type]) || 0)
    const p = Math.max(0, Number(tp?.[type] ?? fallbackPrice) || 0)
    return sum + q * p
  }, 0)
}

export function computeWeightedPurchasePrice(
  tq?: TyreTypeQuantities,
  tp?: TyreTypePrices,
  fallbackPrice = 0
): number {
  const totalQty = sumTypeQuantities(tq)
  if (totalQty > 0) {
    return Math.round(computeTypeValuation(tq, tp, fallbackPrice) / totalQty)
  }
  if (tp) {
    const nonZero = TYRE_TYPES.map((t) => Number(tp[t]) || 0).filter((p) => p > 0)
    if (nonZero.length > 0) {
      return Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length)
    }
  }
  return Math.max(0, Number(fallbackPrice) || 0)
}

export function deductTypeQuantities(current: TyreTypeQuantities, qtyToDeduct: number): TyreTypeQuantities {
  let remaining = qtyToDeduct
  const updated: TyreTypeQuantities = { ...current }
  const keys: (keyof TyreTypeQuantities)[] = [
    'Tubeless + Radial',
    'Tubeless + Nylon',
    'Tube-Type + Nylon',
    'Tube-Type + Radial'
  ]

  for (const k of keys) {
    if (remaining <= 0) break
    const available = updated[k] || 0
    if (available > 0) {
      const take = Math.min(available, remaining)
      updated[k] = Math.max(0, available - take)
      remaining -= take
    }
  }

  return updated
}

export interface StockItem {
  id: string
  brand: string
  model: string
  size: string
  qty: number
  typeQuantities?: TyreTypeQuantities
  typePrices?: TyreTypePrices
  tyreType?: TyreType | string
  purchasePrice: number
  sellingPrice?: number
  status: StockStatus
  minStockLevel?: number
  lastUpdated: string
  createdAt?: any
}

const STOCK_COLLECTION = 'stock'

export function computeStatus(qty: number, minStockLevel = 2): StockStatus {
  if (qty <= 0) return 'Sold'
  if (qty <= minStockLevel) return 'Low stock'
  return 'In stock'
}

export function subscribeToStock(
  onData: (items: StockItem[]) => void,
  onError?: (err: Error) => void
) {
  const stockRef = collection(db, STOCK_COLLECTION)
  const q = query(stockRef, orderBy('brand', 'asc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const items: StockItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        const rawQty = Number(data.qty) || 0
        const rawPurchasePrice = Number(data.purchasePrice) || 0
        const typeQuantities = normalizeTypeQuantities(data.typeQuantities, rawQty)
        const typePrices = normalizeTypePrices(data.typePrices, rawPurchasePrice)
        const computedQty = sumTypeQuantities(typeQuantities)
        const qty = computedQty > 0 || rawQty === 0 ? computedQty : rawQty
        const purchasePrice = data.typePrices
          ? computeWeightedPurchasePrice(typeQuantities, typePrices, rawPurchasePrice)
          : rawPurchasePrice
        const minStockLevel = Number(data.minStockLevel) || 2
        return {
          id: docSnap.id,
          brand: data.brand || '',
          model: data.model || '',
          size: data.size || '',
          typeQuantities,
          typePrices,
          qty,
          purchasePrice,
          sellingPrice: Number(data.sellingPrice) || 0,
          status: data.status || computeStatus(qty, minStockLevel),
          minStockLevel,
          lastUpdated: data.lastUpdated || 'Today',
          createdAt: data.createdAt
        }
      })
      onData(items)
    },
    (err) => {
      console.error('Error listening to stock:', err)
      if (onError) onError(err)
    }
  )
}

export async function addStockItem(item: Omit<StockItem, 'id' | 'status'> & { minStockLevel?: number }) {
  const minStock = item.minStockLevel ?? 2
  const normalizedTypes = item.typeQuantities ? normalizeTypeQuantities(item.typeQuantities) : normalizeTypeQuantities(undefined, item.qty)
  const normalizedPrices = item.typePrices ? normalizeTypePrices(item.typePrices, item.purchasePrice) : defaultTypePrices(item.purchasePrice)
  const computedQty = sumTypeQuantities(normalizedTypes)
  const qty = computedQty > 0 ? computedQty : Math.max(0, Number(item.qty) || 0)
  const purchasePrice = computeWeightedPurchasePrice(normalizedTypes, normalizedPrices, item.purchasePrice)
  const status = computeStatus(qty, minStock)
  const now = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date())

  const stockRef = collection(db, STOCK_COLLECTION)
  const docPayload: Record<string, any> = {
    brand: item.brand.trim(),
    model: item.model.trim(),
    size: item.size.trim(),
    qty,
    typeQuantities: normalizedTypes,
    typePrices: normalizedPrices,
    purchasePrice,
    minStockLevel: minStock,
    status,
    lastUpdated: now,
    createdAt: serverTimestamp()
  }
  if (item.sellingPrice !== undefined) {
    docPayload.sellingPrice = Number(item.sellingPrice)
  }
  const docRef = await addDoc(stockRef, docPayload)

  return docRef.id
}

export async function updateStockItem(id: string, updates: Partial<StockItem>) {
  const docRef = doc(db, STOCK_COLLECTION, id)
  const updatePayload: Record<string, any> = { ...updates }

  if ('typeQuantities' in updates && updates.typeQuantities) {
    const computedQty = sumTypeQuantities(updates.typeQuantities)
    updatePayload.qty = computedQty
    const minStock = updates.minStockLevel ?? 2
    updatePayload.status = computeStatus(computedQty, minStock)
  } else if ('qty' in updates) {
    const minStock = updates.minStockLevel ?? 2
    updatePayload.status = computeStatus(Number(updates.qty), minStock)
  }

  if ('typePrices' in updates && updates.typePrices) {
    const tq = updates.typeQuantities
    updatePayload.purchasePrice = computeWeightedPurchasePrice(tq, updates.typePrices, updates.purchasePrice || 0)
  }

  updatePayload.lastUpdated = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date())

  await updateDoc(docRef, updatePayload)
}

export async function markStockAsSold(id: string) {
  const docRef = doc(db, STOCK_COLLECTION, id)
  await updateDoc(docRef, {
    qty: 0,
    typeQuantities: defaultTypeQuantities(),
    status: 'Sold',
    lastUpdated: 'Just now'
  })
}

export async function deleteStockItem(id: string) {
  const docRef = doc(db, STOCK_COLLECTION, id)
  await deleteDoc(docRef)
}

const defaultInitialStock = [
  { brand: 'MRF', model: 'Zapper', size: '90/90-12', qty: 5, typeQuantities: { 'Tubeless + Radial': 2, 'Tubeless + Nylon': 3, 'Tube-Type + Nylon': 0, 'Tube-Type + Radial': 0 }, purchasePrice: 1200, sellingPrice: 1500, minStockLevel: 2 },
  { brand: 'Apollo', model: 'Alnac', size: '195/55 R16', qty: 6, typeQuantities: { 'Tubeless + Radial': 4, 'Tubeless + Nylon': 2, 'Tube-Type + Nylon': 0, 'Tube-Type + Radial': 0 }, purchasePrice: 4500, sellingPrice: 5200, minStockLevel: 2 },
  { brand: 'CEAT', model: 'SecuraDrive', size: '205/60 R16', qty: 14, typeQuantities: { 'Tubeless + Radial': 8, 'Tubeless + Nylon': 4, 'Tube-Type + Nylon': 2, 'Tube-Type + Radial': 0 }, purchasePrice: 5100, sellingPrice: 5800, minStockLevel: 3 },
  { brand: 'Michelin', model: 'Pilot Sport 4', size: '225/45 R17', qty: 8, typeQuantities: { 'Tubeless + Radial': 6, 'Tubeless + Nylon': 0, 'Tube-Type + Nylon': 0, 'Tube-Type + Radial': 2 }, purchasePrice: 9500, sellingPrice: 11000, minStockLevel: 2 },
  { brand: 'Bridgestone', model: 'Turanza', size: '185/65 R15', qty: 24, typeQuantities: { 'Tubeless + Radial': 14, 'Tubeless + Nylon': 10, 'Tube-Type + Nylon': 0, 'Tube-Type + Radial': 0 }, purchasePrice: 4200, sellingPrice: 4800, minStockLevel: 4 },
  { brand: 'JK Tyre', model: 'UX Royale', size: '175/65 R14', qty: 10, typeQuantities: { 'Tubeless + Radial': 4, 'Tubeless + Nylon': 0, 'Tube-Type + Nylon': 4, 'Tube-Type + Radial': 2 }, purchasePrice: 3100, sellingPrice: 3600, minStockLevel: 3 },
]

export async function seedInitialStockIfEmpty() {
  const stockRef = collection(db, STOCK_COLLECTION)
  const snapshot = await getDocs(stockRef)

  if (snapshot.empty) {
    const batch = writeBatch(db)
    for (const item of defaultInitialStock) {
      const newDocRef = doc(stockRef)
      batch.set(newDocRef, {
        brand: item.brand,
        model: item.model,
        size: item.size,
        qty: item.qty,
        typeQuantities: item.typeQuantities,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        minStockLevel: item.minStockLevel,
        status: computeStatus(item.qty, item.minStockLevel),
        lastUpdated: 'Initial setup',
        createdAt: serverTimestamp()
      })
    }
    await batch.commit()
    return true
  }
  return false
}
