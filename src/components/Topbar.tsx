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
  X
} from 'lucide-react'
import { cn } from '../lib/utils'
import { subscribeToStock, type StockItem } from '../services/stockService'
import { subscribeToSales, type SaleRecord } from '../services/salesService'

interface TopbarProps {
  onOpenMobileMenu?: () => void;
  onNavigate?: (screen: string) => void;
  onLogout?: () => void;
}

interface NotificationItem {
  id: string;
  type: 'out-of-stock' | 'low-stock' | 'sale' | 'system';
  title: string;
  desc: string;
  time: string;
  targetScreen: 'stock' | 'sales' | 'settings';
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

  // Real-time stock & sales for dynamic notifications
  const [stock, setStock] = useState<StockItem[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])

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
          email: parsed.email || 'admin@vascotreads.com',
          phone: parsed.phone || '7907271835'
        }
      }
    } catch {}
    return {
      name: 'Vasco Admin',
      store: 'Vasco Treads',
      email: 'admin@vascotreads.com',
      phone: '7907271835'
    }
  })

  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Subscriptions to live Firestore
  useEffect(() => {
    const unsubStock = subscribeToStock((items) => setStock(items))
    const unsubSales = subscribeToSales((records) => setSales(records))

    return () => {
      unsubStock()
      unsubSales()
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
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Generate real notifications from inventory & sales
  const notifications: NotificationItem[] = useMemo(() => {
    const list: NotificationItem[] = []

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
  }, [stock, sales])

  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'alerts') {
      return notifications.filter(n => n.type === 'low-stock' || n.type === 'out-of-stock')
    }
    if (notifFilter === 'sales') {
      return notifications.filter(n => n.type === 'sale')
    }
    return notifications
  }, [notifications, notifFilter])

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
      onNavigate(item.targetScreen)
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

        {/* Search input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-text-muted" />
          </div>
          <input
            type="text"
            placeholder="Search tyre brands, sizes, invoices..."
            className="block w-full pl-9 pr-3 py-1.5 sm:py-2 border border-border rounded-xl leading-5 bg-card text-text-main placeholder-text-muted focus:outline-none focus:border-accent text-xs transition-colors"
          />
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
    </header>
  )
}
