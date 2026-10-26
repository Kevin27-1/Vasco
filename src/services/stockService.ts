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

export interface StockItem {
  id: string
  brand: string
  model: string
  size: string
  qty: number
  purchasePrice: number
  sellingPrice: number
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
        const qty = Number(data.qty) || 0
        const minStockLevel = Number(data.minStockLevel) || 2
        return {
          id: docSnap.id,
          brand: data.brand || '',
          model: data.model || '',
          size: data.size || '',
          qty,
          purchasePrice: Number(data.purchasePrice) || 0,
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
  const status = computeStatus(item.qty, minStock)
  const now = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date())

  const stockRef = collection(db, STOCK_COLLECTION)
  const docRef = await addDoc(stockRef, {
    brand: item.brand.trim(),
    model: item.model.trim(),
    size: item.size.trim(),
    qty: Number(item.qty),
    purchasePrice: Number(item.purchasePrice),
    sellingPrice: Number(item.sellingPrice),
    minStockLevel: minStock,
    status,
    lastUpdated: now,
    createdAt: serverTimestamp()
  })

  return docRef.id
}

export async function updateStockItem(id: string, updates: Partial<StockItem>) {
  const docRef = doc(db, STOCK_COLLECTION, id)
  const updatePayload: Record<string, any> = { ...updates }

  if ('qty' in updates) {
    const minStock = updates.minStockLevel ?? 2
    updatePayload.status = computeStatus(Number(updates.qty), minStock)
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
    status: 'Sold',
    lastUpdated: 'Just now'
  })
}

export async function deleteStockItem(id: string) {
  const docRef = doc(db, STOCK_COLLECTION, id)
  await deleteDoc(docRef)
}

const defaultInitialStock = [
  { brand: 'MRF', model: 'Zapper', size: '90/90-12', qty: 4, purchasePrice: 1200, sellingPrice: 1500, minStockLevel: 2 },
  { brand: 'Apollo', model: 'Alnac', size: '195/55 R16', qty: 6, purchasePrice: 4500, sellingPrice: 5200, minStockLevel: 2 },
  { brand: 'CEAT', model: 'SecuraDrive', size: '205/60 R16', qty: 14, purchasePrice: 5100, sellingPrice: 5800, minStockLevel: 3 },
  { brand: 'Michelin', model: 'Pilot Sport 4', size: '225/45 R17', qty: 8, purchasePrice: 9500, sellingPrice: 11000, minStockLevel: 2 },
  { brand: 'Bridgestone', model: 'Turanza', size: '185/65 R15', qty: 24, purchasePrice: 4200, sellingPrice: 4800, minStockLevel: 4 },
  { brand: 'JK Tyre', model: 'UX Royale', size: '175/65 R14', qty: 10, purchasePrice: 3100, sellingPrice: 3600, minStockLevel: 3 },
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
