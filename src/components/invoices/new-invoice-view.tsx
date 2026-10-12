'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Customer, InvoiceStatus, TaxBreakdown } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Receipt,
  UserPlus,
  Calendar,
  Coins,
  FileText,
  Send,
  Save,
  Loader2,
  AlertCircle,
  Building2,
  CheckCircle2,
  Percent
} from 'lucide-react';
import { CreateCustomerModal } from '@/components/modals/create-customer-modal';
import { Toast, ToastMessage } from '@/components/ui/toast';

interface LineItemForm {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

export function NewInvoiceView() {
  const { activeCompany, user } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const isColombia = activeCompany?.country !== 'US';
  const defaultTaxRate = isColombia ? 19 : 0;

  // Customers state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // General Invoice Data
  const [invoiceNumber, setInvoiceNumber] = useState('INV-0001');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueTerms, setDueTerms] = useState<15 | 30 | 'custom'>(30);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [currency, setCurrency] = useState<'COP' | 'USD'>(
    activeCompany?.base_currency || 'COP'
  );
  const [exchangeRateToBase, setExchangeRateToBase] = useState<number>(1);

  // Dynamic Line Items
  const [items, setItems] = useState<LineItemForm[]>([
    {
      id: 'item-1',
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: defaultTaxRate,
    },
  ]);

  // Country-Specific Tax & Retention Controls
  // Colombia (CO): Retefuente & ReteICA
  const [retefuenteEnabled, setRetefuenteEnabled] = useState(false);
  const [retefuenteRate, setRetefuenteRate] = useState<number>(2.5);
  const [reteicaEnabled, setReteicaEnabled] = useState(false);
  const [reteicaRate, setReteicaRate] = useState<number>(0.966);

  // USA (US): Sales Tax (%)
  const [usSalesTaxRate, setUsSalesTaxRate] = useState<number>(0);

