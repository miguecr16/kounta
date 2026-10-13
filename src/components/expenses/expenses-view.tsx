'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Expense, ExpenseCategory } from '@/types/database';
import {
  EXPENSE_CATEGORY_OPTIONS,
  formatCurrency,
  formatDate,
  getExpenseCategoryBadge,
} from '@/lib/utils';
import { CreateExpenseModal } from '@/components/modals/create-expense-modal';
import { Toast, ToastMessage } from '@/components/ui/toast';
import {
  Wallet,
  Plus,
  Search,
  Calendar,
  Tag,
  Edit3,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Loader2,
  TrendingDown,
  PieChart,
  Percent,
  X,
  Receipt,
} from 'lucide-react';

export function ExpensesView() {
  const { activeCompany } = useAuth();
  const { isAdmin, canDeleteExpenses } = usePermissions();
  const supabase = createClient();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Filter states
  const [searchVendor, setSearchVendor] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | ExpenseCategory>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Delete confirmation state (ADMIN only)
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadExpenses = useCallback(async () => {
    if (!activeCompany) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses((data as Expense[]) || []);
    } catch (err) {
      console.error('Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCompany, supabase]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const currency = activeCompany?.base_currency || 'COP';
  const isColombia = activeCompany?.country !== 'US';

  // Reactive filtering by vendor, category, and date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // 1. Vendor / notes search
      if (searchVendor.trim()) {
        const q = searchVendor.toLowerCase().trim();
        const matchVendor = (exp.vendor_name || '').toLowerCase().includes(q);
        const matchNotes = (exp.notes || '').toLowerCase().includes(q);
        if (!matchVendor && !matchNotes) return false;
      }

      // 2. Category filter
      if (selectedCategory !== 'ALL' && exp.category !== selectedCategory) {
        return false;
      }

      // 3. Date range filter
      const expDate = (exp.expense_date || '').slice(0, 10);
      if (dateFrom && expDate < dateFrom) return false;
      if (dateTo && expDate > dateTo) return false;

      return true;
    });
  }, [expenses, searchVendor, selectedCategory, dateFrom, dateTo]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}`;

    const totalInPeriod = filteredExpenses.reduce(
      (acc, e) => acc + (Number(e.amount) || 0),
      0
    );

    const totalDeductibleTax = filteredExpenses.reduce(
      (acc, e) => acc + (Number(e.tax_deductible) || 0),
      0
    );

    const currentMonthExpenses = expenses
      .filter((e) => (e.expense_date || '').startsWith(currentMonthPrefix))
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    // Top Category in filtered period
    const categoryTotals = new Map<ExpenseCategory, number>();
    filteredExpenses.forEach((e) => {
      const prev = categoryTotals.get(e.category) || 0;
      categoryTotals.set(e.category, prev + (Number(e.amount) || 0));
    });

    let topCategory: ExpenseCategory | null = null;
    let topCategoryAmount = 0;

    categoryTotals.forEach((amt, cat) => {
      if (amt > topCategoryAmount) {
        topCategoryAmount = amt;
        topCategory = cat;
      }
    });

    const topCategoryShare =
      totalInPeriod > 0 ? Math.round((topCategoryAmount / totalInPeriod) * 100) : 0;

    return {
      totalInPeriod,
      totalDeductibleTax,
      currentMonthExpenses,
      topCategory,
      topCategoryAmount,
      topCategoryShare,
    };
  }, [filteredExpenses, expenses]);

  const handleExpenseSaved = (savedExpense: Expense, isEdit: boolean) => {
    if (isEdit) {
      setExpenses((prev) =>
        prev.map((item) => (item.id === savedExpense.id ? savedExpense : item))
      );
      setToast({
        id: String(Date.now()),
        type: 'success',
        title: 'Gasto actualizado',
        description: `El registro de ${savedExpense.vendor_name} fue actualizado correctamente.`,
      });
    } else {
      setExpenses((prev) => [savedExpense, ...prev]);
      setToast({
        id: String(Date.now()),
        type: 'success',
        title: 'Gasto registrado exitosamente',
        description: `Se contabilizó el egreso de ${savedExpense.vendor_name}.`,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!expenseToDelete || !activeCompany || !canDeleteExpenses) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseToDelete.id)
        .eq('company_id', activeCompany.id);

      if (error) throw error;

      setExpenses((prev) => prev.filter((e) => e.id !== expenseToDelete.id));
      setToast({
        id: String(Date.now()),
        type: 'success',
        title: 'Gasto eliminado',
        description: `El egreso de ${expenseToDelete.vendor_name} fue removido del libro contable.`,
      });
      setExpenseToDelete(null);
    } catch (err: any) {
      console.error('Error deleting expense:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Error al eliminar gasto',
        description: err.message || 'No se pudo eliminar el registro.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters =
    Boolean(searchVendor.trim()) ||
    selectedCategory !== 'ALL' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const clearFilters = () => {
    setSearchVendor('');
    setSelectedCategory('ALL');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <>
      <Header
        title="Gastos y Egresos"
        subtitle={`Control de costos operativos, proveedores e impuestos deducibles · ${
          activeCompany?.legal_name || ''
        }`}
      />

      <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
              Libro de Gastos Operativos
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono-numbers font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
              {filteredExpenses.length}{' '}
              {filteredExpenses.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setExpenseToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Registrar Gasto</span>
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Gastado en el Periodo */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium text-zinc-600">
                  Total Gastado en el Periodo
                </span>
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700 border border-zinc-200/60">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              {loading ? (
                <div className="h-8 w-36 bg-zinc-100 animate-pulse rounded my-1" />
              ) : (
                <div className="text-2xl font-bold font-mono-numbers text-zinc-900 tracking-tight">
                  {formatCurrency(metrics.totalInPeriod, currency)}
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono-numbers text-zinc-500">
              <span>Comprobantes filtrados:</span>
              <span className="font-semibold text-zinc-800">
                {filteredExpenses.length} egresos
              </span>
            </div>
          </div>

          {/* Card 2: Gastos del Mes en Curso */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium text-zinc-600">
                  Gastos de Este Mes
                </span>
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700 border border-zinc-200/60">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              {loading ? (
                <div className="h-8 w-36 bg-zinc-100 animate-pulse rounded my-1" />
              ) : (
                <div className="text-2xl font-bold font-mono-numbers text-zinc-900 tracking-tight">
                  {formatCurrency(metrics.currentMonthExpenses, currency)}
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Ciclo mensual activo</span>
              <span className="font-mono-numbers font-medium text-zinc-700">
                {currency}
              </span>
            </div>
          </div>

          {/* Card 3: Categoría Principal */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium text-zinc-600">
                  Categoría Principal
                </span>
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700 border border-zinc-200/60">
                  <PieChart className="w-4 h-4" />
                </div>
              </div>
              {loading ? (
                <div className="h-8 w-32 bg-zinc-100 animate-pulse rounded my-1" />
              ) : metrics.topCategory ? (
                <div className="text-lg font-bold text-zinc-900 truncate">
                  {getExpenseCategoryBadge(metrics.topCategory).label}
                </div>
              ) : (
                <div className="text-lg font-semibold text-zinc-400">Sin registros</div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono-numbers">
              <span className="text-zinc-500">
                {metrics.topCategory ? `${metrics.topCategoryShare}% del gasto:` : 'Monto:'}
              </span>
              <span className="font-semibold text-zinc-800">
                {formatCurrency(metrics.topCategoryAmount, currency)}
              </span>
            </div>
          </div>

          {/* Card 4: Impuesto Deducible / IVA Soportado */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium text-zinc-600">
                  {isColombia ? 'IVA Descontable Soportado' : 'Tax Deductible Total'}
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              {loading ? (
                <div className="h-8 w-32 bg-zinc-100 animate-pulse rounded my-1" />
              ) : (
                <div className="text-2xl font-bold font-mono-numbers text-emerald-700 tracking-tight">
                  {formatCurrency(metrics.totalDeductibleTax, currency)}
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Crédito fiscal en compras</span>
              <span className="font-mono-numbers font-medium text-emerald-700">
                {isColombia ? 'DIAN' : 'IRS'}
              </span>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search by vendor */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchVendor}
              onChange={(e) => setSearchVendor(e.target.value)}
              placeholder="Buscar por proveedor, beneficiario o notas..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Selector */}
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-400" />
              <select
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value as 'ALL' | ExpenseCategory)
                }
                className="px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 font-medium focus:bg-white focus:outline-none focus:border-zinc-900 cursor-pointer"
              >
                <option value="ALL">Todas las categorías</option>
                {EXPENSE_CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Desde:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono-numbers bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 focus:bg-white focus:outline-none focus:border-zinc-900"
              />
            </div>

            {/* Date To */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Hasta:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono-numbers bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 focus:bg-white focus:outline-none focus:border-zinc-900"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/70 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Accounting Expenses Table */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-zinc-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-14 text-center flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mb-3">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">
                {hasActiveFilters
                  ? 'No se encontraron gastos con los filtros aplicados'
                  : 'Aún no has registrado gastos ni egresos'}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-md">
                {hasActiveFilters
                  ? 'Prueba ajustando el rango de fechas, categoría o término de búsqueda.'
                  : 'Registra pagos de nómina, arriendo, software o impuestos para calcular automáticamente la Utilidad Neta (P&L) de tu empresa.'}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  Restablecer filtros
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setExpenseToEdit(null);
                    setIsModalOpen(true);
                  }}
                  className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Registrar Primer Gasto</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-zinc-200/80 text-zinc-500 text-[11px] font-medium uppercase tracking-wider">
                    <th className="py-3 px-5">Fecha</th>
                    <th className="py-3 px-4">Proveedor / Beneficiario</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-3 text-center">Moneda</th>
                    <th className="py-3 px-4 text-right">
                      {isColombia ? 'IVA Deducible' : 'Tax Deductible'}
                    </th>
                    <th className="py-3 px-5 text-right">Monto</th>
                    <th className="py-3 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredExpenses.map((exp) => {
                    const catBadge = getExpenseCategoryBadge(exp.category);
                    const deductible = Number(exp.tax_deductible) || 0;

                    return (
                      <tr
                        key={exp.id}
                        className="hover:bg-zinc-50/70 transition-colors group"
                      >
                        {/* Col 1: Fecha */}
                        <td className="py-3.5 px-5 font-mono-numbers text-zinc-600 whitespace-nowrap">
                          {formatDate(exp.expense_date)}
                        </td>

                        {/* Col 2: Proveedor / Beneficiario + Notas */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                            <span>{exp.vendor_name}</span>
                            {exp.receipt_url && (
                              <a
                                href={exp.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver soporte / recibo"
                                className="text-zinc-400 hover:text-indigo-600 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          {exp.notes && (
                            <div className="text-[11px] text-zinc-500 truncate max-w-xs mt-0.5">
                              {exp.notes}
                            </div>
                          )}
                        </td>

                        {/* Col 3: Categoría Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${catBadge.badgeClass}`}
                          >
                            {catBadge.label}
                          </span>
                        </td>

                        {/* Col 4: Moneda */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono-numbers font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/80">
                            {exp.currency || currency}
                          </span>
                        </td>

                        {/* Col 5: Impuesto Deducible */}
                        <td className="py-3.5 px-4 text-right font-mono-numbers text-zinc-600">
                          {deductible > 0 ? (
                            <span className="text-emerald-700 font-medium">
                              {formatCurrency(deductible, exp.currency || currency)}
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>

                        {/* Col 6: Monto */}
                        <td className="py-3.5 px-5 text-right font-mono-numbers font-semibold text-zinc-900 whitespace-nowrap">
                          {formatCurrency(Number(exp.amount) || 0, exp.currency || currency)}
                        </td>

                        {/* Col 7: Acciones (Editar / Eliminar solo para ADMIN) */}
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setExpenseToEdit(exp);
                                setIsModalOpen(true);
                              }}
                              title="Editar gasto"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent hover:border-zinc-200/80 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setExpenseToDelete(exp)}
                                title="Eliminar gasto (Solo ADMIN)"
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200/60 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

      {/* Create / Edit Expense Modal */}
      <CreateExpenseModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setExpenseToEdit(null);
        }}
        expenseToEdit={expenseToEdit}
        onExpenseSaved={handleExpenseSaved}
      />

      {/* Delete Expense Confirmation Modal (ADMIN Only) */}
      {expenseToDelete && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !deleting && setExpenseToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  ¿Eliminar este registro de gasto?
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Estás a punto de eliminar el egreso de{' '}
                  <strong className="text-zinc-800">{expenseToDelete.vendor_name}</strong> por{' '}
                  <strong className="font-mono-numbers text-zinc-800">
                    {formatCurrency(
                      Number(expenseToDelete.amount) || 0,
                      expenseToDelete.currency || currency
                    )}
                  </strong>
                  . Esta acción recalculará inmediatamente la utilidad neta en el Dashboard y Reportes P&L.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setExpenseToDelete(null)}
                className="px-3.5 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Sí, eliminar gasto</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
