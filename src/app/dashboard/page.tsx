'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Invoice, Customer } from '@/types/database';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';
import {
  TrendingUp,
  Receipt,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users,
  ArrowUpRight,
  FileText,
  Building2,
  Calendar
} from 'lucide-react';
import { CreateInvoiceModal } from '@/components/modals/create-invoice-modal';
import { CreateCustomerModal } from '@/components/modals/create-customer-modal';
import { Toast, ToastMessage } from '@/components/ui/toast';
import Link from 'next/link';

export default function DashboardPage() {
  const { activeCompany, activeRole } = useAuth();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!activeCompany) return;

    setLoading(true);
    try {
      // 1. Fetch invoices for active company
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select(`
          id,
          company_id,
          customer_id,
          invoice_number,
          status,
          issue_date,
          due_date,
          subtotal,
          tax_total,
          total,
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
        .order('created_at', { ascending: false });

      if (invError) throw invError;

      // 2. Fetch customers
      const { data: custList, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: false });

      if (custError) throw custError;

      setInvoices((invData as any[]) || []);
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

  // Compute metrics
  const currency = activeCompany?.base_currency || 'COP';

  const totalInvoiced = invoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);

  const accountsReceivable = invoices
    .filter((inv) => inv.status === 'ISSUED' || inv.status === 'PARTIAL_PAID')
    .reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);

  const totalCollected = invoices
    .filter((inv) => inv.status === 'PAID')
    .reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);

  const pendingCount = invoices.filter(
    (inv) => inv.status === 'ISSUED' || inv.status === 'PARTIAL_PAID'
  ).length;

  return (
    <>
      <Header
        title="Dashboard Financiero"
        subtitle={`Empresa activa: ${activeCompany?.name || ''} · ${activeCompany?.legal_name || ''}`}
      />

      <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Facturado */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs interactive-card">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Total Facturado</span>
              <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-32 bg-zinc-100 animate-pulse rounded my-1" />
            ) : (
              <div className="text-2xl font-bold font-mono-numbers text-zinc-900 tracking-tight">
                {formatCurrency(totalInvoiced, currency)}
              </div>
            )}
            <div className="mt-2 flex items-center text-[11px] text-zinc-400 font-mono-numbers">
              <span>{invoices.length} facturas totales registradas</span>
            </div>
          </div>

          {/* Card 2: Cuentas por Cobrar */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs interactive-card">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Cuentas por Cobrar</span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/50">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-32 bg-zinc-100 animate-pulse rounded my-1" />
            ) : (
              <div className="text-2xl font-bold font-mono-numbers text-amber-600 tracking-tight">
                {formatCurrency(accountsReceivable, currency)}
              </div>
            )}
            <div className="mt-2 flex items-center text-[11px] text-zinc-400 font-mono-numbers">
              <span>Por recaudar en período activo</span>
            </div>
          </div>

          {/* Card 3: Facturas Pendientes */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs interactive-card">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Facturas Pendientes</span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/50">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-zinc-100 animate-pulse rounded my-1" />
            ) : (
              <div className="text-2xl font-bold font-mono-numbers text-zinc-900 tracking-tight">
                {pendingCount}
              </div>
            )}
            <div className="mt-2 flex items-center text-[11px] text-zinc-400 font-mono-numbers">
              <span>{invoices.filter((i) => i.status === 'PAID').length} facturas ya cobradas</span>
            </div>
          </div>

          {/* Card 4: Total Cobrado */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs interactive-card">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Total Recaudado</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-32 bg-zinc-100 animate-pulse rounded my-1" />
            ) : (
              <div className="text-2xl font-bold font-mono-numbers text-emerald-600 tracking-tight">
                {formatCurrency(totalCollected, currency)}
              </div>
            )}
            <div className="mt-2 flex items-center text-[11px] text-emerald-600 font-mono-numbers">
              <span>
                {totalInvoiced > 0
                  ? `${((totalCollected / totalInvoiced) * 100).toFixed(0)}% efectividad de recaudo`
                  : '0% efectividad'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Sections: Invoices & Quick Customers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Invoices Table (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden flex flex-col">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Facturas Recientes</h2>
                <p className="text-[11px] text-zinc-500">Últimos comprobantes emitidos en {activeCompany?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/invoices/new"
                  className="px-2.5 py-1 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg flex items-center gap-1 transition-all shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>Emitir</span>
                </Link>
                <Link
                  href="/invoices"
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900 px-2 py-1 transition-colors"
                >
                  Ver todas →
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-zinc-100 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="h-12 w-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-medium text-zinc-900">No hay facturas emitidas</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Crea tu primera factura para comenzar a registrar los ingresos y cuentas por cobrar de la empresa.
                </p>
                <Link
                  href="/invoices/new"
                  className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear primera factura</span>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/70 border-b border-zinc-100 text-zinc-500 text-[11px] font-medium">
                      <th className="py-2.5 px-4">N° Factura</th>
                      <th className="py-2.5 px-4">Cliente</th>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Vence</th>
                      <th className="py-2.5 px-4 text-right">Monto</th>
                      <th className="py-2.5 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {invoices.slice(0, 7).map((inv) => {
                      const badge = getStatusBadge(inv.status);
                      const customerName = (inv.customer as any)?.name || 'Cliente sin asignar';

                      return (
                        <tr key={inv.id} className="hover:bg-zinc-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono-numbers font-medium text-zinc-900">
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
                          <td className="py-3 px-3 text-zinc-500 font-mono-numbers">
                            {formatDate(inv.due_date)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-numbers font-medium text-zinc-900">
                            {formatCurrency(inv.total, inv.currency || currency)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.bg}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Customers & Company Overview (1 Col) */}
          <div className="space-y-6">
            {/* Customers Card */}
            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Clientes</h3>
                    <p className="text-[11px] text-zinc-500">{customers.length} registrados</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="p-1 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                  title="Agregar Cliente"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <div className="space-y-2">
                  <div className="h-8 bg-zinc-100 animate-pulse rounded" />
                  <div className="h-8 bg-zinc-100 animate-pulse rounded" />
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
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {customers.slice(0, 5).map((cust) => (
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

              {customers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-100 text-center">
                  <Link
                    href="/customers"
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Gestionar todos los clientes ({customers.length}) →
                  </Link>
                </div>
              )}
            </div>

            {/* Compliance & Tenant Overview */}
            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-5">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-3">
                Información Fiscal y Tenant
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Jurisdicción:</span>
                  <span className="font-medium text-zinc-800">
                    {activeCompany?.country === 'CO' ? '🇨🇴 Colombia (DIAN)' : '🇺🇸 Estados Unidos (IRS)'}
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
                  <span className="text-zinc-500">Moneda contable:</span>
                  <span className="font-mono-numbers font-medium text-zinc-800">
                    {activeCompany?.base_currency}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-500">Tu Rol:</span>
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200/60">
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
        onCustomerCreated={(newCustomer) => {
          setCustomers((prev) => [newCustomer, ...prev]);
          setToast({
            id: String(Date.now()),
            type: 'success',
            title: 'Cliente guardado exitosamente',
            description: `${newCustomer.name} ha sido agregado al directorio.`,
          });
        }}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