  // Submission states
  const [savingStatus, setSavingStatus] = useState<InvoiceStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Sync currency and default tax rate when activeCompany loads
  useEffect(() => {
    if (!activeCompany) return;
    setCurrency(activeCompany.base_currency || 'COP');
    const initialRate = activeCompany.country === 'US' ? 0 : 19;
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === 0 && it.unit_price === 0 && !it.description
          ? { ...it, tax_rate: initialRate }
          : it
      )
    );
  }, [activeCompany]);

  // Fetch customers and compute automatic correlative number (e.g. INV-0001)
  useEffect(() => {
    if (!activeCompany) return;

    let mounted = true;
    async function initFormData() {
      setLoadingInitial(true);
      try {
        // 1. Load customers
        const { data: custData } = await supabase
          .from('customers')
          .select('id, company_id, name, tax_id, email, billing_address, created_at')
          .eq('company_id', activeCompany!.id)
          .order('name', { ascending: true });

        if (mounted && custData) {
          setCustomers(custData as Customer[]);
          if (custData.length > 0) {
            setSelectedCustomerId(custData[0].id);
          }
        }

        // 2. Calculate next correlative invoice number (INV-0001, INV-0002, ...)
        const { data: invData } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('company_id', activeCompany!.id);

        if (mounted) {
          let maxNumber = 0;
          if (invData && invData.length > 0) {
            invData.forEach((row: any) => {
              const match = String(row.invoice_number || '').match(/(\d+)$/);
              if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num) && num > maxNumber) {
                  maxNumber = num;
                }
              }
            });
            if (maxNumber === 0) {
              maxNumber = invData.length;
            }
          }
          const nextCorrelative = String(maxNumber + 1).padStart(4, '0');
          setInvoiceNumber(`INV-${nextCorrelative}`);
        }
      } catch (err) {
        console.error('Error initializing new invoice form:', err);
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    }

    initFormData();
    return () => {
      mounted = false;
    };
  }, [activeCompany, supabase]);

  // Update dueDate when issueDate or dueTerms changes
  const handleIssueDateChange = (newIssueDate: string) => {
    setIssueDate(newIssueDate);
    if (dueTerms !== 'custom' && newIssueDate) {
      const d = new Date(newIssueDate + 'T00:00:00');
      d.setDate(d.getDate() + dueTerms);
      setDueDate(d.toISOString().split('T')[0]);
    }
  };

  const handleTermsSelect = (days: 15 | 30) => {
    setDueTerms(days);
    if (issueDate) {
      const d = new Date(issueDate + 'T00:00:00');
      d.setDate(d.getDate() + days);
      setDueDate(d.toISOString().split('T')[0]);
    }
  };

  // Line Item Handlers
  const handleAddLine = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: isColombia ? 19 : usSalesTaxRate,
      },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleItemChange = (
    id: string,
    field: keyof Omit<LineItemForm, 'id'>,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // For US companies: when user adjusts global Sales Tax %, sync to lines
  const handleUsSalesTaxChange = (newRate: number) => {
    const safeRate = Math.max(0, Math.min(100, newRate));
    setUsSalesTaxRate(safeRate);
    setItems((prev) => prev.map((item) => ({ ...item, tax_rate: safeRate })));
  };

  // Real-time Mathematical & Fiscal Calculations
  const subtotal = items.reduce((acc, item) => {
    const lineAmount = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
    return acc + lineAmount;
  }, 0);

  const lineTaxesTotal = items.reduce((acc, item) => {
    const lineAmount = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
    const rate = Number(item.tax_rate) || 0;
    return acc + lineAmount * (rate / 100);
  }, 0);

  // Colombia (CO) specific calculations
  const ivaTotal = isColombia ? lineTaxesTotal : 0;
  const retefuenteAmount =
    isColombia && retefuenteEnabled ? subtotal * ((Number(retefuenteRate) || 0) / 100) : 0;
  const reteicaAmount =
    isColombia && reteicaEnabled ? subtotal * ((Number(reteicaRate) || 0) / 100) : 0;
  const totalRetentions = retefuenteAmount + reteicaAmount;

  // US specific calculations
  const salesTaxAmount = !isColombia ? lineTaxesTotal : 0;

  // Consolidated tax_total & grandTotal
  const taxTotal = isColombia ? ivaTotal : salesTaxAmount;
  const grandTotal = Math.max(0, subtotal + taxTotal - totalRetentions);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  // Save / Issue Handler
  const handleSaveInvoice = async (targetStatus: 'DRAFT' | 'ISSUED') => {
    setErrorMessage(null);

    if (!activeCompany || !user) {
      setErrorMessage('Tu sesión o empresa activa no está disponible.');
      return;
    }

    if (!selectedCustomerId) {
      setErrorMessage('Por favor selecciona un cliente para la factura.');
      return;
    }

    if (!invoiceNumber.trim()) {
      setErrorMessage('El número de factura es obligatorio.');
      return;
    }

    const invalidLine = items.some(
      (it) => !it.description.trim() || Number(it.quantity) <= 0 || Number(it.unit_price) < 0
    );
    if (invalidLine) {
      setErrorMessage(
        'Verifica que todas las líneas tengan descripción y una cantidad mayor a cero.'
      );
      return;
    }

    setSavingStatus(targetStatus);

    try {
      // Build tax_breakdown JSONB payload
      const taxBreakdownPayload: TaxBreakdown = isColombia
        ? {
            country: 'CO',
            iva_total: Number(ivaTotal.toFixed(2)),
            retefuente_enabled: retefuenteEnabled,
            retefuente_rate: retefuenteEnabled ? Number(retefuenteRate) : 0,
            retefuente_amount: Number(retefuenteAmount.toFixed(2)),
            reteica_enabled: reteicaEnabled,
            reteica_rate: reteicaEnabled ? Number(reteicaRate) : 0,
            reteica_amount: Number(reteicaAmount.toFixed(2)),
            total_retentions: Number(totalRetentions.toFixed(2)),
          }
        : {
            country: 'US',
            sales_tax_rate: Number(usSalesTaxRate),
            sales_tax_amount: Number(salesTaxAmount.toFixed(2)),
            line_taxes_total: Number(lineTaxesTotal.toFixed(2)),
          };

      // 1. Insert into invoices and get id
      const { data: createdInvoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          company_id: activeCompany.id,
          customer_id: selectedCustomerId,
          invoice_number: invoiceNumber.trim(),
          issue_date: issueDate,
          due_date: dueDate,
          status: targetStatus,
          currency,
          exchange_rate_to_base: Number(exchangeRateToBase) || 1,
          subtotal: Number(subtotal.toFixed(2)),
          tax_total: Number(taxTotal.toFixed(2)),
          total: Number(grandTotal.toFixed(2)),
          tax_breakdown: taxBreakdownPayload,
          created_by: user.id,
        })
        .select('id, invoice_number')
        .single();

      if (invError) throw invError;
      if (!createdInvoice) throw new Error('No se pudo obtener el ID de la factura creada.');

      // 2. Insert all lines into invoice_items associated to invoice_id and active company_id
      const itemsPayload = items.map((it) => {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.unit_price) || 0;
        const amount = Number((qty * price).toFixed(2));
        return {
          invoice_id: createdInvoice.id,
          company_id: activeCompany.id,
          description: it.description.trim(),
          quantity: qty,
          unit_price: price,
          tax_rate: Number(it.tax_rate) || 0,
          amount,
        };
      });

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsPayload);

      if (itemsError) throw itemsError;

      // 3. Redirect to /invoices with confirmation toast parameter
      const createdParam = targetStatus === 'ISSUED' ? 'issued' : 'draft';
      router.push(
        `/invoices?created=${createdParam}&number=${encodeURIComponent(
          createdInvoice.invoice_number
        )}`
      );
    } catch (err: any) {
      console.error('Error saving invoice:', err);
      setErrorMessage(err.message || 'Ocurrió un error al guardar la factura.');
      setSavingStatus(null);
    }
  };

  return (
    <>
      {/* Top Action Header */}
      <header className="h-16 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            title="Volver a Facturas"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-zinc-900">
                Nueva Factura de Venta
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-numbers font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                {invoiceNumber}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              {isColombia
                ? `🇨🇴 Emisión bajo estándar fiscal Colombia (${activeCompany?.legal_name})`
                : `🇺🇸 US Commercial Invoice (${activeCompany?.legal_name})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={Boolean(savingStatus)}
            onClick={() => handleSaveInvoice('DRAFT')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200/90 text-xs font-medium shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            {savingStatus === 'DRAFT' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600" />
            ) : (
              <Save className="w-3.5 h-3.5 text-zinc-600" />
            )}
            <span>Guardar Borrador</span>
          </button>

          <button
            type="button"
            disabled={Boolean(savingStatus)}
            onClick={() => handleSaveInvoice('ISSUED')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium tracking-tight shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {savingStatus === 'ISSUED' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Emitir Factura</span>
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl w-full mx-auto space-y-6 pb-16">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Professional Invoice Document Container */}
        <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
          {/* Document Top Banner: Emitter Identity & Invoice Correlative */}
          <div className="p-6 sm:p-8 border-b border-zinc-100 bg-zinc-50/40 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <Building2 className="w-3.5 h-3.5" />
                <span>Emisor</span>
              </div>
              <h2 className="text-lg font-semibold text-zinc-900">
                {activeCompany?.legal_name || activeCompany?.name}
              </h2>
              <p className="text-xs text-zinc-500 font-mono-numbers">
                {isColombia ? 'NIT:' : 'EIN:'} {activeCompany?.tax_id} · Moneda base{' '}
                {activeCompany?.base_currency}
              </p>
            </div>

            <div className="sm:text-right space-y-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Número de Factura
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full sm:w-44 px-3 py-1.5 text-sm font-mono-numbers font-semibold sm:text-right bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
              />
              <p className="text-[10px] text-zinc-400">Correlativo automático asignado</p>
            </div>
          </div>

          {/* 1. Datos Generales: Cliente, Fechas y Moneda */}
          <div className="p-6 sm:p-8 border-b border-zinc-100 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Customer Selector (6 cols) */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-800">
                  Cliente Receptor <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo cliente</span>
                </button>
              </div>

              {loadingInitial ? (
                <div className="h-10 bg-zinc-100 animate-pulse rounded-lg" />
              ) : customers.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="w-full py-3 px-4 rounded-xl border border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>No hay clientes aún. Haz clic para crear el primero</span>
                </button>
              ) : (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-zinc-50/70 border border-zinc-200 rounded-xl text-zinc-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 cursor-pointer"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.tax_id ? `(${c.tax_id})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {/* Selected Customer Preview Card */}
              {selectedCustomer && (
                <div className="p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/70 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900">
                      {selectedCustomer.name}
                    </span>
                    <span className="font-mono-numbers text-[11px] text-zinc-600 bg-white px-2 py-0.5 rounded border border-zinc-200/70">
                      {isColombia ? 'NIT:' : 'Tax ID:'}{' '}
                      {selectedCustomer.tax_id || 'N/A'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {selectedCustomer.email || 'Sin correo de facturación'}
                  </div>
                  {selectedCustomer.billing_address && (
                    <div className="text-[11px] text-zinc-500 truncate">
                      {selectedCustomer.billing_address}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dates & Currency (6 cols) */}
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Fecha de Emisión
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => handleIssueDateChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-numbers bg-zinc-50/70 border border-zinc-200 rounded-xl text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-700">
                    Fecha de Vencimiento
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleTermsSelect(15)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        dueTerms === 15
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      15d
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTermsSelect(30)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        dueTerms === 30
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      30d
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueTerms('custom');
                    setDueDate(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs font-mono-numbers bg-zinc-50/70 border border-zinc-200 rounded-xl text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Moneda de la Factura
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'COP' | 'USD')}
                  className="w-full px-3 py-2 text-xs bg-zinc-50/70 border border-zinc-200 rounded-xl text-zinc-900 font-medium focus:bg-white focus:outline-none focus:border-zinc-900 cursor-pointer"
                >
                  <option value="COP">COP — Peso Colombiano ($)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Tasa de Cambio (Base {activeCompany?.base_currency})
                </label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  disabled={currency === activeCompany?.base_currency}
                  value={
                    currency === activeCompany?.base_currency ? 1 : exchangeRateToBase
                  }
                  onChange={(e) =>
                    setExchangeRateToBase(parseFloat(e.target.value) || 1)
                  }
                  className="w-full px-3 py-2 text-xs font-mono-numbers bg-zinc-50/70 border border-zinc-200 rounded-xl text-zinc-900 disabled:opacity-60 focus:bg-white focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>
          </div>

          {/* 2. Tabla de Ítems Dinámica */}
          <div className="p-6 sm:p-8 border-b border-zinc-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                  Líneas de Facturación
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Detalla los productos o servicios prestados
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 text-xs font-medium transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar línea</span>
              </button>
            </div>

            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/90 border-b border-zinc-200 text-[11px] font-medium text-zinc-500">
                      <th className="py-2.5 px-4 min-w-[240px]">
                        Descripción del servicio o producto
                      </th>
                      <th className="py-2.5 px-3 w-24 text-right">Cantidad</th>
                      <th className="py-2.5 px-3 w-36 text-right">Precio Unitario</th>
                      <th className="py-2.5 px-3 w-28 text-right">
                        {isColombia ? 'IVA (%)' : 'Tax (%)'}
                      </th>
                      <th className="py-2.5 px-4 w-36 text-right">Importe</th>
                      <th className="py-2.5 px-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.map((item, idx) => {
                      const lineAmount =
                        (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);

                      return (
                        <tr key={item.id} className="hover:bg-zinc-50/40 group">
                          {/* Descripción */}
                          <td className="p-2.5 pl-4">
                            <input
                              type="text"
                              required
                              value={item.description}
                              onChange={(e) =>
                                handleItemChange(item.id, 'description', e.target.value)
                              }
                              placeholder={`Ej. ${
                                idx === 0
                                  ? 'Consultoría contable y estructuración financiera'
                                  : 'Licenciamiento de software mensual'
                              }`}
                              className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                            />
                          </td>

                          {/* Cantidad */}
                          <td className="p-2.5">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  'quantity',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-2.5 py-1.5 text-xs font-mono-numbers text-right bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                            />
                          </td>

                          {/* Precio Unitario */}
                          <td className="p-2.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.unit_price}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  'unit_price',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-2.5 py-1.5 text-xs font-mono-numbers text-right bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                            />
                          </td>

                          {/* Tasa de Impuesto */}
                          <td className="p-2.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={item.tax_rate}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  'tax_rate',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-2.5 py-1.5 text-xs font-mono-numbers text-right bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                            />
                          </td>

                          {/* Importe Calculado Automáticamente */}
                          <td className="p-2.5 pr-4 text-right font-mono-numbers font-semibold text-zinc-900">
                            {formatCurrency(lineAmount, currency)}
                          </td>

                          {/* Eliminar */}
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              disabled={items.length <= 1}
                              onClick={() => handleRemoveLine(item.id)}
                              className="p-1.5 rounded-md text-zinc-300 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-20 transition-colors cursor-pointer"
                              title="Eliminar línea"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar línea adicional</span>
              </button>
            </div>
          </div>

          {/* 3. Cálculo Fiscal en Tiempo Real y Adaptado al País */}
          <div className="p-6 sm:p-8 bg-zinc-50/40 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Country-Specific Fiscal Panel (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">{isColombia ? '🇨🇴' : '🇺🇸'}</span>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                  {isColombia
                    ? 'Configuración Fiscal y Retenciones (Colombia - DIAN)'
                    : 'Sales Tax Configuration (United States)'}
                </h4>
              </div>

              {isColombia ? (
                /* COLOMBIA: IVA & Optional Retentions (Retefuente, ReteICA) */
                <div className="bg-white p-4 rounded-xl border border-zinc-200/80 space-y-4">
                  {/* Quick IVA Preset */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100">
                    <div>
                      <div className="text-xs font-medium text-zinc-800">
                        Impuesto sobre las Ventas (IVA)
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Calculado por línea (estándar general 19%)
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[19, 5, 0].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() =>
                            setItems((prev) =>
                              prev.map((it) => ({ ...it, tax_rate: rate }))
                            )
                          }
                          className="px-2.5 py-1 rounded-md text-[11px] font-mono-numbers font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
                        >
                          Aplicar {rate}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Retefuente Checkbox & Rate */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={retefuenteEnabled}
                        onChange={(e) => setRetefuenteEnabled(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-medium text-zinc-900">
                          Aplicar Retención en la Fuente (Retefuente)
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          Descuento anticipado sobre el subtotal antes de IVA
                        </div>
                      </div>
                    </label>

                    {retefuenteEnabled && (
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={retefuenteRate}
                          onChange={(e) =>
                            setRetefuenteRate(parseFloat(e.target.value) || 0)
                          }
                          className="px-2.5 py-1.5 text-xs font-mono-numbers bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:border-zinc-900 cursor-pointer"
                        >
                          <option value={2.5}>2.5% (Compras / General)</option>
                          <option value={3.5}>3.5% (Servicios / Arrend.)</option>
                          <option value={4}>4.0% (Servicios / Declarante)</option>
                          <option value={10}>10.0% (Honorarios)</option>
                          <option value={11}>11.0% (Honorarios PJ)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* ReteICA Checkbox & Rate */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={reteicaEnabled}
                        onChange={(e) => setReteicaEnabled(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-medium text-zinc-900">
                          Aplicar Retención de Industria y Comercio (ReteICA)
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          Tarifa municipal expresada en porcentaje (ej. 0.966% = 9.66x1000)
                        </div>
                      </div>
                    </label>

                    {reteicaEnabled && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.001"
                          value={reteicaRate}
                          onChange={(e) =>
                            setReteicaRate(parseFloat(e.target.value) || 0)
                          }
                          className="w-24 px-2.5 py-1.5 text-xs font-mono-numbers text-right bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:border-zinc-900"
                        />
                        <span className="text-xs font-mono-numbers text-zinc-500">%</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* UNITED STATES: Sales Tax (%) */
                <div className="bg-white p-4 rounded-xl border border-zinc-200/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-zinc-900">
                        State & Local Sales Tax (%)
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Porcentaje aplicable al subtotal de la factura
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        step="0.01"
                        value={usSalesTaxRate}
                        onChange={(e) =>
                          handleUsSalesTaxChange(parseFloat(e.target.value) || 0)
                        }
                        className="w-24 px-2.5 py-1.5 text-xs font-mono-numbers text-right bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:border-zinc-900"
                      />
                      <span className="text-xs font-mono-numbers text-zinc-500">%</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100">
                    <span className="text-[11px] text-zinc-400 mr-1">Tasas comunes:</span>
                    {[
                      { label: 'Tax Exempt (0%)', rate: 0 },
                      { label: 'FL (6%)', rate: 6 },
                      { label: 'CA (7.25%)', rate: 7.25 },
                      { label: 'TX (8.25%)', rate: 8.25 },
                      { label: 'NY (8.875%)', rate: 8.875 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleUsSalesTaxChange(preset.rate)}
                        className={`px-2 py-1 rounded text-[11px] font-mono-numbers transition-colors cursor-pointer ${
                          usSalesTaxRate === preset.rate
                            ? 'bg-zinc-900 text-white font-medium'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Totals Breakdown Box (5 cols) */}
            <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-zinc-200/90 shadow-2xs space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 pb-2 border-b border-zinc-100">
                Resumen Financiero ({currency})
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Subtotal de líneas</span>
                  <span className="font-mono-numbers font-medium text-zinc-900">
                    {formatCurrency(subtotal, currency)}
                  </span>
                </div>

                {isColombia ? (
                  <>
                    <div className="flex items-center justify-between text-zinc-600">
                      <span>IVA Total</span>
                      <span className="font-mono-numbers font-medium text-zinc-900">
                        +{formatCurrency(ivaTotal, currency)}
                      </span>
                    </div>

                    {retefuenteEnabled && (
                      <div className="flex items-center justify-between text-rose-600">
                        <span>Retefuente ({retefuenteRate}%)</span>
                        <span className="font-mono-numbers font-medium">
                          -{formatCurrency(retefuenteAmount, currency)}
                        </span>
                      </div>
                    )}

                    {reteicaEnabled && (
                      <div className="flex items-center justify-between text-rose-600">
                        <span>ReteICA ({reteicaRate}%)</span>
                        <span className="font-mono-numbers font-medium">
                          -{formatCurrency(reteicaAmount, currency)}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Sales Tax ({usSalesTaxRate}%)</span>
                    <span className="font-mono-numbers font-medium text-zinc-900">
                      +{formatCurrency(salesTaxAmount, currency)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-200 flex items-baseline justify-between">
                <div>
                  <span className="text-sm font-bold text-zinc-900">Total a Pagar</span>
                  <p className="text-[10px] text-zinc-400">
                    {isColombia && totalRetentions > 0
                      ? 'Subtotal + IVA - Retenciones'
                      : 'Subtotal + Impuestos'}
                  </p>
                </div>
                <div className="text-xl font-bold font-mono-numbers text-zinc-900 tracking-tight">
                  {formatCurrency(grandTotal, currency)}
                </div>
              </div>

              {/* Bottom Action Buttons inside Summary */}
              <div className="pt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={Boolean(savingStatus)}
                  onClick={() => handleSaveInvoice('DRAFT')}
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingStatus === 'DRAFT' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Guardar Borrador</span>
                </button>

                <button
                  type="button"
                  disabled={Boolean(savingStatus)}
                  onClick={() => handleSaveInvoice('ISSUED')}
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingStatus === 'ISSUED' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Emitir Factura</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Quick Create Customer Modal */}
      <CreateCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onCustomerCreated={(newCust) => {
          setCustomers((prev) => [...prev, newCust]);
          setSelectedCustomerId(newCust.id);
          setToast({
            id: String(Date.now()),
            type: 'success',
            title: 'Cliente guardado exitosamente',
            description: `${newCust.name} fue seleccionado para esta factura.`,
          });
        }}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
