'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Expense, ExpenseCategory } from '@/types/database';
import { EXPENSE_CATEGORY_OPTIONS, formatCurrency } from '@/lib/utils';
import {
  X,
  Wallet,
  Building2,
  Calendar,
  Coins,
  Tag,
  FileText,
  Link2,
  Loader2,
  Check,
  AlertCircle,
  Percent,
} from 'lucide-react';

interface CreateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseToEdit?: Expense | null;
  onExpenseSaved: (savedExpense: Expense, isEdit: boolean) => void;
}

export function CreateExpenseModal({
  isOpen,
  onClose,
  expenseToEdit = null,
  onExpenseSaved,
}: CreateExpenseModalProps) {
  const { activeCompany, user } = useAuth();
  const supabase = createClient();

  const isColombia = activeCompany?.country !== 'US';
  const defaultCurrency = activeCompany?.base_currency || 'COP';

  const [vendorName, setVendorName] = useState('');
  const [expenseDate, setExpenseDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<'COP' | 'USD'>(defaultCurrency);
  const [category, setCategory] = useState<ExpenseCategory>('SOFTWARE');
  const [taxDeductible, setTaxDeductible] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEditMode = Boolean(expenseToEdit?.id);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);

    if (expenseToEdit) {
      setVendorName(expenseToEdit.vendor_name || '');
      setExpenseDate(
        expenseToEdit.expense_date
          ? expenseToEdit.expense_date.slice(0, 10)
          : new Date().toISOString().split('T')[0]
      );
      setAmount(
        expenseToEdit.amount !== undefined && expenseToEdit.amount !== null
          ? String(expenseToEdit.amount)
          : ''
      );
      setCurrency((expenseToEdit.currency as 'COP' | 'USD') || defaultCurrency);
      setCategory(expenseToEdit.category || 'OTHER');
      setTaxDeductible(
        expenseToEdit.tax_deductible !== undefined &&
          expenseToEdit.tax_deductible !== null
          ? String(expenseToEdit.tax_deductible)
          : ''
      );
      setReceiptUrl(expenseToEdit.receipt_url || '');
      setNotes(expenseToEdit.notes || '');
    } else {
      setVendorName('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setAmount('');
      setCurrency(activeCompany?.base_currency || 'COP');
      setCategory('SOFTWARE');
      setTaxDeductible('');
      setReceiptUrl('');
      setNotes('');
    }
  }, [isOpen, expenseToEdit, activeCompany, defaultCurrency]);

  if (!isOpen) return null;

  const numericAmount = parseFloat(amount) || 0;
  const numericTax = parseFloat(taxDeductible) || 0;

  const handleAutoCalculateIva = () => {
    if (numericAmount <= 0) return;
    // Extract 19% IVA included or 19% on base
    const estimatedIva = Number(((numericAmount * 0.19) / 1.19).toFixed(2));
    setTaxDeductible(String(estimatedIva));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!activeCompany || !user) {
      setErrorMsg('No se encontró una empresa activa o sesión válida.');
      return;
    }

    if (!vendorName.trim()) {
      setErrorMsg('El nombre del proveedor o beneficiario es obligatorio.');
      return;
    }

    if (numericAmount <= 0) {
      setErrorMsg('Ingresa un monto mayor a cero.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        company_id: activeCompany.id,
        vendor_name: vendorName.trim(),
        category,
        expense_date: expenseDate,
        amount: Number(numericAmount.toFixed(2)),
        currency,
        tax_deductible: taxDeductible.trim() !== '' ? Number(numericTax.toFixed(2)) : 0,
        receipt_url: receiptUrl.trim() || null,
        notes: notes.trim() || null,
        ...(isEditMode ? {} : { created_by: user.id }),
      };

      if (isEditMode && expenseToEdit) {
        const { data, error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', expenseToEdit.id)
          .eq('company_id', activeCompany.id)
          .select('*')
          .single();

        if (error) throw error;
        onExpenseSaved(data as Expense, true);
      } else {
        const { data, error } = await supabase
          .from('expenses')
          .insert(payload)
          .select('*')
          .single();

        if (error) throw error;
        onExpenseSaved(data as Expense, false);
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving expense:', err);
      setErrorMsg(err.message || 'No fue posible registrar el gasto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => !loading && onClose()}
    >
      <div
        className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-900 text-white">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                {isEditMode ? 'Editar Gasto / Egreso' : 'Registrar Nuevo Gasto'}
              </h3>
              <p className="text-[11px] text-zinc-500">
                {activeCompany?.name} · Contabilidad {isColombia ? '🇨🇴 DIAN' : '🇺🇸 IRS'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Proveedor / Beneficiario */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Proveedor / Beneficiario <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder={
                  isColombia
                    ? 'Ej. AWS Cloud Services, Bancolombia, Enel Codensa...'
                    : 'Ej. Amazon Web Services, WeWork, Gusto Payroll...'
                }
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
              />
            </div>
          </div>

          {/* Grid: Fecha & Categoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Fecha del gasto <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono-numbers bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Categoría Contable <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Tag className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 font-medium focus:bg-white focus:outline-none focus:border-zinc-900 cursor-pointer"
                >
                  {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Grid: Monto & Moneda */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Monto Total del Gasto <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2 text-xs font-mono-numbers font-semibold bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
              />
              {numericAmount > 0 && (
                <p className="mt-1 text-[10px] font-mono-numbers text-zinc-500">
                  Equivalente formateado: {formatCurrency(numericAmount, currency)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Moneda
              </label>
              <div className="relative">
                <Coins className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'COP' | 'USD')}
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono-numbers font-medium bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900 cursor-pointer"
                >
                  <option value="COP">COP ($)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Impuesto Deducible / IVA Soportado & Comprobante URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-700">
                  {isColombia ? 'IVA Descontable / Soportado' : 'Tax Deductible Amount'}
                </label>
                {isColombia && numericAmount > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoCalculateIva}
                    className="text-[10px] font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    Calcular IVA 19%
                  </button>
                )}
              </div>
              <div className="relative">
                <Percent className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxDeductible}
                  onChange={(e) => setTaxDeductible(e.target.value)}
                  placeholder="0.00 (Opcional)"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono-numbers bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                URL de Recibo / Soporte (Opcional)
              </label>
              <div className="relative">
                <Link2 className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="url"
                  value={receiptUrl}
                  onChange={(e) => setReceiptUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>
          </div>

          {/* Notas o descripción */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Notas o descripción del egreso
            </label>
            <div className="relative">
              <FileText className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalle del servicio, número de factura del proveedor o centro de costos..."
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 resize-none"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{isEditMode ? 'Guardar Cambios' : 'Registrar Gasto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
