import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type SaleRecord } from "../services/salesService"
import { type ExpenseRecord } from "../services/expenseService"
import { type StockItem } from "../services/stockService"
import {
  getSaleDateString,
  getExpenseDateString,
  calculateSaleStats,
  calculateDailyExpense,
  calculateMonthlyExpense,
  calculateYearlyExpense,
} from "../lib/financials"

export type ChartTimeRange = "daily" | "monthly" | "yearly" | "all"

interface ChartAreaInteractiveProps {
  timeRange?: ChartTimeRange
  onTimeRangeChange?: (range: ChartTimeRange) => void
  sales?: SaleRecord[]
  expenses?: ExpenseRecord[]
  stock?: StockItem[]
}

const chartConfig = {
  netProfit: {
    label: "Net Profit",
    color: "#e63946", // Brand Red
  },
  expenses: {
    label: "Expenses",
    color: "#f87171", // Coral / Light Red
  },
} satisfies ChartConfig

export function ChartAreaInteractive({
  timeRange: externalTimeRange,
  onTimeRangeChange,
  sales = [],
  expenses = [],
  stock = [],
}: ChartAreaInteractiveProps) {
  // Internal fallback state if uncontrolled
  const [internalTimeRange, setInternalTimeRange] = React.useState<ChartTimeRange>("daily")
  const activeTimeRange = externalTimeRange || internalTimeRange

  const handleRangeChange = (range: string) => {
    const validRange = range as ChartTimeRange
    if (onTimeRangeChange) {
      onTimeRangeChange(validRange)
    } else {
      setInternalTimeRange(validRange)
    }
  }

  // Calculate dynamic Expenses and Net Profit data based on selected date range
  const chartData = React.useMemo(() => {
    // A. DAILY RANGE: Past 14 days up to today
    if (activeTimeRange === "daily") {
      const now = new Date()
      const daysCount = 14
      const result = []

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)

        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, "0")
        const day = String(d.getDate()).padStart(2, "0")
        const dateStr = `${year}-${month}-${day}`
        const displayLabel = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })

        // Real sales on this day
        const daySales = sales.filter((s) => getSaleDateString(s) === dateStr)
        const { netProfit } = calculateSaleStats(daySales, stock)

        // Real expenses on this day
        const dayExpense = calculateDailyExpense(expenses, dateStr)

        result.push({
          date: displayLabel,
          netProfit,
          expenses: dayExpense,
        })
      }

      return result
    }

    // B. MONTHLY RANGE: Past 12 months up to current month
    if (activeTimeRange === "monthly") {
      const now = new Date()
      const currentYear = now.getFullYear()
      const result = []

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, "0")
        const yearMonthStr = `${year}-${month}`
        const displayLabel = d.toLocaleDateString("en-US", {
          month: "short",
          year: year !== currentYear ? "2-digit" : undefined,
        })

        const monthSales = sales.filter((s) => getSaleDateString(s).startsWith(yearMonthStr))
        const { netProfit } = calculateSaleStats(monthSales, stock)
        const monthExpense = calculateMonthlyExpense(expenses, yearMonthStr)

        result.push({
          date: displayLabel,
          netProfit,
          expenses: monthExpense,
        })
      }

      return result
    }

    // C. YEARLY RANGE: Past 5 years up to current year
    if (activeTimeRange === "yearly") {
      const now = new Date()
      const currentYear = now.getFullYear()
      const years = [
        currentYear - 4,
        currentYear - 3,
        currentYear - 2,
        currentYear - 1,
        currentYear,
      ]

      return years.map((year) => {
        const yearStr = year.toString()
        const yearSales = sales.filter((s) => getSaleDateString(s).startsWith(yearStr))
        const { netProfit } = calculateSaleStats(yearSales, stock)
        const yearExpense = calculateYearlyExpense(expenses, yearStr)

        return {
          date: yearStr,
          netProfit,
          expenses: yearExpense,
        }
      })
    }

    // D. ALL-TIME: Historical years spanning recorded data
    const now = new Date()
    const currentYear = now.getFullYear()
    const recordedYears = new Set<number>()

    sales.forEach((s) => {
      const ds = getSaleDateString(s)
      if (ds.length >= 4) {
        const y = parseInt(ds.slice(0, 4), 10)
        if (!isNaN(y)) recordedYears.add(y)
      }
    })
    expenses.forEach((e) => {
      const ds = getExpenseDateString(e)
      if (ds.length >= 4) {
        const y = parseInt(ds.slice(0, 4), 10)
        if (!isNaN(y)) recordedYears.add(y)
      }
    })
    for (let y = currentYear - 4; y <= currentYear; y++) {
      recordedYears.add(y)
    }

    const sortedYears = Array.from(recordedYears).sort((a, b) => a - b)
    return sortedYears.map((year) => {
      const yearStr = year.toString()
      const yearSales = sales.filter((s) => getSaleDateString(s).startsWith(yearStr))
      const { netProfit } = calculateSaleStats(yearSales, stock)
      const yearExpense = calculateYearlyExpense(expenses, yearStr)

      return {
        date: yearStr,
        netProfit,
        expenses: yearExpense,
      }
    })
  }, [activeTimeRange, sales, expenses, stock])

  const descriptionText = React.useMemo(() => {
    switch (activeTimeRange) {
      case "daily":
        return "Showing daily Expenses & Net Profit comparison for the last 14 days"
      case "yearly":
        return "Showing annual Expenses & Net Profit trajectory across recent years"
      case "all":
        return "Showing complete historical Expenses & Net Profit trajectory"
      case "monthly":
      default:
        return "Showing monthly Expenses & Net Profit comparison for the last 12 months"
    }
  }, [activeTimeRange])

  return (
    <Card className="pt-0 border-border bg-card">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border py-3.5 sm:py-4 px-4 sm:px-6">
        <div className="grid flex-1 gap-1">
          <CardTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>Expenses & Net Profit</span>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
              {activeTimeRange}
            </span>
          </CardTitle>
          <CardDescription className="text-xs text-text-muted">
            {descriptionText}
          </CardDescription>
        </div>

        {/* Time Range Selector */}
        <Select value={activeTimeRange} onValueChange={handleRangeChange}>
          <SelectTrigger
            className="w-full sm:w-[140px] rounded-xl flex border-border bg-card-hover/80 text-white font-medium justify-between"
            aria-label="Select date range"
          >
            <SelectValue placeholder="Select Range" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-card">
            <SelectItem value="daily" className="rounded-lg">
              Daily
            </SelectItem>
            <SelectItem value="monthly" className="rounded-lg">
              Monthly
            </SelectItem>
            <SelectItem value="yearly" className="rounded-lg">
              Yearly
            </SelectItem>
            <SelectItem value="all" className="rounded-lg">
              All-Time
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="px-1 sm:px-6 pt-3 sm:pt-6 pb-2">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[240px] sm:h-[290px] w-full"
        >
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
            <defs>
              {/* Net Profit Red Gradient */}
              <linearGradient id="fillNetProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e63946" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#e63946" stopOpacity={0.05} />
              </linearGradient>

              {/* Expenses Coral / Light Red Gradient */}
              <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f87171" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="#2e2e2e" strokeDasharray="3 3" />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
              stroke="#9ca3af"
              tick={{ fill: "#9ca3af", fontSize: 10 }}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              width={38}
              stroke="#9ca3af"
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              domain={[0, (dataMax: number) => Math.max(dataMax || 0, 5000)]}
              tickFormatter={(val) => {
                if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`
                if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`
                return `₹${val}`
              }}
            />

            <ChartTooltip
              cursor={{ stroke: "#e63946", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(val) => `${val}`}
                  formatter={(val) => `₹${Number(val || 0).toLocaleString("en-IN")}`}
                />
              }
            />

            {/* Expenses Area */}
            <Area
              dataKey="expenses"
              name="Expenses"
              type="monotone"
              fill="url(#fillExpenses)"
              stroke="#f87171"
              strokeWidth={2.5}
            />

            {/* Net Profit Area */}
            <Area
              dataKey="netProfit"
              name="Net Profit"
              type="monotone"
              fill="url(#fillNetProfit)"
              stroke="#e63946"
              strokeWidth={2.5}
            />

            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export default ChartAreaInteractive
