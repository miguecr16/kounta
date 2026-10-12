'use client';

import React, { useEffect, useState } from 'react';
import { Invoice, InvoiceItem, InvoiceStatus } from '@/types/database';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';
import {
  X,
  Receipt,
  Calendar,
  Building2,
  User,
  CheckCircle2,
  Ban,
  Send,
  Loader2,
  FileText,
  MapPin,
  Mail
} from 'lucide-react';

interface InvoiceDetailsModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: (updatedInvoice: Invoice) => void;
}

export function InvoiceDetailsModal({
  invoice,
  isOpen,
  onClose,
  onStatusUpdated,
}: InvoiceDetailsModalProps) {
  const { activeCompany } = useAuth();
  const supabase = createClient();

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<InvoiceStatus | null>(null);

  useEffect(() => {
    if (!isOpen || !invoice) return;

    // If items are already embedded in invoice, use them; otherwise fetch
    if (invoice.items && invoice.items.length > 0) {
      setItems(invoice.items);
      return;
    }

    let mounted = true;
    async function fetchItems() {
      setLoadingItems(true);
      try {
        const { data, error } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', invoice!.id);

        if (!error && mounted) {
          setItems((data as InvoiceItem[]) || []);
        }
      } catch (err) {
        console.error('Error loading invoice items:', err);
      } finally {
        if (mounted) setLoadingItems(false);
      }
    }

    fetchItems();
    return () => {
      mounted = false;
    };
  }, [isOpen, invoice, supabase]);

  if (!isOpen || !invoice) return null;

  const currency = invoice.currency || activeCompany?.base_currency || 'COP';
  const badge = getStatusBadge(invoice.status);
  const customer = invoice.customer as any;
  const breakdown = invoice.tax_breakdown || {};

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    setUpdatingStatus(newStatus);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoice.id)
        .select(`
          *,
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
        .single();

      if (error) throw error;
      if (data) {
        onStatusUpdated(data as Invoice);
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-zinc-200/90 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-semibold font-mono-numbers text-zinc-900">
                  {invoice.invoice_number}
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.bg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                  {badge.label}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Comprobante contable · Moneda {currency}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Document Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Emitter & Customer Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/70">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Emisor
              </span>
              <div className="mt-1 text-xs font-semibold text-zinc-900">
                {activeCompany?.legal_name || activeCompany?.name}
              </div>
              <div className="text-[11px] text-zinc-500 font-mono-numbers mt-0.5">
                {activeCompany?.country === 'CO' ? 'NIT:' : 'EIN:'} {activeCompany?.tax_id}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                {activeCompany?.country === 'CO' ? '🇨🇴 Colombia' : '🇺🇸 Estados Unidos'}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Facturado a (Cliente)
              </span>
              <div className="mt-1 text-xs font-semibold text-zinc-900">
                {customer?.name || 'Cliente'}
              </div>
              {customer?.tax_id && (
                <div className="text-[11px] text-zinc-500 font-mono-numbers mt-0.5">
                  {activeCompany?.country === 'CO' ? 'NIT / Doc:' : 'Tax ID:'} {customer.tax_id}
                </div>
              )}
              {customer?.email && (
                <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3 text-zinc-400" />
                  <span>{customer.email}</span>
                </div>
              )}
              {customer?.billing_address && (
                <div className="text-[11px] text-zinc-500 flex items-start gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
                  <span>{customer.billing_address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Dates & Exchange Info */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-zinc-200/70 bg-white">
              <span className="text-[11px] text-zinc-500">Fecha de Emisión</span>
              <div className="font-mono-numbers font-medium text-zinc-900 mt-0.5">
                {formatDate(invoice.issue_date)}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-zinc-200/70 bg-white">
              <span className="text-[11px] text-zinc-500">Fecha de Vencimiento</span>
              <div className="font-mono-numbers font-medium text-zinc-900 mt-0.5">
                {formatDate(invoice.due_date)}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-zinc-200/70 bg-white">
              <span className="text-[11px] text-zinc-500">Moneda / Tasa</span>
              <div className="font-mono-numbers font-medium text-zinc-900 mt-0.5">
                {currency}{' '}
                {invoice.exchange_rate_to_base && invoice.exchange_rate_to_base !== 1
                  ? `(TRM: ${invoice.exchange_rate_to_base})`
                  : ''}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
              Detalle de Conceptos
            </h4>

            {loadingItems ? (
              <div className="space-y-2">
                <div className="h-9 bg-zinc-100 animate-pulse rounded-lg" />
                <div className="h-9 bg-zinc-100 animate-pulse rounded-lg" />
              </div>
            ) : (
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] text-zinc-500 font-medium">
                      <th className="py-2.5 px-3.5">Descripción</th>
                      <th className="py-2.5 px-3 text-right">Cant.</th>
                      <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                      <th className="py-2.5 px-3 text-right">Imp. %</th>
                      <th className="py-2.5 px-3.5 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-zinc-400">
                          No hay líneas registradas en esta factura.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-50/50">
                          <td className="py-2.5 px-3.5 text-zinc-900 font-medium">
                            {item.description}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers text-zinc-600">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers text-zinc-600">
                            {formatCurrency(Number(item.unit_price), currency)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers text-zinc-500">
                            {item.tax_rate}%
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono-numbers font-medium text-zinc-900">
                            {formatCurrency(Number(item.amount), currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Financial & Tax Summary */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 bg-zinc-50/90 border border-zinc-200/80 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600 font-mono-numbers">
                <span>Subtotal:</span>
                <span>{formatCurrency(Number(invoice.subtotal), currency)}</span>
              </div>

              <div className="flex justify-between text-zinc-600 font-mono-numbers">
                <span>
                  {breakdown.country === 'US'
                    ? `Sales Tax (${breakdown.sales_tax_rate ?? 0}%):`
                    : 'IVA Total:'}
                </span>
                <span>+{formatCurrency(Number(invoice.tax_total), currency)}</span>
              </div>

              {breakdown.retefuente_enabled && (breakdown.retefuente_amount ?? 0) > 0 && (
                <div className="flex justify-between text-rose-600 font-mono-numbers">
                  <span>Retefuente ({breakdown.retefuente_rate}%):</span>
                  <span>-{formatCurrency(Number(breakdown.retefuente_amount), currency)}</span>
                </div>
              )}

              {breakdown.reteica_enabled && (breakdown.reteica_amount ?? 0) > 0 && (
                <div className="flex justify-between text-rose-600 font-mono-numbers">
                  <span>ReteICA ({breakdown.reteica_rate}%):</span>
                  <span>-{formatCurrency(Number(breakdown.reteica_amount), currency)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-zinc-200 flex justify-between font-bold text-sm text-zinc-900 font-mono-numbers">
                <span>Total Neto:</span>
                <span>{formatCurrency(Number(invoice.total), currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {invoice.status === 'DRAFT' && (
              <button
                type="button"
                disabled={Boolean(updatingStatus)}
                onClick={() => handleStatusChange('ISSUED')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {updatingStatus === 'ISSUED' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Emitir Factura</span>
              </button>
            )}

            {(invoice.status === 'ISSUED' || invoice.status === 'PARTIAL_PAID') && (
              <button
                type="button"
                disabled={Boolean(updatingStatus)}
                onClick={() => handleStatusChange('PAID')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {updatingStatus === 'PAID' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Marcar como Pagada</span>
              </button>
            )}

            {invoice.status !== 'VOID' && invoice.status !== 'PAID' && (
              <button
                type="button"
                disabled={Boolean(updatingStatus)}
                onClick={() => handleStatusChange('VOID')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {updatingStatus === 'VOID' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Ban className="w-3.5 h-3.5" />
                )}
                <span>Anular</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-200 rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
