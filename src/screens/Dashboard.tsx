import { useState, useEffect, useMemo } from 'react'
import { 
  XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, RefreshCw, PackageCheck } from 'lucide-react'
import { cn } from '../lib/utils'
import { subscribeToSales, type SaleRecord } from '../services/salesService'
import { subscribeToStock, type StockItem } from '../services/stockService'
import { subscribeToExpenses, type ExpenseRecord } from '../services/expenseService'
import ChartAreaInteractive, { type ChartTimeRange } from '../components/ChartAreaInteractive'

const COLORS = ['#e63946', '#457b9d', '#1d3557', '#a8dadc', '#e76f51', '#2a9d8f']

export type TimeRange = ChartTimeRange

// Helper to extract a normalized 'YYYY-MM-DD' string from a sale record
function getSaleDateString(sale: SaleRecord): string {
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

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('daily')
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Track today's date string so daily counts automatically roll over at midnight
  const [todayDateStr, setTodayDateStr] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date()
      const current = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      setTodayDateStr((prev) => (prev !== current ? current : prev))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Real-time Firestore subscriptions
  useEffect(() => {
    let isMounted = true

    const unsubSales = subscribeToSales((records) => {
      if (!isMounted) return
      setSales(records)
      setLoading(false)
    })

    const unsubStock = subscribeToStock((items) => {
      if (!isMounted) return
      setStock(items)
      setLoading(false)
    })

    const unsubExpenses = subscribeToExpenses((expenseItems) => {
      if (!isMounted) return
      setExpenses(expenseItems)
    })

    return () => {
      isMounted = false
      unsubSales()
      unsubStock()
      unsubExpenses()
    }
  }, [])

  // Calculate dynamic metrics filtered by time range (Daily, Monthly, Yearly, All-Time)
  const { currentMetrics, prevMetrics } = useMemo(() => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const currentYear = `${now.getFullYear()}`

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevYearMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`

    const prevYear = `${now.getFullYear() - 1}`

    let currentSales: SaleRecord[] = []
    let prevSales: SaleRecord[] = []

    if (timeRange === 'daily') {
      currentSales = sales.filter((s) => getSaleDateString(s) === todayStr)
      prevSales = sales.filter((s) => getSaleDateString(s) === yesterdayStr)
    } else if (timeRange === 'monthly') {
      currentSales = sales.filter((s) => getSaleDateString(s).startsWith(currentYearMonth))
      prevSales = sales.filter((s) => getSaleDateString(s).startsWith(prevYearMonth))
    } else if (timeRange === 'yearly') {
      currentSales = sales.filter((s) => getSaleDateString(s).startsWith(currentYear))
      prevSales = sales.filter((s) => getSaleDateString(s).startsWith(prevYear))
    } else {
      // all-time
      currentSales = sales
      prevSales = []
    }

    const calcStats = (salesList: SaleRecord[]) => {
      const totalSalesAmount = salesList.reduce((acc, s) => acc + (s.totalAmount || 0), 0)
      let totalCost = 0
      let totalUnitsSold = 0

      salesList.forEach((sale) => {
        sale.items.forEach((item) => {
          totalUnitsSold += item.qty || 1
          const matchingStock = stock.find(
            (st) => st.brand === item.brand && st.model === item.model
          )
          const costPrice =
            item.purchasePrice || matchingStock?.purchasePrice || item.price * 0.8
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

    const currentStats = calcStats(currentSales)
    const prevStats = calcStats(prevSales)

    const totalInventoryCount = stock.reduce((acc, item) => acc + item.qty, 0)
    const inventoryValuation = stock.reduce(
      (acc, item) => acc + item.purchasePrice * item.qty,
      0
    )
    const attentionNeededItems = stock.filter(
      (item) => item.qty <= (item.minStockLevel || 2)
    )

    return {
      currentMetrics: {
        ...currentStats,
        totalInventoryCount,
        inventoryValuation,
        attentionNeededItems,
      },
      prevMetrics: prevStats,
    }
  }, [sales, stock, timeRange, todayDateStr])

  // Calculated percentage trends against previous period
  const profitTrend = useMemo(() => {
    if (timeRange === 'all') return null
    if (prevMetrics.netProfit === 0) {
      return currentMetrics.netProfit > 0 ? 100 : 0
    }
    return Math.round(((currentMetrics.netProfit - prevMetrics.netProfit) / prevMetrics.netProfit) * 1000) / 10
  }, [currentMetrics.netProfit, prevMetrics.netProfit, timeRange])

  const revenueTrend = useMemo(() => {
    if (timeRange === 'all') return null
    if (prevMetrics.totalSalesAmount === 0) {
      return currentMetrics.totalSalesAmount > 0 ? 100 : 0
    }
    return Math.round(((currentMetrics.totalSalesAmount - prevMetrics.totalSalesAmount) / prevMetrics.totalSalesAmount) * 1000) / 10
  }, [currentMetrics.totalSalesAmount, prevMetrics.totalSalesAmount, timeRange])

  const invoicesTrend = useMemo(() => {
    if (timeRange === 'all') return null
    if (prevMetrics.totalTransactions === 0) {
      return currentMetrics.totalTransactions > 0 ? 100 : 0
    }
    return Math.round(((currentMetrics.totalTransactions - prevMetrics.totalTransactions) / prevMetrics.totalTransactions) * 1000) / 10
  }, [currentMetrics.totalTransactions, prevMetrics.totalTransactions, timeRange])

  // Expense breakdown calculated from inventory investment & real expenses
  const expenseData = useMemo(() => {
    const inventoryExp = currentMetrics.inventoryValuation > 0 ? currentMetrics.inventoryValuation : 34000

    if (expenses.length > 0) {
      const catMap: Record<string, number> = {}
      expenses.forEach((e) => {
        catMap[e.category] = (catMap[e.category] || 0) + e.amount
      })
      const topCategories = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, value]) => ({
          name: name.length > 14 ? name.slice(0, 12) + '..' : name,
          value
        }))

      return [
        { name: 'Tyre Stock', value: inventoryExp },
        ...topCategories
      ]
    }

    return [
      { name: 'Tyre Stock', value: inventoryExp },
      { name: 'Shop Wages', value: 12000 },
      { name: 'Utilities/Rent', value: 8500 },
      { name: 'Equipment', value: 4200 },
    ]
  }, [currentMetrics.inventoryValuation, expenses])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard Overview</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Firebase
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {timeRange === 'daily'
              ? `Today's shop performance (${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}) • Resets daily`
              : timeRange === 'monthly'
              ? `This month's financial summary (${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })})`
              : timeRange === 'yearly'
              ? `Annual shop summary (${new Date().getFullYear()})`
              : 'All-time cumulative business performance'}
          </p>
        </div>
        
        {/* Time Range Switcher */}
        <div className="flex items-center bg-card p-1 rounded-xl border border-border w-full sm:w-auto justify-between sm:justify-start">
          {([
            { id: 'daily', label: 'Daily (Today)' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'yearly', label: 'Yearly' },
            { id: 'all', label: 'All-Time' },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTimeRange(id)}
              className={cn(
                "flex-1 sm:flex-none px-2.5 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors text-center",
                timeRange === id 
                  ? "bg-accent text-white shadow-sm" 
                  : "text-text-muted hover:text-text-main"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
          <span>Syncing with Cloud Firestore...</span>
        </div>
      )}

      {/* Stat Cards - 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard 
          title="Net Profit" 
          value={`₹${currentMetrics.netProfit.toLocaleString('en-IN')}`} 
          trend={profitTrend} 
          range={timeRange} 
        />
        <StatCard 
          title="Gross Revenue" 
          value={`₹${currentMetrics.totalSalesAmount.toLocaleString('en-IN')}`} 
          trend={revenueTrend} 
          range={timeRange} 
        />
        <StatCard 
          title="Invoices Issued" 
          value={`${currentMetrics.totalTransactions} ${currentMetrics.totalTransactions === 1 ? 'bill' : 'bills'}`} 
          subValue={`${currentMetrics.totalUnitsSold} tyres sold`}
          trend={invoicesTrend} 
          range={timeRange} 
        />
        <StatCard 
          title="Tyres In Stock" 
          value={`${currentMetrics.totalInventoryCount} units`} 
          subValue={`Valuation ₹${currentMetrics.inventoryValuation.toLocaleString('en-IN')}`}
          trend={currentMetrics.attentionNeededItems.length > 0 ? -currentMetrics.attentionNeededItems.length : null} 
          range={timeRange}
          isInventoryCard={true}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2">
          <ChartAreaInteractive 
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            sales={sales}
            expenses={expenses}
            stock={stock}
          />
        </div>

        <div className="space-y-6">
          {/* Expenses Breakdown */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Expenses & Investment</h2>
            <p className="text-xs text-text-muted mb-4">Stock valuation & operating overhead</p>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseData} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={90} stroke="#9ca3af" tick={{fill: '#9ca3af', fontSize: 11}} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    cursor={{fill: '#242424'}}
                    contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#2e2e2e', borderRadius: '8px' }}
                    labelStyle={{ color: '#ffffff', fontWeight: 600, marginBottom: '2px' }}
                    itemStyle={{ color: '#ef4444', fontWeight: 600 }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {expenseData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-semibold text-white">Stock Alerts</h2>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
                {currentMetrics.attentionNeededItems.length} items
              </span>
            </div>

            <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
              {currentMetrics.attentionNeededItems.length > 0 ? (
                currentMetrics.attentionNeededItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center bg-background rounded-xl p-3 border border-border">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.brand} {item.model}</p>
                      <p className="text-xs text-text-muted font-mono">{item.size}</p>
                    </div>
                    <span className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-md",
                      item.qty === 0 ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                    )}>
                      {item.qty === 0 ? 'Out of Stock' : `${item.qty} Left`}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 p-3 bg-background rounded-xl border border-border text-xs text-emerald-400">
                  <PackageCheck className="w-4 h-4 text-emerald-400" />
                  <span>All tyre inventory levels are healthy!</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function StatCard({ 
  title, 
  value, 
  subValue, 
  trend, 
  range,
  isInventoryCard = false
}: { 
  title: string
  value: string
  subValue?: string
  trend?: number | null
  range: string 
  isInventoryCard?: boolean
}) {
  const isPositive = trend !== null && trend !== undefined ? trend >= 0 : true

  const getComparisonLabel = () => {
    if (isInventoryCard) {
      return 'real-time warehouse stock'
    }
    switch (range) {
      case 'daily':
        return 'vs. yesterday'
      case 'monthly':
        return 'vs. prev month'
      case 'yearly':
        return 'vs. prev year'
      case 'all':
      default:
        return 'all-time lifetime total'
    }
  }
  
  return (
    <div className="bg-card p-3.5 sm:p-5 rounded-2xl border border-border hover:border-[#3a3a3a] transition-colors flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-1.5">
          <p className="text-text-muted text-[11px] sm:text-xs font-semibold uppercase tracking-wider truncate mr-1">{title}</p>
          {isInventoryCard ? (
            <div className={cn(
              "flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-md shrink-0",
              (trend ?? 0) < 0 ? "text-accent bg-accent/10" : "text-emerald-400 bg-emerald-400/10"
            )}>
              {(trend ?? 0) < 0 ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-accent" />
                  <span>{Math.abs(trend!)} low</span>
                </>
              ) : (
                <>
                  <PackageCheck className="w-3 h-3 text-emerald-400" />
                  <span>Healthy</span>
                </>
              )}
            </div>
          ) : trend !== null && trend !== undefined ? (
            <div className={cn(
              "flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-md shrink-0",
              isPositive ? "text-emerald-400 bg-emerald-400/10" : "text-accent bg-accent/10"
            )}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend > 0 ? `+${trend}%` : `${trend}%`}
            </div>
          ) : (
            <span className="text-[10px] sm:text-xs text-text-muted px-1.5 py-0.5 rounded-md bg-white/5 font-medium">
              All Time
            </span>
          )}
        </div>
        <h3 className="text-lg sm:text-2xl font-bold text-white tracking-tight">{value}</h3>
        {subValue && (
          <p className="text-[11px] sm:text-xs text-emerald-400/80 font-medium mt-0.5 truncate">{subValue}</p>
        )}
      </div>
      <p className="text-[10px] sm:text-xs text-text-muted mt-2 capitalize">
        {getComparisonLabel()}
      </p>
    </div>
  )
}
