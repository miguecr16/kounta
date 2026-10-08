'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Invoice, InvoiceStatus } from '@/types/database';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  FileText,
  Check,
  ChevronDown
} from 'lucide-react';
import { CreateInvoiceModal } from '@/components/modals/create-invoice-modal';

const STATUS_FILTERS: { label: string; value: InvoiceStatus | 'ALL' }[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Emitidas', value: 'ISSUED' },
  { label: 'Pagadas', value: 'PAID' },
  { label: 'Pago Parcial', value: 'PARTIAL_PAID' },
  { label: 'Borrador', value: 'DRAFT' },
  { label: 'Anuladas', value: 'VOID' },
];

export default function InvoicesPage() {
  const { activeCompany, activeRole } = useAuth();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
          ),
          items:invoice_items (
            id,
            description,
            quantity,
            unit_price,
            tax_rate,
            amount
          )
        `)
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCompany, supabase]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleUpdateStatus = async (invoiceId: string, newStatus: InvoiceStatus) => {
    setUpdatingId(invoiceId);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId);

      if (error) throw error;
      await loadInvoices();
    } catch (err) {
      console.error('Error updating invoice status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesFilter = selectedFilter === 'ALL' || inv.status === selectedFilter;
    const customerName = (inv.customer as any)?.name || '';
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const currency = activeCompany?.base_currency || 'COP';

  return (
    <>
      <Header
        title="Gestión de Facturas"
        subtitle={`Comprobantes fiscales de ${activeCompany?.name}`}
        onNewInvoiceClick={() => setIsInvoiceModalOpen(true)}
      />

      <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Controls: Search and Status tabs */}
        <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por número o cliente..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setSelectedFilter(f.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  selectedFilter === f.value
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Invoices List / Table */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-zinc-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-medium text-zinc-900">No se encontraron facturas</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                {searchQuery || selectedFilter !== 'ALL'
                  ? 'No hay facturas que coincidan con los filtros seleccionados.'
                  : 'Crea tu primera factura para emitir comprobantes a clientes.'}
              </p>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(true)}
                className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Emitir nueva factura</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/70 border-b border-zinc-100 text-zinc-500 text-[11px] font-medium">
                    <th className="py-3 px-4">N° Factura</th>
                    <th className="py-3 px-4">Cliente / Razón Social</th>
                    <th className="py-3 px-3">Fecha Emisión</th>
                    <th className="py-3 px-3">Vencimiento</th>
                    <th className="py-3 px-4 text-right">Monto Total</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredInvoices.map((inv) => {
                    const badge = getStatusBadge(inv.status);
                    const customerName = (inv.customer as any)?.name || 'Cliente sin asignar';
                    const customerTaxId = (inv.customer as any)?.tax_id || '';

                    return (
                      <tr key={inv.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono-numbers font-medium text-zinc-900">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-zinc-800">{customerName}</div>
                          {customerTaxId && (
                            <div className="text-[10px] text-zinc-400 font-mono-numbers">
                              {customerTaxId}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-zinc-500 font-mono-numbers">
                          {formatDate(inv.issue_date)}
                        </td>
                        <td className="py-3.5 px-3 text-zinc-500 font-mono-numbers">
                          {formatDate(inv.due_date)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-numbers font-medium text-zinc-900">
                          {formatCurrency(inv.total, inv.currency || currency)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {inv.status === 'ISSUED' && (
                            <button
                              type="button"
                              disabled={updatingId === inv.id}
                              onClick={() => handleUpdateStatus(inv.id, 'PAID')}
                              className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 rounded-md border border-emerald-200/80 transition-colors cursor-pointer disabled:opacity-50"
                              title="Marcar como cobrada"
                            >
                              Marcar Pagada
                            </button>
                          )}
                          {inv.status === 'PAID' && (
                            <span className="text-[11px] text-zinc-400 flex items-center justify-end gap-1 font-medium">
                              <Check className="w-3.5 h-3.5 text-emerald-600" /> Cobrado
                            </span>
                          )}
                          {inv.status === 'DRAFT' && (
                            <button
                              type="button"
                              disabled={updatingId === inv.id}
                              onClick={() => handleUpdateStatus(inv.id, 'ISSUED')}
                              className="px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 rounded-md border border-blue-200/80 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Emitir
                            </button>
                          )}
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

      <CreateInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onInvoiceCreated={loadInvoices}
      />
    </>
  );
}
