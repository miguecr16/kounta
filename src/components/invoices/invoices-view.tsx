'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Invoice, InvoiceStatus } from '@/types/database';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';
import {
  Receipt,
  Plus,
  Search,
  TrendingUp,
  Clock,
  AlertTriangle,
  FileText,
  Calendar,
  Eye,
  Check,
  X,
  Send
} from 'lucide-react';
import { InvoiceDetailsModal } from '@/components/modals/invoice-details-modal';
import { Toast, ToastMessage } from '@/components/ui/toast';

const STATUS_FILTERS: { label: string; value: InvoiceStatus | 'ALL' }[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Borradores (DRAFT)', value: 'DRAFT' },
  { label: 'Emitidas (ISSUED)', value: 'ISSUED' },
  { label: 'Pagadas (PAID)', value: 'PAID' },
  { label: 'Anuladas (VOID)', value: 'VOID' },
];

export function InvoicesView() {
  const { activeCompany } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected invoice for row click / details modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Check URL query param for toast after redirect from /invoices/new
  useEffect(() => {
    const createdType = searchParams.get('created');
    const invoiceNum = searchParams.get('number');
    if (createdType === 'issued') {
      setToast({
        id: String(Date.now()),
        type: 'success',
        title: 'Factura emitida exitosamente',
        description: invoiceNum
          ? `El comprobante ${invoiceNum} fue registrado y emitido.`
          : 'La factura ha sido emitida y registrada en contabilidad.',
      });
      router.replace('/invoices', { scroll: false });
    } else if (createdType === 'draft') {
      setToast({
        id: String(Date.now()),
        type: 'success',
        title: 'Borrador guardado exitosamente',
        description: invoiceNum
          ? `El borrador ${invoiceNum} quedó guardado para edición o emisión.`
          : 'La factura se guardó en estado borrador.',
      });
      router.replace('/invoices', { scroll: false });
    }
  }, [searchParams, router]);

  const loadInvoices = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          company_id,
          customer_id,
          invoice_number,
          issue_date,
          due_date,
          status,
          currency,
          exchange_rate_to_base,
          subtotal,
          tax_total,
          total,
          tax_breakdown,
          created_by,
          created_at,
          customer:customer_id (
            id,
            name,
            tax_id,
            email,
            billing_address
          ),
          items:invoice_items (
            id,
            invoice_id,
            company_id,
            description,
            quantity,
            unit_price,
            tax_rate,
            amount
          )
        `)
        .eq('company_id', activeCompany.id)
        .order('issue_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices((data as any[]) || []);
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCompany, supabase]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleQuickStatusUpdate = async (
    e: React.MouseEvent,
    invoice: Invoice,
    newStatus: InvoiceStatus
  ) => {
    e.stopPropagation();
    setUpdatingId(invoice.id);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoice.id);

      if (error) throw error;

      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoice.id ? { ...inv, status: newStatus } : inv))
      );

      setToast({
        id: String(Date.now()),
        type: 'success',
        title:
          newStatus === 'PAID'
            ? 'Factura marcada como pagada'
            : 'Factura emitida exitosamente',
        description: `Comprobante ${invoice.invoice_number} actualizado a ${newStatus}.`,
      });
    } catch (err) {
      console.error('Error updating invoice status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const baseCurrency = activeCompany?.base_currency || 'COP';

  // Helper to check if an invoice is overdue
  const isOverdue = (inv: Invoice) => {
    return (
      (inv.status === 'ISSUED' || inv.status === 'PARTIAL_PAID') &&
      Boolean(inv.due_date) &&
      inv.due_date < todayStr
    );
  };

  // Top Metrics calculations
  const activeInvoices = invoices.filter((inv) => inv.status !== 'VOID');

  const totalBilled = activeInvoices.reduce(
    (acc, inv) => acc + (Number(inv.total) || 0),
    0
  );

  const totalReceivable = invoices
    .filter((inv) => inv.status === 'ISSUED' || inv.status === 'PARTIAL_PAID')
    .reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);

  const overdueInvoices = invoices.filter(isOverdue);
  const totalOverdue = overdueInvoices.reduce(
    (acc, inv) => acc + (Number(inv.total) || 0),
    0
  );

  // Filter logic (Status + Date Range + Search)
  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = selectedStatus === 'ALL' || inv.status === selectedStatus;

    const customerName = ((inv.customer as any)?.name || '').toLowerCase();
    const customerTax = ((inv.customer as any)?.tax_id || '').toLowerCase();
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      customerName.includes(q) ||
      customerTax.includes(q);

    const matchesFrom = !dateFrom || (inv.issue_date && inv.issue_date >= dateFrom);
    const matchesTo = !dateTo || (inv.issue_date && inv.issue_date <= dateTo);

    return matchesStatus && matchesSearch && matchesFrom && matchesTo;
  });

  const hasActiveFilters =
    selectedStatus !== 'ALL' || Boolean(searchQuery) || Boolean(dateFrom) || Boolean(dateTo);

  const clearFilters = () => {
    setSelectedStatus('ALL');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <>
      {/* Top Bar */}
      <header className="h-16 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-semibold tracking-tight text-zinc-900">
              Facturas
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono-numbers font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/80">
              {loading ? '—' : invoices.length}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">
            Libro de facturación y cuentas por cobrar de {activeCompany?.name}
          </p>
        </div>

        <Link
          href="/invoices/new"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium tracking-tight shadow-xs transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Crear Factura</span>
        </Link>
      </header>

      <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Quick Metrics Row (Total Facturado, Por Cobrar, Vencidas) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Metric 1: Total Facturado */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs interactive-card">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Total Facturado</span>
              <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-800">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-36 bg-zinc-100 animate-pulse rounded my-1" />
            ) : (
              <div className="text-2xl font-bold font-mono-numbers text-zinc-900 tracking-tight">
                {formatCurrency(totalBilled, baseCurrency)}
              </div>
            )}
            <div className="mt-1.5 text-[11px] text-zinc-400 font-mono-numbers">
              {activeInvoices.length} comprobantes activos ({baseCurrency})
            </div>
          </div>

          {/* Metric 2: Por Cobrar */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs interactive-card">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Por Cobrar</span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/50">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-36 bg-zinc-100 animate-pulse rounded my-1" />
            ) : (
              <div className="text-2xl font-bold font-mono-numbers text-amber-600 tracking-tight">
                {formatCurrency(totalReceivable, baseCurrency)}
              </div>
            )}
            <div className="mt-1.5 text-[11px] text-zinc-400 font-mono-numbers">
              {invoices.filter((i) => i.status === 'ISSUED' || i.status === 'PARTIAL_PAID').length} facturas emitidas pendientes
            </div>
          </div>

          {/* Metric 3: Vencidas */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs interactive-card">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Vencidas</span>
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/50">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-36 bg-zinc-100 animate-pulse rounded my-1" />
            ) : (
              <div className="text-2xl font-bold font-mono-numbers text-rose-600 tracking-tight">
                {formatCurrency(totalOverdue, baseCurrency)}
              </div>
            )}
            <div className="mt-1.5 text-[11px] text-zinc-400 font-mono-numbers">
              {overdueInvoices.length} {overdueInvoices.length === 1 ? 'factura vencida' : 'facturas vencidas'} de plazo
            </div>
          </div>
        </div>

        {/* Filters Panel: Status + Date Range + Search */}
        <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs space-y-3.5">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-1 overflow-x-auto">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setSelectedStatus(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    selectedStatus === f.value
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>

          {/* Search & Date Range Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por N° de factura, cliente o NIT/EIN..."
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-50/70 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
              />
            </div>

            <div className="md:col-span-3 flex items-center gap-2">
              <span className="text-[11px] font-medium text-zinc-500 shrink-0">Desde:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono-numbers bg-zinc-50/70 border border-zinc-200 rounded-lg text-zinc-800 focus:bg-white focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div className="md:col-span-3 flex items-center gap-2">
              <span className="text-[11px] font-medium text-zinc-500 shrink-0">Hasta:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono-numbers bg-zinc-50/70 border border-zinc-200 rounded-lg text-zinc-800 focus:bg-white focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>
        </div>

        {/* Accounting Table */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-zinc-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-16 px-6 text-center flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-2xl bg-zinc-100 border border-zinc-200/60 text-zinc-400 flex items-center justify-center mb-3.5">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">
                {hasActiveFilters ? 'No hay facturas con estos filtros' : 'Aún no has emitido facturas'}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm leading-relaxed">
                {hasActiveFilters
                  ? 'Intenta ajustar el rango de fechas o el estado seleccionado para ver más comprobantes.'
                  : 'Crea tu primera factura profesional con cálculo automático de impuestos y retenciones.'}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
                >
                  Restablecer filtros
                </button>
              ) : (
                <Link
                  href="/invoices/new"
                  className="mt-5 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Crear Factura</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-zinc-200/80 text-zinc-500 text-[11px] font-medium">
                    <th className="py-3 px-5">N° Factura</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Fecha de Emisión</th>
                    <th className="py-3 px-4">Fecha de Vencimiento</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-5 text-right">Total</th>
                    <th className="py-3 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredInvoices.map((inv) => {
                    const badge = getStatusBadge(inv.status);
                    const customerName = (inv.customer as any)?.name || 'Cliente sin asignar';
                    const customerTaxId = (inv.customer as any)?.tax_id || '';
                    const overdue = isOverdue(inv);
                    const invCurrency = inv.currency || baseCurrency;

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setSelectedInvoice(inv)}
                        className="hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Col 1: N° Factura */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-numbers font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                              {inv.invoice_number}
                            </span>
                            {overdue && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                                Vencida
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Col 2: Cliente */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-zinc-900 truncate max-w-[200px]">
                            {customerName}
                          </div>
                          {customerTaxId && (
                            <div className="text-[10px] text-zinc-400 font-mono-numbers">
                              {customerTaxId}
                            </div>
                          )}
                        </td>

                        {/* Col 3: Fecha de Emisión */}
                        <td className="py-3.5 px-4 font-mono-numbers text-zinc-600">
                          {formatDate(inv.issue_date)}
                        </td>

                        {/* Col 4: Fecha de Vencimiento */}
                        <td
                          className={`py-3.5 px-4 font-mono-numbers ${
                            overdue ? 'text-rose-600 font-medium' : 'text-zinc-600'
                          }`}
                        >
                          {formatDate(inv.due_date)}
                        </td>

                        {/* Col 5: Estado */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${badge.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {badge.label}
                          </span>
                        </td>

                        {/* Col 6: Total (Monospace, right-aligned) */}
                        <td className="py-3.5 px-5 text-right font-mono-numbers font-semibold text-zinc-900">
                          {formatCurrency(Number(inv.total), invCurrency)}
                          <span className="ml-1 text-[10px] font-normal text-zinc-400">
                            {invCurrency}
                          </span>
                        </td>

                        {/* Col 7: Acciones */}
                        <td
                          className="py-3.5 px-5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoice(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                              title="Ver detalle de factura"
                            >
                              <Eye className="w-3.5 h-3.5 text-zinc-500" />
                              <span>Detalle</span>
                            </button>

                            {inv.status === 'ISSUED' && (
                              <button
                                type="button"
                                disabled={updatingId === inv.id}
                                onClick={(e) => handleQuickStatusUpdate(e, inv, 'PAID')}
                                className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/80 rounded-lg border border-emerald-200/70 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                Pagada
                              </button>
                            )}

                            {inv.status === 'DRAFT' && (
                              <button
                                type="button"
                                disabled={updatingId === inv.id}
                                onClick={(e) => handleQuickStatusUpdate(e, inv, 'ISSUED')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100/80 rounded-lg border border-blue-200/70 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Send className="w-3 h-3" />
                                <span>Emitir</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Invoice Details Modal when clicking on a row */}
      <InvoiceDetailsModal
        invoice={selectedInvoice}
        isOpen={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        onStatusUpdated={(updatedInv) => {
          setInvoices((prev) =>
            prev.map((inv) => (inv.id === updatedInv.id ? updatedInv : inv))
          );
          setSelectedInvoice(updatedInv);
          setToast({
            id: String(Date.now()),
            type: 'success',
            title: 'Estado de factura actualizado',
            description: `La factura ${updatedInv.invoice_number} cambió a estado ${updatedInv.status}.`,
          });
        }}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
