'use client';

import React, { useState, useMemo } from 'react';
import { Invoice } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { BarChart3, TrendingUp, Calendar } from 'lucide-react';

export interface MonthlyRevenuePoint {
  key: string; // YYYY-MM
  label: string; // e.g., "May", "Jun"
  fullLabel: string; // e.g., "Mayo 2026"
  billed: number; // Total emitted (ISSUED + PARTIAL_PAID + PAID)
  paid: number; // Total collected (PAID)
  outstanding: number; // Total pending (ISSUED + PARTIAL_PAID)
  invoiceCount: number;
}

interface RevenueEvolutionChartProps {
  invoices: Invoice[];
  currency: string;
  loading?: boolean;
}

const MONTH_SHORT_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const MONTH_FULL_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function RevenueEvolutionChart({
  invoices,
  currency,
  loading = false,
}: RevenueEvolutionChartProps) {
  const [chartType, setChartType] = useState<'bars' | 'line'>('bars');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Build the last 6 calendar months ending in the current month
  const monthlyData: MonthlyRevenuePoint[] = useMemo(() => {
    const now = new Date();
    const buckets: MonthlyRevenuePoint[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

      buckets.push({
        key,
        label: `${MONTH_SHORT_ES[monthIdx]}`,
        fullLabel: `${MONTH_FULL_ES[monthIdx]} ${year}`,
        billed: 0,
        paid: 0,
        outstanding: 0,
        invoiceCount: 0,
      });
    }

    const bucketMap = new Map<string, MonthlyRevenuePoint>();
    buckets.forEach((b) => bucketMap.set(b.key, b));

    invoices.forEach((inv) => {
      if (inv.status === 'VOID' || inv.status === 'DRAFT') return;
      const rawDate = inv.issue_date || inv.created_at;
      if (!rawDate) return;

      const monthKey = rawDate.slice(0, 7); // YYYY-MM
      const bucket = bucketMap.get(monthKey);
      if (!bucket) return;

      const amount = Number(inv.total) || 0;
      bucket.billed += amount;
      bucket.invoiceCount += 1;

      if (inv.status === 'PAID') {
        bucket.paid += amount;
      } else if (inv.status === 'ISSUED' || inv.status === 'PARTIAL_PAID') {
        bucket.outstanding += amount;
      }
    });

    return buckets;
  }, [invoices]);

  const maxAmount = useMemo(() => {
    const m = Math.max(...monthlyData.map((d) => d.billed), 0);
    return m > 0 ? m * 1.12 : 1000;
  }, [monthlyData]);

  const sixMonthTotalBilled = useMemo(
    () => monthlyData.reduce((acc, m) => acc + m.billed, 0),
    [monthlyData]
  );

  const sixMonthTotalPaid = useMemo(
    () => monthlyData.reduce((acc, m) => acc + m.paid, 0),
    [monthlyData]
  );

  const formatCompactNumber = (val: number) => {
    if (val === 0) return '$0';
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
    return `$${val.toFixed(0)}`;
  };

  // Y-axis ticks (4 levels)
  const yTicks = [1, 0.66, 0.33, 0].map((ratio) => Math.round(maxAmount * ratio));

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              Evolución de Ingresos (Últimos 6 Meses)
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/70 font-mono-numbers">
              <Calendar className="w-2.5 h-2.5" />
              {monthlyData[0]?.label} – {monthlyData[monthlyData.length - 1]?.label}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Comparativa mensual de facturación emitida frente a ingresos efectivamente recaudados ({currency})
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 text-[11px] text-zinc-500 mr-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-zinc-900 inline-block" />
              Facturado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
              Cobrado (PAID)
            </span>
          </div>

          {/* Chart Type Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 border border-zinc-200/70">
            <button
              type="button"
              onClick={() => setChartType('bars')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                chartType === 'bars'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <BarChart3 className="w-3 h-3" />
              <span>Barras</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                chartType === 'line'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Tendencia</span>
            </button>
          </div>
        </div>
      </div>

      {/* Body / Canvas */}
      {loading ? (
        <div className="h-64 flex items-end gap-6 pt-8 pb-4 px-4">
          {[45, 70, 55, 85, 60, 95].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div
                style={{ height: `${h}%` }}
                className="w-full max-w-[42px] bg-zinc-100 animate-pulse rounded-t-md"
              />
              <div className="h-3 w-8 bg-zinc-100 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative pt-5 pb-2">
          {/* Hover Tooltip Banner */}
          <div className="min-h-[38px] mb-2 px-3 py-1.5 rounded-xl bg-zinc-50/90 border border-zinc-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            {hoveredIndex !== null && monthlyData[hoveredIndex] ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900">
                    {monthlyData[hoveredIndex].fullLabel}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono-numbers">
                    · {monthlyData[hoveredIndex].invoiceCount}{' '}
                    {monthlyData[hoveredIndex].invoiceCount === 1 ? 'factura' : 'facturas'}
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono-numbers text-[11px]">
                  <span>
                    <span className="text-zinc-400 mr-1">Emitido:</span>
                    <strong className="text-zinc-900">
                      {formatCurrency(monthlyData[hoveredIndex].billed, currency)}
                    </strong>
                  </span>
                  <span>
                    <span className="text-zinc-400 mr-1">Cobrado:</span>
                    <strong className="text-emerald-600">
                      {formatCurrency(monthlyData[hoveredIndex].paid, currency)}
                    </strong>
                  </span>
                  <span>
                    <span className="text-zinc-400 mr-1">Por cobrar:</span>
                    <strong className="text-amber-600">
                      {formatCurrency(monthlyData[hoveredIndex].outstanding, currency)}
                    </strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="text-zinc-500 text-[11px]">
                  Pasa el cursor sobre un mes para inspeccionar el desglose contable
                </span>
                <div className="flex items-center gap-4 font-mono-numbers text-[11px]">
                  <span>
                    <span className="text-zinc-400 mr-1">Acumulado 6M:</span>
                    <strong className="text-zinc-900">
                      {formatCurrency(sixMonthTotalBilled, currency)}
                    </strong>
                  </span>
                  <span>
                    <span className="text-zinc-400 mr-1">Recaudado 6M:</span>
                    <strong className="text-emerald-600">
                      {formatCurrency(sixMonthTotalPaid, currency)}
                    </strong>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Chart Plot Area */}
          <div className="relative h-56 flex">
            {/* Y-Axis Labels */}
            <div className="w-14 pr-2 flex flex-col justify-between text-right text-[10px] text-zinc-400 font-mono-numbers pb-6 select-none">
              {yTicks.map((val, idx) => (
                <span key={idx}>{formatCompactNumber(val)}</span>
              ))}
            </div>

            {/* Plot Grid + Columns / SVG Line */}
            <div className="flex-1 relative flex flex-col justify-between pb-6">
              {/* Horizontal Grid Lines */}
              <div className="absolute inset-0 bottom-6 flex flex-col justify-between pointer-events-none">
                {yTicks.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-full border-b ${
                      idx === yTicks.length - 1
                        ? 'border-zinc-200'
                        : 'border-dashed border-zinc-100'
                    }`}
                  />
                ))}
              </div>

              {chartType === 'bars' ? (
                /* BAR CHART VIEW */
                <div className="relative z-10 flex-1 grid grid-cols-6 gap-2 sm:gap-4 items-end px-2 pt-2">
                  {monthlyData.map((point, index) => {
                    const billedHeightPct =
                      maxAmount > 0 ? Math.max((point.billed / maxAmount) * 100, point.billed > 0 ? 4 : 0) : 0;
                    const paidHeightPct =
                      maxAmount > 0 ? Math.max((point.paid / maxAmount) * 100, point.paid > 0 ? 4 : 0) : 0;
                    const isHovered = hoveredIndex === index;

                    return (
                      <div
                        key={point.key}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className="h-full flex flex-col justify-end items-center group cursor-pointer relative"
                      >
                        {/* Hover column highlight */}
                        <div
                          className={`absolute inset-x-0 -top-1 bottom-0 rounded-lg transition-colors pointer-events-none ${
                            isHovered ? 'bg-zinc-100/70' : 'bg-transparent'
                          }`}
                        />

                        {/* Bars Pair */}
                        <div className="relative z-10 w-full max-w-[44px] h-full flex items-end justify-center gap-1 px-1">
                          {/* Billed Bar (Slate/Zinc-900) */}
                          <div
                            style={{ height: `${billedHeightPct}%` }}
                            className={`flex-1 rounded-t-sm transition-all duration-300 ${
                              point.billed > 0
                                ? isHovered
                                  ? 'bg-zinc-950'
                                  : 'bg-zinc-800'
                                : 'h-[2px] bg-zinc-200'
                            }`}
                            title={`Facturado: ${formatCurrency(point.billed, currency)}`}
                          />
                          {/* Paid Bar (Emerald-600) */}
                          <div
                            style={{ height: `${paidHeightPct}%` }}
                            className={`flex-1 rounded-t-sm transition-all duration-300 ${
                              point.paid > 0
                                ? isHovered
                                  ? 'bg-emerald-500'
                                  : 'bg-emerald-600'
                                : 'h-[2px] bg-zinc-200'
                            }`}
                            title={`Cobrado: ${formatCurrency(point.paid, currency)}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* LINE / AREA CHART VIEW */
                <div className="relative z-10 flex-1 px-2 pt-2">
                  <svg
                    viewBox="0 0 600 180"
                    preserveAspectRatio="none"
                    className="w-full h-full overflow-visible"
                  >
                    <defs>
                      <linearGradient id="billedAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#18181b" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="#18181b" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="paidAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity="0.16" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {(() => {
                      const width = 600;
                      const height = 180;
                      const stepX = width / 6;

                      const billedCoords = monthlyData.map((d, i) => {
                        const x = stepX * i + stepX / 2;
                        const y = height - (maxAmount > 0 ? (d.billed / maxAmount) * (height - 12) : 0);
                        return { x, y };
                      });

                      const paidCoords = monthlyData.map((d, i) => {
                        const x = stepX * i + stepX / 2;
                        const y = height - (maxAmount > 0 ? (d.paid / maxAmount) * (height - 12) : 0);
                        return { x, y };
                      });

                      const billedPoints = billedCoords.map((p) => `${p.x},${p.y}`).join(' ');
                      const billedArea = `${billedCoords[0].x},${height} ${billedPoints} ${
                        billedCoords[billedCoords.length - 1].x
                      },${height}`;

                      const paidPoints = paidCoords.map((p) => `${p.x},${p.y}`).join(' ');
                      const paidArea = `${paidCoords[0].x},${height} ${paidPoints} ${
                        paidCoords[paidCoords.length - 1].x
                      },${height}`;

                      return (
                        <>
                          <polygon points={billedArea} fill="url(#billedAreaGrad)" />
                          <polygon points={paidArea} fill="url(#paidAreaGrad)" />

                          <polyline
                            fill="none"
                            stroke="#18181b"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={billedPoints}
                          />
                          <polyline
                            fill="none"
                            stroke="#059669"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={paidPoints}
                          />

                          {billedCoords.map((pt, idx) => (
                            <g key={monthlyData[idx].key}>
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={hoveredIndex === idx ? 5 : 3.5}
                                className="fill-white stroke-zinc-900 stroke-2 transition-all"
                              />
                              <circle
                                cx={paidCoords[idx].x}
                                cy={paidCoords[idx].y}
                                r={hoveredIndex === idx ? 5 : 3.5}
                                className="fill-white stroke-emerald-600 stroke-2 transition-all"
                              />
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>

                  {/* Invisible Hover Columns for Line Chart */}
                  <div className="absolute inset-0 grid grid-cols-6">
                    {monthlyData.map((point, idx) => (
                      <div
                        key={point.key}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className="h-full cursor-pointer"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* X-Axis Month Labels */}
              <div className="absolute bottom-0 inset-x-0 grid grid-cols-6 gap-2 px-2 text-center">
                {monthlyData.map((point, index) => (
                  <span
                    key={point.key}
                    className={`text-[11px] font-mono-numbers transition-colors ${
                      hoveredIndex === index
                        ? 'text-zinc-900 font-semibold'
                        : 'text-zinc-500 font-medium'
                    }`}
                  >
                    {point.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
