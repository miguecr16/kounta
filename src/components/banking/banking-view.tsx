'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import {
  BankAccount,
  BankTransaction,
  BankTransactionStatus,
  Invoice,
  Expense,
} from '@/types/database';
import {
  formatCurrency,
  formatDate,
  formatSignedCurrency,
  getBankAccountTypeLabel,
  getBankTransactionStatusBadge,
  getExpenseCategoryBadge,
} from '@/lib/utils';
import { CreateBankAccountModal } from '@/components/modals/create-bank-account-modal';
import { ImportBankCsvModal } from '@/components/modals/import-bank-csv-modal';
import { MatchInvoiceModal } from '@/components/banking/match-invoice-modal';
import { MatchExpenseModal } from '@/components/banking/match-expense-modal';
import { Toast, ToastMessage } from '@/components/ui/toast';
import {
  Landmark,
  Plus,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Ban,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Wallet,
  Building2,
  CreditCard,
  PiggyBank,
  RotateCcw,
  Sparkles,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

export function BankingView() {
  const { activeCompany } = useAuth();
  const { isAdmin, canManageBankAccounts } = usePermissions();
  const supabase = createClient();

  // State
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Tabs: UNMATCHED, MATCHED, EXCLUDED
  const [activeTab, setActiveTab] = useState<BankTransactionStatus>('UNMATCHED');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [flowFilter, setFlowFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  // Modals state
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);

  // Matching modals
  const [matchingTxForInvoice, setMatchingTxForInvoice] = useState<BankTransaction | null>(null);
  const [matchingTxForExpense, setMatchingTxForExpense] = useState<BankTransaction | null>(null);

  // Load bank accounts
  const loadAccounts = useCallback(async () => {
    if (!activeCompany) return;
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const accList = (data as BankAccount[]) || [];
      setAccounts(accList);

      // Select first account by default if not set or if deleted
      if (accList.length > 0) {
        setSelectedAccountId((prev) => {
          if (prev && accList.some((a) => a.id === prev)) return prev;
          return accList[0].id;
        });
      } else {
        setSelectedAccountId(null);
      }
    } catch (err) {
      console.error('Error loading bank accounts:', err);
      setToast({
        id: Math.random().toString(),
        type: 'error',
        title: 'Error de conexión',
        description: 'No se pudieron cargar las cuentas bancarias.',
      });
    } finally {
      setLoadingAccounts(false);
    }
  }, [activeCompany, supabase]);

  // Load transactions for selected account
  const loadTransactions = useCallback(async () => {
    if (!activeCompany || !selectedAccountId) {
      setTransactions([]);
      return;
    }

    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select(`
          *,
          matched_invoice:invoices(*),
          matched_expense:expenses(*)
        `)
        .eq('company_id', activeCompany.id)
        .eq('bank_account_id', selectedAccountId)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions((data as BankTransaction[]) || []);
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  }, [activeCompany, selectedAccountId, supabase]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (selectedAccountId) {
      loadTransactions();
    }
  }, [selectedAccountId, loadTransactions]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    let unmatched = 0;
    let matched = 0;
    let excluded = 0;

    transactions.forEach((tx) => {
      if (tx.status === 'UNMATCHED') unmatched++;
      else if (tx.status === 'MATCHED') matched++;
      else if (tx.status === 'EXCLUDED') excluded++;
    });

    return { unmatched, matched, excluded };
  }, [transactions]);

  // Filtered transactions for the active tab and search
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Tab status
      if (tx.status !== activeTab) return false;

      // 2. Flow filter
      if (flowFilter === 'INCOME' && tx.amount <= 0) return false;
      if (flowFilter === 'EXPENSE' && tx.amount >= 0) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const amountMatch = Math.abs(tx.amount).toString().includes(q);
        const invoiceMatch =
          tx.matched_invoice?.invoice_number?.toLowerCase().includes(q) || false;
        const expenseMatch =
          tx.matched_expense?.vendor_name?.toLowerCase().includes(q) || false;
        return descMatch || amountMatch || invoiceMatch || expenseMatch;
      }

      return true;
    });
  }, [transactions, activeTab, flowFilter, searchQuery]);

  // Handle Mark as EXCLUDED
  const handleExcludeTransaction = async (tx: BankTransaction) => {
    if (!activeCompany) return;

    // Optimistic update
    setTransactions((prev) =>
      prev.map((item) => (item.id === tx.id ? { ...item, status: 'EXCLUDED' } : item))
    );

    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ status: 'EXCLUDED' })
        .eq('id', tx.id);

      if (error) throw error;

      setToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Movimiento excluido',
        description: 'La transacción se ha marcado como excluida de la contabilidad.',
      });
    } catch (err) {
      console.error('Error excluding transaction:', err);
      // Revert
      loadTransactions();
      setToast({
        id: Math.random().toString(),
        type: 'error',
        title: 'Error',
        description: 'No se pudo excluir la transacción.',
      });
    }
  };

  // Handle Revert to UNMATCHED (Deshacer)
  const handleRevertTransaction = async (tx: BankTransaction) => {
    if (!activeCompany) return;

    // Optimistic update
    setTransactions((prev) =>
      prev.map((item) =>
        item.id === tx.id
          ? {
              ...item,
              status: 'UNMATCHED',
              matched_invoice_id: null,
              matched_invoice: undefined,
              matched_expense_id: null,
              matched_expense: undefined,
            }
          : item
      )
    );

    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({
          status: 'UNMATCHED',
          matched_invoice_id: null,
          matched_expense_id: null,
        })
        .eq('id', tx.id);

      if (error) throw error;

      setToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Conciliación deshecha',
        description: 'La transacción ha vuelto al estado pendiente por revisar.',
      });
    } catch (err) {
      console.error('Error reverting transaction:', err);
      loadTransactions();
      setToast({
        id: Math.random().toString(),
        type: 'error',
        title: 'Error',
        description: 'No se pudo deshacer la conciliación.',
      });
    }
  };

  // Callback after invoice matching
  const handleInvoiceMatched = (transactionId: string, invoice: Invoice) => {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === transactionId
          ? {
              ...tx,
              status: 'MATCHED',
              matched_invoice_id: invoice.id,
              matched_invoice: invoice,
            }
          : tx
      )
    );
    setToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'Factura vinculada',
      description: `El cobro se concilió con la Factura ${invoice.invoice_number} y se marcó como Pagada.`,
    });
  };

  // Callback after expense matching
  const handleExpenseMatched = (transactionId: string, expense: Expense) => {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === transactionId
          ? {
              ...tx,
              status: 'MATCHED',
              matched_expense_id: expense.id,
              matched_expense: expense,
            }
          : tx
      )
    );
    setToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'Gasto conciliado',
      description: `El movimiento se vinculó con el gasto de ${expense.vendor_name}.`,
    });
  };

  // Callback after new account created
  const handleAccountCreated = (newAcc: BankAccount) => {
    setAccounts((prev) => [...prev, newAcc]);
    setSelectedAccountId(newAcc.id);
    setToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'Cuenta registrada',
      description: `${newAcc.institution_name} (${newAcc.account_name}) ha sido añadida.`,
    });
  };

  // Callback after CSV imported
  const handleImportComplete = (count: number, netChange: number) => {
    setToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'Extracto importado',
      description: `Se importaron ${count} movimientos exitosamente. El saldo fue actualizado.`,
    });
    // Reload accounts (for updated balance) and transactions
    loadAccounts();
    loadTransactions();
  };

  // Consolidated total balance in company base currency
  const totalBalanceStats = useMemo(() => {
    let copTotal = 0;
    let usdTotal = 0;

    accounts.forEach((acc) => {
      if (acc.currency === 'USD') {
        usdTotal += acc.current_balance;
      } else {
        copTotal += acc.current_balance;
      }
    });

    return { copTotal, usdTotal };
  }, [accounts]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-zinc-50/50 dark:bg-zinc-950">
      <Header
        title="Bancos y Conciliación"
        subtitle="Monitoreo de tesorería, importación de extractos y conciliación automática con facturas y gastos"
      />

      <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
        <Toast toast={toast} onDismiss={() => setToast(null)} />

        {/* TOP BAR: Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Cuentas de Tesorería
              </h2>
              <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Haz clic en cualquier cuenta para ver sus extractos bancarios y movimientos por conciliar
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {selectedAccount && (
              <button
                type="button"
                onClick={() => setIsImportCsvOpen(true)}
                className="px-3.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 rounded-lg shadow-2xs flex items-center gap-2 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Importar Extracto (CSV)</span>
              </button>
            )}

            {canManageBankAccounts && (
              <button
                type="button"
                onClick={() => setIsAddAccountOpen(true)}
                className="px-3.5 py-2 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white rounded-lg shadow-xs flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Cuenta Bancaria</span>
              </button>
            )}
          </div>
        </div>

        {/* 1. BANK ACCOUNTS CARDS CAROUSEL / GRID */}
        {loadingAccounts ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-24 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="w-12 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
                <div className="w-32 h-6 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="w-20 h-3 bg-zinc-100 dark:bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          /* Empty state for accounts */
          <div className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center bg-white dark:bg-zinc-900/60 max-w-xl mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center mx-auto shadow-2xs">
              <Landmark className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              No tienes cuentas bancarias registradas
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Registra tu primera cuenta corriente, de ahorros, tarjeta corporativa o caja menor para comenzar a importar extractos y conciliar transacciones.
            </p>
            {canManageBankAccounts ? (
              <button
                type="button"
                onClick={() => setIsAddAccountOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Cuenta Bancaria</span>
              </button>
            ) : (
              <span className="text-[11px] text-zinc-400">
                Pide a un Administrador que configure las cuentas bancarias de la empresa.
              </span>
            )}
          </div>
        ) : (
          /* Horizontal Account Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              const Icon =
                acc.account_type === 'CREDIT_CARD'
                  ? CreditCard
                  : acc.account_type === 'SAVINGS'
                  ? PiggyBank
                  : Landmark;

              return (
                <button
                  type="button"
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between relative overflow-hidden group ${
                    isSelected
                      ? 'border-zinc-900 dark:border-zinc-100 bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-900 dark:ring-zinc-100'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-2xs'
                  }`}
                >
                  {/* Subtle top indicator bar when selected */}
                  {isSelected && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-900 dark:bg-zinc-100" />
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {acc.institution_name}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0">
                        {acc.currency}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                      <span className="truncate">{acc.account_name}</span>
                      {acc.last_four && (
                        <span className="font-mono text-zinc-400 text-[11px] shrink-0">
                          •••• {acc.last_four}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-baseline justify-between">
                    <span className="text-[10px] text-zinc-400 font-medium">Saldo Actual</span>
                    <span className="font-mono font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(acc.current_balance, acc.currency)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 2. TRANSACTIONS SECTION FOR SELECTED ACCOUNT */}
        {selectedAccount && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
            {/* Account Detail Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/40 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      {selectedAccount.institution_name} — {selectedAccount.account_name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {getBankAccountTypeLabel(selectedAccount.account_type)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                    {selectedAccount.last_four && (
                      <span>Cuenta N° •••• {selectedAccount.last_four}</span>
                    )}
                    <span>•</span>
                    <span>
                      Saldo en libros:{' '}
                      <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(selectedAccount.current_balance, selectedAccount.currency)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick CSV upload action button */}
              <button
                type="button"
                onClick={() => setIsImportCsvOpen(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Subir Extracto Bancario</span>
              </button>
            </div>

            {/* Reconciliation Tabs */}
            <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 bg-zinc-50/20 dark:bg-zinc-900/50 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('UNMATCHED')}
                className={`py-3 text-xs font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap mr-6 ${
                  activeTab === 'UNMATCHED'
                    ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Por Revisar</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    tabCounts.unmatched > 0
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                  }`}
                >
                  {tabCounts.unmatched}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('MATCHED')}
                className={`py-3 text-xs font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap mr-6 ${
                  activeTab === 'MATCHED'
                    ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Conciliadas</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
                  {tabCounts.matched}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('EXCLUDED')}
                className={`py-3 text-xs font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'EXCLUDED'
                    ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Excluidas</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
                  {tabCounts.excluded}
                </span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-3.5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar movimiento, factura o proveedor..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[11px] text-zinc-400 flex items-center gap-1 mr-1">
                  <Filter className="w-3 h-3" />
                  Flujo:
                </span>
                <button
                  type="button"
                  onClick={() => setFlowFilter('ALL')}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                    flowFilter === 'ALL'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFlowFilter('INCOME')}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors flex items-center gap-1 ${
                    flowFilter === 'INCOME'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  <ArrowDownLeft className="w-3 h-3" />
                  Ingresos (+)
                </button>
                <button
                  type="button"
                  onClick={() => setFlowFilter('EXPENSE')}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors flex items-center gap-1 ${
                    flowFilter === 'EXPENSE'
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  <ArrowUpRight className="w-3 h-3" />
                  Egresos (-)
                </button>
              </div>
            </div>

            {/* Transactions Table */}
            {loadingTransactions ? (
              <div className="py-16 flex flex-col items-center justify-center text-zinc-400 text-xs gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-600 dark:text-zinc-400" />
                <span>Cargando movimientos de la cuenta...</span>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-16 text-center p-6 space-y-2">
                {activeTab === 'UNMATCHED' ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      ¡Todo al día! No hay transacciones pendientes
                    </p>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Todos los movimientos de esta cuenta están conciliados o excluidos. Puedes importar un nuevo extracto CSV en cualquier momento.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setIsImportCsvOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Importar nuevo extracto CSV</span>
                      </button>
                    </div>
                  </>
                ) : activeTab === 'MATCHED' ? (
                  <>
                    <Receipt className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Aún no hay transacciones conciliadas en esta cuenta
                    </p>
                    <p className="text-xs text-zinc-400">
                      Revisa la pestaña &quot;Por Revisar&quot; para vincular depósitos con facturas o egresos con gastos.
                    </p>
                  </>
                ) : (
                  <>
                    <Ban className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      No hay transacciones excluidas
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
                      <th className="py-2.5 px-4">Fecha</th>
                      <th className="py-2.5 px-4">Descripción Bancaria</th>
                      <th className="py-2.5 px-4 text-right">Monto</th>
                      <th className="py-2.5 px-4">Estado / Vinculación</th>
                      <th className="py-2.5 px-4 text-right">Acciones de Conciliación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredTransactions.map((tx) => {
                      const { text, isPositive } = formatSignedCurrency(
                        tx.amount,
                        selectedAccount.currency
                      );
                      const statusBadge = getBankTransactionStatusBadge(tx.status);

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          {/* 1. Fecha */}
                          <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                            {formatDate(tx.transaction_date)}
                          </td>

                          {/* 2. Descripción */}
                          <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100 max-w-xs sm:max-w-md">
                            <div className="truncate" title={tx.description}>
                              {tx.description}
                            </div>
                          </td>

                          {/* 3. Monto Formateado */}
                          <td className="py-3 px-4 text-right font-mono font-medium whitespace-nowrap">
                            <span
                              className={
                                isPositive
                                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                                  : 'text-zinc-800 dark:text-zinc-200'
                              }
                            >
                              {text}
                            </span>
                          </td>

                          {/* 4. Estado / Detalle de Vinculación */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {tx.status === 'UNMATCHED' ? (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge.bg}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                                {statusBadge.label}
                              </span>
                            ) : tx.status === 'MATCHED' ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge.bg}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                                  {statusBadge.label}
                                </span>

                                {/* Invoice detail badge */}
                                {tx.matched_invoice && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                                    <Receipt className="w-3 h-3" />
                                    Factura {tx.matched_invoice.invoice_number}
                                  </span>
                                )}

                                {/* Expense detail badge */}
                                {tx.matched_expense && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                    <Wallet className="w-3 h-3" />
                                    {tx.matched_expense.vendor_name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge.bg}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                                {statusBadge.label}
                              </span>
                            )}
                          </td>

                          {/* 5. Acciones Rápidas */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {tx.status === 'UNMATCHED' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {isPositive ? (
                                  /* Depósito (+) -> Vincular Factura */
                                  <button
                                    type="button"
                                    onClick={() => setMatchingTxForInvoice(tx)}
                                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center gap-1 shadow-2xs transition-colors"
                                  >
                                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Vincular Factura</span>
                                  </button>
                                ) : (
                                  /* Egreso (-) -> Vincular o Crear Gasto */
                                  <button
                                    type="button"
                                    onClick={() => setMatchingTxForExpense(tx)}
                                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 flex items-center gap-1 shadow-2xs transition-colors"
                                  >
                                    <Wallet className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                                    <span>Vincular / Crear Gasto</span>
                                  </button>
                                )}

                                {/* Exclude action */}
                                <button
                                  type="button"
                                  onClick={() => handleExcludeTransaction(tx)}
                                  title="Marcar como movimiento excluido"
                                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              /* MATCHED o EXCLUDED -> Permitir Deshacer */
                              <button
                                type="button"
                                onClick={() => handleRevertTransaction(tx)}
                                className="px-2 py-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors inline-flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Deshacer</span>
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
        )}

        {/* MODALS */}
        <CreateBankAccountModal
          isOpen={isAddAccountOpen}
          onClose={() => setIsAddAccountOpen(false)}
          onAccountCreated={handleAccountCreated}
        />

        <ImportBankCsvModal
          isOpen={isImportCsvOpen}
          onClose={() => setIsImportCsvOpen(false)}
          account={selectedAccount}
          onImportComplete={handleImportComplete}
        />

        <MatchInvoiceModal
          isOpen={Boolean(matchingTxForInvoice)}
          onClose={() => setMatchingTxForInvoice(null)}
          transaction={matchingTxForInvoice}
          currency={selectedAccount?.currency || 'COP'}
          onMatched={handleInvoiceMatched}
        />

        <MatchExpenseModal
          isOpen={Boolean(matchingTxForExpense)}
          onClose={() => setMatchingTxForExpense(null)}
          transaction={matchingTxForExpense}
          currency={selectedAccount?.currency || 'COP'}
          onMatched={handleExpenseMatched}
        />
      </main>
    </div>
  );
}
