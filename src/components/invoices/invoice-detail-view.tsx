'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Company, Customer, Invoice, InvoiceItem, InvoiceStatus } from '@/types/database';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';
import { generateInvoicePdf } from '@/lib/pdf/generate-invoice-pdf';
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  Ban,
  Send,
  Loader2,
  Printer,
  ShieldAlert,
  Building2,
  Mail,
  MapPin,
  FileText
} from 'lucide-react';
import { Toast, ToastMessage } from '@/components/ui/toast';

interface InvoiceDetailViewProps {
  invoiceId: string;
}

export function InvoiceDetailView({ invoiceId }: InvoiceDetailViewProps) {
  const { activeCompany, activeRole, companies, user, isLoading: authLoading } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<InvoiceStatus | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchInvoiceFullDetail = useCallback(async () => {
    if (authLoading || !activeCompany) return;
    setLoading(true);

    try {
      // Single query with JOIN on companies, customers, and invoice_items
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          company_id,
          customer_id,
          invoice_number,
          issue_date,
          due_date,
          status,
          currency,
          exchange_rate_to_base,
          subtotal,
          tax_total,
          total,
          tax_breakdown,
          created_by,
          created_at,
          company:company_id (
            id,
            name,
            legal_name,
            country,
            tax_id,
            base_currency
          ),
          customer:customer_id (
            id,
            company_id,
            name,
            tax_id,
            email,
            billing_address
          ),
          items:invoice_items (
            id,
            invoice_id,
            company_id,
            description,
            quantity,
            unit_price,
            tax_rate,
            amount
          )
        `)
        .eq('id', invoiceId)
        .maybeSingle();

      if (error || !data) {
        // RLS blocked access or invoice does not exist for this tenant
        router.replace('/invoices?error=unauthorized');
        return;
      }

      // Validate tenant membership isolation
      const belongsToUserCompany = companies.some((c) => c.id === data.company_id);
      if (!belongsToUserCompany || data.company_id !== activeCompany.id) {
        router.replace('/invoices?error=unauthorized');
        return;
      }

      const embeddedCompany = Array.isArray(data.company)
        ? data.company[0]
        : data.company;
      const embeddedCustomer = Array.isArray(data.customer)
        ? data.customer[0]
        : data.customer;

      setInvoice(data as unknown as Invoice);
      setCompanyData((embeddedCompany as Company) || activeCompany);
      setCustomerData((embeddedCustomer as Customer) || null);
      setItems((data.items as InvoiceItem[]) || []);
    } catch (err) {
      console.error('Error fetching invoice detail:', err);
      router.replace('/invoices?error=unauthorized');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, activeCompany, companies, authLoading, supabase, router]);

  useEffect(() => {
    fetchInvoiceFullDetail();
  }, [fetchInvoiceFullDetail]);

  const handleUpdateStatus = async (newStatus: InvoiceStatus) => {
    if (!invoice || !activeCompany) return;

    // RBAC check for VOID
    if (newStatus === 'VOID' && activeRole !== 'ADMIN') {
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Acción restringida',
        description: 'Solo un administrador (ADMIN) puede anular facturas.',
      });
      return;
    }

    setUpdatingStatus(newStatus);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoice.id)
        .eq('company_id', activeCompany.id)
        .select('id, status, invoice_number')
        .single();

      if (error) throw error;

      if (data) {
        setInvoice((prev) => (prev ? { ...prev, status: data.status as InvoiceStatus } : prev));
        setToast({
          id: String(Date.now()),
          type: 'success',
          title:
            newStatus === 'PAID'
              ? 'Factura marcada como Pagada'
              : newStatus === 'VOID'
              ? 'Factura anulada (VOID)'
              : 'Factura emitida exitosamente',
          description: `El estado de ${invoice.invoice_number} se actualizó a ${newStatus}.`,
        });
      }
    } catch (err: any) {
      console.error('Error updating status:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Error al actualizar estado',
        description: err.message || 'No se pudo actualizar la factura.',
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDownloadPdf = () => {
    if (!invoice || !companyData) return;
    setGeneratingPdf(true);
    try {
      generateInvoicePdf({
        invoice,
        company: companyData,
        customer: customerData,
        items,
        emitterEmail: user?.email,
      });
      setToast({
        id: String(Date.now()),
        type: 'success',
        title: 'PDF generado exitosamente',
        description: `Se ha descargado ${invoice.invoice_number}.pdf`,
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Error generando el PDF',
        description: 'No fue posible construir el documento PDF.',
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading || authLoading) {
    return (
      <>
        <header className="h-16 border-b border-zinc-200/80 bg-white px-6 flex items-center justify-between">
          <div className="h-5 w-48 bg-zinc-100 animate-pulse rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-28 bg-zinc-100 animate-pulse rounded-lg" />
            <div className="h-8 w-36 bg-zinc-100 animate-pulse rounded-lg" />
          </div>
        </header>
        <main className="p-6 sm:p-10 max-w-4xl w-full mx-auto">
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-10 space-y-8">
            <div className="flex justify-between">
              <div className="space-y-2">
                <div className="h-6 w-48 bg-zinc-100 animate-pulse rounded" />
                <div className="h-4 w-32 bg-zinc-100 animate-pulse rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-6 w-28 bg-zinc-100 animate-pulse rounded ml-auto" />
                <div className="h-4 w-36 bg-zinc-100 animate-pulse rounded" />
              </div>
            </div>
            <div className="h-28 bg-zinc-50 animate-pulse rounded-xl" />
            <div className="space-y-3">
              <div className="h-10 bg-zinc-100 animate-pulse rounded-lg" />
              <div className="h-10 bg-zinc-100 animate-pulse rounded-lg" />
              <div className="h-10 bg-zinc-100 animate-pulse rounded-lg" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!invoice || !companyData) return null;

  const badge = getStatusBadge(invoice.status);
  const currency = invoice.currency || companyData.base_currency || 'COP';
  const breakdown = invoice.tax_breakdown || {};
  const isColombia = (breakdown.country || companyData.country) !== 'US';

  const ivaAmount =
    breakdown.iva_total !== undefined
      ? Number(breakdown.iva_total)
      : Number(invoice.tax_total) || 0;
  const salesTaxAmount =
    breakdown.sales_tax_amount !== undefined
      ? Number(breakdown.sales_tax_amount)
      : Number(invoice.tax_total) || 0;

  return (
    <>
      {/* 1. CABECERA DE CONTROL */}
      <header className="min-h-16 py-3 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md px-6 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            title="Volver al listado de facturas"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-semibold font-mono-numbers tracking-tight text-zinc-900">
                {invoice.invoice_number}
              </h1>
              {/* Status Badge Indicator */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badge.bg}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                <span>
                  {badge.label} ({invoice.status})
                </span>
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Cliente: <strong className="text-zinc-700">{customerData?.name || 'General'}</strong> · Emitida el {formatDate(invoice.issue_date)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Descargar PDF */}
          <button
            type="button"
            disabled={generatingPdf}
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200/90 text-xs font-medium shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            {generatingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600" />
            ) : (
              <Download className="w-3.5 h-3.5 text-zinc-700" />
            )}
            <span>Descargar PDF</span>
          </button>

          {/* Emitir Factura (if currently DRAFT) */}
          {invoice.status === 'DRAFT' && (
            <button
              type="button"
              disabled={Boolean(updatingStatus)}
              onClick={() => handleUpdateStatus('ISSUED')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {updatingStatus === 'ISSUED' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Emitir Factura</span>
            </button>
          )}

          {/* Marcar como Pagada */}
          {invoice.status !== 'PAID' && invoice.status !== 'VOID' && (
            <button
              type="button"
              disabled={Boolean(updatingStatus)}
              onClick={() => handleUpdateStatus('PAID')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {updatingStatus === 'PAID' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Marcar como Pagada</span>
            </button>
          )}

          {/* Anular Factura (ADMIN only) */}
          {activeRole === 'ADMIN' && invoice.status !== 'VOID' && (
            <button
              type="button"
              disabled={Boolean(updatingStatus)}
              onClick={() => handleUpdateStatus('VOID')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200/80 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
            >
              {updatingStatus === 'VOID' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Ban className="w-3.5 h-3.5" />
              )}
              <span>Anular Factura</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. CANVAS DE FACTURA (Vista previa interactiva editorial estilo Stripe Invoicing) */}
      <main className="p-6 sm:p-10 max-w-4xl w-full mx-auto pb-20">
        <div className="bg-white rounded-none sm:rounded-xl border border-zinc-200/90 shadow-sm overflow-hidden relative print:border-0 print:shadow-none">
          {/* Editorial Top Monochrome Bar */}
          <div className="h-1.5 w-full bg-zinc-950" />

          {/*VOID Watermark if Anulada */}
          {invoice.status === 'VOID' && (
            <div className="px-8 py-2.5 bg-rose-50 border-b border-rose-200/70 text-rose-700 text-xs font-medium flex items-center justify-between">
              <span>COMPROBANTE ANULADO (VOID) — Sin validez para cobro contable</span>
              <span className="font-mono-numbers">{invoice.invoice_number}</span>
            </div>
          )}

          <div className="p-8 sm:p-12 space-y-10">
            {/* A. ENCABEZADO DEL DOCUMENTO */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-8 border-b border-zinc-200/80">
              {/* Emisor */}
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-md bg-zinc-950 text-white flex items-center justify-center font-bold text-xs">
                    {companyData.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                    {isColombia ? 'Factura de Venta' : 'Commercial Invoice'}
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-950">
                  {companyData.legal_name || companyData.name}
                </h2>
                {companyData.name && companyData.name !== companyData.legal_name && (
                  <p className="text-xs text-zinc-600">{companyData.name}</p>
                )}
                <p className="text-xs font-mono-numbers text-zinc-600">
                  {isColombia ? 'NIT:' : 'EIN / Tax ID:'} {companyData.tax_id}
                </p>
                <p className="text-xs text-zinc-500">
                  {isColombia ? '🇨🇴 Colombia · Régimen Tributario DIAN' : '🇺🇸 United States · IRS Standard'}
                  {user?.email ? ` · ${user.email}` : ''}
                </p>
              </div>

              {/* Datos del Documento */}
              <div className="sm:text-right space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                  N° de Documento
                </div>
                <div className="text-2xl font-bold font-mono-numbers text-zinc-950 tracking-tight">
                  {invoice.invoice_number}
                </div>

                <div className="pt-2 space-y-1 text-xs">
                  <div className="flex sm:justify-end gap-3">
                    <span className="text-zinc-500">Fecha de emisión:</span>
                    <span className="font-mono-numbers font-medium text-zinc-900">
                      {formatDate(invoice.issue_date)}
                    </span>
                  </div>
                  <div className="flex sm:justify-end gap-3">
                    <span className="text-zinc-500">Fecha de vencimiento:</span>
                    <span className="font-mono-numbers font-medium text-zinc-900">
                      {formatDate(invoice.due_date)}
                    </span>
                  </div>
                  <div className="flex sm:justify-end gap-3">
                    <span className="text-zinc-500">Moneda:</span>
                    <span className="font-mono-numbers font-semibold text-zinc-900">
                      {currency}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* B. BLOQUE DEL CLIENTE ("Facturado a") & RESUMEN RÁPIDO */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
              <div className="sm:col-span-7 space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  Facturado a
                </div>
                <div className="text-sm font-semibold text-zinc-950">
                  {customerData?.name || 'Cliente General'}
                </div>
                <div className="text-xs font-mono-numbers text-zinc-600">
                  {isColombia ? 'NIT / Documento:' : 'Tax ID / EIN:'}{' '}
                  {customerData?.tax_id || 'No registrado'}
                </div>
                {customerData?.email && (
                  <div className="text-xs text-zinc-600 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>{customerData.email}</span>
                  </div>
                )}
                {customerData?.billing_address && (
                  <div className="text-xs text-zinc-600 flex items-start gap-1.5 max-w-md leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                    <span>{customerData.billing_address}</span>
                  </div>
                )}
              </div>

              <div className="sm:col-span-5 p-4 rounded-xl bg-zinc-50/90 border border-zinc-200/80 flex flex-col justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  Importe Total ({currency})
                </span>
                <div className="text-2xl font-bold font-mono-numbers text-zinc-950 tracking-tight mt-1">
                  {formatCurrency(Number(invoice.total), currency)}
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-200/70 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Estado actual:</span>
                  <span className="font-semibold text-zinc-800">{badge.label}</span>
                </div>
              </div>
            </div>

            {/* C. TABLA DE CONCEPTOS */}
            <div>
              <div className="border-t border-b border-zinc-200 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      <th className="py-3 px-4">Descripción</th>
                      <th className="py-3 px-4 text-right w-24">Cantidad</th>
                      <th className="py-3 px-4 text-right w-36">Precio Unitario</th>
                      <th className="py-3 px-4 text-right w-36">Total Línea</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-zinc-400">
                          No hay conceptos detallados en este comprobante.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3.5 px-4 text-zinc-900 font-medium">
                            <div>{item.description}</div>
                            {Number(item.tax_rate) > 0 && (
                              <div className="text-[10px] text-zinc-400 font-mono-numbers mt-0.5">
                                {isColombia ? 'IVA' : 'Tax'}: {item.tax_rate}%
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono-numbers text-zinc-700">
                            {item.quantity}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono-numbers text-zinc-700">
                            {formatCurrency(Number(item.unit_price), currency)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono-numbers font-semibold text-zinc-950">
                            {formatCurrency(Number(item.amount), currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* D. BLOQUE DE TOTALES (Localización Fiscal CO / US) */}
            <div className="flex justify-end">
              <div className="w-full sm:w-80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span className="font-mono-numbers font-medium text-zinc-900">
                    {formatCurrency(Number(invoice.subtotal), currency)}
                  </span>
                </div>

                {isColombia ? (
                  <>
                    <div className="flex items-center justify-between text-zinc-600">
                      <span>IVA (19%)</span>
                      <span className="font-mono-numbers font-medium text-zinc-900">
                        +{formatCurrency(ivaAmount, currency)}
                      </span>
                    </div>

                    {breakdown.retefuente_enabled && (breakdown.retefuente_amount ?? 0) > 0 && (
                      <div className="flex items-center justify-between text-rose-700">
                        <span>Retefuente ({breakdown.retefuente_rate ?? 2.5}%)</span>
                        <span className="font-mono-numbers font-medium">
                          -{formatCurrency(Number(breakdown.retefuente_amount), currency)}
                        </span>
                      </div>
                    )}

                    {breakdown.reteica_enabled && (breakdown.reteica_amount ?? 0) > 0 && (
                      <div className="flex items-center justify-between text-rose-700">
                        <span>ReteICA ({breakdown.reteica_rate ?? 0}%)</span>
                        <span className="font-mono-numbers font-medium">
                          -{formatCurrency(Number(breakdown.reteica_amount), currency)}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Sales Tax ({breakdown.sales_tax_rate ?? 0}%)</span>
                    <span className="font-mono-numbers font-medium text-zinc-900">
                      +{formatCurrency(salesTaxAmount, currency)}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t-2 border-zinc-950 flex items-baseline justify-between">
                  <span className="text-sm font-bold text-zinc-950">
                    Total Final ({currency})
                  </span>
                  <span className="text-lg font-bold font-mono-numbers text-zinc-950">
                    {formatCurrency(Number(invoice.total), currency)} {currency}
                  </span>
                </div>
              </div>
            </div>

            {/* E. PIE DE PÁGINA (Términos de pago, notas bancarias y sello Kounta) */}
            <div className="pt-8 border-t border-zinc-200/80 space-y-6">
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  Términos de Pago y Notas Bancarias
                </h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {isColombia ? (
                    <>
                      Favor realizar el pago antes del{' '}
                      <strong className="text-zinc-700 font-mono-numbers">
                        {formatDate(invoice.due_date)}
                      </strong>{' '}
                      mediante transferencia electrónica ACH / PSE a nombre de{' '}
                      <strong className="text-zinc-700">{companyData.legal_name}</strong> (NIT{' '}
                      <span className="font-mono-numbers">{companyData.tax_id}</span>). Esta factura
                      de venta se asimila en todos sus efectos legales a un título valor según el
                      Código de Comercio Colombiano.
                    </>
                  ) : (
                    <>
                      Please remit payment by{' '}
                      <strong className="text-zinc-700 font-mono-numbers">
                        {formatDate(invoice.due_date)}
                      </strong>{' '}
                      via ACH or Wire Transfer payable to{' '}
                      <strong className="text-zinc-700">{companyData.legal_name}</strong> (EIN{' '}
                      <span className="font-mono-numbers">{companyData.tax_id}</span>). Please
                      reference invoice{' '}
                      <span className="font-mono-numbers font-medium text-zinc-700">
                        {invoice.invoice_number}
                      </span>{' '}
                      in your payment memo.
                    </>
                  )}
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Documento electrónico verificable</span>
                <span className="italic">Generado a través de Kounta</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
