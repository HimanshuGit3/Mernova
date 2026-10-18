import { useId } from 'react';
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CATEGORY, CATEGORY_ORDER } from '../../theme/meta.js';

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

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <span className="font-bold text-text">{p.name}</span>
      <span className="ml-2 text-muted tabular">{p.value}</span>
    </div>
  );
}

/** Issues by category: donut + an accessible legend list with the numbers. */
export function CategoryDonut({ counts }) {
  const data = CATEGORY_ORDER.map((c) => ({
    key: c,
    name: CATEGORY[c].label,
    value: counts?.[c] ?? 0,
    color: CATEGORY[c].color,
  })).filter((d) => d.value > 0);
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
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
