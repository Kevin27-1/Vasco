import { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Search, 
  Bell, 
  CalendarDays, 
  Database, 
  Menu, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Settings, 
  LogOut, 
  PackageSearch, 
  CircleDollarSign, 
  Receipt, 
  User, 
  ChevronDown, 
  X,
  LayoutDashboard,
  ArrowRight
} from 'lucide-react'
import { cn } from '../lib/utils'
import { subscribeToStock, type StockItem } from '../services/stockService'
import { subscribeToSales, type SaleRecord } from '../services/salesService'
import { subscribeToExpenses, type ExpenseRecord } from '../services/expenseService'

interface TopbarProps {
  onOpenMobileMenu?: () => void;
  onNavigate?: (screen: string, searchFilter?: string) => void;
  onLogout?: () => void;
}

interface NotificationItem {
  id: string;
  type: 'overdue-sale' | 'out-of-stock' | 'low-stock' | 'sale' | 'system';
  title: string;
  desc: string;
  time: string;
  targetScreen: 'stock' | 'sales' | 'settings';
  searchFilter?: string;
}

export default function Topbar({ onOpenMobileMenu, onNavigate, onLogout }: TopbarProps) {
  // Stable date string without render impurity
  const currentDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date())
  }, [])

  // Dropdown states
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [notifFilter, setNotifFilter] = useState<'all' | 'alerts' | 'sales'>('all')
  const [isOverdueToastDismissed, setIsOverdueToastDismissed] = useState(false)

  // Global search state
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Real-time stock, sales & expenses for dynamic notifications and global search
  const [stock, setStock] = useState<StockItem[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])

  // Read notifications tracked in localStorage
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vasco_read_notifications')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Profile data from shop settings
  const [profileData, setProfileData] = useState(() => {
    try {
      const saved = localStorage.getItem('vasco_shop_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          name: parsed.ownerName || 'Vasco Admin',
          store: parsed.storeName || 'Vasco Treads',
          email: parsed.email || 'vascotreadskgm@gmail.com',
          phone: parsed.phone || '7907271835'
        }
      }
    } catch {}
    return {
      name: 'Vasco Admin',
      store: 'Vasco Treads',
      email: 'vascotreadskgm@gmail.com',
      phone: '7907271835'
    }
  })

  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Subscriptions to live Firestore
  useEffect(() => {
    const unsubStock = subscribeToStock((items) => setStock(items))
    const unsubSales = subscribeToSales((records) => setSales(records))
    const unsubExpenses = subscribeToExpenses((records) => setExpenses(records))

    return () => {
      unsubStock()
      unsubSales()
      unsubExpenses()
    }
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard shortcuts: Ctrl+K or '/' to focus search, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        setIsSearchOpen(true)
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
        setIsSearchOpen(true)
      } else if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false)
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])

  // Global search results across Stock, Sales/Invoices, Expenses, and Pages
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      return {
        stock: [] as StockItem[],
        sales: [] as SaleRecord[],
        expenses: [] as ExpenseRecord[],
        pages: [] as { id: string; label: string; desc: string; icon: typeof LayoutDashboard }[],
        totalCount: 0
      }
    }

    const matchedStock = stock
      .filter(
        (item) =>
          item.brand.toLowerCase().includes(q) ||
          item.model.toLowerCase().includes(q) ||
          item.size.toLowerCase().includes(q) ||
          (item.tyreType || '').toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q)
      )
      .slice(0, 5)

    const matchedSales = sales
      .filter(
        (s) =>
          s.invoiceNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.customerPhone.toLowerCase().includes(q) ||
          (s.vehicleNumber || '').toLowerCase().includes(q) ||
          (s.paymentMethod || '').toLowerCase().includes(q) ||
          s.items.some(
            (it) =>
              it.brand.toLowerCase().includes(q) ||
              it.model?.toLowerCase().includes(q) ||
              it.size?.toLowerCase().includes(q) ||
              (it.tyreType || '').toLowerCase().includes(q)
          )
      )
      .slice(0, 5)

    const matchedExpenses = expenses
      .filter(
        (ex) =>
          ex.title.toLowerCase().includes(q) ||
          ex.category.toLowerCase().includes(q) ||
          (ex.notes || '').toLowerCase().includes(q) ||
          (ex.receiptNumber || '').toLowerCase().includes(q) ||
          ex.paymentMethod.toLowerCase().includes(q)
      )
      .slice(0, 4)

    const allPages = [
      { id: 'dashboard', label: 'Dashboard Overview', desc: 'Net profit, revenue, & daily charts', icon: LayoutDashboard },
      { id: 'stock', label: 'Stock Management', desc: 'Tyre inventory, sizes & construction types', icon: PackageSearch },
      { id: 'sales', label: 'Sales & Invoices', desc: 'Billing, vehicle plates, credit & dues', icon: CircleDollarSign },
      { id: 'expenses', label: 'Expenses & Overhead', desc: 'Daily, monthly & one-time shop expenses', icon: Receipt },
      { id: 'settings', label: 'Settings & CSV Export', desc: 'Shop details, tax settings & data backups', icon: Settings }
    ]

    const matchedPages = allPages.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    )

    return {
      stock: matchedStock,
      sales: matchedSales,
      expenses: matchedExpenses,
      pages: matchedPages,
      totalCount: matchedStock.length + matchedSales.length + matchedExpenses.length + matchedPages.length
    }
  }, [searchQuery, stock, sales, expenses])

  const handleSelectSearchResult = (screen: string, filterText?: string) => {
    setIsSearchOpen(false)
    if (onNavigate) {
      onNavigate(screen, filterText)
    }
  }

  // Overdue credit sales (due date passed and balance remaining)
  const overdueSales = useMemo(() => {
    const today = new Intl.DateTimeFormat('en-CA').format(new Date())
    const todayMs = new Date(today).getTime()
    return sales
      .filter((s) => {
        const isCredit = s.paymentMethod === 'Credit' || s.isCreditSale
        const due = Number(s.remainingDue ?? Math.max(0, s.totalAmount - (s.amountPaidNow || 0)))
        return isCredit && due > 0 && !!s.dueDate && s.dueDate < today
      })
      .map((s) => {
        const due = Number(s.remainingDue ?? Math.max(0, s.totalAmount - (s.amountPaidNow || 0)))
        const dueMs = new Date(s.dueDate!).getTime()
        const daysOverdue = Math.max(1, Math.ceil((todayMs - dueMs) / (1000 * 60 * 60 * 24)))
        return { sale: s, due, daysOverdue }
      })
  }, [sales])

  // Generate real notifications from inventory & sales
  const notifications: NotificationItem[] = useMemo(() => {
    const list: NotificationItem[] = []

    // 0. Overdue Credit Sales (highest priority)
    overdueSales.forEach(({ sale: s, due, daysOverdue }) => {
      list.push({
        id: `overdue-${s.id}`,
        type: 'overdue-sale',
        title: `Sale Overdue: #${s.invoiceNumber}`,
        desc: `${s.customerName || 'Customer'}${s.vehicleNumber ? ` (${s.vehicleNumber})` : ''} • ₹${due.toLocaleString('en-IN')} due (Due ${s.dueDate})`,
        time: `${daysOverdue}d overdue`,
        targetScreen: 'sales',
        searchFilter: s.invoiceNumber
      })
    })

    // 1. Out of stock tyre items
    stock.filter(item => item.qty === 0 || item.status === 'Sold').forEach(item => {
      list.push({
        id: `sold-${item.id}`,
        type: 'out-of-stock',
        title: `Out of Stock: ${item.brand} ${item.model}`,
        desc: `Size ${item.size} has 0 units left. Replenish stock.`,
        time: item.lastUpdated || 'Urgent',
        targetScreen: 'stock'
      })
    })

    // 2. Low stock tyre items
    stock.filter(item => item.qty > 0 && item.qty <= (item.minStockLevel || 2)).forEach(item => {
      list.push({
        id: `low-${item.id}`,
        type: 'low-stock',
        title: `Low Stock: ${item.brand} ${item.model}`,
        desc: `Only ${item.qty} units left (Min threshold: ${item.minStockLevel || 2}).`,
        time: item.lastUpdated || 'Attention',
        targetScreen: 'stock'
      })
    })

    // 3. Recent Sales
    sales.slice(0, 4).forEach(s => {
      list.push({
        id: `sale-${s.id}`,
        type: 'sale',
        title: `Sale: #${s.invoiceNumber}`,
        desc: `${s.customerName || 'Customer'}${s.vehicleNumber ? ` (${s.vehicleNumber})` : ''} purchased tyre(s) • ₹${s.totalAmount.toLocaleString('en-IN')}`,
        time: s.date || 'Recent',
        targetScreen: 'sales'
      })
    })

    // 4. Cloud connection status
    list.push({
      id: 'system-live-sync',
      type: 'system',
      title: 'Cloud Firestore Connected',
      desc: 'Real-time database sync active for Vasco Treads.',
      time: 'Online',
      targetScreen: 'settings'
    })

    return list
  }, [stock, sales, overdueSales])

  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'alerts') {
      return notifications.filter(n => n.type === 'overdue-sale' || n.type === 'low-stock' || n.type === 'out-of-stock')
    }
    if (notifFilter === 'sales') {
      return notifications.filter(n => n.type === 'sale' || n.type === 'overdue-sale')
    }
    return notifications
  }, [notifications, notifFilter])

  const unreadOverdueNotifications = useMemo(() => {
    return notifications.filter(n => n.type === 'overdue-sale' && !readNotifIds.includes(n.id))
  }, [notifications, readNotifIds])

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !readNotifIds.includes(n.id)).length
  }, [notifications, readNotifIds])

  const handleMarkAllRead = () => {
    const allIds = notifications.map(n => n.id)
    setReadNotifIds(allIds)
    try {
      localStorage.setItem('vasco_read_notifications', JSON.stringify(allIds))
    } catch {}
  }

  const handleNotificationClick = (item: NotificationItem) => {
    if (!readNotifIds.includes(item.id)) {
      const updated = [...readNotifIds, item.id]
      setReadNotifIds(updated)
      try {
        localStorage.setItem('vasco_read_notifications', JSON.stringify(updated))
      } catch {}
    }
    setIsNotificationsOpen(false)
    if (onNavigate) {
      onNavigate(item.targetScreen, item.searchFilter)
    }
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const existing = localStorage.getItem('vasco_shop_settings')
      const current = existing ? JSON.parse(existing) : {}
      const updated = {
        ...current,
        ownerName: profileData.name,
        storeName: profileData.store,
        email: profileData.email,
        phone: profileData.phone
      }
      localStorage.setItem('vasco_shop_settings', JSON.stringify(updated))
      setIsEditProfileOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <header className="h-16 sm:h-20 bg-background flex items-center justify-between px-3 sm:px-6 border-b border-border shrink-0 relative z-30">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-md">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-text-muted hover:text-white hover:bg-card border border-border/60 transition-colors"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Interactive Search */}
        <div className="relative flex-1" ref={searchRef}>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-text-muted" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setIsSearchOpen(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  e.preventDefault()
                  if (searchResults.stock.length > 0) {
                    handleSelectSearchResult('stock', searchQuery.trim())
                  } else if (searchResults.sales.length > 0) {
                    handleSelectSearchResult('sales', searchQuery.trim())
                  } else if (searchResults.expenses.length > 0) {
                    handleSelectSearchResult('expenses', searchQuery.trim())
                  } else if (searchResults.pages.length > 0) {
                    handleSelectSearchResult(searchResults.pages[0].id)
                  }
                }
              }}
              placeholder="Search tyres, plates, customers, invoices..."
              className="block w-full pl-9 pr-14 py-1.5 sm:py-2 border border-border rounded-xl leading-5 bg-card text-text-main placeholder-text-muted focus:outline-none focus:border-accent text-xs transition-colors"
            />
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    searchInputRef.current?.focus()
                  }}
                  className="p-1 text-text-muted hover:text-white rounded-md transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-background border border-border rounded">
                  Ctrl K
                </kbd>
              )}
            </div>
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 sm:w-[440px] mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="max-h-[70vh] overflow-y-auto divide-y divide-border/60">
                {searchResults.totalCount === 0 ? (
                  <div className="p-6 text-center text-text-muted">
                    <Search className="w-7 h-7 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium text-white">No results for "{searchQuery}"</p>
                    <p className="text-[11px] mt-0.5">Try searching a brand, tyre size, customer name, vehicle plate, or invoice #</p>
                  </div>
                ) : (
                  <>
                    {/* Stock Results */}
                    {searchResults.stock.length > 0 && (
                      <div className="p-2">
                        <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          <span className="flex items-center gap-1.5">
                            <PackageSearch className="w-3 h-3 text-emerald-400" />
                            Tyre Stock
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectSearchResult('stock', searchQuery.trim())}
                            className="text-accent hover:underline normal-case font-medium"
                          >
                            Filter in Stock →
                          </button>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {searchResults.stock.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectSearchResult('stock', item.brand + ' ' + item.model)}
                              className="w-full px-2.5 py-2 rounded-xl hover:bg-card-hover transition-colors text-left flex items-center justify-between gap-2 group"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-white truncate">
                                    {item.brand} {item.model}
                                  </span>
                                  <span className="text-[10px] font-mono text-text-muted">({item.size})</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    {item.tyreType || 'Tubeless + Radial'}
                                  </span>
                                  <span className="text-[10px] text-text-muted">
                                    ₹{item.purchasePrice.toLocaleString('en-IN')}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={cn(
                                    "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                                    item.qty === 0
                                      ? "bg-red-500/10 text-red-400"
                                      : item.qty <= (item.minStockLevel || 2)
                                      ? "bg-yellow-500/10 text-yellow-400"
                                      : "bg-emerald-500/10 text-emerald-400"
                                  )}
                                >
                                  {item.qty} in stock
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sales & Invoices Results */}
                    {searchResults.sales.length > 0 && (
                      <div className="p-2">
                        <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          <span className="flex items-center gap-1.5">
                            <CircleDollarSign className="w-3 h-3 text-blue-400" />
                            Sales & Invoices
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectSearchResult('sales', searchQuery.trim())}
                            className="text-accent hover:underline normal-case font-medium"
                          >
                            Filter in Sales →
                          </button>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {searchResults.sales.map((sale) => (
                            <button
                              key={sale.id}
                              type="button"
                              onClick={() => handleSelectSearchResult('sales', sale.invoiceNumber)}
                              className="w-full px-2.5 py-2 rounded-xl hover:bg-card-hover transition-colors text-left flex items-center justify-between gap-2 group"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-mono font-bold text-accent">
                                    #{sale.invoiceNumber}
                                  </span>
                                  <span className="text-xs font-semibold text-white truncate">
                                    {sale.customerName}
                                  </span>
                                  {sale.vehicleNumber && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#2a2a2a] text-amber-300 border border-white/5">
                                      {sale.vehicleNumber}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-text-muted mt-0.5 truncate">
                                  {sale.date} • {sale.customerPhone || 'No phone'} • {sale.paymentMethod || 'Cash'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-right">
                                <div>
                                  <span className="text-xs font-bold text-emerald-400 block">
                                    ₹{sale.totalAmount.toLocaleString('en-IN')}
                                  </span>
                                  {sale.isCreditSale && (sale.remainingDue || 0) > 0 && (
                                    <span className="text-[10px] text-amber-400 font-mono">
                                      Due ₹{(sale.remainingDue || 0).toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expenses Results */}
                    {searchResults.expenses.length > 0 && (
                      <div className="p-2">
                        <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          <span className="flex items-center gap-1.5">
                            <Receipt className="w-3 h-3 text-amber-400" />
                            Expenses
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectSearchResult('expenses', searchQuery.trim())}
                            className="text-accent hover:underline normal-case font-medium"
                          >
                            Filter in Expenses →
                          </button>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {searchResults.expenses.map((exp) => (
                            <button
                              key={exp.id}
                              type="button"
                              onClick={() => handleSelectSearchResult('expenses', exp.title)}
                              className="w-full px-2.5 py-2 rounded-xl hover:bg-card-hover transition-colors text-left flex items-center justify-between gap-2 group"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{exp.title}</p>
                                <p className="text-[10px] text-text-muted mt-0.5 truncate">
                                  {exp.category} • {exp.frequency} • {exp.date}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold text-red-400">
                                  ₹{exp.amount.toLocaleString('en-IN')}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Pages */}
                    {searchResults.pages.length > 0 && (
                      <div className="p-2">
                        <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          Quick Navigation
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {searchResults.pages.map((page) => {
                            const Icon = page.icon
                            return (
                              <button
                                key={page.id}
                                type="button"
                                onClick={() => handleSelectSearchResult(page.id)}
                                className="w-full px-2.5 py-2 rounded-xl hover:bg-card-hover transition-colors text-left flex items-center justify-between gap-2 group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="p-1.5 rounded-lg bg-background border border-border text-accent">
                                    <Icon className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white">{page.label}</p>
                                    <p className="text-[10px] text-text-muted truncate">{page.desc}</p>
                                  </div>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {searchResults.totalCount > 0 && (
                <div className="px-3 py-2 bg-background/80 border-t border-border text-[10px] text-text-muted flex items-center justify-between">
                  <span>Press <kbd className="px-1 py-0.5 bg-card border border-border rounded font-mono">Enter</kbd> to jump to top match</span>
                  <span><kbd className="px-1 py-0.5 bg-card border border-border rounded font-mono">Esc</kbd> to close</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 ml-2">
        {/* Firebase Live Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] font-medium text-emerald-400">
          <Database className="w-3 h-3 text-emerald-400" />
          <span className="hidden sm:inline">Firebase: vasco</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>

        {/* Current Date Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-card rounded-full border border-border text-xs font-medium text-text-muted">
          <CalendarDays className="w-3.5 h-3.5" />
          {currentDate}
        </div>
        
        {/* Functional Notification Bell with Dropdown */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => {
              setIsNotificationsOpen(prev => !prev)
              setIsProfileOpen(false)
            }}
            className={cn(
              "relative p-2 text-text-muted hover:text-white transition-all bg-card rounded-xl border border-border",
              isNotificationsOpen && "bg-card-hover border-accent/40 text-white shadow-sm"
            )}
            title="Notifications"
            aria-label="Open notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white shadow-sm ring-2 ring-background animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-text-muted hover:text-accent font-medium transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="px-3 pt-2 pb-1 border-b border-border/50 flex gap-1.5 bg-background/50">
                {(['all', 'alerts', 'sales'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setNotifFilter(tab)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-lg capitalize transition-colors font-medium",
                      notifFilter === tab 
                        ? "bg-card text-white font-semibold shadow-xs" 
                        : "text-text-muted hover:text-white"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center text-text-muted text-xs">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-text-muted/40" />
                    <p>No notifications in this category.</p>
                  </div>
                ) : (
                  filteredNotifications.map(item => {
                    const isRead = readNotifIds.includes(item.id)

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={cn(
                          "p-3.5 flex items-start gap-3 cursor-pointer hover:bg-card-hover transition-colors",
                          !isRead && "bg-accent/5"
                        )}
                      >
                        {/* Icon */}
                        <div className="shrink-0 mt-0.5">
                          {item.type === 'overdue-sale' && (
                            <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center ring-1 ring-red-500/30">
                              <AlertCircle className="w-4 h-4" />
                            </div>
                          )}
                          {item.type === 'out-of-stock' && (
                            <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
                              <AlertCircle className="w-4 h-4" />
                            </div>
                          )}
                          {item.type === 'low-stock' && (
                            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                          )}
                          {item.type === 'sale' && (
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                              <CircleDollarSign className="w-4 h-4" />
                            </div>
                          )}
                          {item.type === 'system' && (
                            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                              <Database className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p className={cn("text-xs font-semibold truncate", !isRead ? "text-white" : "text-text-main")}>
                              {item.title}
                            </p>
                            <span className="text-[10px] text-text-muted shrink-0">{item.time}</span>
                          </div>
                          <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>

                        {/* Unread indicator */}
                        {!isRead && (
                          <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-2.5 bg-background border-t border-border flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    setIsNotificationsOpen(false)
                    if (onNavigate) onNavigate('stock')
                  }}
                  className="text-text-muted hover:text-white transition-colors"
                >
                  View Stock Alerts
                </button>
                <button
                  onClick={() => {
                    setIsNotificationsOpen(false)
                    if (onNavigate) onNavigate('settings')
                  }}
                  className="text-accent hover:underline font-medium"
                >
                  Notification Settings
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Functional Admin Profile Button & Dropdown */}
        <div className="relative pl-1 sm:pl-2 border-l border-border/80" ref={profileRef}>
          <button 
            onClick={() => {
              setIsProfileOpen(prev => !prev)
              setIsNotificationsOpen(false)
            }}
            className={cn(
              "flex items-center gap-2 p-1.5 rounded-xl transition-all border border-transparent",
              isProfileOpen ? "bg-card border-border shadow-sm" : "hover:bg-card/70 hover:border-border/60"
            )}
            aria-label="Open profile menu"
          >
            <div className="relative">
              <img
                className="h-8 w-8 rounded-full border border-border object-cover"
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                alt="Admin Avatar"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-background"></span>
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-white leading-tight">{profileData.name}</span>
              <span className="text-[10px] text-text-muted leading-tight">{profileData.store}</span>
            </div>
            <ChevronDown className={cn("w-3.5 h-3.5 text-text-muted transition-transform duration-200 hidden sm:block", isProfileOpen && "rotate-180 text-white")} />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Profile Card Header */}
              <div className="p-4 border-b border-border bg-background/50">
                <div className="flex items-center gap-3">
                  <img
                    className="h-10 w-10 rounded-full border border-border object-cover"
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    alt="Admin Avatar"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{profileData.name}</p>
                    <p className="text-xs text-text-muted truncate">{profileData.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-medium text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      Store Owner
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="p-2 space-y-1">
                <button
                  onClick={() => {
                    setIsProfileOpen(false)
                    if (onNavigate) onNavigate('settings')
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-main hover:text-white hover:bg-card-hover transition-colors"
                >
                  <Settings className="w-4 h-4 text-accent" />
                  <span>Store Settings</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false)
                    if (onNavigate) onNavigate('stock')
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-main hover:text-white hover:bg-card-hover transition-colors"
                >
                  <PackageSearch className="w-4 h-4 text-emerald-400" />
                  <span>Manage Stock</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false)
                    if (onNavigate) onNavigate('sales')
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-main hover:text-white hover:bg-card-hover transition-colors"
                >
                  <CircleDollarSign className="w-4 h-4 text-blue-400" />
                  <span>Sales & Invoices</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false)
                    if (onNavigate) onNavigate('expenses')
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-main hover:text-white hover:bg-card-hover transition-colors"
                >
                  <Receipt className="w-4 h-4 text-amber-400" />
                  <span>Expenses Outflow</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false)
                    setIsEditProfileOpen(true)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-main hover:text-white hover:bg-card-hover transition-colors"
                >
                  <User className="w-4 h-4 text-purple-400" />
                  <span>Edit Profile</span>
                </button>
              </div>

              {/* Sign Out Button */}
              <div className="p-2 border-t border-border bg-background/50">
                <button
                  onClick={() => {
                    setIsProfileOpen(false)
                    if (onLogout) onLogout()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out (Logout)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Quick Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-border">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-accent" />
                Edit Admin Profile
              </h2>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-card-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Admin / Owner Name</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Store Name</label>
                <input
                  type="text"
                  value={profileData.store}
                  onChange={(e) => setProfileData({ ...profileData, store: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Email Address</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-text-main bg-background hover:bg-card-hover border border-border rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors shadow-lg shadow-accent/20"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Automatic Overdue Sale Alert Message Toast */}
      {!isOverdueToastDismissed && unreadOverdueNotifications.length > 0 && (
        <div className="fixed bottom-20 md:bottom-5 right-4 z-50 max-w-sm w-[calc(100%-2rem)] bg-card border border-red-500/40 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/25 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide">
                  {unreadOverdueNotifications.length === 1
                    ? 'Sale Payment Overdue'
                    : `${unreadOverdueNotifications.length} Sales Became Overdue`}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsOverdueToastDismissed(true)}
                  className="text-text-muted hover:text-white p-0.5 rounded"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-white font-medium mt-1">
                {unreadOverdueNotifications[0].title}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                {unreadOverdueNotifications[0].desc}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsOverdueToastDismissed(true)
                    handleNotificationClick(unreadOverdueNotifications[0])
                  }}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold rounded-lg transition-colors"
                >
                  View Overdue Sale
                </button>
                <button
                  type="button"
                  onClick={() => setIsOverdueToastDismissed(true)}
                  className="px-2.5 py-1.5 bg-background hover:bg-card-hover border border-border text-text-muted hover:text-white text-[11px] font-medium rounded-lg transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
