'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { BankAccount, BankAccountType } from '@/types/database';
import { BANK_ACCOUNT_TYPE_OPTIONS } from '@/lib/utils';
import {
  X,
  Landmark,
  Building2,
  Coins,
  CreditCard,
  Hash,
  Loader2,
  AlertCircle,
  PiggyBank,
  Wallet,
} from 'lucide-react';

interface CreateBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (account: BankAccount) => void;
}

const COMMON_BANKS_CO = [
  'Bancolombia',
  'Davivienda',
  'Banco de Bogotá',
  'BBVA Colombia',
  'Banco de Occidente',
  'Scotiabank Colpatria',
  'Nu Colombia',
  'Lulo Bank',
];

const COMMON_BANKS_US = [
  'Chase',
  'Bank of America',
  'Wells Fargo',
  'Citibank',
  'Mercury',
  'Brex',
  'Capital One',
  'SVB',
];

export function CreateBankAccountModal({
  isOpen,
  onClose,
  onAccountCreated,
}: CreateBankAccountModalProps) {
  const { activeCompany } = useAuth();
  const supabase = createClient();

  const isColombia = activeCompany?.country !== 'US';
  const defaultCurrency = activeCompany?.base_currency || (isColombia ? 'COP' : 'USD');

  const [institutionName, setInstitutionName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<BankAccountType>('CHECKING');
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [currentBalance, setCurrentBalance] = useState<string>('0');
  const [lastFour, setLastFour] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setInstitutionName('');
    setAccountName('');
    setAccountType('CHECKING');
    setCurrency(defaultCurrency);
    setCurrentBalance('0');
    setLastFour('');
  }, [isOpen, defaultCurrency]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;

    if (!institutionName.trim()) {
      setErrorMsg('Ingresa la entidad financiera o banco.');
      return;
    }
    if (!accountName.trim()) {
      setErrorMsg('Ingresa el nombre o alias de la cuenta.');
      return;
    }

    const cleanBalance = parseFloat(currentBalance.replace(/,/g, ''));
    if (isNaN(cleanBalance)) {
      setErrorMsg('Ingresa un saldo inicial válido.');
      return;
    }

    if (lastFour && (lastFour.length !== 4 || !/^\d{4}$/.test(lastFour))) {
      setErrorMsg('Los últimos dígitos deben ser exactamente 4 números.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        company_id: activeCompany.id,
        institution_name: institutionName.trim(),
        account_name: accountName.trim(),
        account_type: accountType,
        currency: currency.toUpperCase(),
        current_balance: cleanBalance,
        last_four: lastFour.trim() ? lastFour.trim() : null,
      };

      const { data, error } = await supabase
        .from('bank_accounts')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;

      onAccountCreated(data as BankAccount);
      onClose();
    } catch (err: unknown) {
      console.error('Error creating bank account:', err);
      const message = err instanceof Error ? err.message : 'Error al registrar la cuenta bancaria.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const commonBanks = isColombia ? COMMON_BANKS_CO : COMMON_BANKS_US;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Agregar Cuenta Bancaria
              </h2>
              <p className="text-xs text-zinc-500">
                Registra una cuenta bancaria, tarjeta corporativa o caja para conciliar movimientos
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tipo de Cuenta */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Tipo de Cuenta
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BANK_ACCOUNT_TYPE_OPTIONS.map((opt) => {
                const isSelected = accountType === opt.value;
                const Icon =
                  opt.value === 'CREDIT_CARD'
                    ? CreditCard
                    : opt.value === 'SAVINGS'
                    ? PiggyBank
                    : opt.value === 'CASH'
                    ? Wallet
                    : Landmark;

                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setAccountType(opt.value)}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                      isSelected
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isSelected
                          ? 'text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-zinc-500 leading-tight truncate">
                        {opt.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Entidad Financiera */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Entidad Financiera / Banco <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder={isColombia ? 'ej. Bancolombia, Davivienda' : 'ej. Chase, Mercury, Brex'}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {commonBanks.slice(0, 5).map((bank) => (
                <button
                  type="button"
                  key={bank}
                  onClick={() => setInstitutionName(bank)}
                  className="px-2 py-0.5 text-[11px] rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {bank}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre / Alias de la Cuenta */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Nombre o Alias de la Cuenta <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="ej. Cuenta Operativa Principal, Nómina, Tarjeta Visa"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          {/* Moneda y Últimos 4 Dígitos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Moneda
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Coins className="w-4 h-4" />
                </div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  <option value="COP">COP (Pesos Colombianos)</option>
                  <option value="USD">USD (Dólares Americanos)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Últimos 4 Dígitos <span className="text-zinc-400 text-[10px]">(Opcional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Hash className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  maxLength={4}
                  value={lastFour}
                  onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ''))}
                  placeholder="ej. 4821"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Saldo Inicial / Actual */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Saldo Inicial / Actual <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 font-mono text-sm">
                {currency === 'COP' ? '$' : '$'}
              </span>
              <input
                type="number"
                step="any"
                required
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Saldo actual en libros o extracto. Las transacciones importadas o conciliadas ajustarán este saldo.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white rounded-lg flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar Cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
