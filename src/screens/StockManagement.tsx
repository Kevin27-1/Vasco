import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, X, Check, Trash2, RefreshCw, Database, CheckCircle2, FileText } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { InvoicePDF } from '../components/InvoicePDF'
import { cn } from '../lib/utils'
import {
  type StockItem,
  type StockStatus,
  subscribeToStock,
  addStockItem,
  updateStockItem,
  deleteStockItem,
  seedInitialStockIfEmpty
} from '../services/stockService'
import { createSale, type SaleRecord } from '../services/salesService'

export default function StockManagement() {
  const [stock, setStock] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<StockItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Sell Stock modal state (triggered via tick mark)
  const [sellingItem, setSellingItem] = useState<StockItem | null>(null)
  const [sellForm, setSellForm] = useState({
    qty: 1,
    sellingPrice: 0,
    customerName: 'Walk-in Customer',
    customerPhone: '',
    paymentMethod: 'UPI',
    date: new Intl.DateTimeFormat('en-CA').format(new Date())
  })
  const [completedSale, setCompletedSale] = useState<SaleRecord | null>(null)

  // Add form state
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    size: '',
    qty: 1,
    purchasePrice: 0,
    minStockLevel: 2
  })

  // Subscribe to real-time Firestore updates
  useEffect(() => {
    let isMounted = true

    // Attempt to seed sample stock if collection is empty
    seedInitialStockIfEmpty()
      .catch((err) => console.warn('Seed stock skipped/failed:', err))
      .finally(() => {
        if (!isMounted) return
      })

    const unsubscribe = subscribeToStock(
      (items) => {
        setStock(items)
        setLoading(false)
        setErrorMsg(null)
      },
      (err) => {
        console.error('Firestore Stock Error:', err)
        setErrorMsg('Failed to sync with Firebase. Please check connection.')
        setLoading(false)
      }
    )

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const filteredStock = stock.filter(item => 
    item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.size.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.model.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateStock = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      await addStockItem({
        brand: formData.brand,
        model: formData.model,
        size: formData.size,
        qty: Number(formData.qty),
        purchasePrice: Number(formData.purchasePrice),
        minStockLevel: Number(formData.minStockLevel),
        lastUpdated: 'Just now'
      })
      setIsAddModalOpen(false)
      setFormData({
        brand: '',
        model: '',
        size: '',
        qty: 1,
        purchasePrice: 0,
        minStockLevel: 2
      })
    } catch (err: any) {
      console.error('Failed to add stock item:', err)
      setErrorMsg(err.message || 'Failed to save item to Firestore')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      await updateStockItem(editingItem.id, {
        brand: editingItem.brand,
        model: editingItem.model,
        size: editingItem.size,
        qty: Number(editingItem.qty),
        purchasePrice: Number(editingItem.purchasePrice),
        minStockLevel: Number(editingItem.minStockLevel || 2)
      })
      setEditingItem(null)
    } catch (err: any) {
      console.error('Failed to update stock item:', err)
      setErrorMsg(err.message || 'Failed to update item in Firestore')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenSellModal = (item: StockItem) => {
    setSellingItem(item)
    setSellForm({
      qty: item.qty, // Default to all remaining units so it sells out by selling
      sellingPrice: item.sellingPrice || 0,
      customerName: 'Walk-in Customer',
      customerPhone: '',
      paymentMethod: 'UPI',
      date: new Intl.DateTimeFormat('en-CA').format(new Date())
    })
    setErrorMsg(null)
  }

  const handleConfirmSell = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sellingItem) return
    if (sellForm.qty <= 0 || sellForm.qty > sellingItem.qty) {
      setErrorMsg(`Please enter a valid quantity between 1 and ${sellingItem.qty}`)
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const created = await createSale({
        customerName: sellForm.customerName.trim() || 'Walk-in Customer',
        customerPhone: sellForm.customerPhone.trim(),
        date: sellForm.date,
        paymentMethod: sellForm.paymentMethod,
        items: [
          {
            stockId: sellingItem.id,
            brand: sellingItem.brand,
            model: sellingItem.model,
            size: sellingItem.size,
            qty: sellForm.qty,
            price: sellForm.sellingPrice,
            purchasePrice: sellingItem.purchasePrice
          }
        ]
      })

      const isSoldOut = sellForm.qty >= sellingItem.qty
      setSuccessNotice(
        isSoldOut
          ? `Sold out all ${sellForm.qty} unit(s) of ${sellingItem.brand} ${sellingItem.model}! Invoice #${created.invoiceNumber} recorded in Sales.`
          : `Sold ${sellForm.qty} unit(s) of ${sellingItem.brand} ${sellingItem.model}. Invoice #${created.invoiceNumber} recorded in Sales.`
      )
      setCompletedSale(created)
      setSellingItem(null)
    } catch (err: any) {
      console.error('Failed to sell stock:', err)
      setErrorMsg(err.message || 'Failed to complete sale transaction in Firebase')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this tyre item from Firebase?')) {
      try {
        await deleteStockItem(id)
      } catch (err) {
        console.error('Failed to delete item:', err)
      }
    }
  }

  const handleSeedDefaults = async () => {
    setLoading(true)
    try {
      await seedInitialStockIfEmpty()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4 sm:border-b-0 sm:pb-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Stock Management</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Firebase
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">Real-time inventory synced with Cloud Firestore</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-text-muted" />
            </div>
            <input
              type="text"
              placeholder="Filter by brand, size, status..."
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
            <span>Add Stock</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400/70 hover:text-red-400 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-emerald-400/70 hover:text-emerald-400 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium text-text-muted">Product</th>
                <th className="px-6 py-4 font-medium text-text-muted">Size</th>
                <th className="px-6 py-4 font-medium text-text-muted">Qty</th>
                <th className="px-6 py-4 font-medium text-text-muted">Purchase (₹)</th>
                <th className="px-6 py-4 font-medium text-text-muted">Status</th>
                <th className="px-6 py-4 font-medium text-text-muted">Last Updated</th>
                <th className="px-6 py-4 font-medium text-text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-accent" />
                      <span>Loading inventory from Firebase...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStock.map((item) => (
                <tr key={item.id} className="hover:bg-card-hover/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-text-main">{item.brand}</p>
                    <p className="text-xs text-text-muted">{item.model}</p>
                  </td>
                  <td className="px-6 py-4 text-text-main font-mono text-xs">{item.size}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "font-semibold",
                      item.qty === 0 ? "text-red-400" : item.qty <= (item.minStockLevel || 2) ? "text-yellow-400" : "text-text-main"
                    )}>
                      {item.qty} units
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-main">₹{item.purchasePrice.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4 text-text-muted text-xs">{item.lastUpdated}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      {item.qty > 0 && item.status !== 'Sold' ? (
                        <button 
                          onClick={() => handleOpenSellModal(item)}
                          className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 hover:border-emerald-500 rounded-lg transition-all duration-150 shadow-sm"
                          title={`Sell ${item.brand} ${item.model} (Tick to sell out)`}
                        >
                          <Check className="w-4 h-4 text-emerald-400 group-hover:text-white transition-colors" />
                          <span className="text-xs font-semibold">Sell</span>
                        </button>
                      ) : (
                        <span 
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 border border-red-500/20"
                          title="This tyre stock has been sold out"
                        >
                          <Check className="w-3.5 h-3.5 text-red-400" />
                          <span>Sold Out</span>
                        </span>
                      )}
                      <button 
                        onClick={() => setEditingItem(item)}
                        className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                        title="Edit Item"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {!loading && filteredStock.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Database className="w-10 h-10 text-text-muted opacity-40" />
                      <p>No tyre items found in Firestore database.</p>
                      <button
                        onClick={handleSeedDefaults}
                        className="px-4 py-2 bg-card hover:bg-card-hover border border-border text-white text-xs font-semibold rounded-xl transition-colors"
                      >
                        Populate Sample Tyre Stock
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Stock Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Add New Tyre Stock</h2>
                <p className="text-xs text-text-muted">Will be recorded directly into Firebase</p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="text-text-muted hover:text-text-main p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form className="space-y-4" onSubmit={handleCreateStock}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Brand *</label>
                  <input 
                    type="text" 
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                    placeholder="e.g. MRF, Michelin" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Model *</label>
                  <input 
                    type="text" 
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                    placeholder="e.g. Zapper, Primacy 4" 
                    required 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Size Specification *</label>
                <input 
                  type="text" 
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                  placeholder="e.g. 205/55 R16, 90/90-12" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Quantity *</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={formData.qty}
                    onChange={(e) => setFormData({ ...formData, qty: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Purchase Price (₹) *</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={formData.purchasePrice || ''}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                    placeholder="0.00" 
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Minimum Stock Alert Level</label>
                <input 
                  type="number" 
                  min="1" 
                  value={formData.minStockLevel}
                  onChange={(e) => setFormData({ ...formData, minStockLevel: Math.max(1, parseInt(e.target.value) || 2) })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                  required 
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-text-main bg-background hover:bg-card-hover border border-border rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving to Firebase...
                    </>
                  ) : (
                    'Save to Firebase'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stock Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Edit Tyre Stock</h2>
                <p className="text-xs text-text-muted">{editingItem.brand} {editingItem.model}</p>
              </div>
              <button 
                onClick={() => setEditingItem(null)} 
                className="text-text-muted hover:text-text-main p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form className="space-y-4" onSubmit={handleUpdateStock}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Brand</label>
                  <input 
                    type="text" 
                    value={editingItem.brand}
                    onChange={(e) => setEditingItem({ ...editingItem, brand: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Model</label>
                  <input 
                    type="text" 
                    value={editingItem.model}
                    onChange={(e) => setEditingItem({ ...editingItem, model: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                    required 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Size Specification</label>
                <input 
                  type="text" 
                  value={editingItem.size}
                  onChange={(e) => setEditingItem({ ...editingItem, size: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Quantity</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={editingItem.qty}
                    onChange={(e) => setEditingItem({ ...editingItem, qty: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Purchase (₹)</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={editingItem.purchasePrice}
                    onChange={(e) => setEditingItem({ ...editingItem, purchasePrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Min Stock Alert Level</label>
                <input 
                  type="number" 
                  min="1" 
                  value={editingItem.minStockLevel || 2}
                  onChange={(e) => setEditingItem({ ...editingItem, minStockLevel: Math.max(1, parseInt(e.target.value) || 2) })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                  required 
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setEditingItem(null)}
                  className="px-5 py-2.5 text-sm font-medium text-text-main bg-background hover:bg-card-hover border border-border rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update in Firebase'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sell Stock Modal (Triggered by Tick Mark) */}
      {sellingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Sell Tyre Stock
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Creates Sale Record
                    </span>
                  </h2>
                  <p className="text-xs text-text-muted">
                    Sell out units & automatically record invoice in Firebase
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSellingItem(null)} 
                className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-card-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Tyre Summary Card */}
            <div className="p-3.5 rounded-xl bg-background/80 border border-border/80 mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-text-muted uppercase font-medium tracking-wider">Product</p>
                <p className="font-bold text-white text-base">{sellingItem.brand} {sellingItem.model}</p>
                <p className="text-xs font-mono text-text-muted mt-0.5">{sellingItem.size}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-text-muted block">Available in Stock</span>
                <span className="text-sm font-bold text-emerald-400">{sellingItem.qty} units</span>
                <span className="text-[11px] text-text-muted block mt-0.5">Purchase: ₹{sellingItem.purchasePrice.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmSell} className="space-y-4">
              {/* Quantity to sell */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-text-muted">
                    Quantity to Sell <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSellForm(f => ({ ...f, qty: 1 }))}
                      className={cn(
                        "px-2 py-0.5 rounded border transition-colors",
                        sellForm.qty === 1 
                          ? "bg-accent/20 border-accent/40 text-accent font-semibold" 
                          : "border-border text-text-muted hover:text-white"
                      )}
                    >
                      1 Unit
                    </button>
                    <button
                      type="button"
                      onClick={() => setSellForm(f => ({ ...f, qty: sellingItem.qty }))}
                      className={cn(
                        "px-2 py-0.5 rounded border transition-colors",
                        sellForm.qty === sellingItem.qty 
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 font-semibold" 
                          : "border-border text-text-muted hover:text-white"
                      )}
                    >
                      Sell All ({sellingItem.qty})
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={sellingItem.qty}
                    value={sellForm.qty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1
                      setSellForm(f => ({ ...f, qty: Math.min(sellingItem.qty, Math.max(1, val)) }))
                    }}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-text-muted">
                    / max {sellingItem.qty}
                  </span>
                </div>

                {sellForm.qty === sellingItem.qty ? (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <Check className="w-3.5 h-3.5" />
                    <span>Selling all {sellingItem.qty} units will mark this item as <strong>Sold Out</strong>.</span>
                  </div>
                ) : (
                  <div className="mt-1.5 text-[11px] text-text-muted">
                    Remaining after sale: {sellingItem.qty - sellForm.qty} units
                  </div>
                )}
              </div>

              {/* Selling price per unit & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Selling Price / Unit (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={sellForm.sellingPrice}
                    onChange={(e) => setSellForm(f => ({ ...f, sellingPrice: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Sale Date
                  </label>
                  <input
                    type="date"
                    value={sellForm.date}
                    onChange={(e) => setSellForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                    required
                  />
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={sellForm.customerName}
                    onChange={(e) => setSellForm(f => ({ ...f, customerName: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                    placeholder="e.g. Rahul Verma"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Customer Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={sellForm.customerPhone}
                    onChange={(e) => setSellForm(f => ({ ...f, customerPhone: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['UPI', 'Cash', 'Card', 'Net Banking'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSellForm(f => ({ ...f, paymentMethod: method }))}
                      className={cn(
                        "py-2 text-xs font-medium rounded-xl border transition-all text-center",
                        sellForm.paymentMethod === method
                          ? "bg-accent/15 border-accent text-accent font-semibold shadow-sm"
                          : "bg-background border-border text-text-muted hover:text-white hover:border-border/80"
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total & Profit Calculation Summary Box */}
              <div className="p-3.5 rounded-xl bg-accent/5 border border-accent/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-text-muted block">Total Sale Amount</span>
                  <span className="text-xl font-bold text-accent">
                    ₹{(sellForm.qty * sellForm.sellingPrice).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-text-muted block">Est. Profit</span>
                  <span className="text-sm font-semibold text-emerald-400">
                    +₹{Math.max(0, (sellForm.sellingPrice - sellingItem.purchasePrice) * sellForm.qty).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSellingItem(null)}
                  className="px-5 py-2.5 text-sm font-medium text-text-main bg-background hover:bg-card-hover border border-border rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/25 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Recording Sale...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{sellForm.qty === sellingItem.qty ? 'Confirm & Mark Sold Out' : 'Confirm Sale'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Generation Modal for Completed Sale */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-emerald-400/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Sale Recorded in Firebase!</h2>
            <p className="text-xs text-text-muted mb-2">
              Invoice #{completedSale.invoiceNumber} recorded in Sales.
            </p>
            <p className="text-xs text-emerald-400 font-medium mb-6">
              Inventory quantity and status updated in Cloud Firestore.
            </p>
            
            <div className="space-y-3">
              <PDFDownloadLink
                document={
                  <InvoicePDF
                    customerName={completedSale.customerName}
                    customerPhone={completedSale.customerPhone}
                    invoiceNumber={completedSale.invoiceNumber}
                    date={completedSale.date}
                    items={completedSale.items}
                  />
                }
                fileName={`invoice-${completedSale.invoiceNumber}.pdf`}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-accent/20"
              >
                {/* @ts-ignore */}
                {({ loading }) => (
                  loading ? (
                    'Generating PDF...'
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Download Tax Invoice</span>
                    </>
                  )
                )}
              </PDFDownloadLink>

              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="w-full py-2.5 px-4 bg-background hover:bg-card-hover border border-border text-text-main text-sm font-medium rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: StockStatus }) {
  let styles = ""
  
  if (status === 'In stock') styles = "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
  else if (status === 'Low stock') styles = "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20"
  else if (status === 'Sold') styles = "bg-red-400/10 text-red-400 border border-red-400/20"

  return (
    <span className={cn("px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1", styles)}>
      {status === 'Sold' ? (
        <>
          <Check className="w-3.5 h-3.5 text-red-400" />
          <span>Sold Out</span>
        </>
      ) : (
        status
      )}
    </span>
  )
}
