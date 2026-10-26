import { useState, useEffect } from 'react'
import { 
  Building2, 
  Receipt, 
  BellRing, 
  Database, 
  Save, 
  CheckCircle2, 
  Download, 
  RotateCcw,
  Sliders
} from 'lucide-react'
import { cn } from '../lib/utils'
import { subscribeToStock, seedInitialStockIfEmpty } from '../services/stockService'
import { subscribeToSales } from '../services/salesService'

export interface ShopSettings {
  storeName: string
  tagline: string
  ownerName: string
  phone: string
  email: string
  address: string
  gstin: string
  invoicePrefix: string
  defaultPaymentMethod: string
  taxRatePercent: number
  invoiceTerms: string
  defaultMinStockLevel: number
  enableLowStockAlerts: boolean
  enableSoundAlerts: boolean
}

const DEFAULT_SETTINGS: ShopSettings = {
  storeName: 'Vasco Treads',
  tagline: 'Tyre & Retreading Specialists',
  ownerName: 'Vasco Admin',
  phone: '7907271835',
  email: 'admin@vascotreads.com',
  address: 'Variyatyak, Kunnamangalam, Opp. Milk Society - 673 571',
  gstin: '32AAAAA0000A1Z5',
  invoicePrefix: 'INV-',
  defaultPaymentMethod: 'UPI',
  taxRatePercent: 18,
  invoiceTerms: 'Goods once sold will not be taken back without original bill. Warranty claims subject to manufacturer policies.',
  defaultMinStockLevel: 2,
  enableLowStockAlerts: true,
  enableSoundAlerts: false
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'store' | 'billing' | 'inventory' | 'data'>('store')
  const [settings, setSettings] = useState<ShopSettings>(() => {
    try {
      const saved = localStorage.getItem('vasco_shop_settings')
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const [stockCount, setStockCount] = useState<number>(0)
  const [salesCount, setSalesCount] = useState<number>(0)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    const unsubStock = subscribeToStock((items) => setStockCount(items.length))
    const unsubSales = subscribeToSales((sales) => setSalesCount(sales.length))
    return () => {
      unsubStock()
      unsubSales()
    }
  }, [])

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      localStorage.setItem('vasco_shop_settings', JSON.stringify(settings))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  const handleExportStockCSV = () => {
    subscribeToStock((items) => {
      const headers = ['Brand', 'Model', 'Size', 'Qty', 'PurchasePrice', 'SellingPrice', 'Status']
      const rows = items.map(i => [
        `"${i.brand}"`,
        `"${i.model}"`,
        `"${i.size}"`,
        i.qty,
        i.purchasePrice,
        i.sellingPrice,
        `"${i.status}"`
      ])
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `vasco-inventory-${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })()
  }

  const handleExportSalesCSV = () => {
    subscribeToSales((sales) => {
      const headers = ['InvoiceNumber', 'CustomerName', 'Phone', 'Date', 'TotalAmount', 'PaymentMethod', 'ItemsCount']
      const rows = sales.map(s => [
        `"${s.invoiceNumber}"`,
        `"${s.customerName}"`,
        `"${s.customerPhone}"`,
        `"${s.date}"`,
        s.totalAmount,
        `"${s.paymentMethod || 'Cash'}"`,
        s.items?.length || 0
      ])
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `vasco-sales-${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })()
  }

  const handleReSeedData = async () => {
    if (window.confirm('Populate initial tyre sample stock if empty?')) {
      setIsResetting(true)
      try {
        await seedInitialStockIfEmpty()
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2500)
      } catch (err) {
        console.error(err)
      } finally {
        setIsResetting(false)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4 sm:border-b-0 sm:pb-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Settings</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/30">
              <Sliders className="w-3.5 h-3.5" />
              Store Config
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">Manage store profile, tax details, invoice templates & data sync</p>
        </div>

        <button
          onClick={() => handleSave()}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-accent/20"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>Settings successfully updated and saved locally!</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { id: 'store', label: 'Store Profile', icon: Building2 },
          { id: 'billing', label: 'Billing & Invoices', icon: Receipt },
          { id: 'inventory', label: 'Inventory Rules', icon: BellRing },
          { id: 'data', label: 'Cloud & Data Sync', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all",
                isActive
                  ? "bg-accent text-white shadow-md shadow-accent/20 font-semibold"
                  : "bg-card text-text-muted hover:text-white hover:bg-card-hover border border-border"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab 1: Store Profile */}
      {activeTab === 'store' && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent" />
              Shop Identity & Contact
            </h2>
            <p className="text-xs text-text-muted mt-0.5">These details appear on your printed Tax Invoices and customer receipts</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Store / Business Name *</label>
              <div className="relative">
                <input
                  type="text"
                  value={settings.storeName}
                  onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                  placeholder="e.g. Vasco Treads"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Business Tagline</label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                placeholder="e.g. Tyre & Wheel Alignment Hub"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Manager / Owner Name</label>
              <input
                type="text"
                value={settings.ownerName}
                onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                placeholder="e.g. Vasco Admin"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Primary Phone Number *</label>
              <div className="relative">
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                  placeholder="e.g. 7907271835"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Business Email Address</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                placeholder="e.g. admin@vascotreads.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">GSTIN / Tax Identification</label>
              <input
                type="text"
                value={settings.gstin}
                onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm uppercase font-mono"
                placeholder="e.g. 32AAAAA0000A1Z5"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-text-muted mb-1.5">Full Physical Shop Address *</label>
              <textarea
                rows={2}
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                placeholder="e.g. Variyatyak, Kunnamangalam, Opp. Milk Society - 673 571"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Billing & Invoices */}
      {activeTab === 'billing' && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-accent" />
              Invoice & Tax Configuration
            </h2>
            <p className="text-xs text-text-muted mt-0.5">Customize automatic invoice numbering and tax breakdown for customers</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Invoice Number Prefix</label>
              <input
                type="text"
                value={settings.invoicePrefix}
                onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm font-mono"
                placeholder="e.g. INV-"
              />
              <span className="text-[11px] text-text-muted mt-1 block">Preview: {settings.invoicePrefix}1001</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Standard GST Rate (%)</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.taxRatePercent}
                  onChange={(e) => setSettings({ ...settings, taxRatePercent: Number(e.target.value) || 18 })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                />
                <span className="absolute right-3 top-2.5 text-xs text-text-muted">%</span>
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">Split: {settings.taxRatePercent / 2}% CGST + {settings.taxRatePercent / 2}% SGST</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Default Payment Method</label>
              <select
                value={settings.defaultPaymentMethod}
                onChange={(e) => setSettings({ ...settings, defaultPaymentMethod: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
              >
                <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                <option value="Cash">Cash</option>
                <option value="Card">Debit / Credit Card</option>
                <option value="Net Banking">Net Banking</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-text-muted mb-1.5">Invoice Terms & Conditions (Footer Note)</label>
              <textarea
                rows={3}
                value={settings.invoiceTerms}
                onChange={(e) => setSettings({ ...settings, invoiceTerms: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                placeholder="Disclaimer printed at the bottom of customer invoices"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Inventory Rules */}
      {activeTab === 'inventory' && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BellRing className="w-4 h-4 text-accent" />
              Inventory & Alert Thresholds
            </h2>
            <p className="text-xs text-text-muted mt-0.5">Control when tyre stock items trigger low stock and out of stock warnings</p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-background border border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Default Low Stock Alert Threshold</p>
                <p className="text-xs text-text-muted mt-0.5">Items with quantity at or below this value will trigger amber warning badges</p>
              </div>
              <div className="w-24">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.defaultMinStockLevel}
                  onChange={(e) => setSettings({ ...settings, defaultMinStockLevel: Math.max(1, parseInt(e.target.value) || 2) })}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-center text-white focus:outline-none focus:border-accent text-sm font-bold"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-background border border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Top Bar Notification Badges</p>
                <p className="text-xs text-text-muted mt-0.5">Show red/amber badge counters on the Topbar notification bell for low/depleted stock</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableLowStockAlerts}
                  onChange={(e) => setSettings({ ...settings, enableLowStockAlerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-card-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Cloud & Data Sync */}
      {activeTab === 'data' && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              Firebase Cloud Firestore Sync
            </h2>
            <p className="text-xs text-text-muted mt-0.5">Live database synchronization status and export options</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-background border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-muted uppercase">Inventory Collection</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <p className="text-2xl font-bold text-white">{stockCount} items</p>
              <p className="text-xs text-emerald-400 mt-1">Collection: stock</p>
              <button
                type="button"
                onClick={handleExportStockCSV}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 bg-card hover:bg-card-hover border border-border rounded-xl text-xs font-medium text-white transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Stock as CSV</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-background border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-muted uppercase">Sales & Invoices</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <p className="text-2xl font-bold text-white">{salesCount} invoices</p>
              <p className="text-xs text-emerald-400 mt-1">Collection: sales</p>
              <button
                type="button"
                onClick={handleExportSalesCSV}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 bg-card hover:bg-card-hover border border-border rounded-xl text-xs font-medium text-white transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Sales as CSV</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Reset Sample Tyre Stock</p>
              <p className="text-xs text-text-muted">Populates default MRF, Michelin, CEAT and Apollo items if the stock collection is empty</p>
            </div>
            <button
              type="button"
              onClick={handleReSeedData}
              disabled={isResetting}
              className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-card-hover border border-border text-xs font-medium text-text-main rounded-xl transition-colors disabled:opacity-50"
            >
              <RotateCcw className={cn("w-3.5 h-3.5", isResetting && "animate-spin")} />
              <span>Seed Sample Data</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
