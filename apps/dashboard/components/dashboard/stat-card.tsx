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
  /** مقایسه با دوره قبل در دسترس/قابل اعتماد نیست → «—» به‌جای روند */
  trendNa?: boolean
  /** آیکون اختیاری (برای استفاده آینده) */
  icon?: React.ReactNode
}

const TREND_CLASSES = {
  up: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400",
  down: "bg-destructive/10 text-destructive",
  na: "bg-muted text-muted-foreground",
} as const

/**
 * کارت فشرده نمایش یک KPI منفرد (Impressions، Reach، Spend و ...).
 * کاملا presentational است: هیچ داده‌ای fetch نمی‌کند و هیچ mock دیفالتی
 * ندارد؛ تمام مقادیر از طریق props تزریق می‌شوند. آیکون به‌صورت عمدی خنثی
 * (muted) رندر می‌شود تا فضای رنگی آرام بماند — فقط روند مثبت/منفی رنگ
 * معنایی دارد.
 */
function StatCard({
  title,
  value,
  description,
  trend,
  trendNa,
  icon,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-3.5 text-card-foreground shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[0.72rem] font-medium leading-4 text-muted-foreground">
          {title}
        </span>
        {icon ? (
          <span
            data-slot="stat-card-icon"
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5"
          >
            {icon}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="text-lg font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </span>
        {trend ? (
          <span
            data-slot="stat-card-trend"
            data-direction={trend.direction}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.68rem] font-semibold",
              TREND_CLASSES[trend.direction]
            )}
          >
            <span aria-hidden="true">
              {trend.direction === "up" ? "▲" : "▼"}
            </span>
            {trend.value}%
          </span>
        ) : trendNa ? (
          <span
            data-slot="stat-card-trend"
            data-direction="na"
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.68rem] font-medium",
              TREND_CLASSES.na
            )}
          >
            —
          </span>
        ) : null}
      </div>

      {description || trend?.label ? (
        <span className="truncate text-[0.68rem] leading-4 text-muted-foreground">
          {description}
          {description && trend?.label ? " · " : null}
          {trend?.label}
        </span>
      ) : null}
    </div>
  )
}

export { StatCard }