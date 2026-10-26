import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectContextType {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  selectedLabel: string
  setSelectedLabel: React.Dispatch<React.SetStateAction<string>>
}

const SelectContext = React.createContext<SelectContextType | null>(null)

function useSelect() {
  const context = React.useContext(SelectContext)
  if (!context) {
    throw new Error("Select components must be used within a Select provider")
  }
  return context
}

export function Select({
  value,
  onValueChange,
  children
}: {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [selectedLabel, setSelectedLabel] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange,
        open,
        setOpen,
        selectedLabel,
        setSelectedLabel
      }}
    >
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = useSelect()

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-text-main shadow-sm transition-colors hover:bg-card-hover focus:outline-none focus:border-accent",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 opacity-60 transition-transform duration-200", open && "rotate-180")} />
    </button>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { selectedLabel, value } = useSelect()
  return <span>{selectedLabel || value || placeholder}</span>
}

export function SelectContent({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
  const { open } = useSelect()
  if (!open) return null

  return (
    <div
      className={cn(
        "absolute right-0 z-50 mt-1 min-w-[8rem] overflow-hidden rounded-xl border border-border bg-card p-1 text-text-main shadow-xl animate-in fade-in-0 zoom-in-95",
        className
      )}
    >
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

export function SelectItem({
  value,
  children,
  className
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const { value: selectedValue, onValueChange, setOpen, setSelectedLabel } = useSelect()
  const isSelected = selectedValue === value

  // Set label if this is selected on mount
  React.useEffect(() => {
    if (isSelected && typeof children === "string") {
      setSelectedLabel(children)
    }
  }, [isSelected, children, setSelectedLabel])

  return (
    <div
      onClick={() => {
        onValueChange(value)
        if (typeof children === "string") {
          setSelectedLabel(children)
        }
        setOpen(false)
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors hover:bg-card-hover hover:text-white",
        isSelected && "bg-accent/10 text-accent font-semibold",
        className
      )}
    >
      {children}
    </div>
  )
}
