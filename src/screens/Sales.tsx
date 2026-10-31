import { useState, useEffect } from 'react'
import { Plus, Search, X, FileText, Trash2, RefreshCw, Database } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { InvoicePDF } from '../components/InvoicePDF'
import {
  type SaleRecord,
  type SaleItemDetail,
  subscribeToSales,
  createSale,
  deleteSale,
  seedInitialSalesIfEmpty
} from '../services/salesService'
import { type StockItem, subscribeToStock } from '../services/stockService'

export default function Sales() {
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [availableStock, setAvailableStock] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form State
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [saleDate, setSaleDate] = useState(new Intl.DateTimeFormat('en-CA').format(new Date()))
  const [saleItems, setSaleItems] = useState<{ stockId: string; qty: number; price: number | '' }[]>([{ stockId: '', qty: 1, price: '' }])

  // PDF Generation State for newly completed sale
  const [completedSale, setCompletedSale] = useState<SaleRecord | null>(null)

  // Subscribe to real-time sales and stock from Firestore
  useEffect(() => {
    let isMounted = true

    // Attempt seed initial sales if empty
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
      // Only items that have qty > 0 are available to sell
      setAvailableStock(stockItems.filter((s) => s.qty > 0))
    })

    return () => {
      isMounted = false
      unsubSales()
      unsubStock()
    }
  }, [])

  const filteredSales = sales.filter((s) =>
    s.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.customerPhone.includes(searchQuery) ||
    s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.items.some((item) => item.brand.toLowerCase().includes(searchQuery.toLowerCase()))
  )

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

      if (itemsToSave.some(item => item.price <= 0)) {
        setErrorMessage('Please enter a valid selling price greater than 0 for each tyre item.')
        setIsSubmitting(false)
        return
      }

      const created = await createSale({
        customerName,
        customerPhone,
        date: saleDate,
        paymentMethod,
        items: itemsToSave
      })

      setCompletedSale(created)
      
      // Reset form
      setCustomerName('')
      setCustomerPhone('')
      setPaymentMethod('UPI')
      setSaleItems([{ stockId: '', qty: 1, price: '' }])
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

  const closeModals = () => {
    setIsAddModalOpen(false)
    setCompletedSale(null)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4 sm:border-b-0 sm:pb-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Sales & Invoices</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Firebase
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">Transactions and invoices recorded in Cloud Firestore</p>
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

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Sales Table */}
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
              ) : filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-card-hover/50 transition-colors">
                  <td className="px-6 py-4 text-text-main font-mono text-xs font-semibold">
                    #{sale.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 text-text-muted text-xs">{sale.date}</td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-text-main">{sale.customerName}</p>
                    <p className="text-xs text-text-muted">{sale.customerPhone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded text-xs bg-background border border-border text-text-muted">
                      {sale.paymentMethod || 'Cash'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-main">
                    {sale.items.length === 1 ? (
                      <div>
                        <span>{sale.items[0].brand} {sale.items[0].model}</span>
                        <span className="text-xs text-text-muted ml-1 font-mono">({sale.items[0].size})</span>
                      </div>
                    ) : (
                      <span className="font-medium text-accent">
                        {sale.items.length} Tyre Items
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-text-main font-medium">
                    {sale.items.reduce((acc, curr) => acc + curr.qty, 0)}
                  </td>
                  <td className="px-6 py-4 text-text-main font-semibold text-emerald-400">
                    ₹{(sale.totalAmount || sale.items.reduce((acc, curr) => acc + curr.price * curr.qty, 0)).toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <PDFDownloadLink
                        document={
                          <InvoicePDF
                            customerName={sale.customerName}
                            customerPhone={sale.customerPhone}
                            invoiceNumber={sale.invoiceNumber}
                            date={sale.date}
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
              ))}
              
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

      {/* Add Sale Modal */}
      {isAddModalOpen && !completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Create New Sale</h2>
                <p className="text-xs text-text-muted">Will reduce Firestore stock and issue invoice</p>
              </div>
              <button onClick={closeModals} className="text-text-muted hover:text-text-main p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form className="space-y-4" onSubmit={handleAddSale}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Customer Name *</label>
                  <input 
                    type="text" 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)} 
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
                    onChange={e => setCustomerPhone(e.target.value)} 
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                    placeholder="10-digit number" 
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Date</label>
                  <input 
                    type="date" 
                    value={saleDate} 
                    onChange={e => setSaleDate(e.target.value)} 
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Payment Method</label>
                  <select 
                    value={paymentMethod} 
                    onChange={e => setPaymentMethod(e.target.value)} 
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent text-sm"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-medium text-text-muted">Tyre Products (From Stock)</label>
                  <button 
                    type="button" 
                    onClick={() => setSaleItems([...saleItems, { stockId: '', qty: 1, price: '' }])} 
                    className="text-xs font-semibold text-accent hover:text-accent-hover flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3"/> Add Item
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-2 text-[11px] text-text-muted font-medium px-1">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-3">Selling Price (₹)</div>
                  <div className="col-span-1"></div>
                </div>
                
                {saleItems.map((item, index) => {
                  const selectedStock = availableStock.find(s => s.id === item.stockId)
                  return (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <select 
                          value={item.stockId} 
                          onChange={e => {
                            const newItems = [...saleItems]
                            newItems[index].stockId = e.target.value
                            const found = availableStock.find(s => s.id === e.target.value)
                            if (found?.sellingPrice && (newItems[index].price === '' || newItems[index].price === 0)) {
                              newItems[index].price = found.sellingPrice
                            }
                            setSaleItems(newItems)
                          }}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent appearance-none text-xs truncate" 
                          required
                        >
                          <option value="" disabled>Select tyre from stock...</option>
                          {availableStock.map(stock => (
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
                          onChange={e => {
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
                            onChange={e => {
                              const newItems = [...saleItems]
                              newItems[index].price = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0)
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

              {saleItems.some(i => i.stockId) && (
                <div className="mt-4 p-4 bg-background border border-border rounded-xl flex justify-between items-center">
                  <span className="text-text-muted text-sm font-medium">Total Amount:</span>
                  <span className="text-xl font-bold text-emerald-400">
                    ₹{saleItems.reduce((acc, curr) => {
                      const p = typeof curr.price === 'number' ? curr.price : parseFloat(String(curr.price)) || 0
                      return acc + (p * curr.qty)
                    }, 0).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-8">
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
                  className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Recording Sale...
                    </>
                  ) : (
                    'Complete Sale'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Generation Modal */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-emerald-400/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Sale Recorded in Firebase!</h2>
            <p className="text-xs text-text-muted mb-6">
              Invoice #{completedSale.invoiceNumber} is saved. Stock was updated in Cloud Firestore.
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
                className="w-full flex items-center justify-center py-3 px-4 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-accent/20"
              >
                {/* @ts-ignore */}
                {({ loading }) => (loading ? 'Generating PDF...' : 'Download Invoice PDF')}
              </PDFDownloadLink>
              <button 
                onClick={closeModals}
                className="w-full flex items-center justify-center py-3 px-4 bg-background hover:bg-card-hover border border-border text-text-main text-sm font-semibold rounded-xl transition-colors"
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
