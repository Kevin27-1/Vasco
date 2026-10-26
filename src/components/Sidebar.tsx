import { 
  LayoutDashboard, 
  PackageSearch, 
  CircleDollarSign, 
  Receipt, 
  Settings, 
  X 
} from 'lucide-react'
import { cn } from '../lib/utils'

interface SidebarProps {
  activeScreen: string;
  setActiveScreen: (screen: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'stock', label: 'Stock', icon: PackageSearch },
  { id: 'sales', label: 'Sales', icon: CircleDollarSign },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
]

export default function Sidebar({ 
  activeScreen, 
  setActiveScreen,
  isOpen = false,
  onClose 
}: SidebarProps) {
  const handleNavClick = (id: string) => {
    setActiveScreen(id)
    if (onClose) onClose()
  }

  const sidebarContent = (
    <div className="w-72 md:w-64 bg-card h-full flex flex-col border-r border-border">
      <div className="p-5 md:p-6 flex items-center justify-between border-b border-border/50 md:border-b-0">
        <div className="flex items-center gap-3">
          {/* Stylized tyre logo */}
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 shadow-md shadow-accent/20">
            <div className="w-4 h-4 border-2 border-white rounded-full border-dashed animate-[spin_10s_linear_infinite]" />
          </div>
          <div>
            <span className="font-bold text-lg text-white block leading-tight">Vasco Treads</span>
            <span className="text-[10px] text-text-muted">Tyre Management</span>
          </div>
        </div>

        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-card-hover transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-1.5 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeScreen === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                isActive 
                  ? "bg-accent/10 text-accent font-semibold shadow-sm" 
                  : "text-text-muted hover:bg-card-hover hover:text-text-main"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
              )}
            </button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <button 
          onClick={() => handleNavClick('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium",
            activeScreen === 'settings'
              ? "bg-accent/10 text-accent font-semibold shadow-sm"
              : "text-text-muted hover:bg-card-hover hover:text-text-main"
          )}
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
          {activeScreen === 'settings' && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
          )}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden md:flex h-full shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer with Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Drawer content */}
          <div className="relative z-10 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
