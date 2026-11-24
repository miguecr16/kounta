'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { BankTransaction, Invoice } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  X,
  Receipt,
  Search,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  Clock,
  User,
} from 'lucide-react';

interface MatchInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: BankTransaction | null;
  currency: string;
  onMatched: (transactionId: string, invoice: Invoice) => void;
}

export function MatchInvoiceModal({
  isOpen,
  onClose,
  transaction,
  currency,
  onMatched,
}: MatchInvoiceModalProps) {
  const { activeCompany } = useAuth();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !activeCompany) return;

    setErrorMsg(null);
    setSelectedInvoiceId(null);
    setSearch('');

    const fetchPendingInvoices = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('*, customer:customers(*)')
          .eq('company_id', activeCompany.id)
          .eq('status', 'ISSUED')
          .order('issue_date', { ascending: false });

        if (error) throw error;
        setInvoices((data as Invoice[]) || []);
      } catch (err: unknown) {
        console.error('Error loading pending invoices:', err);
        setErrorMsg('Error al cargar facturas por cobrar.');
      } finally {
        setLoading(false);
      }
    };

    fetchPendingInvoices();
  }, [isOpen, activeCompany, supabase]);

  const filteredInvoices = useMemo(() => {
    if (!transaction) return [];
    const txAmount = Math.abs(transaction.amount);

    return invoices
      .filter((inv) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const numMatch = (inv.invoice_number || '').toLowerCase().includes(q);
        const custMatch = (inv.customer?.name || '').toLowerCase().includes(q);
        const amountMatch = inv.total.toString().includes(q);
        return numMatch || custMatch || amountMatch;
      })
      .sort((a, b) => {
        // Prioritize exact amount match
        const diffA = Math.abs(a.total - txAmount);
        const diffB = Math.abs(b.total - txAmount);
        return diffA - diffB;
      });
  }, [invoices, search, transaction]);

  if (!isOpen || !transaction) return null;

  const handleConfirmMatch = async () => {
    if (!selectedInvoiceId || !transaction || !activeCompany) return;

    const matchedInvoice = invoices.find((inv) => inv.id === selectedInvoiceId);
    if (!matchedInvoice) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Update bank transaction to MATCHED with matched_invoice_id
      const { error: txErr } = await supabase
        .from('bank_transactions')
        .update({
          status: 'MATCHED',
          matched_invoice_id: selectedInvoiceId,
        })
        .eq('id', transaction.id);

      if (txErr) throw txErr;

      // 2. Automatically update invoice status to PAID
      const { error: invErr } = await supabase
        .from('invoices')
        .update({
          status: 'PAID',
        })
        .eq('id', selectedInvoiceId);

      if (invErr) throw invErr;

      onMatched(transaction.id, matchedInvoice);
      onClose();
    } catch (err: unknown) {
      console.error('Error matching invoice:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al vincular la factura.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/50 dark:border-emerald-800/40">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Vincular con Factura por Cobrar
              </h2>
              <p className="text-xs text-zinc-500">
                Concilia el depósito y marca la factura emitida automáticamente como Pagada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Transaction Summary */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
            Depósito Bancario Recibido
          </div>
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-4">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {transaction.description}
              </div>
              <div className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Fecha: {formatDate(transaction.transaction_date)}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-base font-mono font-bold text-emerald-700 dark:text-emerald-400">
                +{formatCurrency(transaction.amount, currency)}
              </div>
              <span className="text-[10px] text-zinc-500 uppercase font-mono">
                {currency}
              </span>
            </div>
          </div>
        </div>

        {/* Invoices List Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por N° de factura, cliente o monto..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-400 text-xs gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Buscando facturas emitidas...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <Receipt className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                No hay facturas pendientes emitidas ({'ISSUED'}) que coincidan.
              </p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-xs mx-auto">
                Asegúrate de que la factura esté creada en estado &quot;Emitida&quot; para poder conciliarla con este pago.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-zinc-500 flex items-center justify-between">
                <span>Facturas sugeridas ({filteredInvoices.length})</span>
                <span className="text-[10px]">Selecciona la factura correspondiente</span>
              </div>

              {filteredInvoices.map((inv) => {
                const isSelected = selectedInvoiceId === inv.id;
                const isExactMatch = Math.abs(inv.total - Math.abs(transaction.amount)) < 0.01;

                return (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 ring-1 ring-emerald-600'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <div className="min-w-0 flex items-start gap-3">
                      <div
                        className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-zinc-300 dark:border-zinc-600'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {inv.invoice_number}
                          </span>
                          {isExactMatch && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              Monto idéntico
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
                          <User className="w-3 h-3 text-zinc-400" />
                          <span className="truncate">{inv.customer?.name || 'Cliente sin registrar'}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          Emitida: {formatDate(inv.issue_date)} • Vence: {formatDate(inv.due_date)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(inv.total, inv.currency || currency)}
                      </div>
                      <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded border border-blue-200/50 dark:border-blue-800/40">
                        Por Cobrar
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmMatch}
            disabled={submitting || !selectedInvoiceId}
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Conciliando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Vincular y Marcar como Pagada
                {selectedInvoice && (
                  <span className="font-mono text-emerald-100">
                    ({selectedInvoice.invoice_number})
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
