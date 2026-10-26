import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  runTransaction
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { computeStatus } from './stockService'

export interface SaleItemDetail {
  stockId?: string
  brand: string
  model: string
  size: string
  qty: number
  price: number
  purchasePrice?: number
}

export interface SaleRecord {
  id: string
  invoiceNumber: string
  customerName: string
  customerPhone: string
  date: string
  items: SaleItemDetail[]
  totalAmount: number
  paymentMethod?: string
  createdAt?: any
}

const SALES_COLLECTION = 'sales'
const STOCK_COLLECTION = 'stock'

export function subscribeToSales(
  onData: (sales: SaleRecord[]) => void,
  onError?: (err: Error) => void
) {
  const salesRef = collection(db, SALES_COLLECTION)
  const q = query(salesRef, orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const sales: SaleRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          invoiceNumber: data.invoiceNumber || docSnap.id.slice(0, 6).toUpperCase(),
          customerName: data.customerName || '',
          customerPhone: data.customerPhone || '',
          date: data.date || '',
          items: data.items || [],
          totalAmount: Number(data.totalAmount) || 0,
          paymentMethod: data.paymentMethod || 'Cash',
          createdAt: data.createdAt
        }
      })
      onData(sales)
    },
    (err) => {
      console.error('Error listening to sales:', err)
      if (onError) onError(err)
    }
  )
}

export async function createSale(params: {
  customerName: string
  customerPhone: string
  date: string
  items: SaleItemDetail[]
  paymentMethod?: string
}): Promise<SaleRecord> {
  const totalAmount = params.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`

  // Use a Firestore transaction to update stock counts safely
  await runTransaction(db, async (transaction) => {
    // 1. Check and decrement stock for each item if stockId is provided
    for (const item of params.items) {
      if (item.stockId) {
        const stockDocRef = doc(db, STOCK_COLLECTION, item.stockId)
        const stockSnap = await transaction.get(stockDocRef)

        if (stockSnap.exists()) {
          const currentData = stockSnap.data()
          const currentQty = Number(currentData.qty) || 0
          const minStock = Number(currentData.minStockLevel) || 2
          const newQty = Math.max(0, currentQty - item.qty)
          const newStatus = computeStatus(newQty, minStock)

          transaction.update(stockDocRef, {
            qty: newQty,
            status: newStatus,
            lastUpdated: new Intl.DateTimeFormat('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date())
          })
        }
      }
    }

    // 2. Add the sale record
    const salesRef = collection(db, SALES_COLLECTION)
    const newSaleDocRef = doc(salesRef)
    transaction.set(newSaleDocRef, {
      invoiceNumber,
      customerName: params.customerName.trim(),
      customerPhone: params.customerPhone.trim(),
      date: params.date,
      items: params.items,
      totalAmount,
      paymentMethod: params.paymentMethod || 'Cash',
      createdAt: serverTimestamp()
    })
  })

  return {
    id: invoiceNumber,
    invoiceNumber,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    date: params.date,
    items: params.items,
    totalAmount,
    paymentMethod: params.paymentMethod || 'Cash'
  }
}

export async function deleteSale(id: string) {
  const docRef = doc(db, SALES_COLLECTION, id)
  await deleteDoc(docRef)
}

export async function seedInitialSalesIfEmpty() {
  const salesRef = collection(db, SALES_COLLECTION)
  const snapshot = await getDocs(salesRef)

  if (snapshot.empty) {
    const today = new Intl.DateTimeFormat('en-CA').format(new Date())
    await addDoc(salesRef, {
      invoiceNumber: 'INV-1001',
      customerName: 'Rahul Verma',
      customerPhone: '9876543210',
      date: today,
      items: [
        { brand: 'Apollo', model: 'Alnac', size: '195/55 R16', qty: 2, price: 5200, purchasePrice: 4500 }
      ],
      totalAmount: 10400,
      paymentMethod: 'UPI',
      createdAt: serverTimestamp()
    })
    return true
  }
  return false
}
