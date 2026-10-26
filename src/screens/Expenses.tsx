import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Search,
  Receipt,
  Calendar,
  Sparkles,
  TrendingDown,
  Trash2,
  Edit2,
  X,
  Check,
  Filter,
  AlertCircle,
  Tag,
  RotateCcw,
  Sun,
  CalendarDays,
  CalendarRange,
  Zap
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip
} from 'recharts'
import {
  type ExpenseRecord,
  type ExpenseFrequency,
  EXPENSE_CATEGORIES,
  FREQUENCY_LABELS,
  subscribeToExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  seedInitialExpensesIfEmpty
} from '../services/expenseService'

const FREQUENCY_ICONS = {
  daily: Sun,
  monthly: CalendarDays,
  yearly: CalendarRange,
  'one-time': Zap
}

const FREQUENCY_COLORS: Record<ExpenseFrequency, string> = {
  daily: '#38bdf8',      // Sky
  monthly: '#818cf8',    // Indigo
  yearly: '#fbbf24',     // Amber
  'one-time': '#34d399'  // Emerald
}

const CATEGORY_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e76f51', '#f4a261',
  '#a8dadc', '#9b5de5', '#00bbf9', '#00f5d4'
]

export default function Expenses() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFrequency, setSelectedFrequency] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState<{
    title: string
    category: string
    frequency: ExpenseFrequency
    amount: string
    date: string
    paymentMethod: string
    notes: string
    receiptNumber: string
  }>({
    title: '',
    category: EXPENSE_CATEGORIES[0],
    frequency: 'daily',
    amount: '',
    date: new Intl.DateTimeFormat('en-CA').format(new Date()),
    paymentMethod: 'UPI',
    notes: '',
    receiptNumber: ''
  })

  // Subscribe to real-time Firestore updates
  useEffect(() => {
    let isMounted = true

    seedInitialExpensesIfEmpty().catch(console.warn)

    const unsubscribe = subscribeToExpenses(
      (items) => {
        if (!isMounted) return
        setExpenses(items)
        setLoading(false)
        setErrorMsg(null)
      },
      (err) => {
        console.error('Firestore Expenses Error:', err)
        if (!isMounted) return
        setErrorMsg('Failed to sync expenses with Firebase.')
        setLoading(false)
      }
    )

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  // Open Create Modal
  const handleOpenCreateModal = (defaultFrequency: ExpenseFrequency = 'daily') => {
    setEditingExpense(null)
    setFormData({
      title: '',
      category: EXPENSE_CATEGORIES[0],
      frequency: defaultFrequency,
      amount: '',
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      paymentMethod: 'UPI',
      notes: '',
      receiptNumber: ''
    })
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEditModal = (expense: ExpenseRecord) => {
    setEditingExpense(expense)
    setFormData({
      title: expense.title,
      category: expense.category,
      frequency: expense.frequency,
      amount: expense.amount.toString(),
      date: expense.date,
      paymentMethod: expense.paymentMethod,
      notes: expense.notes || '',
      receiptNumber: expense.receiptNumber || ''
    })
    setIsModalOpen(true)
  }

  // Handle Form Submission
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setErrorMsg('Please enter an expense title/description.')
      return
    }
    const parsedAmount = parseFloat(formData.amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid expense amount greater than 0.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          title: formData.title,
          category: formData.category,
          frequency: formData.frequency,
          amount: parsedAmount,
          date: formData.date,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes,
          receiptNumber: formData.receiptNumber
        })
      } else {
        await createExpense({
          title: formData.title,
          category: formData.category,
          frequency: formData.frequency,
          amount: parsedAmount,
          date: formData.date,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes,
          receiptNumber: formData.receiptNumber
        })
      }

      setIsModalOpen(false)
      setEditingExpense(null)
    } catch (err: any) {
      console.error('Failed to save expense:', err)
      setErrorMsg(err.message || 'Failed to save expense to Firebase.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Delete
  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteExpense(id)
      setDeleteConfirmId(null)
    } catch (err: any) {
      console.error('Failed to delete expense:', err)
      setErrorMsg('Failed to delete expense.')
    }
  }

  // Metrics Calculation
  const metrics = useMemo(() => {
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

    const dailyExpenses = expenses.filter((e) => e.frequency === 'daily')
    const dailyTotal = dailyExpenses.reduce((sum, e) => sum + e.amount, 0)

    const monthlyExpenses = expenses.filter((e) => e.frequency === 'monthly')
    const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0)

    const yearlyExpenses = expenses.filter((e) => e.frequency === 'yearly')
    const yearlyTotal = yearlyExpenses.reduce((sum, e) => sum + e.amount, 0)

    const oneTimeExpenses = expenses.filter((e) => e.frequency === 'one-time')
    const oneTimeTotal = oneTimeExpenses.reduce((sum, e) => sum + e.amount, 0)

    return {
      totalAmount,
      totalCount: expenses.length,
      dailyTotal,
      dailyCount: dailyExpenses.length,
      monthlyTotal,
      monthlyCount: monthlyExpenses.length,
      yearlyTotal,
      yearlyCount: yearlyExpenses.length,
      oneTimeTotal,
      oneTimeCount: oneTimeExpenses.length
    }
  }, [expenses])

  // Frequency Chart Data
  const frequencyChartData = useMemo(() => {
    return [
      { name: 'Daily', value: metrics.dailyTotal, color: FREQUENCY_COLORS.daily, count: metrics.dailyCount },
      { name: 'Monthly', value: metrics.monthlyTotal, color: FREQUENCY_COLORS.monthly, count: metrics.monthlyCount },
      { name: 'Yearly', value: metrics.yearlyTotal, color: FREQUENCY_COLORS.yearly, count: metrics.yearlyCount },
      { name: 'One-Time', value: metrics.oneTimeTotal, color: FREQUENCY_COLORS['one-time'], count: metrics.oneTimeCount }
    ].filter((item) => item.value > 0)
  }, [metrics])

  // Category Chart Data
  const categoryChartData = useMemo(() => {
    const catMap: Record<string, number> = {}
    expenses.forEach((e) => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount
    })

    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [expenses])

  // Filtered Expenses List
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.receiptNumber && item.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesFrequency =
        selectedFrequency === 'all' || item.frequency === selectedFrequency

      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory

      const matchesPayment =
        selectedPaymentMethod === 'all' || item.paymentMethod === selectedPaymentMethod

      return matchesSearch && matchesFrequency && matchesCategory && matchesPayment
    })
  }, [expenses, searchQuery, selectedFrequency, selectedCategory, selectedPaymentMethod])

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent shrink-0">
              <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Expenses Management
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Track daily operational costs, monthly overheads, yearly commitments & capex
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => handleOpenCreateModal('daily')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Create Expense</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Cards - 2 cols on mobile, 5 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
        {/* Total Expenses */}
        <div className="col-span-2 sm:col-span-1 bg-card border border-border p-3.5 sm:p-4 rounded-2xl relative overflow-hidden group hover:border-border/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-muted mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
            <div className="p-1 rounded-lg bg-white/5 text-white">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white mb-1">
            ₹{metrics.totalAmount.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>{metrics.totalCount} transactions</span>
            <span className="text-accent font-medium">All Types</span>
          </div>
        </div>

        {/* Daily Expenses */}
        {/* Daily Expenses */}
        <div 
          onClick={() => setSelectedFrequency(selectedFrequency === 'daily' ? 'all' : 'daily')}
          className={`bg-card border p-3 sm:p-4 rounded-2xl relative overflow-hidden cursor-pointer transition-all hover:border-sky-500/50 flex flex-col justify-between ${
            selectedFrequency === 'daily' ? 'border-sky-500 bg-sky-500/5' : 'border-border'
          }`}
        >
          <div className="flex items-center justify-between text-text-muted mb-1.5">
            <div className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-sky-400">Daily</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleOpenCreateModal('daily')
              }}
              title="Add Daily Expense"
              className="p-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white mb-0.5">
            ₹{metrics.dailyTotal.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>{metrics.dailyCount} entries</span>
            <span className="text-sky-400/80 text-[10px] truncate max-w-[80px]">Daily items</span>
          </div>
        </div>

        {/* Monthly Expenses */}
        <div 
          onClick={() => setSelectedFrequency(selectedFrequency === 'monthly' ? 'all' : 'monthly')}
          className={`bg-card border p-3 sm:p-4 rounded-2xl relative overflow-hidden cursor-pointer transition-all hover:border-indigo-500/50 flex flex-col justify-between ${
            selectedFrequency === 'monthly' ? 'border-indigo-500 bg-indigo-500/5' : 'border-border'
          }`}
        >
          <div className="flex items-center justify-between text-text-muted mb-1.5">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-indigo-400">Monthly</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleOpenCreateModal('monthly')
              }}
              title="Add Monthly Expense"
              className="p-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white mb-0.5">
            ₹{metrics.monthlyTotal.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>{metrics.monthlyCount} entries</span>
            <span className="text-indigo-400/80 text-[10px] truncate max-w-[80px]">Rent, bills</span>
          </div>
        </div>

        {/* Yearly Expenses */}
        <div 
          onClick={() => setSelectedFrequency(selectedFrequency === 'yearly' ? 'all' : 'yearly')}
          className={`bg-card border p-3 sm:p-4 rounded-2xl relative overflow-hidden cursor-pointer transition-all hover:border-amber-500/50 flex flex-col justify-between ${
            selectedFrequency === 'yearly' ? 'border-amber-500 bg-amber-500/5' : 'border-border'
          }`}
        >
          <div className="flex items-center justify-between text-text-muted mb-1.5">
            <div className="flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-400">Yearly</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleOpenCreateModal('yearly')
              }}
              title="Add Yearly Expense"
              className="p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white mb-0.5">
            ₹{metrics.yearlyTotal.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>{metrics.yearlyCount} entries</span>
            <span className="text-amber-400/80 text-[10px] truncate max-w-[80px]">Insurance</span>
          </div>
        </div>

        {/* One-Time Expenses */}
        <div 
          onClick={() => setSelectedFrequency(selectedFrequency === 'one-time' ? 'all' : 'one-time')}
          className={`bg-card border p-3 sm:p-4 rounded-2xl relative overflow-hidden cursor-pointer transition-all hover:border-emerald-500/50 flex flex-col justify-between ${
            selectedFrequency === 'one-time' ? 'border-emerald-500 bg-emerald-500/5' : 'border-border'
          }`}
        >
          <div className="flex items-center justify-between text-text-muted mb-1.5">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-400">One-Time</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleOpenCreateModal('one-time')
              }}
              title="Add One-Time Expense"
              className="p-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white mb-0.5">
            ₹{metrics.oneTimeTotal.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>{metrics.oneTimeCount} entries</span>
            <span className="text-emerald-400/80 text-[10px] truncate max-w-[80px]">Capex</span>
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Frequency Breakdown Donut */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Expense Frequency Mix</h2>
              <p className="text-xs text-text-muted">Share of capital by recurrence schedule</p>
            </div>
            <Sparkles className="w-4 h-4 text-text-muted" />
          </div>

          <div className="h-[200px] w-full relative">
            {frequencyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#2e2e2e', borderRadius: '8px' }}
                    labelStyle={{ color: '#ffffff', fontWeight: 600, marginBottom: '2px' }}
                    itemStyle={{ color: '#ef4444', fontWeight: 600 }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                  />
                  <Pie
                    data={frequencyChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {frequencyChartData.map((entry, index) => (
                      <Cell key={`freq-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-text-muted">
                No expense data recorded
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50 text-xs">
            {frequencyChartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg bg-card-hover/40">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-text-muted">{item.name}</span>
                </div>
                <span className="font-semibold text-white">
                  ₹{item.value.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Spending Categories Bar Chart */}
        <div className="bg-card border border-border rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Spending by Category</h2>
              <p className="text-xs text-text-muted">Top expenditure segments</p>
            </div>
            <Tag className="w-4 h-4 text-text-muted" />
          </div>

          <div className="h-[240px] w-full">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" stroke="#9ca3af" fontSize={11} tickFormatter={(val) => `₹${val / 1000}k`} />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} width={130} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: '#242424' }}
                    contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#2e2e2e', borderRadius: '8px' }}
                    labelStyle={{ color: '#ffffff', fontWeight: 600, marginBottom: '2px' }}
                    itemStyle={{ color: '#ef4444', fontWeight: 600 }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {categoryChartData.map((_, index) => (
                      <Cell key={`cat-cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-text-muted">
                No category data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, notes, bill number, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Secondary Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-xl text-xs text-text-main focus:outline-none focus:border-accent"
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Payment Method Dropdown */}
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-xl text-xs text-text-main focus:outline-none focus:border-accent"
            >
              <option value="all">All Payment Methods</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Card">Card</option>
              <option value="Cheque">Cheque</option>
            </select>

            {(selectedFrequency !== 'all' || selectedCategory !== 'all' || selectedPaymentMethod !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedFrequency('all')
                  setSelectedCategory('all')
                  setSelectedPaymentMethod('all')
                  setSearchQuery('')
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-card-hover text-text-muted hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Frequency Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-border/40">
          <span className="text-xs text-text-muted font-medium flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Frequency:
          </span>
          {[
            { id: 'all', label: 'All Expenses', count: expenses.length },
            { id: 'daily', label: 'Daily', count: metrics.dailyCount, icon: Sun },
            { id: 'monthly', label: 'Monthly', count: metrics.monthlyCount, icon: CalendarDays },
            { id: 'yearly', label: 'Yearly', count: metrics.yearlyCount, icon: CalendarRange },
            { id: 'one-time', label: 'One-Time', count: metrics.oneTimeCount, icon: Zap }
          ].map((tab) => {
            const Icon = tab.icon
            const isSelected = selectedFrequency === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedFrequency(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                  isSelected
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-card-hover/60 text-text-muted hover:bg-card-hover hover:text-text-main'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-background/80 text-text-muted'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-accent" />
            <h2 className="text-base font-semibold text-white">Expense Records</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-card-hover text-text-muted">
              {filteredExpenses.length} of {expenses.length}
            </span>
          </div>

          <button
            onClick={() => handleOpenCreateModal()}
            className="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1.5 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New</span>
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-text-muted">
            <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading expenses from Firebase...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-16 text-center text-text-muted px-4">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium text-white mb-1">No expenses found</p>
            <p className="text-xs text-text-muted max-w-sm mx-auto mb-4">
              {searchQuery || selectedFrequency !== 'all'
                ? 'Try adjusting your search criteria or frequency filter.'
                : 'Start tracking daily, monthly, yearly, or one-time expenditures for your workshop.'}
            </p>
            <button
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-xs font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Expense</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-background/50 text-text-muted text-xs uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Expense Details</th>
                  <th className="px-5 py-3.5 font-semibold">Frequency</th>
                  <th className="px-5 py-3.5 font-semibold">Category</th>
                  <th className="px-5 py-3.5 font-semibold">Date</th>
                  <th className="px-5 py-3.5 font-semibold">Payment</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Amount</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredExpenses.map((expense) => {
                  const freqMeta = FREQUENCY_LABELS[expense.frequency] || FREQUENCY_LABELS['one-time']
                  const FreqIcon = FREQUENCY_ICONS[expense.frequency] || Zap

                  return (
                    <tr key={expense.id} className="hover:bg-card-hover/40 transition-colors">
                      {/* Title & Notes */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-white flex items-center gap-2">
                          <span>{expense.title}</span>
                          {expense.receiptNumber && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-text-muted font-mono">
                              #{expense.receiptNumber}
                            </span>
                          )}
                        </div>
                        {expense.notes && (
                          <p className="text-xs text-text-muted line-clamp-1 mt-0.5">
                            {expense.notes}
                          </p>
                        )}
                      </td>

                      {/* Frequency Badge */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${freqMeta.badgeBg}`}
                        >
                          <FreqIcon className="w-3 h-3" />
                          <span>{freqMeta.label}</span>
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs text-text-muted bg-card-hover px-2.5 py-1 rounded-lg border border-border/60">
                          {expense.category}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 whitespace-nowrap text-text-muted text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{expense.date}</span>
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-text-muted border border-border/50">
                          {expense.paymentMethod}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <span className="font-semibold text-red-400 text-base">
                          ₹{expense.amount.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(expense)}
                            title="Edit Expense"
                            className="p-1.5 rounded-lg hover:bg-card-hover text-text-muted hover:text-white transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(expense.id)}
                            title="Delete Expense"
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-text-muted hover:text-white transition-colors p-1 rounded-lg hover:bg-card-hover"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-accent" />
                {editingExpense ? 'Edit Expense Record' : 'Create New Expense'}
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Record workshop expenditures by frequency: daily, monthly, yearly, or one-time
              </p>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-5">
              {/* FREQUENCY SELECTOR CARDS */}
              <div>
                <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-2">
                  Expense Frequency / Recurrence *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(
                    [
                      { id: 'daily', label: 'Daily', icon: Sun, color: 'text-sky-400', border: 'hover:border-sky-500/50', desc: 'Recurring daily' },
                      { id: 'monthly', label: 'Monthly', icon: CalendarDays, color: 'text-indigo-400', border: 'hover:border-indigo-500/50', desc: 'Recurring monthly' },
                      { id: 'yearly', label: 'Yearly', icon: CalendarRange, color: 'text-amber-400', border: 'hover:border-amber-500/50', desc: 'Recurring yearly' },
                      { id: 'one-time', label: 'One-Time', icon: Zap, color: 'text-emerald-400', border: 'hover:border-emerald-500/50', desc: 'Single / Capex' }
                    ] as const
                  ).map((option) => {
                    const Icon = option.icon
                    const isSelected = formData.frequency === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, frequency: option.id })}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-accent/10 border-accent text-white shadow-sm ring-1 ring-accent'
                            : `bg-background/60 border-border text-text-muted ${option.border} hover:bg-card-hover`
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className={`w-4 h-4 ${option.color}`} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{option.label}</div>
                          <div className="text-[10px] text-text-muted leading-tight mt-0.5">
                            {option.desc}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Title / Description */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Expense Title / Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Shop Commercial Rent, Mechanic Daily Wages, Signboard"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              {/* Category & Amount in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:outline-none focus:border-accent"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                    Amount (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm font-semibold">
                      ₹
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full pl-8 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Date & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                    Payment Method *
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:outline-none focus:border-accent"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT / IMPS</option>
                    <option value="Card">Credit / Debit Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Receipt / Invoice No */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Receipt / Invoice / Bill Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., EB-8849, RENT-2026-03, BILL-102"
                  value={formData.receiptNumber}
                  onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Additional Notes / Reference (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context, vendor name, or specific notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-text-muted hover:text-white hover:bg-card-hover text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingExpense ? 'Update Expense' : 'Save Expense'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Delete Expense Record?</h3>
            <p className="text-xs text-text-muted mb-6">
              Are you sure you want to delete this expense record? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-border text-text-muted hover:text-white text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteExpense(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-medium transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
