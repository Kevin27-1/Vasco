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

export interface CreditPaymentRecord {
  date: string
  amount: number
  paymentMethod?: string
  notes?: string
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
  // Credit sales fields
  isCreditSale?: boolean
  interestType?: 'percentage' | 'fixed'
  interestRate?: number // e.g. 5%
  interestAmount?: number // in ₹
  amountPaidNow?: number // Down payment paid at purchase
  remainingDue?: number // Balance due
  dueDate?: string // YYYY-MM-DD
  creditStatus?: 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue'
  paymentHistory?: CreditPaymentRecord[]
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
      const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date())
      const sales: SaleRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        const totalAmount = Number(data.totalAmount) || 0
        const isCreditSale = data.paymentMethod === 'Credit' || !!data.isCreditSale
        const amountPaidNow = Number(data.amountPaidNow ?? (isCreditSale ? 0 : totalAmount)) || 0
        const remainingDue = Number(data.remainingDue ?? (isCreditSale ? Math.max(0, totalAmount - amountPaidNow) : 0))
        
        let creditStatus: 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue' | undefined = data.creditStatus
        if (isCreditSale) {
          if (remainingDue <= 0) {
            creditStatus = 'Paid'
          } else if (data.dueDate && data.dueDate < todayStr) {
            creditStatus = 'Overdue'
          } else if (amountPaidNow > 0) {
            creditStatus = 'Partially Paid'
          } else {
            creditStatus = 'Pending'
          }
        }

        return {
          id: docSnap.id,
          invoiceNumber: data.invoiceNumber || docSnap.id.slice(0, 6).toUpperCase(),
          customerName: data.customerName || '',
          customerPhone: data.customerPhone || '',
          date: data.date || '',
          items: data.items || [],
          totalAmount,
          paymentMethod: data.paymentMethod || 'Cash',
          createdAt: data.createdAt,
          isCreditSale,
          interestType: (data.interestType as 'percentage' | 'fixed') || 'percentage',
          interestRate: Number(data.interestRate) || 0,
          interestAmount: Number(data.interestAmount) || 0,
          amountPaidNow,
          remainingDue,
          dueDate: data.dueDate || '',
          creditStatus,
          paymentHistory: Array.isArray(data.paymentHistory) ? data.paymentHistory : []
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

export interface CreateSaleParams {
  customerName: string
  customerPhone: string
  date: string
  items: SaleItemDetail[]
  paymentMethod?: string
  // Credit fields
  isCreditSale?: boolean
  interestType?: 'percentage' | 'fixed'
  interestRate?: number
  interestAmount?: number
  amountPaidNow?: number
  remainingDue?: number
  dueDate?: string
  creditStatus?: 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue'
}

export async function createSale(params: CreateSaleParams): Promise<SaleRecord> {
  const itemsSubtotal = params.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  const isCredit = params.paymentMethod === 'Credit' || !!params.isCreditSale
  const interestType = params.interestType || 'percentage'
  let interestRate = 0
  let interestAmount = 0

  if (isCredit) {
    if (interestType === 'fixed') {
      interestAmount = params.interestAmount !== undefined ? Number(params.interestAmount) : 0
      interestRate = itemsSubtotal > 0 ? Number(((interestAmount / itemsSubtotal) * 100).toFixed(2)) : 0
    } else {
      interestRate = Number(params.interestRate || 0)
      interestAmount = params.interestAmount !== undefined ? Number(params.interestAmount) : Math.round((itemsSubtotal * interestRate) / 100)
    }
  }

  const totalAmount = itemsSubtotal + interestAmount
  const amountPaidNow = isCredit ? Number(params.amountPaidNow || 0) : totalAmount
  const remainingDue = isCredit ? Math.max(0, totalAmount - amountPaidNow) : 0
  const dueDate = isCredit ? (params.dueDate || '') : ''
  const creditStatus: 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue' | undefined = isCredit
    ? (remainingDue <= 0 ? 'Paid' : amountPaidNow > 0 ? 'Partially Paid' : 'Pending')
    : undefined

  const initialHistory: CreditPaymentRecord[] = isCredit && amountPaidNow > 0
    ? [{ date: params.date, amount: amountPaidNow, paymentMethod: 'Initial Down Payment', notes: 'Paid at purchase' }]
    : []

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
    const salePayload: Record<string, any> = {
      invoiceNumber,
      customerName: params.customerName.trim(),
      customerPhone: params.customerPhone.trim(),
      date: params.date,
      items: params.items,
      totalAmount,
      paymentMethod: params.paymentMethod || 'Cash',
      createdAt: serverTimestamp()
    }

    if (isCredit) {
      salePayload.isCreditSale = true
      salePayload.interestType = interestType
      salePayload.interestRate = interestRate
      salePayload.interestAmount = interestAmount
      salePayload.amountPaidNow = amountPaidNow
      salePayload.remainingDue = remainingDue
      salePayload.dueDate = dueDate
      salePayload.creditStatus = creditStatus
      salePayload.paymentHistory = initialHistory
    }

    transaction.set(newSaleDocRef, salePayload)
  })

  return {
    id: invoiceNumber,
    invoiceNumber,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    date: params.date,
    items: params.items,
    totalAmount,
    paymentMethod: params.paymentMethod || 'Cash',
    isCreditSale: isCredit,
    interestType,
    interestRate,
    interestAmount,
    amountPaidNow,
    remainingDue,
    dueDate,
    creditStatus,
    paymentHistory: initialHistory
  }
}

export async function recordCreditPayment(
  saleId: string,
  amount: number,
  paymentMethod: string = 'Cash',
  notes?: string
): Promise<void> {
  const saleDocRef = doc(db, SALES_COLLECTION, saleId)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(saleDocRef)
    if (!snap.exists()) throw new Error('Invoice record not found')
    const data = snap.data()
    const currentPaid = Number(data.amountPaidNow) || 0
    const total = Number(data.totalAmount) || 0
    const newPaid = currentPaid + amount
    const newRemaining = Math.max(0, total - newPaid)
    const newStatus = newRemaining === 0 ? 'Paid' : 'Partially Paid'
    const newHistory = Array.isArray(data.paymentHistory) ? [...data.paymentHistory] : []
    newHistory.push({
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      amount,
      paymentMethod,
      notes: notes || 'Credit Installment Payment'
    })

    transaction.update(saleDocRef, {
      amountPaidNow: newPaid,
      remainingDue: newRemaining,
      creditStatus: newStatus,
      paymentHistory: newHistory
    })
  })
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
