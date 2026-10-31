import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Search,
  X,
  FileText,
  Trash2,
  RefreshCw,
  Database,
  CreditCard,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  Check,
  Coins
} from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { InvoicePDF } from '../components/InvoicePDF'
import {
  type SaleRecord,
  type SaleItemDetail,
  subscribeToSales,
  createSale,
  deleteSale,
  recordCreditPayment,
  seedInitialSalesIfEmpty
} from '../services/salesService'
import { type StockItem, subscribeToStock } from '../services/stockService'

function getDefaultDueDate(daysAhead = 30): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return new Intl.DateTimeFormat('en-CA').format(d)
}

function getDaysRemaining(dueDateStr?: string): { days: number; isOverdue: boolean; label: string } {
  if (!dueDateStr) return { days: 0, isOverdue: false, label: 'No due date' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr)
  due.setHours(0, 0, 0, 0)
  const diffTime = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { days: Math.abs(diffDays), isOverdue: true, label: `${Math.abs(diffDays)}d overdue` }
  } else if (diffDays === 0) {
    return { days: 0, isOverdue: false, label: 'Due today' }
  } else {
    return { days: diffDays, isOverdue: false, label: `${diffDays}d left` }
  }
}

export default function Sales() {
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [availableStock, setAvailableStock] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Tab View: 'all' = All Invoices, 'credit' = Credit & Dues
  const [activeTab, setActiveTab] = useState<'all' | 'credit'>('all')
  const [creditStatusFilter, setCreditStatusFilter] = useState<'all' | 'pending' | 'partially-paid' | 'overdue' | 'paid'>('all')

  // Form State
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [saleDate, setSaleDate] = useState(new Intl.DateTimeFormat('en-CA').format(new Date()))
  const [saleItems, setSaleItems] = useState<{ stockId: string; qty: number; price: number | '' }[]>([
    { stockId: '', qty: 1, price: '' }
  ])

  // Credit Specific Form State
  const [interestType, setInterestType] = useState<'percentage' | 'fixed'>('percentage')
  const [interestValue, setInterestValue] = useState<number | ''>(0)
  const [amountPaidNow, setAmountPaidNow] = useState<number | ''>(0)
  const [dueDate, setDueDate] = useState<string>(() => getDefaultDueDate(30))

  // Repayment Modal State (collecting due from customer)
  const [collectingSale, setCollectingSale] = useState<SaleRecord | null>(null)
  const [collectAmount, setCollectAmount] = useState<string>('')
  const [collectMethod, setCollectMethod] = useState<string>('Cash')
  const [collectNotes, setCollectNotes] = useState<string>('')
  const [isCollectingPayment, setIsCollectingPayment] = useState<boolean>(false)

  // PDF Generation State for newly completed sale
  const [completedSale, setCompletedSale] = useState<SaleRecord | null>(null)

  // Subscribe to real-time sales and stock from Firestore
  useEffect(() => {
    let isMounted = true

    seedInitialSalesIfEmpty().catch(console.warn)

    const unsubSales = subscribeToSales(
      (data) => {
        if (!isMounted) return
        setSales(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching sales:', err)
        setErrorMessage('Failed to connect to Firebase Sales collection.')
        setLoading(false)
      }
    )

    const unsubStock = subscribeToStock((stockItems) => {
      if (!isMounted) return
      setAvailableStock(stockItems.filter((s) => s.qty > 0))
    })

    return () => {
      isMounted = false
      unsubSales()
      unsubStock()
    }
  }, [])

  // Standard Sales Filter
  const filteredSales = useMemo(() => {
    return sales.filter(
      (s) =>
        s.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.customerPhone.includes(searchQuery) ||
        s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.items.some((item) => item.brand.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [sales, searchQuery])

  // Credit Sales List & Metrics
  const creditSales = useMemo(() => {
    return sales.filter((s) => s.paymentMethod === 'Credit' || s.isCreditSale)
  }, [sales])

  const creditMetrics = useMemo(() => {
    const today = new Intl.DateTimeFormat('en-CA').format(new Date())
    let totalDue = 0
    let totalCollected = 0
    let overdueCount = 0
    let overdueAmount = 0
    let pendingCount = 0
    let partiallyPaidCount = 0
    let paidCount = 0
    const customerSet = new Set<string>()

    creditSales.forEach((s) => {
      const due = Number(s.remainingDue ?? Math.max(0, s.totalAmount - (s.amountPaidNow || 0)))
      const paid = Number(s.amountPaidNow || 0)
      totalDue += due
      totalCollected += paid

      if (due > 0) {
        customerSet.add((s.customerName || s.customerPhone || s.id).toLowerCase().trim())
        if (s.dueDate && s.dueDate < today) {
          overdueCount++
          overdueAmount += due
        }
        if (paid > 0) {
          partiallyPaidCount++
        } else {
          pendingCount++
        }
      } else {
        paidCount++
      }
    })

    return {
      totalDue,
      totalCollected,
      activeCustomers: customerSet.size,
      overdueCount,
      overdueAmount,
      pendingCount,
      partiallyPaidCount,
      paidCount,
      totalCount: creditSales.length
    }
  }, [creditSales])

  const filteredCreditSales = useMemo(() => {
    const today = new Intl.DateTimeFormat('en-CA').format(new Date())
    return creditSales.filter((s) => {
      const matchesSearch =
        s.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.customerPhone.includes(searchQuery) ||
        s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false

      const due = Number(s.remainingDue ?? Math.max(0, s.totalAmount - (s.amountPaidNow || 0)))
      const paid = Number(s.amountPaidNow || 0)
      const isOverdue = due > 0 && !!s.dueDate && s.dueDate < today

      if (creditStatusFilter === 'pending') return due > 0 && paid === 0 && !isOverdue
      if (creditStatusFilter === 'partially-paid') return due > 0 && paid > 0 && !isOverdue
      if (creditStatusFilter === 'overdue') return isOverdue
      if (creditStatusFilter === 'paid') return due === 0
      return true
    })
  }, [creditSales, searchQuery, creditStatusFilter])

  // Real-time computations in modal
  const modalItemsSubtotal = useMemo(() => {
    return saleItems.reduce((acc, curr) => {
      const p = typeof curr.price === 'number' ? curr.price : parseFloat(String(curr.price)) || 0
      return acc + p * curr.qty
    }, 0)
  }, [saleItems])

  const modalInterestAmount = useMemo(() => {
    if (paymentMethod !== 'Credit') return 0
    if (interestType === 'fixed') {
      return Number(interestValue) || 0
    }
    const rate = Number(interestValue) || 0
    return Math.round((modalItemsSubtotal * rate) / 100)
  }, [paymentMethod, interestType, interestValue, modalItemsSubtotal])

  const modalInterestRate = useMemo(() => {
    if (paymentMethod !== 'Credit') return 0
    if (interestType === 'percentage') {
      return Number(interestValue) || 0
    }
    const amt = Number(interestValue) || 0
    return modalItemsSubtotal > 0 ? Number(((amt / modalItemsSubtotal) * 100).toFixed(1)) : 0
  }, [paymentMethod, interestType, interestValue, modalItemsSubtotal])

  const handleToggleInterestType = (newType: 'percentage' | 'fixed') => {
    if (newType === interestType) return
    setInterestType(newType)
    if (newType === 'fixed') {
      const rate = Number(interestValue) || 0
      const amt = Math.round((modalItemsSubtotal * rate) / 100)
      setInterestValue(amt > 0 ? amt : '')
    } else {
      const amt = Number(interestValue) || 0
      const pct = modalItemsSubtotal > 0 ? Number(((amt / modalItemsSubtotal) * 100).toFixed(1)) : 0
      setInterestValue(pct > 0 ? pct : '')
    }
  }

  const modalTotalPayable = modalItemsSubtotal + modalInterestAmount
  const modalPaidNow = paymentMethod === 'Credit' ? Number(amountPaidNow) || 0 : modalTotalPayable
  const modalRemainingDue = Math.max(0, modalTotalPayable - modalPaidNow)

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const itemsToSave: SaleItemDetail[] = saleItems
        .map((si) => {
          const stockItem = availableStock.find((s) => s.id === si.stockId)
          if (!stockItem) return null
          const unitPrice = typeof si.price === 'number' ? si.price : parseFloat(String(si.price)) || 0
          return {
            stockId: stockItem.id,
            brand: stockItem.brand,
            model: stockItem.model,
            size: stockItem.size,
            qty: si.qty,
            price: unitPrice,
            purchasePrice: stockItem.purchasePrice
          }
        })
        .filter(Boolean) as SaleItemDetail[]

      if (itemsToSave.length === 0) {
        setErrorMessage('Please select at least one valid tyre product from available stock.')
        setIsSubmitting(false)
        return
      }

      if (itemsToSave.some((item) => item.price <= 0)) {
        setErrorMessage('Please enter a valid selling price greater than 0 for each tyre item.')
        setIsSubmitting(false)
        return
      }

      if (paymentMethod === 'Credit' && !dueDate) {
        setErrorMessage('Please choose a valid due date for the remaining credit balance.')
        setIsSubmitting(false)
        return
      }

      const created = await createSale({
        customerName,
        customerPhone,
        date: saleDate,
        paymentMethod,
        items: itemsToSave,
        isCreditSale: paymentMethod === 'Credit',
        interestType: paymentMethod === 'Credit' ? interestType : 'percentage',
        interestRate: paymentMethod === 'Credit' ? modalInterestRate : 0,
        interestAmount: modalInterestAmount,
        amountPaidNow: modalPaidNow,
        remainingDue: modalRemainingDue,
        dueDate: paymentMethod === 'Credit' ? dueDate : ''
      })

      setCompletedSale(created)

      // Reset form
      setCustomerName('')
      setCustomerPhone('')
      setPaymentMethod('UPI')
      setSaleItems([{ stockId: '', qty: 1, price: '' }])
      setInterestType('percentage')
      setInterestValue(0)
      setAmountPaidNow(0)
      setDueDate(getDefaultDueDate(30))
    } catch (err: any) {
      console.error('Failed to create sale:', err)
      setErrorMessage(err.message || 'Failed to complete sale transaction in Firebase.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSale = async (id: string) => {
    if (window.confirm('Delete this invoice record from Firebase?')) {
      try {
        await deleteSale(id)
      } catch (err) {
        console.error('Failed to delete sale:', err)
      }
    }
  }

  const handleOpenCollectModal = (sale: SaleRecord) => {
    setCollectingSale(sale)
    setCollectAmount(String(sale.remainingDue || ''))
    setCollectMethod('Cash')
    setCollectNotes('')
  }

  const handleConfirmCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collectingSale) return
    const amt = parseFloat(collectAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid repayment amount greater than 0')
      return
    }
    if (amt > (collectingSale.remainingDue || 0)) {
      if (!window.confirm(`Entered payment (₹${amt}) is higher than the remaining due (₹${collectingSale.remainingDue}). Proceed anyway?`)) {
        return
      }
    }

    setIsCollectingPayment(true)
    try {
      await recordCreditPayment(collectingSale.id, amt, collectMethod, collectNotes)
      setCollectingSale(null)
    } catch (err: any) {
      console.error('Error recording payment:', err)
      alert(err.message || 'Failed to record repayment')
    } finally {
      setIsCollectingPayment(false)
    }
  }

  const closeModals = () => {
    setIsAddModalOpen(false)
    setCompletedSale(null)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4 sm:border-b-0 sm:pb-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Sales & Invoices</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Firebase
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">Transactions, invoices, and customer credit dues</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search invoices, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-border rounded-xl bg-background text-sm text-text-main placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-accent/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Sale</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs: All Invoices vs Credit Sales & Dues */}
      <div className="flex items-center bg-card p-1 rounded-2xl border border-border w-full sm:w-fit gap-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'all'
              ? 'bg-accent text-white shadow-sm'
              : 'text-text-muted hover:text-white hover:bg-card-hover'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>All Invoices</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-white font-mono">
            {sales.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('credit')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'credit'
              ? 'bg-amber-500 text-black font-bold shadow-sm'
              : 'text-text-muted hover:text-white hover:bg-card-hover'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Credit Sales & Dues</span>
          <span
            className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              activeTab === 'credit' ? 'bg-black/20 text-black' : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {creditSales.length}
          </span>
          {creditMetrics.totalDue > 0 && (
            <span
              className={`hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                activeTab === 'credit' ? 'bg-black/30 text-white' : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              ₹{creditMetrics.totalDue.toLocaleString('en-IN')} Due
            </span>
          )}
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      {/* ============================================================== */}
      {/* CREDIT SALES & DUES SECTION */}
      {/* ============================================================== */}
      {activeTab === 'credit' && (
        <div className="space-y-4">
          {/* Credit Overview Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Outstanding */}
            <div className="bg-card p-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/5">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Total Outstanding</span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                ₹{creditMetrics.totalDue.toLocaleString('en-IN')}
              </h3>
              <p className="text-[11px] text-amber-400/80 mt-1">
                {creditMetrics.pendingCount + creditMetrics.partiallyPaidCount} unpaid customer dues
              </p>
            </div>

            {/* Collected Upfront / Installments */}
            <div className="bg-card p-4 rounded-2xl border border-border">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Paid / Collected</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                ₹{creditMetrics.totalCollected.toLocaleString('en-IN')}
              </h3>
              <p className="text-[11px] text-text-muted mt-1">Down payments + repayments</p>
            </div>

            {/* Active Credit Customers */}
            <div className="bg-card p-4 rounded-2xl border border-border">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">Active Debtors</span>
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {creditMetrics.activeCustomers} <span className="text-sm font-normal text-text-muted">people</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-1">Customers with pending balance</p>
            </div>

            {/* Overdue Bills */}
            <div className="bg-card p-4 rounded-2xl border border-red-500/30 bg-gradient-to-br from-card via-card to-red-500/5">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-red-400">Overdue Dues</span>
                <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {creditMetrics.overdueCount} <span className="text-sm font-normal text-text-muted">bills</span>
              </h3>
              <p className="text-[11px] text-red-400/80 mt-1">
                ₹{creditMetrics.overdueAmount.toLocaleString('en-IN')} past due date
              </p>
            </div>
          </div>

          {/* Filter Pills for Credit Bills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {[
              { id: 'all', label: 'All Credit', count: creditMetrics.totalCount },
              { id: 'pending', label: 'Pending Balance', count: creditMetrics.pendingCount },
              { id: 'partially-paid', label: 'Partially Paid', count: creditMetrics.partiallyPaidCount },
              { id: 'overdue', label: 'Overdue', count: creditMetrics.overdueCount, isAlert: creditMetrics.overdueCount > 0 },
              { id: 'paid', label: 'Fully Settled', count: creditMetrics.paidCount }
            ].map(({ id, label, count, isAlert }) => (
              <button
                key={id}
                onClick={() => setCreditStatusFilter(id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  creditStatusFilter === id
                    ? 'bg-accent text-white shadow-sm'
                    : isAlert
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                    : 'bg-card text-text-muted hover:text-white border border-border hover:bg-card-hover'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    creditStatusFilter === id ? 'bg-black/30 text-white' : 'bg-white/10 text-text-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Credit Sales Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-5 py-3.5 font-medium text-text-muted">Invoice</th>
                    <th className="px-5 py-3.5 font-medium text-text-muted">Customer</th>
                    <th className="px-5 py-3.5 font-medium text-text-muted">Sale Date</th>
                    <th className="px-5 py-3.5 font-medium text-text-muted">Total (w/ Int.)</th>
                    <th className="px-5 py-3.5 font-medium text-text-muted">Paid Amount</th>
                    <th className="px-5 py-3.5 font-medium text-text-muted">Remaining Due</th>
                    <th className="px-5 py-3.5 font-medium text-text-muted">Due Date / Status</th>
                    <th className="px-5 py-3.5 font-medium text-text-muted text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-text-muted">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin text-accent" />
                          <span>Loading credit sales from Firebase...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCreditSales.map((sale) => {
                    const due = Number(sale.remainingDue ?? Math.max(0, sale.totalAmount - (sale.amountPaidNow || 0)))
                    const paid = Number(sale.amountPaidNow || 0)
                    const timing = getDaysRemaining(sale.dueDate)
                    const isFullyPaid = due === 0

                    return (
                      <tr key={sale.id} className="hover:bg-card-hover/50 transition-colors">
                        <td className="px-5 py-4 text-text-main font-mono text-xs font-semibold">
                          #{sale.invoiceNumber}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-text-main">{sale.customerName}</p>
                          <p className="text-xs text-text-muted">{sale.customerPhone || 'No phone'}</p>
                        </td>
                        <td className="px-5 py-4 text-text-muted text-xs">{sale.date}</td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">₹{sale.totalAmount.toLocaleString('en-IN')}</div>
                          {sale.interestAmount ? (
                            <span className="text-[10px] text-amber-400 font-mono">
                              +₹{sale.interestAmount.toLocaleString('en-IN')} ({sale.interestRate}%)
                            </span>
                          ) : (
                            <span className="text-[10px] text-text-muted">No interest</span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-semibold text-emerald-400">
                          ₹{paid.toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`font-mono font-bold text-sm ${
                              due > 0 ? (timing.isOverdue ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'
                            }`}
                          >
                            ₹{due.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Check className="w-3 h-3" />
                              Settled
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="text-xs text-white font-medium flex items-center gap-1.5">
                                <CalendarClock className="w-3.5 h-3.5 text-text-muted" />
                                <span>{sale.dueDate || 'No due date'}</span>
                              </div>
                              <span
                                className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${
                                  timing.isOverdue
                                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                    : timing.days <= 5
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    : 'bg-white/5 text-text-muted border border-border'
                                }`}
                              >
                                {timing.label}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {due > 0 && (
                              <button
                                onClick={() => handleOpenCollectModal(sale)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500 hover:text-black rounded-lg border border-amber-500/30 transition-all shadow-sm"
                                title="Record payment received from customer"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>Record Pay</span>
                              </button>
                            )}

                            <PDFDownloadLink
                              document={
                                <InvoicePDF
                                  customerName={sale.customerName}
                                  customerPhone={sale.customerPhone}
                                  invoiceNumber={sale.invoiceNumber}
                                  date={sale.date}
                                  paymentMethod={sale.paymentMethod}
                                  isCreditSale={sale.isCreditSale}
                                  interestRate={sale.interestRate}
                                  interestAmount={sale.interestAmount}
                                  amountPaidNow={sale.amountPaidNow}
                                  remainingDue={due}
                                  dueDate={sale.dueDate}
                                  items={sale.items}
                                />
                              }
                              fileName={`credit-invoice-${sale.invoiceNumber}.pdf`}
                              className="inline-flex p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                              title="Download Credit Invoice PDF"
                            >
                              <FileText className="w-4 h-4" />
                            </PDFDownloadLink>

                            <button
                              onClick={() => handleDeleteSale(sale.id)}
                              className="inline-flex p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {!loading && filteredCreditSales.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CreditCard className="w-9 h-9 text-text-muted opacity-40 mb-1" />
                          <p className="text-white font-medium text-sm">No credit sales found</p>
                          <p className="text-xs text-text-muted">
                            When creating a new sale, choose &quot;Credit&quot; as payment method to track dues here.
                          </p>
                          <button
                            onClick={() => {
                              setPaymentMethod('Credit')
                              setIsAddModalOpen(true)
                            }}
                            className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-colors"
                          >
                            Create First Credit Sale
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STANDARD INVOICES LIST (ALL INVOICES) */}
      {/* ============================================================== */}
      {activeTab === 'all' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium text-text-muted">Invoice #</th>
                  <th className="px-6 py-4 font-medium text-text-muted">Date</th>
                  <th className="px-6 py-4 font-medium text-text-muted">Customer</th>
                  <th className="px-6 py-4 font-medium text-text-muted">Payment</th>
                  <th className="px-6 py-4 font-medium text-text-muted">Product(s)</th>
                  <th className="px-6 py-4 font-medium text-text-muted">Qty</th>
                  <th className="px-6 py-4 font-medium text-text-muted">Total (₹)</th>
                  <th className="px-6 py-4 font-medium text-text-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-text-muted">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-accent" />
                        <span>Loading sales from Firebase...</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const isCredit = sale.paymentMethod === 'Credit' || sale.isCreditSale
                    const due = Number(sale.remainingDue ?? Math.max(0, sale.totalAmount - (sale.amountPaidNow || 0)))

                    return (
                      <tr key={sale.id} className="hover:bg-card-hover/50 transition-colors">
                        <td className="px-6 py-4 text-text-main font-mono text-xs font-semibold">
                          #{sale.invoiceNumber}
                        </td>
                        <td className="px-6 py-4 text-text-muted text-xs">{sale.date}</td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-text-main">{sale.customerName}</p>
                          <p className="text-xs text-text-muted">{sale.customerPhone || 'No phone'}</p>
                        </td>
                        <td className="px-6 py-4">
                          {isCredit ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold">
                                <CreditCard className="w-3 h-3" />
                                Credit
                              </span>
                              {due > 0 ? (
                                <p className="text-[10px] text-amber-400 font-mono font-medium">
                                  Due: ₹{due.toLocaleString('en-IN')}
                                </p>
                              ) : (
                                <p className="text-[10px] text-emerald-400 font-mono font-medium">Settled</p>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs bg-background border border-border text-text-muted">
                              {sale.paymentMethod || 'Cash'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-text-main">
                          {sale.items.length === 1 ? (
                            <div>
                              <span>
                                {sale.items[0].brand} {sale.items[0].model}
                              </span>
                              <span className="text-xs text-text-muted ml-1 font-mono">({sale.items[0].size})</span>
                            </div>
                          ) : (
                            <span className="font-medium text-accent">{sale.items.length} Tyre Items</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-text-main font-medium">
                          {sale.items.reduce((acc, curr) => acc + curr.qty, 0)}
                        </td>
                        <td className="px-6 py-4 text-text-main font-semibold text-emerald-400">
                          ₹{sale.totalAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {isCredit && due > 0 && (
                              <button
                                onClick={() => handleOpenCollectModal(sale)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500 hover:text-black rounded-lg border border-amber-500/30 transition-all shadow-sm"
                                title="Record payment received"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>Pay</span>
                              </button>
                            )}

                            <PDFDownloadLink
                              document={
                                <InvoicePDF
                                  customerName={sale.customerName}
                                  customerPhone={sale.customerPhone}
                                  invoiceNumber={sale.invoiceNumber}
                                  date={sale.date}
                                  paymentMethod={sale.paymentMethod}
                                  isCreditSale={sale.isCreditSale}
                                  interestRate={sale.interestRate}
                                  interestAmount={sale.interestAmount}
                                  amountPaidNow={sale.amountPaidNow}
                                  remainingDue={due}
                                  dueDate={sale.dueDate}
                                  items={sale.items}
                                />
                              }
                              fileName={`invoice-${sale.invoiceNumber}.pdf`}
                              className="inline-flex p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                              title="Download Invoice PDF"
                            >
                              <FileText className="w-4 h-4" />
                            </PDFDownloadLink>
                            <button
                              onClick={() => handleDeleteSale(sale.id)}
                              className="inline-flex p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                              title="Delete Sale"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}

                {!loading && filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Database className="w-10 h-10 text-text-muted opacity-40" />
                        <p>No sales records found in Firestore database.</p>
                        <button
                          onClick={() => setIsAddModalOpen(true)}
                          className="px-4 py-2 bg-card hover:bg-card-hover border border-border text-white text-xs font-semibold rounded-xl transition-colors"
                        >
                          Record First Sale
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* RECORD CREDIT REPAYMENT MODAL */}
      {/* ============================================================== */}
      {collectingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Record Credit Payment</h2>
                  <p className="text-xs text-text-muted">Invoice #{collectingSale.invoiceNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setCollectingSale(null)}
                className="text-text-muted hover:text-text-main p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-background border border-border mb-4 space-y-1 text-xs">
              <div className="flex justify-between text-text-muted">
                <span>Customer:</span>
                <span className="font-semibold text-white">{collectingSale.customerName}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Total Invoice (w/ interest):</span>
                <span className="text-white">₹{collectingSale.totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Already Paid:</span>
                <span className="text-emerald-400">₹{(collectingSale.amountPaidNow || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-border">
                <span className="text-text-muted">Current Balance Due:</span>
                <span className="text-amber-400 font-mono">
                  ₹{(collectingSale.remainingDue || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmCollectPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Payment Amount Received (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm text-text-muted">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl pl-7 pr-4 py-2.5 text-white font-bold text-base focus:outline-none focus:border-amber-400"
                    placeholder="Enter amount"
                    required
                  />
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setCollectAmount(String(collectingSale.remainingDue || 0))}
                    className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-colors"
                  >
                    Pay Full Due (₹{collectingSale.remainingDue})
                  </button>
                  {collectingSale.remainingDue && collectingSale.remainingDue > 1000 && (
                    <button
                      type="button"
                      onClick={() => setCollectAmount(String(Math.round((collectingSale.remainingDue || 0) / 2)))}
                      className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-colors"
                    >
                      Pay 50%
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Payment Method</label>
                <select
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Payment Notes (Optional)</label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="e.g. 2nd Installment via GPay"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectingSale(null)}
                  className="px-4 py-2 text-xs font-medium text-text-main bg-background hover:bg-card-hover border border-border rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCollectingPayment}
                  className="px-5 py-2 text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isCollectingPayment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Payment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ADD SALE MODAL (WITH CREDIT & DUE OPTIONS) */}
      {/* ============================================================== */}
      {isAddModalOpen && !completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Create New Sale</h2>
                <p className="text-xs text-text-muted">Issue invoice and record payment terms</p>
              </div>
              <button onClick={closeModals} className="text-text-muted hover:text-text-main p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleAddSale}>
              {/* Customer info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Customer Name *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                    placeholder="e.g. Rahul Verma"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Phone No. *</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                    placeholder="10-digit number"
                    required
                  />
                </div>
              </div>

              {/* Date & Payment Method */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Date</label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Payment Method *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm font-semibold"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit">Credit / Due (Khata)</option>
                  </select>
                </div>
              </div>

              {/* Credit Specific Fields */}
              {paymentMethod === 'Credit' && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                    <CalendarClock className="w-4 h-4" />
                    <span>Credit & Due Terms (Customer Khata)</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {/* Interest (% or ₹) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-medium text-text-muted">
                          Interest {interestType === 'percentage' ? '(%)' : '(₹)'}
                        </label>
                        <div className="flex items-center rounded-lg bg-background border border-border p-0.5">
                          <button
                            type="button"
                            onClick={() => handleToggleInterestType('percentage')}
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                              interestType === 'percentage'
                                ? 'bg-amber-500 text-black shadow-sm'
                                : 'text-text-muted hover:text-white'
                            }`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleInterestType('fixed')}
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                              interestType === 'fixed'
                                ? 'bg-amber-500 text-black shadow-sm'
                                : 'text-text-muted hover:text-white'
                            }`}
                          >
                            ₹
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        {interestType === 'fixed' && (
                          <span className="absolute left-2.5 top-2 text-xs text-text-muted">₹</span>
                        )}
                        <input
                          type="number"
                          min="0"
                          step={interestType === 'percentage' ? '0.5' : 'any'}
                          placeholder="0"
                          value={interestValue}
                          onChange={(e) =>
                            setInterestValue(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className={`w-full bg-background border border-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400 text-xs font-semibold ${
                            interestType === 'fixed' ? 'pl-6 pr-2' : 'pr-6'
                          }`}
                        />
                        {interestType === 'percentage' && (
                          <span className="absolute right-2.5 top-2 text-xs text-text-muted">%</span>
                        )}
                      </div>
                      <span className="text-[10px] text-amber-400/90 mt-1 block">
                        {interestType === 'percentage'
                          ? `+₹${modalInterestAmount.toLocaleString('en-IN')} interest`
                          : `≈ ${modalInterestRate}% of subtotal`}
                      </span>
                    </div>

                    {/* Amount Paid Now */}
                    <div>
                      <label className="block text-[11px] font-medium text-text-muted mb-1">
                        Amount Paid Now (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs text-text-muted">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={amountPaidNow}
                          onChange={(e) =>
                            setAmountPaidNow(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className="w-full bg-background border border-border rounded-xl pl-6 pr-2 py-2 text-white focus:outline-none focus:border-amber-400 text-xs font-semibold"
                        />
                      </div>
                      <span className="text-[10px] text-text-muted mt-1 block truncate">Initial down payment</span>
                    </div>

                    {/* Due Date */}
                    <div>
                      <label className="block text-[11px] font-medium text-text-muted mb-1">Due Date *</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-2 py-2 text-white focus:outline-none focus:border-amber-400 text-xs font-semibold"
                        required={paymentMethod === 'Credit'}
                      />
                      <span className="text-[10px] text-text-muted mt-1 block">For remaining balance</span>
                    </div>
                  </div>

                  {/* Summary Box inside credit terms */}
                  <div className="p-2.5 rounded-lg bg-background/80 border border-border/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-text-muted">Total Payable: </span>
                      <span className="font-bold text-white">₹{modalTotalPayable.toLocaleString('en-IN')}</span>
                      {modalInterestAmount > 0 && (
                        <span className="text-[10px] text-amber-400 ml-1">
                          (₹{modalItemsSubtotal.toLocaleString('en-IN')} + ₹{modalInterestAmount} int.)
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-text-muted">Remaining Balance Due: </span>
                      <span className="font-bold text-amber-400 font-mono text-sm">
                        ₹{modalRemainingDue.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tyre Line Items */}
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-medium text-text-muted">Tyre Products (From Stock)</label>
                  <button
                    type="button"
                    onClick={() => setSaleItems([...saleItems, { stockId: '', qty: 1, price: '' }])}
                    className="text-xs font-semibold text-accent hover:text-accent-hover flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-2 text-[11px] text-text-muted font-medium px-1">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-3">Selling Price (₹)</div>
                  <div className="col-span-1"></div>
                </div>

                {saleItems.map((item, index) => {
                  const selectedStock = availableStock.find((s) => s.id === item.stockId)
                  return (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <select
                          value={item.stockId}
                          onChange={(e) => {
                            const newItems = [...saleItems]
                            newItems[index].stockId = e.target.value
                            const found = availableStock.find((s) => s.id === e.target.value)
                            if (found?.sellingPrice && (newItems[index].price === '' || newItems[index].price === 0)) {
                              newItems[index].price = found.sellingPrice
                            }
                            setSaleItems(newItems)
                          }}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent appearance-none text-xs truncate"
                          required
                        >
                          <option value="" disabled>
                            Select tyre from stock...
                          </option>
                          {availableStock.map((stock) => (
                            <option key={stock.id} value={stock.id}>
                              {stock.brand} {stock.model} ({stock.size}) [{stock.qty} in stock]
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          max={selectedStock ? selectedStock.qty : 100}
                          value={item.qty}
                          onChange={(e) => {
                            const newItems = [...saleItems]
                            newItems[index].qty = Math.max(1, parseInt(e.target.value) || 1)
                            setSaleItems(newItems)
                          }}
                          className="w-full bg-background border border-border rounded-xl px-2 py-2 text-white focus:outline-none focus:border-accent text-xs text-center font-medium"
                          required
                        />
                      </div>

                      <div className="col-span-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs text-text-muted">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Price"
                            value={item.price}
                            onChange={(e) => {
                              const newItems = [...saleItems]
                              newItems[index].price =
                                e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0)
                              setSaleItems(newItems)
                            }}
                            className="w-full bg-background border border-border rounded-xl pl-6 pr-2 py-2 text-white focus:outline-none focus:border-accent text-xs font-semibold"
                            required
                          />
                        </div>
                      </div>

                      <div className="col-span-1 flex justify-center">
                        {saleItems.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setSaleItems(saleItems.filter((_, i) => i !== index))}
                            className="text-text-muted hover:text-red-400 p-1"
                            title="Remove item"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total Amount Preview */}
              {saleItems.some((i) => i.stockId) && (
                <div className="mt-4 p-4 bg-background border border-border rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-text-muted text-xs block">
                      {paymentMethod === 'Credit' ? 'Total Payable (w/ interest):' : 'Total Amount:'}
                    </span>
                    <span className="text-xl font-bold text-emerald-400">
                      ₹{modalTotalPayable.toLocaleString('en-IN')}
                    </span>
                  </div>
                  {paymentMethod === 'Credit' && (
                    <div className="text-right">
                      <span className="text-text-muted text-xs block">Balance Due:</span>
                      <span className="text-base font-bold text-amber-400 font-mono">
                        ₹{modalRemainingDue.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-5 py-2.5 text-sm font-medium text-text-main bg-background hover:bg-card-hover border border-border rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 ${
                    paymentMethod === 'Credit'
                      ? 'bg-amber-500 hover:bg-amber-400 text-black font-bold'
                      : 'bg-accent hover:bg-accent-hover text-white'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Recording Sale...
                    </>
                  ) : paymentMethod === 'Credit' ? (
                    'Record Credit Sale'
                  ) : (
                    'Complete Sale'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Completed Sale PDF Modal */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              {completedSale.isCreditSale ? 'Credit Sale Recorded!' : 'Sale Completed!'}
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Invoice #{completedSale.invoiceNumber} for {completedSale.customerName}
            </p>

            {completedSale.isCreditSale && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4 text-xs space-y-1 text-left">
                <div className="flex justify-between text-text-muted">
                  <span>Paid Upfront:</span>
                  <span className="font-semibold text-emerald-400">
                    ₹{(completedSale.amountPaidNow || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Remaining Due:</span>
                  <span className="font-bold text-amber-400">
                    ₹{(completedSale.remainingDue || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                {completedSale.dueDate && (
                  <div className="flex justify-between text-text-muted">
                    <span>Due Date:</span>
                    <span className="text-white">{completedSale.dueDate}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center gap-3">
              <PDFDownloadLink
                document={
                  <InvoicePDF
                    customerName={completedSale.customerName}
                    customerPhone={completedSale.customerPhone}
                    invoiceNumber={completedSale.invoiceNumber}
                    date={completedSale.date}
                    paymentMethod={completedSale.paymentMethod}
                    isCreditSale={completedSale.isCreditSale}
                    interestRate={completedSale.interestRate}
                    interestAmount={completedSale.interestAmount}
                    amountPaidNow={completedSale.amountPaidNow}
                    remainingDue={completedSale.remainingDue}
                    dueDate={completedSale.dueDate}
                    items={completedSale.items}
                  />
                }
                fileName={`invoice-${completedSale.invoiceNumber}.pdf`}
                className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>Download Invoice PDF</span>
              </PDFDownloadLink>
              <button
                onClick={closeModals}
                className="px-4 py-2.5 bg-background hover:bg-card-hover border border-border text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
