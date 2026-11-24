'use client';

import React, { useState, useId } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { BankAccount, BankTransaction } from '@/types/database';
import { formatCurrency, formatSignedCurrency } from '@/lib/utils';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  FileText,
  DollarSign,
  Info,
} from 'lucide-react';

interface ImportBankCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: BankAccount | null;
  onImportComplete: (importedCount: number, netChange: number) => void;
}

interface ParsedTransactionRow {
  transaction_date: string;
  description: string;
  amount: number;
  originalRow: Record<string, string>;
}

export function ImportBankCsvModal({
  isOpen,
  onClose,
  account,
  onImportComplete,
}: ImportBankCsvModalProps) {
  const { activeCompany } = useAuth();
  const supabase = createClient();
  const fileInputId = useId();

  const [step, setStep] = useState<'UPLOAD' | 'MAP' | 'PREVIEW'>('UPLOAD');
  const [fileName, setFileName] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);

  // Column mapping states
  const [dateCol, setDateCol] = useState<string>('');
  const [descCol, setDescCol] = useState<string>('');
  const [amountMode, setAmountMode] = useState<'SINGLE' | 'DEBIT_CREDIT'>('SINGLE');
  const [singleAmountCol, setSingleAmountCol] = useState<string>('');
  const [debitCol, setDebitCol] = useState<string>('');
  const [creditCol, setCreditCol] = useState<string>('');

  // Loading & error
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !account) return null;

  // Simple and robust CSV line splitter taking quotes into account
  const parseCsvText = (text: string) => {
    // Determine delimiter: semicolon or comma
    const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
    const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(cur.trim().replace(/^"|"$/g, ''));
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const lines = text
      .split(/\r\n|\n|\r/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error('El archivo CSV debe tener al menos una fila de encabezados y una fila de datos.');
    }

    const headers = parseLine(lines[0]);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === headers.length || values.some((v) => v.length > 0)) {
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        rows.push(rowObj);
      }
    }

    return { headers, rows };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { headers, rows } = parseCsvText(text);

        if (rows.length === 0) {
          throw new Error('No se encontraron transacciones válidas en el archivo CSV.');
        }

        setCsvHeaders(headers);
        setRawRows(rows);

        // Auto-guess columns
        const guessedDate = headers.find((h) => /fecha|date/i.test(h)) || headers[0] || '';
        const guessedDesc =
          headers.find((h) => /descrip|concepto|detalle|narrative|memo|reference/i.test(h)) ||
          headers[1] ||
          '';

        const guessedDebit = headers.find((h) => /debito|debit|cargo|salida|egreso/i.test(h));
        const guessedCredit = headers.find((h) => /credito|credit|abono|entrada|ingreso/i.test(h));
        const guessedAmount = headers.find((h) => /monto|amount|valor|importe|saldo/i.test(h));

        setDateCol(guessedDate);
        setDescCol(guessedDesc);

        if (guessedDebit && guessedCredit) {
          setAmountMode('DEBIT_CREDIT');
          setDebitCol(guessedDebit);
          setCreditCol(guessedCredit);
        } else {
          setAmountMode('SINGLE');
          setSingleAmountCol(guessedAmount || headers[headers.length - 1] || '');
        }

        setStep('MAP');
      } catch (err: unknown) {
        console.error('CSV parse error:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Error al procesar el archivo CSV.');
      }
    };
    reader.readAsText(file);
  };

  // Helper to parse numbers like "$ 1.250.000,50", "-350.25", "(100.00)"
  const parseNumericAmount = (str: string | undefined): number => {
    if (!str) return 0;
    let s = str.trim();
    // Negative in parenthesis: (100.00) -> -100.00
    const isParenNegative = /^\(.*\)$/.test(s);
    s = s.replace(/[$€COPUSD\s]/gi, '').replace(/[()]/g, '');

    // Check if format uses dot as thousand and comma as decimal (1.250,50)
    if (/\d+\.\d{3},\d+/.test(s) || (s.includes(',') && !s.includes('.'))) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // standard US (1,250.50)
      s = s.replace(/,/g, '');
    }

    const num = parseFloat(s);
    if (isNaN(num)) return 0;
    return isParenNegative ? -Math.abs(num) : num;
  };

  // Format ISO date (YYYY-MM-DD) from common date formats
  const normalizeDate = (val: string): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    const clean = val.trim();

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
      const d = dmy[1].padStart(2, '0');
      const m = dmy[2].padStart(2, '0');
      const y = dmy[3];
      return `${y}-${m}-${d}`;
    }

    // MM/DD/YYYY (US style)
    const mdy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (mdy && account.currency === 'USD') {
      const m = mdy[1].padStart(2, '0');
      const d = mdy[2].padStart(2, '0');
      const y = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
      return `${y}-${m}-${d}`;
    }

    try {
      const parsed = new Date(clean);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    } catch {
      // fallback
    }

    return new Date().toISOString().split('T')[0];
  };

  // Parsed rows
  const parsedRows: ParsedTransactionRow[] = React.useMemo(() => {
    if (!dateCol || !descCol) return [];

    return rawRows.map((row) => {
      const dateStr = normalizeDate(row[dateCol]);
      const description = (row[descCol] || 'Transacción bancaria').trim();

      let amount = 0;
      if (amountMode === 'SINGLE') {
        amount = parseNumericAmount(row[singleAmountCol]);
      } else {
        const debit = parseNumericAmount(row[debitCol]);
        const credit = parseNumericAmount(row[creditCol]);
        // Debit is withdrawal (-), credit is deposit (+)
        amount = credit > 0 ? credit : -Math.abs(debit);
      }

      return {
        transaction_date: dateStr,
        description,
        amount,
        originalRow: row,
      };
    });
  }, [rawRows, dateCol, descCol, amountMode, singleAmountCol, debitCol, creditCol]);

  // Statistics calculation
  const stats = React.useMemo(() => {
    let deposits = 0;
    let withdrawals = 0;
    let net = 0;

    parsedRows.forEach((r) => {
      net += r.amount;
      if (r.amount > 0) {
        deposits += r.amount;
      } else {
        withdrawals += Math.abs(r.amount);
      }
    });

    const newEstimatedBalance = account.current_balance + net;

    return {
      totalCount: parsedRows.length,
      deposits,
      withdrawals,
      net,
      newEstimatedBalance,
    };
  }, [parsedRows, account.current_balance]);

  const handleConfirmImport = async () => {
    if (!activeCompany || !account) return;
    if (parsedRows.length === 0) {
      setErrorMsg('No hay filas para importar.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const transactionsPayload = parsedRows.map((r) => ({
        company_id: activeCompany.id,
        bank_account_id: account.id,
        transaction_date: r.transaction_date,
        description: r.description,
        amount: r.amount,
        status: 'UNMATCHED',
      }));

      // Insert bank transactions in batch
      const { error: insertErr } = await supabase
        .from('bank_transactions')
        .insert(transactionsPayload);

      if (insertErr) throw insertErr;

      // Update bank account current balance
      const { error: updateAccErr } = await supabase
        .from('bank_accounts')
        .update({
          current_balance: stats.newEstimatedBalance,
        })
        .eq('id', account.id);

      if (updateAccErr) throw updateAccErr;

      onImportComplete(parsedRows.length, stats.net);
      onClose();
    } catch (err: unknown) {
      console.error('Error importing bank transactions:', err);
      const message =
        err instanceof Error ? err.message : 'Error al importar los movimientos bancarios.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Importar Extracto Bancario (CSV)
                </h2>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                  {account.institution_name} {account.last_four ? `•••• ${account.last_four}` : ''}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Sube tu extracto de banco para conciliar automáticamente depósitos y egresos
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'UPLOAD' && (
            <div className="space-y-4">
              <label
                htmlFor={fileInputId}
                className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-zinc-50/50 dark:bg-zinc-900/50 group"
              >
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 shadow-xs border border-zinc-200/80 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 group-hover:scale-105 transition-transform mb-3">
                  <UploadCloud className="w-6 h-6 text-zinc-800 dark:text-zinc-200" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Selecciona tu archivo de extracto bancario
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mb-3">
                  Formatos compatibles: .CSV estándar exportado desde Bancolombia, Davivienda, Chase, Mercury o tu portal bancario.
                </p>
                <span className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs">
                  Explorar Archivos
                </span>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 p-3.5 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-300">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <span className="font-semibold">Mapeo Inteligente de Columnas:</span> En el siguiente paso podrás confirmar qué columna corresponde a la Fecha, Concepto y Monto (o Débito/Crédito) antes de guardar en tu contabilidad.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: MAP & PREVIEW */}
          {(step === 'MAP' || step === 'PREVIEW') && (
            <div className="space-y-5">
              {/* File Info Bar */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800 text-xs">
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                  <FileSpreadsheet className="w-4 h-4 text-zinc-500" />
                  <span className="font-medium truncate max-w-xs">{fileName}</span>
                  <span className="text-zinc-400">•</span>
                  <span className="text-zinc-500">{rawRows.length} filas detectadas</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('UPLOAD');
                    setRawRows([]);
                    setCsvHeaders([]);
                  }}
                  className="text-xs text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Column Mapping Selectors */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3.5">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                  <span>Mapeo de Columnas</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Fecha */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Columna de Fecha</span>
                    </label>
                    <select
                      value={dateCol}
                      onChange={(e) => setDateCol(e.target.value)}
                      className="w-full text-xs py-2 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 font-medium"
                    >
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Descripción */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Columna de Descripción / Concepto</span>
                    </label>
                    <select
                      value={descCol}
                      onChange={(e) => setDescCol(e.target.value)}
                      className="w-full text-xs py-2 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 font-medium"
                    >
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Amount Mode Toggle */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Estructura de Montos</span>
                    </label>
                    <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-800">
                      <button
                        type="button"
                        onClick={() => setAmountMode('SINGLE')}
                        className={`px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                          amountMode === 'SINGLE'
                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                      >
                        Monto Único (+/-)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmountMode('DEBIT_CREDIT')}
                        className={`px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                          amountMode === 'DEBIT_CREDIT'
                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                      >
                        Débito / Crédito Separados
                      </button>
                    </div>
                  </div>

                  {amountMode === 'SINGLE' ? (
                    <div>
                      <select
                        value={singleAmountCol}
                        onChange={(e) => setSingleAmountCol(e.target.value)}
                        className="w-full text-xs py-2 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 font-medium"
                      >
                        {csvHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[11px] text-zinc-500 mb-1">
                          Columna Débitos (Salidas / Retiros)
                        </span>
                        <select
                          value={debitCol}
                          onChange={(e) => setDebitCol(e.target.value)}
                          className="w-full text-xs py-2 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 font-medium"
                        >
                          {csvHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="block text-[11px] text-zinc-500 mb-1">
                          Columna Créditos (Entradas / Depósitos)
                        </span>
                        <select
                          value={creditCol}
                          onChange={(e) => setCreditCol(e.target.value)}
                          className="w-full text-xs py-2 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 font-medium"
                        >
                          {csvHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40">
                  <div className="text-[10px] uppercase font-semibold text-zinc-500 mb-1">
                    Transacciones
                  </div>
                  <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {stats.totalCount}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <div className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                    Depósitos (+)
                  </div>
                  <div className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400 truncate">
                    +{formatCurrency(stats.deposits, account.currency)}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40">
                  <div className="text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Egresos (-)
                  </div>
                  <div className="text-sm font-bold font-mono text-zinc-800 dark:text-zinc-200 truncate">
                    -{formatCurrency(stats.withdrawals, account.currency)}
                  </div>
                </div>
              </div>

              {/* Data Preview Table */}
              <div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center justify-between">
                  <span>Vista Previa de Filas (Primeras 5 transacciones)</span>
                  <span className="text-[11px] font-normal text-zinc-500">
                    Muestra cómo se registrarán en Kounta
                  </span>
                </div>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium text-left">
                        <th className="py-2 px-3">Fecha</th>
                        <th className="py-2 px-3">Descripción</th>
                        <th className="py-2 px-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                      {parsedRows.slice(0, 5).map((row, idx) => {
                        const { text, isPositive } = formatSignedCurrency(
                          row.amount,
                          account.currency
                        );
                        return (
                          <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                            <td className="py-2 px-3 font-mono text-zinc-700 dark:text-zinc-300">
                              {row.transaction_date}
                            </td>
                            <td className="py-2 px-3 text-zinc-900 dark:text-zinc-100 font-medium max-w-xs truncate">
                              {row.description}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-mono font-medium ${
                                isPositive
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-zinc-800 dark:text-zinc-200'
                              }`}
                            >
                              {text}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Balance Impact Note */}
                <div className="mt-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 flex items-center justify-between text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Impacto en saldo actual ({formatCurrency(account.current_balance, account.currency)}):
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 font-mono">
                      {stats.net >= 0 ? '+' : ''}
                      {formatCurrency(stats.net, account.currency)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(stats.newEstimatedBalance, account.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          {step === 'UPLOAD' ? (
            <label
              htmlFor={fileInputId}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white rounded-lg flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
            >
              Cargar Archivo CSV
            </label>
          ) : (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={loading || parsedRows.length === 0}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white rounded-lg flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Importando {parsedRows.length} movimientos...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar e Importar ({parsedRows.length})
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
