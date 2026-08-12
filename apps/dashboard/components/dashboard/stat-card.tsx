import * as React from "react"
import { cn } from "@/lib/utils"

export interface StatCardTrend {
  /**
   * Signed or unsigned numeric value, e.g. 12.4 for "+12.4%".
   * Direction is derived from `direction`, not from the sign of this number,
   * so callers can pass either a raw delta or an already-formatted magnitude.
   */
  value: number
  direction: "up" | "down"
  /**
   * Optional label shown after the value, e.g. "نسبت به ماه قبل".
   */
  label?: string
}

export interface StatCardProps extends React.ComponentProps<"div"> {
  /** عنوان اصلی متریک، مثلا "Impressions" */
  title: string
  /** مقدار اصلی، از قبل فرمت‌شده توسط caller (عدد یا رشته) */
  value: string | number
  /** توضیح تکمیلی زیر مقدار اصلی */
  description?: string
  /** روند مثبت/منفی نسبت به دوره قبل */
  trend?: StatCardTrend
  /** آیکون اختیاری (برای استفاده آینده) */
  icon?: React.ReactNode
}

/**
 * کارت نمایش یک KPI منفرد (Impressions، Reach، Spend و ...).
 * کاملا presentational است: هیچ داده‌ای fetch نمی‌کند و هیچ mock دیفالتی ندارد؛
 * تمام مقادیر از طریق props تزریق می‌شوند.
 */
function StatCard({
  title,
  value,
  description,
  trend,
  icon,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        {icon ? (
          <span
            data-slot="stat-card-icon"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4"
          >
            {icon}
          </span>
        ) : null}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        {trend ? (
          <span
            data-slot="stat-card-trend"
            data-direction={trend.direction}
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              trend.direction === "up"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive"
            )}
          >
            <span aria-hidden="true">
              {trend.direction === "up" ? "▲" : "▼"}
            </span>
            {trend.value}%
          </span>
        ) : null}
      </div>

      {description || trend?.label ? (
        <span className="text-xs text-muted-foreground">
          {description}
          {description && trend?.label ? " · " : null}
          {trend?.label}
        </span>
      ) : null}
    </div>
  )
}

export { StatCard }
