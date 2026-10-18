import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORY, CATEGORY_ORDER, STATUS, STATUS_ORDER, categoryColor } from '../../theme/meta.js';
import { useTheme } from '../../theme/themeContext.js';
import { formatHours } from '../../theme/format.js';

/*
 * Chart conventions (dataviz skill): one y-axis per chart (never dual), 2px lines,
 * recessive grid and axes, text in neutral ink (never the series colour), a legend for
 * two or more series, a hover tooltip on every plotted chart, and validated colours per theme.
 */

const AXIS = { fontSize: 12, fill: 'var(--muted)' };
const GRID = 'var(--border)';
const SERIES = {
  reports: { light: '#3B7BD0', dark: '#5B93DD' },
  fixes: { light: '#1F9E89', dark: '#1F9E89' },
};

/** Tiny trend line for KPI cards (decorative; the number next to it carries the meaning). */
export function Sparkline({ data, color = '#C9962B', height = 40 }) {
  const id = useId().replace(/:/g, '');
  const points = (data ?? []).map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} aria-hidden className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#spark-${id})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TooltipBox({ title, rows }) {
  return (
    <div className="min-w-36 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      {title ? <p className="mb-1 font-bold text-text">{title}</p> : null}
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted">
            {r.color ? (
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: r.color }}
                aria-hidden
              />
            ) : null}
            {r.label}
          </span>
          <span className="font-bold text-text tabular">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 rounded-full"
            style={{ backgroundColor: i.color }}
            aria-hidden
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Issues by category: donut + an accessible legend list with the numbers. */
export function CategoryDonut({ counts }) {
  const { theme } = useTheme();
  const data = CATEGORY_ORDER.map((c) => ({
    key: c,
    name: CATEGORY[c].label,
    value: counts?.[c] ?? 0,
    color: categoryColor(c, theme),
  })).filter((d) => d.value > 0);
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* 2px surface-coloured stroke separates the segments */}
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    rows={[
                      {
                        label: payload[0].name,
                        value: payload[0].value,
                        color: payload[0].payload.color,
                      },
                    ]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-extrabold text-text tabular">{total}</p>
            <p className="text-xs text-muted">issues</p>
          </div>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-1">
        {data.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
                aria-hidden
              />
              <span className="truncate text-text">{d.name}</span>
            </span>
            <span className="font-bold text-text tabular">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Reports vs fixes per day: two series of the same unit on one axis. */
export function ReportsVsFixesChart({ created, resolution, height = 260 }) {
  const { theme } = useTheme();
  const reports = SERIES.reports[theme];
  const fixes = SERIES.fixes[theme];
  const data = created.map((c, i) => ({
    date: c.date,
    reports: c.count,
    fixes: resolution[i]?.resolved ?? 0,
  }));
  return (
    <div>
      <Legend
        items={[
          { label: 'Reported', color: reports },
          { label: 'Fixed', color: fixes },
        ]}
      />
      <div style={{ height }} className="mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={shortDate(label)}
                    rows={[
                      { label: 'Reported', value: payload[0].payload.reports, color: reports },
                      { label: 'Fixed', value: payload[0].payload.fixes, color: fixes },
                    ]}
                  />
                ) : null
              }
            />
            <Line
              type="monotone"
              dataKey="reports"
              name="Reported"
              stroke={reports}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="fixes"
              name="Fixed"
              stroke={fixes}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Average time to fix per day (its own chart: hours are a different unit from counts). */
export function ResolutionTimeChart({ resolution, height = 220 }) {
  const { theme } = useTheme();
  const color = theme === 'dark' ? '#E4BC63' : '#B07D1F';
  const data = resolution.map((r) => ({ date: r.date, hours: r.avgHours }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(h) => `${h}h`}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={shortDate(label)}
                  rows={[
                    {
                      label: 'Average time to fix',
                      value: payload[0].value === null ? 'No fixes' : formatHours(payload[0].value),
                    },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="hours" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Issues by status: labelled horizontal bars (status colours are reserved for status). */
export function StatusBars({ counts }) {
  const max = Math.max(1, ...STATUS_ORDER.map((s) => counts?.[s] ?? 0));
  return (
    <ul className="flex flex-col gap-2.5">
      {STATUS_ORDER.map((s) => {
        const n = counts?.[s] ?? 0;
        return (
          <li
            key={s}
            className="grid grid-cols-[96px_minmax(0,1fr)_40px] items-center gap-3 text-sm"
            title={`${STATUS[s].label}: ${n}`}
          >
            <span className="truncate text-text">{STATUS[s].label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(n / max) * 100}%`,
                  backgroundColor: STATUS[s].color,
                  minWidth: n ? 6 : 0,
                }}
              />
            </span>
            <span className="text-right font-bold text-text tabular">{n}</span>
          </li>
        );
      })}
    </ul>
  );
}
