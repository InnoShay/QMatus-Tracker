"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { FlowDay } from "@/server/dal/dashboard";

const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const label = (d: string) => SHORT.format(new Date(`${d}T00:00:00Z`));

/* Fixed series order: identity follows the series, never its rank (dataviz). */
export const FLOW_SERIES = [
  { key: "completed", name: "Completed", color: "var(--chart-2)" },
  { key: "created", name: "Created", color: "var(--chart-1)" },
] as const;

function FlowTooltip({ active, payload, label: day }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length || typeof day !== "string") return null;
  const row = payload[0].payload as FlowDay;
  return (
    <div className="min-w-40 rounded-md border border-line-strong bg-raised px-3 py-2.5 shadow-float">
      <p className="text-meta text-fg-3">{WEEKDAY.format(new Date(`${day}T00:00:00Z`))}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {FLOW_SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-label">
            <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
            <span className="text-fg-2">{s.name}</span>
            <span className="ml-auto pl-4 font-semibold text-fg tabular">{row[s.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Created vs completed per day. One y-axis (both are task counts), 2px lines
 * over a 10% wash, a crosshair that reads every series at the hovered day.
 */
export function FlowChart({ days }: { days: FlowDay[] }) {
  // Clean y ticks (0, 5, 10, …): the smallest step that covers the peak in ≤ 4 intervals.
  const max = Math.max(1, ...days.map((d) => Math.max(d.created, d.completed)));
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((n) => Math.ceil(max / n) <= 4) ?? 1000;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  return (
    <div className="h-[248px] w-full min-w-0 overflow-hidden" data-testid="flow-chart">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 280, height: 248 }}>
        <AreaChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            {FLOW_SERIES.map((s) => (
              <linearGradient key={s.key} id={`flow-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
          <XAxis
            dataKey="date"
            tickFormatter={label}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
            tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
            tickMargin={10}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, top]}
            ticks={ticks}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
            width={40}
          />
          <Tooltip
            content={FlowTooltip}
            cursor={{ stroke: "var(--border-control)", strokeWidth: 1 }}
            isAnimationActive={false}
            wrapperStyle={{ outline: "none" }}
          />
          {[...FLOW_SERIES].reverse().map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#flow-${s.key})`}
              dot={false}
              activeDot={{ r: 4.5, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
