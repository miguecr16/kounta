'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { BankTransaction, Expense, ExpenseCategory } from '@/types/database';
import {
  EXPENSE_CATEGORY_OPTIONS,
  formatCurrency,
  formatDate,
  getExpenseCategoryBadge,
} from '@/lib/utils';
import {
  X,
  Wallet,
  Search,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertCircle,
  PlusCircle,
  Building2,
  Calendar,
  Tag,
  Coins,
  Link2,
} from 'lucide-react';

interface MatchExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: BankTransaction | null;
  currency: string;
  onMatched: (transactionId: string, expense: Expense) => void;
}

export function MatchExpenseModal({
  isOpen,
  onClose,
  transaction,
  currency,
  onMatched,
}: MatchExpenseModalProps) {
  const { activeCompany, user } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'LINK_EXISTING' | 'CREATE_QUICK'>('CREATE_QUICK');

  // Existing expenses tab state
  const [existingExpenses, setExistingExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Quick expense form state
  const [vendorName, setVendorName] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('OTHER');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !transaction) return;

    setErrorMsg(null);
    setSelectedExpenseId(null);
    setSearch('');

    // Pre-populate quick expense defaults
    setNotes(transaction.description || '');

    // Guess vendor name from bank description (clean common bank prefixes)
    const cleanDesc = transaction.description
      .replace(/^(COMPRA|PAGO|TRANSFERENCIA|TRANSF|DEBITO|CARGO|ACH|POS|DB)\s*[-:]?\s*/i, '')
      .trim();
    setVendorName(cleanDesc);

    // Auto-guess category based on description keywords
    const lowerDesc = transaction.description.toLowerCase();
    if (lowerDesc.includes('nomina') || lowerDesc.includes('payroll') || lowerDesc.includes('sueldo')) {
      setCategory('PAYROLL');
    } else if (lowerDesc.includes('arriendo') || lowerDesc.includes('rent')) {
      setCategory('RENT');
    } else if (
      lowerDesc.includes('software') ||
      lowerDesc.includes('aws') ||
      lowerDesc.includes('google') ||
      lowerDesc.includes('github') ||
      lowerDesc.includes('slack') ||
      lowerDesc.includes('supabase')
    ) {
      setCategory('SOFTWARE');
    } else if (
      lowerDesc.includes('enel') ||
      lowerDesc.includes('epm') ||
      lowerDesc.includes('claro') ||
      lowerDesc.includes('etb') ||
      lowerDesc.includes('luz') ||
      lowerDesc.includes('agua')
    ) {
      setCategory('UTILITIES');
    } else if (
      lowerDesc.includes('dian') ||
      lowerDesc.includes('irs') ||
      lowerDesc.includes('impuesto') ||
      lowerDesc.includes('tax')
    ) {
      setCategory('TAXES');
    } else if (lowerDesc.includes('meta') || lowerDesc.includes('facebook') || lowerDesc.includes('ads')) {
      setCategory('MARKETING');
    } else {
      setCategory('OTHER');
    }

    // Fetch recent unlinked expenses
    const fetchExpenses = async () => {
      if (!activeCompany) return;
      setLoadingExpenses(true);
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('company_id', activeCompany.id)
          .order('expense_date', { ascending: false })
          .limit(50);

        if (error) throw error;
        setExistingExpenses((data as Expense[]) || []);
      } catch (err) {
        console.error('Error fetching expenses:', err);
      } finally {
        setLoadingExpenses(false);
      }
    };

    fetchExpenses();
  }, [isOpen, transaction, activeCompany, supabase]);

  const filteredExpenses = useMemo(() => {
    if (!transaction) return [];
    const txAmount = Math.abs(transaction.amount);

    return existingExpenses
      .filter((exp) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const vendorMatch = (exp.vendor_name || '').toLowerCase().includes(q);
        const notesMatch = (exp.notes || '').toLowerCase().includes(q);
        const amountMatch = exp.amount.toString().includes(q);
        return vendorMatch || notesMatch || amountMatch;
      })
      .sort((a, b) => {
        const diffA = Math.abs(a.amount - txAmount);
        const diffB = Math.abs(b.amount - txAmount);
        return diffA - diffB;
      });
  }, [existingExpenses, search, transaction]);

  if (!isOpen || !transaction) return null;

  const targetAmount = Math.abs(transaction.amount);

  // Link with existing expense
  const handleLinkExisting = async () => {
    if (!selectedExpenseId || !transaction || !activeCompany) return;

    const matchedExpense = existingExpenses.find((e) => e.id === selectedExpenseId);
    if (!matchedExpense) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const { error: txErr } = await supabase
        .from('bank_transactions')
        .update({
          status: 'MATCHED',
          matched_expense_id: selectedExpenseId,
        })
        .eq('id', transaction.id);

      if (txErr) throw txErr;

      onMatched(transaction.id, matchedExpense);
      onClose();
    } catch (err: unknown) {
      console.error('Error linking expense:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al vincular el gasto.');
    } finally {
      setSubmitting(false);
    }
  };

  // Create quick expense and link
  const handleCreateQuickExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction || !activeCompany) return;

    if (!vendorName.trim()) {
      setErrorMsg('Ingresa el proveedor o beneficiario del gasto.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Insert into expenses
      const expensePayload = {
        company_id: activeCompany.id,
        vendor_name: vendorName.trim(),
        category,
        expense_date: transaction.transaction_date,
        amount: targetAmount,
        currency,
        notes: notes.trim() || null,
        created_by: user?.id || null,
      };

      const { data: createdExpense, error: expErr } = await supabase
        .from('expenses')
        .insert(expensePayload)
        .select('*')
        .single();

      if (expErr) throw expErr;

      // 2. Update bank transaction to MATCHED
      const { error: txErr } = await supabase
        .from('bank_transactions')
        .update({
          status: 'MATCHED',
          matched_expense_id: createdExpense.id,
        })
        .eq('id', transaction.id);

      if (txErr) throw txErr;

      onMatched(transaction.id, createdExpense as Expense);
      onClose();
    } catch (err: unknown) {
      console.error('Error creating quick expense:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar el gasto.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Conciliar Egreso Bancario
              </h2>
              <p className="text-xs text-zinc-500">
                Registra un gasto rápido o vincula uno existente en tu contabilidad
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
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div className="min-w-0 pr-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-0.5">
              Salida Bancaria
            </div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {transaction.description}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Fecha: {formatDate(transaction.transaction_date)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-base font-mono font-bold text-zinc-900 dark:text-zinc-100">
              -{formatCurrency(targetAmount, currency)}
            </div>
            <span className="text-[10px] text-zinc-500 uppercase font-mono">
              {currency}
            </span>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-zinc-50/50 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setActiveTab('CREATE_QUICK')}
            className={`py-3 text-xs font-medium border-b-2 transition-all flex items-center gap-2 mr-6 ${
              activeTab === 'CREATE_QUICK'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Crear Gasto Rápido</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LINK_EXISTING')}
            className={`py-3 text-xs font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'LINK_EXISTING'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Vincular Gasto Existente</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'CREATE_QUICK' ? (
            <form id="quick-expense-form" onSubmit={handleCreateQuickExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Proveedor / Beneficiario <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="ej. AWS, Enel, WeWork, Nómina"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Categoría del Gasto <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Tag className="w-4 h-4" />
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-medium"
                  >
                    {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Fecha
                  </label>
                  <div className="px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 font-mono text-zinc-600 dark:text-zinc-300">
                    {formatDate(transaction.transaction_date)}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Monto
                  </label>
                  <div className="px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(targetAmount, currency)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Notas o Concepto Adicional
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles sobre el egreso..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por proveedor o notas..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              {loadingExpenses ? (
                <div className="py-12 flex flex-col items-center justify-center text-zinc-400 text-xs gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Buscando gastos registrados...</span>
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                  <Wallet className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    No se encontraron gastos que coincidan.
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Puedes utilizar la pestaña &quot;Crear Gasto Rápido&quot; para registrarlo en segundos.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {filteredExpenses.map((exp) => {
                    const isSelected = selectedExpenseId === exp.id;
                    const isExact = Math.abs(exp.amount - targetAmount) < 0.01;
                    const badge = getExpenseCategoryBadge(exp.category);

                    return (
                      <button
                        key={exp.id}
                        type="button"
                        onClick={() => setSelectedExpenseId(exp.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 ring-1 ring-zinc-900 dark:ring-zinc-100'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                        }`}
                      >
                        <div className="min-w-0 flex items-start gap-2.5">
                          <div
                            className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                                : 'border-zinc-300 dark:border-zinc-600'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {exp.vendor_name}
                              </span>
                              {isExact && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Monto exacto
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded border ${badge.badgeClass}`}
                              >
                                {badge.label}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                {formatDate(exp.expense_date)}
                              </span>
                            </div>
                            {exp.notes && (
                              <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                                {exp.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {formatCurrency(exp.amount, exp.currency || currency)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
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

          {activeTab === 'CREATE_QUICK' ? (
            <button
              form="quick-expense-form"
              type="submit"
              disabled={submitting || !vendorName.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white rounded-lg flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Crear Gasto y Conciliar
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLinkExisting}
              disabled={submitting || !selectedExpenseId}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white rounded-lg flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Vinculando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Vincular Gasto
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
