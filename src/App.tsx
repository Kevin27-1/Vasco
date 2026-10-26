import { useState } from 'react'
import { 
  LayoutDashboard, 
  PackageSearch, 
  CircleDollarSign, 
  Receipt, 
  Menu 
} from 'lucide-react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './screens/Dashboard'
import StockManagement from './screens/StockManagement'
import Login from './screens/Login'
import Sales from './screens/Sales'
import Expenses from './screens/Expenses'
import Settings from './screens/Settings'
import { cn } from './lib/utils'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />
  }

  const mobileNavTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'stock', label: 'Stock', icon: PackageSearch },
    { id: 'sales', label: 'Sales', icon: CircleDollarSign },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar with Mobile Drawer capability */}
      <Sidebar 
        activeScreen={activeScreen} 
        setActiveScreen={setActiveScreen}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Topbar 
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={(screen) => setActiveScreen(screen)}
          onLogout={() => setIsAuthenticated(false)}
        />
        
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-24 md:pb-6">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {activeScreen === 'dashboard' && <Dashboard />}
            {activeScreen === 'stock' && <StockManagement />}
            {activeScreen === 'sales' && <Sales />}
            {activeScreen === 'expenses' && <Expenses />}
            {activeScreen === 'settings' && <Settings />}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar (app-like experience) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-md border-t border-border z-40 flex items-center justify-around px-2 shadow-2xl">
          {mobileNavTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeScreen === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveScreen(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-1 transition-all",
                  isActive ? "text-accent" : "text-text-muted hover:text-text-main"
                )}
              >
                <div className={cn(
                  "p-1 rounded-xl transition-all",
                  isActive && "bg-accent/15"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium tracking-tight mt-0.5">
                  {tab.label}
                </span>
              </button>
            )
          })}

          {/* More menu drawer trigger button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 text-text-muted hover:text-text-main transition-colors"
          >
            <div className="p-1 rounded-xl">
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium tracking-tight mt-0.5">
              More
            </span>
          </button>
        </nav>
      </div>
    </div>
  )
}

export default App
