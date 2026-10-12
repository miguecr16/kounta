'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Invoice, Customer } from '@/types/database';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Users,
  ArrowUpRight,
  FileText,
  Percent,
  BarChart3,
  Eye,
} from 'lucide-react';
import { CreateInvoiceModal } from '@/components/modals/create-invoice-modal';
import { CreateCustomerModal } from '@/components/modals/create-customer-modal';
import { RevenueEvolutionChart } from '@/components/dashboard/revenue-evolution-chart';
import { Toast, ToastMessage } from '@/components/ui/toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { activeCompany, activeRole } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'access_denied') {
        setToast({
          id: String(Date.now()),
          type: 'error',
          title: 'Acceso denegado',
          description: 'No tienes permisos de administrador (ADMIN) para acceder a esta sección.',
        });
        router.replace('/dashboard', { scroll: false });
      }
    }
  }, [router]);

  const loadDashboardData = useCallback(async () => {
    if (!activeCompany) return;

    setLoading(true);
    try {
      // Optimized query selecting only required columns for KPIs, chart & recent transactions
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select(`
          id,
          company_id,
          customer_id,
          invoice_number,
          total,
          subtotal,
          tax_total,
          status,
          due_date,
          tax_breakdown,
          issue_date,
          currency,
          created_at,
          customer:customer_id (
            id,
            name,
            tax_id,
            email
          )
        `)
        .eq('company_id', activeCompany.id)
        .order('issue_date', { ascending: false });

      if (invError) throw invError;

      const { data: custList, error: custError } = await supabase
        .from('customers')
        .select('id, company_id, name, tax_id, email, billing_address, created_at')
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: false });

      if (custError) throw custError;

      setInvoices((invData as unknown as Invoice[]) || []);
      setCustomers((custList as Customer[]) || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCompany, supabase]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Executive KPIs calculation
  const currency = activeCompany?.base_currency || 'COP';

  const kpis = useMemo(() => {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0];

    // Valid emitted invoices (exclude VOID and DRAFT for collection rate & billed totals)
    const activeEmittedInvoices = invoices.filter(
      (inv) => inv.status === 'ISSUED' || inv.status === 'PARTIAL_PAID' || inv.status === 'PAID'
    );

    const totalEmittedAmount = activeEmittedInvoices.reduce(
      (acc, inv) => acc + (Number(inv.total) || 0),
      0
    );

    // 1. Revenue Paid (Mes en curso + acumulado)
    const paidInvoicesAll = invoices.filter((inv) => inv.status === 'PAID');
    const totalPaidAllTime = paidInvoicesAll.reduce(
      (acc, inv) => acc + (Number(inv.total) || 0),
      0
    );

    const paidThisMonthInvoices = paidInvoicesAll.filter((inv) => {
      const dateRef = inv.issue_date || inv.created_at || '';
      return dateRef.startsWith(currentYearMonth);
    });
    const revenuePaidThisMonth = paidThisMonthInvoices.reduce(
      (acc, inv) => acc + (Number(inv.total) || 0),
      0
    );

    // 2. Cuentas por Cobrar (Outstanding / ISSUED)
    const issuedInvoices = invoices.filter(
      (inv) => inv.status === 'ISSUED' || inv.status === 'PARTIAL_PAID'
    );
    const accountsReceivable = issuedInvoices.reduce(
      (acc, inv) => acc + (Number(inv.total) || 0),
      0
    );

    // 3. Facturas Vencidas (Overdue: status === 'ISSUED' and due_date < today)
    const overdueInvoices = invoices.filter(
      (inv) =>
        (inv.status === 'ISSUED' || inv.status === 'PARTIAL_PAID') &&
        Boolean(inv.due_date) &&
        inv.due_date < todayStr
    );
    const overdueAmount = overdueInvoices.reduce(
      (acc, inv) => acc + (Number(inv.total) || 0),
      0
    );

    // 4. Tasa de Cobro (%): Paid / Total Emitted
    const collectionRate =
      totalEmittedAmount > 0 ? (totalPaidAllTime / totalEmittedAmount) * 100 : 0;

    return {
      revenuePaidThisMonth,
      paidThisMonthCount: paidThisMonthInvoices.length,
      totalPaidAllTime,
      paidAllCount: paidInvoicesAll.length,
      accountsReceivable,
      issuedCount: issuedInvoices.length,
      overdueAmount,
      overdueCount: overdueInvoices.length,
      collectionRate,
      totalEmittedAmount,
    };
  }, [invoices]);

  // Last 5 emitted transactions
  const recentTransactions = useMemo(() => {
    const emitted = invoices.filter((inv) => inv.status !== 'VOID');
    return (emitted.length > 0 ? emitted : invoices).slice(0, 5);
  }, [invoices]);

  return (
    <>
      <Header
        title="Dashboard Ejecutivo"
        subtitle={`Empresa activa: ${activeCompany?.name || ''} · ${activeCompany?.legal_name || ''}`}
      />

      <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
              Resumen Financiero y Operativo
            </h2>
            <p className="text-xs text-zinc-500">
              Indicadores clave de recaudación, cartera activa y cumplimiento fiscal en tiempo real.
            </p>
          </div>
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Link
              href="/reports"
              className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200/90 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs"
            >
              <BarChart3 className="w-3.5 h-3.5 text-zinc-500" />
              <span>Reportes Fiscales</span>
            </Link>
            <Link
              href="/invoices/new"
              className="px-3 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Factura</span>
            </Link>
          </div>
        </div>

        {/* 1. Executive KPI Cards Grid (Stripe / Mercury Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Ingresos Cobrados (Revenue Paid - Mes en Curso) */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium text-zinc-600">
                  Ingresos Cobrados (Mes)
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              {loading ? (
                <div className="h-8 w-36 bg-zinc-100 animate-pulse rounded my-1" />
              ) : (
                <div className="text-2xl font-bold font-mono-numbers text-zinc-900 tracking-tight">
                  {formatCurrency(kpis.revenuePaidThisMonth, currency)}
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono-numbers">
              <span className="text-zinc-500">Acumulado cobrado:</span>
              <span className="font-semibold text-emerald-700">
                {formatCurrency(kpis.totalPaidAllTime, currency)}
              </span>
            </div>
          </div>

          {/* KPI 2: Cuentas por Cobrar (Outstanding / Receivables) */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium text-zinc-600">
                  Cuentas por Cobrar
                </span>
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700 border border-zinc-200/60">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              {loading ? (
                <div className="h-8 w-36 bg-zinc-100 animate-pulse rounded my-1" />
              ) : (
                <div className="text-2xl font-bold font-mono-numbers text-zinc-900 tracking-tight">
                  {formatCurrency(kpis.accountsReceivable, currency)}
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono-numbers">
              <span className="text-zinc-500">Comprobantes ISSUED:</span>
              <span className="font-semibold text-zinc-800">
                {kpis.issuedCount} {kpis.issuedCount === 1 ? 'factura' : 'facturas'}
              </span>
            </div>
          </div>

          {/* KPI 3: Facturas Vencidas (Overdue) */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium text-zinc-600">
                  Facturas Vencidas
                </span>
                <div
                  className={`p-1.5 rounded-lg border ${
                    kpis.overdueCount > 0
                      ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200/60'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              {loading ? (
                <div className="h-8 w-36 bg-zinc-100 animate-pulse rounded my-1" />
              ) : (
                <div
                  className={`text-2xl font-bold font-mono-numbers tracking-tight ${
                    kpis.overdueCount > 0 ? 'text-rose-600' : 'text-zinc-900'
                  }`}
                >
                  {formatCurrency(kpis.overdueAmount, currency)}
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono-numbers">
              <span className="text-zinc-500">En mora (vencidas):</span>
              <span
                className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                  kpis.overdueCount > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                }`}
              >
                {kpis.overdueCount} {kpis.overdueCount === 1 ? 'vencida' : 'vencidas'}
              </span>
            </div>
          </div>

          {/* KPI 4: Tasa de Cobro (%) */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium text-zinc-600">
                  Tasa de Cobro Efectiva
                </span>
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700 border border-zinc-200/60">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              {loading ? (
                <div className="h-8 w-24 bg-zinc-100 animate-pulse rounded my-1" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono-numbers text-zinc-900 tracking-tight">
                    {kpis.collectionRate.toFixed(1)}%
                  </span>
                  <span className="text-[11px] text-zinc-500">recaudado</span>
                </div>
              )}
            </div>
            <div className="mt-3 pt-2">
              <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, kpis.collectionRate))}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-400 font-mono-numbers">
                <span>Emitido neto:</span>
                <span>{formatCurrency(kpis.totalEmittedAmount, currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 6-Month Revenue Evolution Chart */}
        <RevenueEvolutionChart
          invoices={invoices}
          currency={currency}
          loading={loading}
        />

        {/* 3. Bottom Grid: Last 5 Transactions & Quick Customers / Tenant Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Last 5 Transactions Table (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden flex flex-col">
            <div className="p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Últimas Transacciones
                </h2>
                <p className="text-[11px] text-zinc-500">
                  Últimas 5 facturas registradas en {activeCompany?.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/invoices/new"
                  className="px-2.5 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg flex items-center gap-1 transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva Factura</span>
                </Link>
                <Link
                  href="/invoices"
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-200/80 hover:bg-zinc-50 transition-colors"
                >
                  Ver todas →
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-zinc-100 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="h-12 w-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-medium text-zinc-900">
                  No hay transacciones registradas
                </h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Emite tu primera factura para visualizar el flujo de caja y las métricas ejecutivas.
                </p>
                <Link
                  href="/invoices/new"
                  className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva Factura</span>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/70 border-b border-zinc-100 text-zinc-500 text-[11px] font-medium">
                      <th className="py-2.5 px-4">N° Factura</th>
                      <th className="py-2.5 px-4">Cliente</th>
                      <th className="py-2.5 px-3">Emisión</th>
                      <th className="py-2.5 px-3">Vencimiento</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                      <th className="py-2.5 px-4 text-right">Total</th>
                      <th className="py-2.5 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {recentTransactions.map((inv) => {
                      const badge = getStatusBadge(inv.status);
                      const customerName =
                        (inv.customer as Customer | undefined)?.name || 'Cliente sin asignar';
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isOverdue =
                        (inv.status === 'ISSUED' || inv.status === 'PARTIAL_PAID') &&
                        Boolean(inv.due_date) &&
                        inv.due_date < todayStr;

                      return (
                        <tr
                          key={inv.id}
                          className="hover:bg-zinc-50/70 transition-colors group"
                        >
                          <td className="py-3 px-4 font-mono-numbers font-semibold text-zinc-900">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="hover:text-indigo-600 transition-colors"
                            >
                              {inv.invoice_number}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-zinc-700 truncate max-w-[150px]">
                            {customerName}
                          </td>
                          <td className="py-3 px-3 text-zinc-500 font-mono-numbers">
                            {formatDate(inv.issue_date)}
                          </td>
                          <td className="py-3 px-3 font-mono-numbers">
                            <span
                              className={
                                isOverdue ? 'text-rose-600 font-medium' : 'text-zinc-500'
                              }
                            >
                              {formatDate(inv.due_date)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.bg}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono-numbers font-semibold text-zinc-900">
                            {formatCurrency(inv.total, inv.currency || currency)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent hover:border-zinc-200/80 transition-all"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Ver Factura</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Quick Customers & Fiscal Jurisdiction */}
          <div className="space-y-6">
            {/* Customers Card */}
            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Directorio Clientes</h3>
                    <p className="text-[11px] text-zinc-500">{customers.length} registrados</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200/60 transition-colors cursor-pointer"
                  title="Nuevo Cliente"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {loading ? (
                <div className="space-y-2">
                  <div className="h-9 bg-zinc-100 animate-pulse rounded-lg" />
                  <div className="h-9 bg-zinc-100 animate-pulse rounded-lg" />
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-6 text-zinc-400 text-xs">
                  <p>No tienes clientes registrados aún.</p>
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="mt-2 text-indigo-600 hover:text-indigo-700 font-medium text-xs cursor-pointer"
                  >
                    + Registrar cliente
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {customers.slice(0, 4).map((cust) => (
                    <div
                      key={cust.id}
                      className="p-2.5 rounded-xl border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50/50 transition-all flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-medium text-zinc-900 truncate">
                          {cust.name}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono-numbers truncate">
                          {cust.tax_id} · {cust.email}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                <Link
                  href="/customers"
                  className="text-zinc-600 hover:text-zinc-900 font-medium flex items-center gap-1"
                >
                  <span>Ver clientes</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/reports"
                  className="text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Ingresos por cliente →
                </Link>
              </div>
            </div>

            {/* Fiscal Jurisdiction & Tenant Overview */}
            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                  Entorno Fiscal Activo
                </h3>
                <Link
                  href="/reports"
                  className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
                >
                  Resumen Tributario
                </Link>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Jurisdicción:</span>
                  <span className="font-medium text-zinc-800">
                    {activeCompany?.country === 'CO'
                      ? '🇨🇴 Colombia (DIAN)'
                      : '🇺🇸 Estados Unidos (IRS)'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">
                    {activeCompany?.country === 'CO' ? 'NIT:' : 'EIN:'}
                  </span>
                  <span className="font-mono-numbers font-medium text-zinc-800">
                    {activeCompany?.tax_id}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Moneda Base:</span>
                  <span className="font-mono-numbers font-medium text-zinc-800">
                    {activeCompany?.base_currency}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-500">Rol Operativo:</span>
                  <span className="font-medium text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded text-[10px] border border-zinc-200/80">
                    {activeRole}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <CreateInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onInvoiceCreated={loadDashboardData}
      />

      <CreateCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onCustomerSaved={() => {
          loadDashboardData();
          setToast({
            id: String(Date.now()),
            type: 'success',
            title: 'Cliente guardado exitosamente',
            description: 'El directorio de clientes ha sido actualizado.',
          });
        }}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
