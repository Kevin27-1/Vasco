import * as React from "react"
import {
  ResponsiveContainer,
  Tooltip,
  Legend
} from "recharts"
import { cn } from "@/lib/utils"

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    icon?: React.ComponentType
    color?: string
    theme?: Record<string, string>
  }
>

interface ChartContextProps {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

export function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }
  return context
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ReactNode
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  // Build style properties for each entry in config
  const styleVars = React.useMemo(() => {
    const styleObj: Record<string, string> = {
      "--color-desktop": "#e63946",
      "--color-mobile": "#457b9d"
    }

    Object.entries(config).forEach(([key, item]) => {
      if (item.color) {
        styleObj[`--color-${key}`] = item.color
      }
    })

    return styleObj
  }, [config])

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        id={chartId}
        style={styleVars as React.CSSProperties}
        className={cn("flex aspect-video justify-center text-xs", className)}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

export const ChartTooltip = Tooltip

export interface ChartTooltipContentProps {
  active?: boolean
  payload?: any[]
  label?: any
  labelFormatter?: (label: any, payload?: any[]) => React.ReactNode
  indicator?: "dot" | "line" | "dashed"
  className?: string
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  indicator = "dot",
  className
}: ChartTooltipContentProps) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  const formattedLabel = labelFormatter ? labelFormatter(label, payload) : label

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-3 py-2 text-xs text-text-main shadow-xl",
        className
      )}
    >
      {formattedLabel && (
        <div className="font-semibold text-white mb-1.5 pb-1 border-b border-border/60">
          {formattedLabel}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((item: any, index: number) => {
          const key = item.dataKey || item.name || index
          const itemConfig = config[key as string]
          const labelText = itemConfig?.label || item.name || key
          const color = item.color || item.fill || itemConfig?.color || "#fff"

          return (
            <div key={`tooltip-item-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-text-muted">
                {indicator === "dot" && (
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span>{labelText}</span>
              </div>
              <span className="font-bold text-white font-mono">
                {typeof item.value === "number" ? item.value.toLocaleString("en-IN") : item.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const ChartLegend = Legend

export interface ChartLegendContentProps {
  payload?: any[]
  className?: string
}

export function ChartLegendContent({
  payload,
  className
}: ChartLegendContentProps) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div className={cn("flex items-center justify-center gap-4 pt-3 text-xs", className)}>
      {payload.map((item: any, index: number) => {
        const key = item.dataKey || item.value || index
        const itemConfig = config[key as string]
        const labelText = itemConfig?.label || item.value || key
        const color = item.color || itemConfig?.color || "#fff"

        return (
          <div key={`legend-item-${index}`} className="flex items-center gap-1.5 text-text-muted">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-white font-medium">{labelText}</span>
          </div>
        )
      })}
    </div>
  )
}
