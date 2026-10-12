'use client';

import React, { useEffect, useState } from 'react';
import { Customer, Invoice } from '@/types/database';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';
import {
  X,
  Pencil,
  Mail,
  MapPin,
  FileText,
  Calendar,
  Receipt,
  Building2,
  Copy,
  Check
} from 'lucide-react';

interface CustomerDetailsModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onEditCustomer: (customer: Customer) => void;
}

export function CustomerDetailsModal({
  customer,
  isOpen,
  onClose,
  onEditCustomer,
}: CustomerDetailsModalProps) {
  const { activeCompany } = useAuth();
  const supabase = createClient();

  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [copiedTaxId, setCopiedTaxId] = useState(false);

  const isColombia = activeCompany?.country !== 'US';
  const currency = activeCompany?.base_currency || 'COP';

  useEffect(() => {
    if (!isOpen || !customer || !activeCompany) return;

    let mounted = true;
    async function fetchCustomerInvoices() {
      setLoadingInvoices(true);
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('company_id', activeCompany!.id)
          .eq('customer_id', customer!.id)
          .order('created_at', { ascending: false });

        if (!error && mounted) {
          setCustomerInvoices((data as Invoice[]) || []);
        }
      } catch (err) {
        console.error('Error fetching customer invoices:', err);
      } finally {
        if (mounted) setLoadingInvoices(false);
      }
    }

    fetchCustomerInvoices();
    return () => {
      mounted = false;
    };
  }, [isOpen, customer, activeCompany, supabase]);

  if (!isOpen || !customer) return null;

  const totalBilled = customerInvoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);
  const pendingReceivable = customerInvoices
    .filter((inv) => inv.status === 'ISSUED' || inv.status === 'PARTIAL_PAID')
    .reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);

  const handleCopyTaxId = () => {
    if (!customer.tax_id) return;
    navigator.clipboard.writeText(customer.tax_id);
    setCopiedTaxId(true);
    setTimeout(() => setCopiedTaxId(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-zinc-200/90 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-semibold text-sm shrink-0">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-zinc-900 truncate">
                {customer.name}
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono-numbers">
                Registrado el {formatDate(customer.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditCustomer(customer);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            >
              <Pencil className="w-3.5 h-3.5 text-zinc-600" />
              <span>Editar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Datos Fiscales y de Contacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                {isColombia ? 'NIT / Documento' : 'Tax ID / EIN'}
              </span>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs font-semibold font-mono-numbers text-zinc-900">
                  {customer.tax_id || 'Sin especificar'}
                </span>
                {customer.tax_id && (
                  <button
                    type="button"
                    onClick={handleCopyTaxId}
                    title="Copiar identificación"
                    className="p-1 rounded hover:bg-zinc-200/60 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                  >
                    {copiedTaxId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-400" />
                Correo de Facturación
              </span>
              <div className="mt-1 text-xs font-medium text-zinc-900 truncate">
                {customer.email || 'Sin correo registrado'}
              </div>
            </div>

            <div className="sm:col-span-2 p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                Dirección de Facturación
              </span>
              <div className="mt-1 text-xs text-zinc-800 leading-relaxed">
                {customer.billing_address || (
                  <span className="text-zinc-400 italic">No se ha registrado dirección fiscal</span>
                )}
              </div>
            </div>
          </div>

          {/* Resumen Financiero del Cliente */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
              Estado de Cuenta del Cliente
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-zinc-200/80 bg-white">
                <span className="text-[11px] text-zinc-500">Total Facturado</span>
                <div className="text-sm font-bold font-mono-numbers text-zinc-900 mt-0.5">
                  {formatCurrency(totalBilled, currency)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-200/80 bg-white">
                <span className="text-[11px] text-zinc-500">Por Cobrar</span>
                <div className="text-sm font-bold font-mono-numbers text-amber-600 mt-0.5">
                  {formatCurrency(pendingReceivable, currency)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-200/80 bg-white">
                <span className="text-[11px] text-zinc-500">Comprobantes</span>
                <div className="text-sm font-bold font-mono-numbers text-zinc-900 mt-0.5">
                  {customerInvoices.length}
                </div>
              </div>
            </div>
          </div>

          {/* Historial de Facturas del Cliente */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2.5 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-zinc-400" />
              Facturas Asociadas
            </h4>

            {loadingInvoices ? (
              <div className="space-y-2">
                <div className="h-10 bg-zinc-100 animate-pulse rounded-lg" />
                <div className="h-10 bg-zinc-100 animate-pulse rounded-lg" />
              </div>
            ) : customerInvoices.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-zinc-200 text-center text-xs text-zinc-400">
                Este cliente aún no registra facturas emitidas.
              </div>
            ) : (
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] text-zinc-500 font-medium">
                      <th className="py-2 px-3">N° Factura</th>
                      <th className="py-2 px-3">Emisión</th>
                      <th className="py-2 px-3 text-right">Total</th>
                      <th className="py-2 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {customerInvoices.slice(0, 5).map((inv) => {
                      const badge = getStatusBadge(inv.status);
                      return (
                        <tr key={inv.id} className="hover:bg-zinc-50/60">
                          <td className="py-2.5 px-3 font-mono-numbers font-medium text-zinc-900">
                            {inv.invoice_number}
                          </td>
                          <td className="py-2.5 px-3 font-mono-numbers text-zinc-500">
                            {formatDate(inv.issue_date)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers font-medium text-zinc-900">
                            {formatCurrency(inv.total, inv.currency || currency)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.bg}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
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
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-100 bg-zinc-50/40 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
