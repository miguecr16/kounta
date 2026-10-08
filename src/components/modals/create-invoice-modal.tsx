'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/auth-context';
import { Customer, InvoiceStatus } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import {
  X,
  Loader2,
  Plus,
  Trash2,
  Receipt,
  AlertCircle,
  Calendar,
  Building,
  UserPlus
} from 'lucide-react';
import { CreateCustomerModal } from './create-customer-modal';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceCreated: () => void;
}

interface LineItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  onInvoiceCreated,
}: CreateInvoiceModalProps) {
  const { activeCompany } = useAuth();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('ISSUED');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const [items, setItems] = useState<LineItemInput[]>([
    {
      description: 'Servicios de consultoría financiera',
      quantity: 1,
      unit_price: activeCompany?.base_currency === 'COP' ? 1500000 : 850,
      tax_rate: activeCompany?.country === 'CO' ? 19 : 0,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Load customers for active company
  useEffect(() => {
    if (!isOpen || !activeCompany) return;

    async function loadCustomers() {
      setLoadingCustomers(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', activeCompany!.id)
        .order('name');

      if (!error && data) {
        setCustomers(data as Customer[]);
        if (data.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(data[0].id);
        }
      }
      setLoadingCustomers(false);
    }

    // Auto-generate invoice number prefix
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const prefix = activeCompany.country === 'CO' ? `FAC-${randomSuffix}` : `INV-${randomSuffix}`;
    setInvoiceNumber(prefix);

    loadCustomers();
  }, [isOpen, activeCompany, supabase]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: activeCompany?.country === 'CO' ? 19 : 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof LineItemInput, value: any) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };
    setItems(newItems);
  };

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
  const taxTotal = items.reduce((acc, it) => acc + (it.quantity * it.unit_price * (it.tax_rate / 100)), 0);
  const grandTotal = subtotal + taxTotal;
  const currency = activeCompany?.base_currency || 'COP';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!activeCompany) {
      setErrorMessage('No hay empresa activa seleccionada.');
      return;
    }

    if (!selectedCustomerId) {
      setErrorMessage('Debes seleccionar o crear un cliente antes de emitir la factura.');
      return;
    }

    if (items.some((it) => !it.description.trim() || it.quantity <= 0)) {
      setErrorMessage('Cada línea debe tener una descripción válida y cantidad mayor a cero.');
      return;
    }

    setLoading(true);

    try {
      // 1. Insert invoice
      const { data: invoiceData, error: invoiceErr } = await supabase
        .from('invoices')
        .insert({
          company_id: activeCompany.id,
          customer_id: selectedCustomerId,
          invoice_number: invoiceNumber.trim(),
          status,
          issue_date: issueDate,
          due_date: dueDate,
          subtotal,
          tax_total: taxTotal,
          total: grandTotal,
          currency,
        })
        .select()
        .single();

      if (invoiceErr) throw invoiceErr;
      if (!invoiceData) throw new Error('No se pudo crear la factura.');

      // 2. Insert invoice items
      const itemsToInsert = items.map((it) => ({
        company_id: activeCompany.id,
        invoice_id: invoiceData.id,
        description: it.description.trim(),
        quantity: it.quantity,
        unit_price: it.unit_price,
        tax_rate: it.tax_rate,
        amount: it.quantity * it.unit_price,
      }));

      const { error: itemsErr } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (itemsErr) throw itemsErr;

      onInvoiceCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error al emitir la factura.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-zinc-950 text-white">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Nueva Factura</h3>
                <p className="text-[11px] text-zinc-500 font-mono-numbers">
                  {activeCompany?.name} · {currency}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form scrollable area */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Customer & Invoice Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-zinc-700">Cliente</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Nuevo cliente
                  </button>
                </div>
                {customers.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="w-full py-2.5 px-3 text-xs border border-dashed border-zinc-300 rounded-lg text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 text-center transition-colors flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Crear primer cliente para facturar</span>
                  </button>
                ) : (
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 cursor-pointer"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.tax_id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Número de Factura
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="FAC-001"
                  className="w-full px-3 py-2 text-xs font-mono-numbers bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>
            </div>

            {/* Dates & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Fecha de Emisión
                </label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-numbers bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Fecha de Vencimiento
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-numbers bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Estado Inicial
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 cursor-pointer"
                >
                  <option value="ISSUED">Emitida (Por cobrar)</option>
                  <option value="PAID">Pagada (Recaudada)</option>
                  <option value="DRAFT">Borrador</option>
                </select>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                  Conceptos / Ítems
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir ítem
                </button>
              </div>

              <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium text-[11px]">
                      <th className="py-2.5 px-3">Descripción</th>
                      <th className="py-2.5 px-2 w-20 text-right">Cant.</th>
                      <th className="py-2.5 px-2 w-28 text-right">Precio Unit.</th>
                      <th className="py-2.5 px-2 w-20 text-right">IVA %</th>
                      <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
                      <th className="py-2.5 px-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.map((item, index) => {
                      const itemSubtotal = item.quantity * item.unit_price;
                      return (
                        <tr key={index} className="hover:bg-zinc-50/50">
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              value={item.description}
                              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                              placeholder="Descripción del producto o servicio"
                              className="w-full px-2 py-1 text-xs border border-zinc-200 rounded bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-xs font-mono-numbers text-right border border-zinc-200 rounded bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-xs font-mono-numbers text-right border border-zinc-200 rounded bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={item.tax_rate}
                              onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-xs font-mono-numbers text-right border border-zinc-200 rounded bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                          </td>
                          <td className="p-2 text-right font-mono-numbers text-zinc-900 font-medium">
                            {formatCurrency(itemSubtotal, currency)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              disabled={items.length <= 1}
                              className="text-zinc-300 hover:text-rose-600 disabled:opacity-20 cursor-pointer transition-colors"
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

            {/* Totals Summary */}
            <div className="flex justify-end pt-2">
              <div className="w-64 bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-500 font-mono-numbers">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-zinc-500 font-mono-numbers">
                  <span>Impuestos (IVA):</span>
                  <span>{formatCurrency(taxTotal, currency)}</span>
                </div>
                <div className="flex justify-between font-semibold text-zinc-900 pt-2 border-t border-zinc-200 font-mono-numbers text-sm">
                  <span>Total a facturar:</span>
                  <span>{formatCurrency(grandTotal, currency)}</span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !selectedCustomerId}
                className="px-5 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Emitir Factura</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <CreateCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onCustomerCreated={(newCust) => {
          setCustomers((prev) => [...prev, newCust]);
          setSelectedCustomerId(newCust.id);
        }}
      />
    </>
  );
}
