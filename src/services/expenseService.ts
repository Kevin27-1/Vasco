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
  getDocs
} from 'firebase/firestore'
import { db } from '../lib/firebase'

export type ExpenseFrequency = 'daily' | 'monthly' | 'yearly' | 'one-time'

export interface ExpenseRecord {
  id: string
  title: string
  category: string
  frequency: ExpenseFrequency
  amount: number
  date: string // YYYY-MM-DD
  paymentMethod: string // 'Cash' | 'UPI' | 'Bank Transfer' | 'Card' | 'Cheque'
  notes?: string
  receiptNumber?: string
  createdAt?: any
}

const EXPENSES_COLLECTION = 'expenses'

export const EXPENSE_CATEGORIES = [
  'Rent & Utilities',
  'Salaries & Wages',
  'Equipment & Tools',
  'Maintenance & Repairs',
  'Supplies & Refreshments',
  'Taxes & Licenses',
  'Marketing & Signage',
  'Logistics & Fuel',
  'Miscellaneous'
] as const

export const FREQUENCY_LABELS: Record<ExpenseFrequency, { label: string; desc: string; color: string; badgeBg: string }> = {
  daily: {
    label: 'Daily',
    desc: 'Daily recurring expenses (tea, helper wages, fuel)',
    color: '#38bdf8', // sky-400
    badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/30'
  },
  monthly: {
    label: 'Monthly',
    desc: 'Monthly bills (rent, electricity, staff salary)',
    color: '#818cf8', // indigo-400
    badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
  },
  yearly: {
    label: 'Yearly',
    desc: 'Annual commitments (licenses, insurance, taxes)',
    color: '#fbbf24', // amber-400
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  },
  'one-time': {
    label: 'One-Time',
    desc: 'Ad-hoc or capex (repairs, new machinery, signage)',
    color: '#34d399', // emerald-400
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  }
}

export function subscribeToExpenses(
  onData: (expenses: ExpenseRecord[]) => void,
  onError?: (err: Error) => void
) {
  const expensesRef = collection(db, EXPENSES_COLLECTION)
  const q = query(expensesRef, orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const expenses: ExpenseRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          title: data.title || 'Untitled Expense',
          category: data.category || 'Miscellaneous',
          frequency: (data.frequency as ExpenseFrequency) || 'one-time',
          amount: Number(data.amount) || 0,
          date: data.date || '',
          paymentMethod: data.paymentMethod || 'Cash',
          notes: data.notes || '',
          receiptNumber: data.receiptNumber || '',
          createdAt: data.createdAt
        }
      })
      onData(expenses)
    },
    (err) => {
      console.error('Error listening to expenses:', err)
      if (onError) onError(err)
    }
  )
}

export async function createExpense(params: {
  title: string
  category: string
  frequency: ExpenseFrequency
  amount: number
  date: string
  paymentMethod: string
  notes?: string
  receiptNumber?: string
}): Promise<ExpenseRecord> {
  const expensesRef = collection(db, EXPENSES_COLLECTION)
  const docRef = await addDoc(expensesRef, {
    title: params.title.trim(),
    category: params.category.trim(),
    frequency: params.frequency,
    amount: Number(params.amount) || 0,
    date: params.date,
    paymentMethod: params.paymentMethod || 'Cash',
    notes: (params.notes || '').trim(),
    receiptNumber: (params.receiptNumber || '').trim(),
    createdAt: serverTimestamp()
  })

  return {
    id: docRef.id,
    ...params,
    amount: Number(params.amount) || 0
  }
}

export async function updateExpense(
  id: string,
  params: Partial<Omit<ExpenseRecord, 'id' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, EXPENSES_COLLECTION, id)
  const updateData: any = { ...params }
  if (updateData.amount !== undefined) {
    updateData.amount = Number(updateData.amount) || 0
  }
  await updateDoc(docRef, updateData)
}

export async function deleteExpense(id: string): Promise<void> {
  const docRef = doc(db, EXPENSES_COLLECTION, id)
  await deleteDoc(docRef)
}

export async function seedInitialExpensesIfEmpty(): Promise<void> {
  const expensesRef = collection(db, EXPENSES_COLLECTION)
  const snapshot = await getDocs(expensesRef)

  if (!snapshot.empty) {
    return // Already seeded
  }

  const initialExpenses: Array<Omit<ExpenseRecord, 'id' | 'createdAt'>> = [
    {
      title: 'Workshop Daily Tea & Refreshments',
      category: 'Supplies & Refreshments',
      frequency: 'daily',
      amount: 250,
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      paymentMethod: 'Cash',
      notes: 'Morning and evening tea/snacks for mechanic team'
    },
    {
      title: 'Shop Daily Cleaning & Scrap Disposal',
      category: 'Maintenance & Repairs',
      frequency: 'daily',
      amount: 300,
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      paymentMethod: 'Cash',
      notes: 'Disposal of discarded tyre debris & floor degreasing'
    },
    {
      title: 'Shop Commercial Rent',
      category: 'Rent & Utilities',
      frequency: 'monthly',
      amount: 32000,
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      paymentMethod: 'Bank Transfer',
      receiptNumber: 'RENT-2026-03',
      notes: 'Monthly workshop and showroom lease payment'
    },
    {
      title: 'Commercial Electricity & Power Bill',
      category: 'Rent & Utilities',
      frequency: 'monthly',
      amount: 6800,
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      paymentMethod: 'UPI',
      receiptNumber: 'EB-64720',
      notes: 'High-voltage compressor & balancing machine power consumption'
    },
    {
      title: 'Tyre Fitters & Helper Monthly Wages',
      category: 'Salaries & Wages',
      frequency: 'monthly',
      amount: 42000,
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      paymentMethod: 'Bank Transfer',
      notes: 'Salaries for 2 lead tyre fitters and 1 alignment technician'
    },
    {
      title: 'Shop Trade License Renewal',
      category: 'Taxes & Licenses',
      frequency: 'yearly',
      amount: 12500,
      date: '2026-01-15',
      paymentMethod: 'Bank Transfer',
      receiptNumber: 'TL-2026-881',
      notes: 'Municipal trade license and pollution board certificate'
    },
    {
      title: 'Commercial Stock & Equipment Insurance',
      category: 'Taxes & Licenses',
      frequency: 'yearly',
      amount: 19800,
      date: '2026-02-01',
      paymentMethod: 'Bank Transfer',
      receiptNumber: 'INS-TYRE-9901',
      notes: 'Comprehensive fire, theft & storm coverage for tyre warehouse'
    },
    {
      title: 'Pneumatic Air Impact Wrench Set',
      category: 'Equipment & Tools',
      frequency: 'one-time',
      amount: 8500,
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      paymentMethod: 'UPI',
      receiptNumber: 'TOOL-5541',
      notes: 'Heavy-duty 1/2-inch composite impact wrench with socket kit'
    },
    {
      title: 'Front Façade LED Signage Board',
      category: 'Marketing & Signage',
      frequency: 'one-time',
      amount: 24000,
      date: '2026-02-20',
      paymentMethod: 'UPI',
      receiptNumber: 'SIGN-441',
      notes: '3D acrylic backlit signage with Vasco Treads branding'
    }
  ]

  for (const exp of initialExpenses) {
    await addDoc(expensesRef, {
      ...exp,
      createdAt: serverTimestamp()
    })
  }
}
