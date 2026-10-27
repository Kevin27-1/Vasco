import { type SaleRecord } from '../services/salesService'
import { type StockItem } from '../services/stockService'
import { type ExpenseRecord } from '../services/expenseService'

// Helper to extract a normalized 'YYYY-MM-DD' string from a sale record
export function getSaleDateString(sale: SaleRecord): string {
  if (sale.date && typeof sale.date === 'string') {
    const trimmed = sale.date.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10)
    }
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  if (sale.createdAt) {
    let d: Date | null = null
    if (typeof sale.createdAt.toDate === 'function') {
      d = sale.createdAt.toDate()
    } else if (sale.createdAt.seconds) {
      d = new Date(sale.createdAt.seconds * 1000)
    } else {
      const parsed = new Date(sale.createdAt)
      if (!isNaN(parsed.getTime())) d = parsed
    }
    if (d) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  return ''
}

// Helper to extract a normalized 'YYYY-MM-DD' string from an expense record
export function getExpenseDateString(expense: ExpenseRecord): string {
  if (expense.date && typeof expense.date === 'string') {
    const trimmed = expense.date.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10)
    }
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  if (expense.createdAt) {
    let d: Date | null = null
    if (typeof expense.createdAt.toDate === 'function') {
      d = expense.createdAt.toDate()
    } else if (expense.createdAt.seconds) {
      d = new Date(expense.createdAt.seconds * 1000)
    } else {
      const parsed = new Date(expense.createdAt)
      if (!isNaN(parsed.getTime())) d = parsed
    }
    if (d) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  return ''
}

export interface FinancialStats {
  totalSalesAmount: number
  netProfit: number
  totalUnitsSold: number
  totalTransactions: number
}

// Calculate sales stats and net profit consistently across the dashboard and charts
export function calculateSaleStats(
  salesList: SaleRecord[],
  stock: StockItem[]
): FinancialStats {
  const totalSalesAmount = salesList.reduce((acc, s) => acc + (s.totalAmount || 0), 0)
  let totalCost = 0
  let totalUnitsSold = 0

  salesList.forEach((sale) => {
    sale.items.forEach((item) => {
      totalUnitsSold += item.qty || 1
      const matchingStock = stock.find(
        (st) =>
          (item.stockId && st.id === item.stockId) ||
          (st.brand === item.brand && st.model === item.model)
      )
      const costPrice =
        item.purchasePrice || matchingStock?.purchasePrice || (item.price ? item.price * 0.8 : 0)
      totalCost += costPrice * (item.qty || 1)
    })
  })

  const netProfit = Math.max(0, totalSalesAmount - totalCost)
  return {
    totalSalesAmount,
    netProfit,
    totalUnitsSold,
    totalTransactions: salesList.length,
  }
}

// Calculate real daily expenses recorded for a specific date
export function calculateDailyExpense(
  expenses: ExpenseRecord[],
  targetDateStr: string
): number {
  return expenses
    .filter((e) => getExpenseDateString(e) === targetDateStr)
    .reduce((sum, e) => sum + (e.amount || 0), 0)
}

// Calculate real monthly expenses recorded for a specific year-month (YYYY-MM)
export function calculateMonthlyExpense(
  expenses: ExpenseRecord[],
  targetYearMonthStr: string
): number {
  return expenses
    .filter((e) => getExpenseDateString(e).startsWith(targetYearMonthStr))
    .reduce((sum, e) => sum + (e.amount || 0), 0)
}

// Calculate real yearly expenses recorded for a specific year (YYYY)
export function calculateYearlyExpense(
  expenses: ExpenseRecord[],
  targetYearStr: string
): number {
  return expenses
    .filter((e) => getExpenseDateString(e).startsWith(targetYearStr))
    .reduce((sum, e) => sum + (e.amount || 0), 0)
}

