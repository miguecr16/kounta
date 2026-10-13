'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Invoice, Customer, TaxBreakdown, Expense, ExpenseCategory } from '@/types/database';
import {
  EXPENSE_CATEGORY_OPTIONS,
  formatCurrency,
  formatDate,
  getExpenseCategoryBadge,
} from '@/lib/utils';
import { Toast, ToastMessage } from '@/components/ui/toast';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  Landmark,
  Users,
  Shield,
  Lock,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Receipt,
  Search,
  Building2,
  AlertCircle,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';

export type DateRangePreset = 'this_month' | 'last_quarter' | 'ytd' | 'custom';
export type WorkerReportAccessMode = 'SUMMARY_ONLY' | 'BLOCKED';

interface CustomerRevenueRow {
  customerId: string;
  customerName: string;
  taxId: string;
  email: string;
  invoiceCount: number;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
}

interface UsJurisdictionTaxRow {
  jurisdiction: string;
  rateLabel: string;
  invoiceCount: number;
  taxableSubtotal: number;
  salesTaxCollected: number;
  grossTotal: number;
}

function extractUsStateOrCounty(address?: string | null, rate?: number): string {
  if (address && address.trim().length > 0) {
    // Check common US state abbreviations or city/state patterns
    const usStateMatch = address.match(/\b(FL|CA|NY|TX|DE|WA|IL|GA|NJ|PA|MA|NC|VA|OH|CO|AZ|NV|OR|MI)\b/i);
    if (usStateMatch) {
      const code = usStateMatch[1].toUpperCase();
      const stateNames: Record<string, string> = {
        FL: 'Florida (FL) — State & County',
        CA: 'California (CA) — CDTFA',
        NY: 'New York (NY) — NYS Tax',
        TX: 'Texas (TX) — Comptroller',
        DE: 'Delaware (DE) — Exempt / 0%',
        WA: 'Washington (WA) — DOR',
        IL: 'Illinois (IL) — IDOR',
        GA: 'Georgia (GA) — DOR',
        NJ: 'New Jersey (NJ) — Division of Taxation',
      };
      return stateNames[code] || `Estado ${code} (US)`;
    }
    const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(-2).join(', ');
    }
  }
  if (rate && rate > 0) {
    return `Jurisdicción Estándar (${rate}% Sales Tax)`;
  }
  return 'Exento / Out-of-State (0% Tax)';
}

export function ReportsView() {
  const router = useRouter();
  const supabase = createClient();
  const { activeCompany } = useAuth();
  const { isAdmin, isWorker, isLoading: permLoading } = usePermissions();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Date range filter state
  const [preset, setPreset] = useState<DateRangePreset>('ytd');
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  });
  const [customTo, setCustomTo] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Search filter for customer revenue table
  const [customerSearch, setCustomerSearch] = useState('');

  // Active section tab in reports ('all' | 'pnl' | 'customers' | 'taxes')
  const [reportSection, setReportSection] = useState<'all' | 'pnl' | 'customers' | 'taxes'>('all');

  // Configurable RBAC policy for WORKER access to /reports
  const [workerAccessPolicy, setWorkerAccessPolicy] =
    useState<WorkerReportAccessMode>('SUMMARY_ONLY');

  useEffect(() => {
    if (!activeCompany || typeof window === 'undefined') return;
    const savedPolicy = localStorage.getItem(
      `kounta_worker_reports_policy_${activeCompany.id}`
    ) as WorkerReportAccessMode | null;
    if (savedPolicy === 'SUMMARY_ONLY' || savedPolicy === 'BLOCKED') {
      setWorkerAccessPolicy(savedPolicy);
    }
  }, [activeCompany]);

  // Enforce RBAC if WORKER and policy is BLOCKED
  useEffect(() => {
    if (!permLoading && isWorker && workerAccessPolicy === 'BLOCKED') {
      router.replace('/dashboard?error=access_denied');
    }
  }, [permLoading, isWorker, workerAccessPolicy, router]);

  const handleToggleWorkerPolicy = (newPolicy: WorkerReportAccessMode) => {
    if (!activeCompany || !isAdmin) return;
    setWorkerAccessPolicy(newPolicy);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`kounta_worker_reports_policy_${activeCompany.id}`, newPolicy);
    }
    setToast({
      id: String(Date.now()),
      type: 'info',
      title: 'Política RBAC actualizada',
      description:
        newPolicy === 'SUMMARY_ONLY'
          ? 'Los usuarios WORKER ahora pueden visualizar resúmenes generales en Reportes.'
          : 'El acceso a /reports ha sido restringido exclusivamente para administradores (ADMIN).',
    });
  };

  // Compute start and end dates for the active preset
  const dateRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'this_month') {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from, to, label: 'Este Mes' };
    }

    if (preset === 'last_quarter') {
      const qStart = new Date(year, month - 2, 1);
      const from = `${qStart.getFullYear()}-${String(qStart.getMonth() + 1).padStart(2, '0')}-01`;
      return { from, to: todayStr, label: 'Último Trimestre (Últimos 3 Meses)' };
    }

    if (preset === 'ytd') {
      const from = `${year}-01-01`;
      return { from, to: `${year}-12-31`, label: `Año a la Fecha (${year})` };
    }

    return {
      from: customFrom || `${year}-01-01`,
      to: customTo || todayStr,
      label: `Personalizado (${customFrom} a ${customTo})`,
    };
  }, [preset, customFrom, customTo]);

  // Load invoices, expenses, and customers efficiently from Supabase
  const loadReportsData = useCallback(async () => {
    if (!activeCompany) return;

    setLoading(true);
    try {
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select(`
          id,
          company_id,
          customer_id,
          invoice_number,
          total,
          subtotal,
          tax_total,
          status,
          due_date,
          tax_breakdown,
          issue_date,
          currency,
          created_at,
          customer:customer_id (
            id,
            name,
            tax_id,
            email,
            billing_address
          )
        `)
        .eq('company_id', activeCompany.id)
        .order('issue_date', { ascending: false });

      if (invError) throw invError;

      const { data: expData } = await supabase
        .from('expenses')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('expense_date', { ascending: false });

      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('id, company_id, name, tax_id, email, billing_address')
        .eq('company_id', activeCompany.id)
        .order('name', { ascending: true });

      if (custError) throw custError;

      setInvoices((invData as unknown as Invoice[]) || []);
      setExpenses((expData as Expense[]) || []);
      setCustomers((custData as Customer[]) || []);
    } catch (err) {
      console.error('Error loading financial reports:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Error al cargar reportes',
        description: 'No fue posible consultar las agregaciones financieras desde Supabase.',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompany, supabase]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  const currency = activeCompany?.base_currency || 'COP';
  const isColombia = activeCompany?.country === 'CO';

  // Filter valid emitted/paid invoices within selected date range
  const periodInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.status === 'VOID' || inv.status === 'DRAFT') return false;
      const issueDate = (inv.issue_date || inv.created_at || '').slice(0, 10);
      if (!issueDate) return true;
      return issueDate >= dateRange.from && issueDate <= dateRange.to;
    });
  }, [invoices, dateRange]);

  // Filter expenses within selected date range
  const periodExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const expDate = (exp.expense_date || exp.created_at || '').slice(0, 10);
      if (!expDate) return true;
      return expDate >= dateRange.from && expDate <= dateRange.to;
    });
  }, [expenses, dateRange]);

  // P&L (Profit & Loss / Estado de Resultados) Aggregation
  const pnlSummary = useMemo(() => {
    const totalRevenueBilled = periodInvoices.reduce(
      (acc, inv) => acc + (Number(inv.total) || 0),
      0
    );
    const totalRevenuePaid = periodInvoices
      .filter((inv) => inv.status === 'PAID')
      .reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);

    const totalExpenses = periodExpenses.reduce(
      (acc, exp) => acc + (Number(exp.amount) || 0),
      0
    );
    const totalDeductibleTax = periodExpenses.reduce(
      (acc, exp) => acc + (Number(exp.tax_deductible) || 0),
      0
    );

    const netProfitPaid = totalRevenuePaid - totalExpenses;
    const netProfitAccrued = totalRevenueBilled - totalExpenses;
    const netMarginPct =
      totalRevenuePaid > 0
        ? (netProfitPaid / totalRevenuePaid) * 100
        : totalRevenueBilled > 0
        ? (netProfitAccrued / totalRevenueBilled) * 100
        : 0;

    // Breakdown by ExpenseCategory
    const byCategory = EXPENSE_CATEGORY_OPTIONS.map((opt) => {
      const matching = periodExpenses.filter((e) => e.category === opt.value);
      const amount = matching.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      const share = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
      return {
        category: opt.value,
        label: opt.label,
        badgeClass: opt.badgeClass,
        count: matching.length,
        amount,
        share,
      };
    }).sort((a, b) => b.amount - a.amount);

    return {
      totalRevenueBilled,
      totalRevenuePaid,
      totalExpenses,
      totalDeductibleTax,
      netProfitPaid,
      netProfitAccrued,
      netMarginPct,
      byCategory,
    };
  }, [periodInvoices, periodExpenses]);

  // 1. Aggregated Customer Revenue Report
  const customerRevenueRows: CustomerRevenueRow[] = useMemo(() => {
    const map = new Map<string, CustomerRevenueRow>();

    // Seed with customers that have invoices in the period
    periodInvoices.forEach((inv) => {
      const custObj = inv.customer as Customer | undefined;
      const cid = inv.customer_id || 'unassigned';
      const existing = map.get(cid) || {
        customerId: cid,
        customerName: custObj?.name || 'Cliente General',
        taxId: custObj?.tax_id || '—',
        email: custObj?.email || '—',
        invoiceCount: 0,
        totalBilled: 0,
        totalPaid: 0,
        outstandingBalance: 0,
      };

      const total = Number(inv.total) || 0;
      existing.invoiceCount += 1;
      existing.totalBilled += total;

      if (inv.status === 'PAID') {
        existing.totalPaid += total;
      } else if (inv.status === 'ISSUED' || inv.status === 'PARTIAL_PAID') {
        existing.outstandingBalance += total;
      }

      map.set(cid, existing);
    });

    const rows = Array.from(map.values()).sort((a, b) => b.totalBilled - a.totalBilled);

    if (!customerSearch.trim()) return rows;
    const q = customerSearch.toLowerCase().trim();
    return rows.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        r.taxId.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
    );
  }, [periodInvoices, customerSearch]);

  const customerReportTotals = useMemo(() => {
    return customerRevenueRows.reduce(
      (acc, r) => {
        acc.invoiceCount += r.invoiceCount;
        acc.totalBilled += r.totalBilled;
        acc.totalPaid += r.totalPaid;
        acc.outstandingBalance += r.outstandingBalance;
        return acc;
      },
      { invoiceCount: 0, totalBilled: 0, totalPaid: 0, outstandingBalance: 0 }
    );
  }, [customerRevenueRows]);

  // 2. Tax Summary Report Aggregation (CO & US) from JSONB tax_breakdown
  const taxSummary = useMemo(() => {
    let subtotalSum = 0;
    let ivaTotalSum = 0;
    let retefuenteSum = 0;
    let retefuenteCount = 0;
    let reteicaSum = 0;
    let reteicaCount = 0;
    let usSalesTaxSum = 0;
    let netTotalSum = 0;

    const usJurisdictionMap = new Map<string, UsJurisdictionTaxRow>();

    periodInvoices.forEach((inv) => {
      const sub = Number(inv.subtotal) || 0;
      const taxTot = Number(inv.tax_total) || 0;
      const tot = Number(inv.total) || 0;
      const tb: TaxBreakdown = (inv.tax_breakdown as TaxBreakdown) || {};

      subtotalSum += sub;
      netTotalSum += tot;

      if (isColombia) {
        // Colombia DIAN breakdown
        const iva =
          tb.iva_total !== undefined
            ? Number(tb.iva_total)
            : tb.line_taxes_total !== undefined
            ? Number(tb.line_taxes_total)
            : Math.max(0, taxTot);

        const retefuente = Number(tb.retefuente_amount) || 0;
        const reteica = Number(tb.reteica_amount) || 0;

        ivaTotalSum += iva;
        retefuenteSum += retefuente;
        if (retefuente > 0) retefuenteCount += 1;

        reteicaSum += reteica;
        if (reteica > 0) reteicaCount += 1;
      } else {
        // United States Sales Tax breakdown
        const salesTax =
          (Number(tb.sales_tax_amount) || 0) + (Number(tb.line_taxes_total) || 0) ||
          Math.max(0, taxTot);

        usSalesTaxSum += salesTax;

        const custObj = inv.customer as Customer | undefined;
        const effectiveRate =
          tb.sales_tax_rate !== undefined
            ? Number(tb.sales_tax_rate)
            : sub > 0
            ? Number(((salesTax / sub) * 100).toFixed(2))
            : 0;

        const jurisdictionName = extractUsStateOrCounty(
          custObj?.billing_address,
          effectiveRate
        );
        const key = `${jurisdictionName}__${effectiveRate}`;

        const currentRow = usJurisdictionMap.get(key) || {
          jurisdiction: jurisdictionName,
          rateLabel: `${effectiveRate}%`,
          invoiceCount: 0,
          taxableSubtotal: 0,
          salesTaxCollected: 0,
          grossTotal: 0,
        };

        currentRow.invoiceCount += 1;
        currentRow.taxableSubtotal += sub;
        currentRow.salesTaxCollected += salesTax;
        currentRow.grossTotal += tot;

        usJurisdictionMap.set(key, currentRow);
      }
    });

    return {
      subtotalSum,
      ivaTotalSum,
      retefuenteSum,
      retefuenteCount,
      reteicaSum,
      reteicaCount,
      totalRetentions: retefuenteSum + reteicaSum,
      usSalesTaxSum,
      netTotalSum,
      usJurisdictions: Array.from(usJurisdictionMap.values()).sort(
        (a, b) => b.salesTaxCollected - a.salesTaxCollected
      ),
    };
  }, [periodInvoices, isColombia]);

  // CSV Export 1: Ingresos por Cliente
  const handleExportCustomerCSV = () => {
    if (customerRevenueRows.length === 0) {
      setToast({
        id: String(Date.now()),
        type: 'info',
        title: 'Sin datos para exportar',
        description: 'No hay registros de clientes en el rango de fechas seleccionado.',
      });
      return;
    }

    const headers = [
      'Cliente / Razon Social',
      isColombia ? 'NIT' : 'Tax ID / EIN',
      'Email',
      'Cantidad Facturas',
      `Monto Total Facturado (${currency})`,
      `Monto Pagado (${currency})`,
      `Saldo Pendiente (${currency})`,
    ];

    const escapeCsv = (val: string | number) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [
      headers.map(escapeCsv).join(','),
      ...customerRevenueRows.map((r) =>
        [
          r.customerName,
          r.taxId,
          r.email,
          r.invoiceCount,
          r.totalBilled.toFixed(2),
          r.totalPaid.toFixed(2),
          r.outstandingBalance.toFixed(2),
        ]
          .map(escapeCsv)
          .join(',')
      ),
      [
        'TOTAL CONSOLIDADO',
        '',
        '',
        customerReportTotals.invoiceCount,
        customerReportTotals.totalBilled.toFixed(2),
        customerReportTotals.totalPaid.toFixed(2),
        customerReportTotals.outstandingBalance.toFixed(2),
      ]
        .map(escapeCsv)
        .join(','),
    ];

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Kounta_Ingresos_Clientes_${activeCompany?.name?.replace(/\s+/g, '_') || 'Empresa'}_${dateRange.from}_${dateRange.to}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToast({
      id: String(Date.now()),
      type: 'success',
      title: 'Reporte CSV descargado',
      description: 'El archivo de Ingresos por Cliente se ha exportado correctamente.',
    });
  };

  // CSV Export 2: Resumen Fiscal y Tributario (DIAN CO / IRS US)
  const handleExportTaxCSV = () => {
    if (periodInvoices.length === 0) {
      setToast({
        id: String(Date.now()),
        type: 'info',
        title: 'Sin datos fiscales para exportar',
        description: 'No existen facturas emitidas en el periodo seleccionado.',
      });
      return;
    }

    const escapeCsv = (val: string | number) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    let lines: string[] = [];

    if (isColombia) {
      const headers = [
        'Nro Factura',
        'Fecha Emision',
        'Estado',
        'Cliente',
        'NIT Cliente',
        `Subtotal Base Gravable (${currency})`,
        `IVA Cobrado (${currency})`,
        `Retefuente (${currency})`,
        `ReteICA (${currency})`,
        `Total Neto Factura (${currency})`,
      ];

      lines = [
        headers.map(escapeCsv).join(','),
        ...periodInvoices.map((inv) => {
          const cust = inv.customer as Customer | undefined;
          const tb: TaxBreakdown = (inv.tax_breakdown as TaxBreakdown) || {};
          const iva =
            tb.iva_total !== undefined
              ? Number(tb.iva_total)
              : Math.max(0, Number(inv.tax_total) || 0);
          const rf = Number(tb.retefuente_amount) || 0;
          const rica = Number(tb.reteica_amount) || 0;

          return [
            inv.invoice_number,
            inv.issue_date,
            inv.status,
            cust?.name || 'Cliente General',
            cust?.tax_id || '',
            (Number(inv.subtotal) || 0).toFixed(2),
            iva.toFixed(2),
            rf.toFixed(2),
            rica.toFixed(2),
            (Number(inv.total) || 0).toFixed(2),
          ]
            .map(escapeCsv)
            .join(',');
        }),
        [
          'TOTAL LIQUIDACION DIAN',
          `${dateRange.from} a ${dateRange.to}`,
          '',
          '',
          '',
          taxSummary.subtotalSum.toFixed(2),
          taxSummary.ivaTotalSum.toFixed(2),
          taxSummary.retefuenteSum.toFixed(2),
          taxSummary.reteicaSum.toFixed(2),
          taxSummary.netTotalSum.toFixed(2),
        ]
          .map(escapeCsv)
          .join(','),
      ];
    } else {
      const headers = [
        'Invoice Number',
        'Issue Date',
        'Status',
        'Customer Name',
        'Customer EIN / Tax ID',
        'State / Jurisdiction',
        'Sales Tax Rate (%)',
        `Taxable Subtotal (${currency})`,
        `Sales Tax Collected (${currency})`,
        `Invoice Total (${currency})`,
      ];

      lines = [
        headers.map(escapeCsv).join(','),
        ...periodInvoices.map((inv) => {
          const cust = inv.customer as Customer | undefined;
          const tb: TaxBreakdown = (inv.tax_breakdown as TaxBreakdown) || {};
          const sub = Number(inv.subtotal) || 0;
          const salesTax =
            (Number(tb.sales_tax_amount) || 0) + (Number(tb.line_taxes_total) || 0) ||
            Math.max(0, Number(inv.tax_total) || 0);
          const rate =
            tb.sales_tax_rate !== undefined
              ? Number(tb.sales_tax_rate)
              : sub > 0
              ? Number(((salesTax / sub) * 100).toFixed(2))
              : 0;
          const jurisdiction = extractUsStateOrCounty(cust?.billing_address, rate);

          return [
            inv.invoice_number,
            inv.issue_date,
            inv.status,
            cust?.name || 'General Customer',
            cust?.tax_id || '',
            jurisdiction,
            rate,
            sub.toFixed(2),
            salesTax.toFixed(2),
            (Number(inv.total) || 0).toFixed(2),
          ]
            .map(escapeCsv)
            .join(',');
        }),
        [
          'TOTAL US TAX SUMMARY',
          `${dateRange.from} to ${dateRange.to}`,
          '',
          '',
          '',
          '',
          '',
          taxSummary.subtotalSum.toFixed(2),
          taxSummary.usSalesTaxSum.toFixed(2),
          taxSummary.netTotalSum.toFixed(2),
        ]
          .map(escapeCsv)
          .join(','),
      ];
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Kounta_Resumen_Fiscal_${activeCompany?.country || 'CO'}_${dateRange.from}_${dateRange.to}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToast({
      id: String(Date.now()),
      type: 'success',
      title: 'Anexo Fiscal CSV exportado',
      description: 'El reporte tributario listo para contabilidad ha sido descargado.',
    });
  };

  // CSV Export 3: Estado de Resultados / Profit & Loss (P&L)
  const handleExportPnlCSV = () => {
    const escapeCsv = (val: string | number) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines: string[] = [
      ['Concepto Estado de Resultados (P&L)', 'Cantidad Registros', `Monto (${currency})`, 'Participacion (%)']
        .map(escapeCsv)
        .join(','),
      [
        '(+) Ingresos Facturados Devengados (ISSUED + PAID)',
        periodInvoices.length,
        pnlSummary.totalRevenueBilled.toFixed(2),
        '100%',
      ]
        .map(escapeCsv)
        .join(','),
      [
        '(+) Ingresos Efectivamente Cobrados (PAID)',
        periodInvoices.filter((i) => i.status === 'PAID').length,
        pnlSummary.totalRevenuePaid.toFixed(2),
        '',
      ]
        .map(escapeCsv)
        .join(','),
      ['(-) GASTOS OPERATIVOS TOTALES', periodExpenses.length, (-pnlSummary.totalExpenses).toFixed(2), '100%']
        .map(escapeCsv)
        .join(','),
      ...pnlSummary.byCategory.map((cat) =>
        [
          `   Gasto: ${cat.label}`,
          cat.count,
          (-cat.amount).toFixed(2),
          `${cat.share.toFixed(1)}%`,
        ]
          .map(escapeCsv)
          .join(',')
      ),
      [
        '(=) BENEFICIO NETO EN CAJA (Ingresos Cobrados - Gastos)',
        '',
        pnlSummary.netProfitPaid.toFixed(2),
        `${pnlSummary.netMarginPct.toFixed(1)}%`,
      ]
        .map(escapeCsv)
        .join(','),
      [
        '(=) RESULTADO OPERATIVO DEVENGADO (Facturado - Gastos)',
        '',
        pnlSummary.netProfitAccrued.toFixed(2),
        '',
      ]
        .map(escapeCsv)
        .join(','),
    ];

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Kounta_Estado_Resultados_PnL_${activeCompany?.name?.replace(/\s+/g, '_') || 'Empresa'}_${dateRange.from}_${dateRange.to}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToast({
      id: String(Date.now()),
      type: 'success',
      title: 'Estado P&L exportado a CSV',
      description: 'El Estado de Resultados (Profit & Loss) se ha descargado.',
    });
  };

  if (!permLoading && isWorker && workerAccessPolicy === 'BLOCKED') {
    return null;
  }

  return (
    <>
      <Header
        title="Reportes Financieros y Fiscales"
        subtitle={`Estado de Resultados (P&L), liquidación tributaria (${
          isColombia ? '🇨🇴 DIAN Colombia' : '🇺🇸 IRS / State Tax USA'
        }) e ingresos por cliente · ${activeCompany?.legal_name || ''}`}
      />

      <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* RBAC Notice Banner for WORKER or Policy Control for ADMIN */}
        {isWorker ? (
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100/80 text-amber-800">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-amber-950">
                  Modo de Consulta General (Rol WORKER)
                </div>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Estás visualizando el resumen general autorizado. La exportación de anexos contables detallados y el control de políticas son exclusivos para el rol <strong>ADMIN</strong>.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase bg-white text-amber-800 border border-amber-200 shrink-0">
              Solo Lectura
            </span>
          </div>
        ) : (
          <div className="bg-white px-4 py-3 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700 border border-zinc-200/60">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-900">
                  Control de Acceso RBAC a Reportes (`/reports`)
                </span>
                <span className="hidden md:inline text-[11px] text-zinc-500 ml-2">
                  Define el nivel de visibilidad para colaboradores con rol WORKER:
                </span>
              </div>
            </div>

            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 border border-zinc-200/70 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleToggleWorkerPolicy('SUMMARY_ONLY')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  workerAccessPolicy === 'SUMMARY_ONLY'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                WORKER: Ver Resumen General
              </button>
              <button
                type="button"
                onClick={() => handleToggleWorkerPolicy('BLOCKED')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  workerAccessPolicy === 'BLOCKED'
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Solo ADMIN (Restringido)
              </button>
            </div>
          </div>
        )}

        {/* Filter Bar: Date Range Selector & Section Tabs */}
        <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Period Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-zinc-500 mr-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Periodo Contable:
              </span>
              {(
                [
                  { id: 'this_month', label: 'Este Mes' },
                  { id: 'last_quarter', label: 'Último Trimestre' },
                  { id: 'ytd', label: 'Año a la Fecha (YTD)' },
                  { id: 'custom', label: 'Personalizado' },
                ] as { id: DateRangePreset; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPreset(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    preset === item.id
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Section View Switcher */}
            <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-zinc-100 border border-zinc-200/60 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setReportSection('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  reportSection === 'all'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Vista Completa
              </button>
              <button
                type="button"
                onClick={() => setReportSection('pnl')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  reportSection === 'pnl'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Estado P&L (Resultados)
              </button>
              <button
                type="button"
                onClick={() => setReportSection('customers')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  reportSection === 'customers'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Ingresos por Cliente
              </button>
              <button
                type="button"
                onClick={() => setReportSection('taxes')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  reportSection === 'taxes'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Liquidación de Impuestos
              </button>
            </div>
          </div>

          {/* Custom Date Inputs or Active Range Indicator */}
          {preset === 'custom' ? (
            <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-zinc-600">Desde:</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-mono-numbers bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-zinc-600">Hasta:</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-mono-numbers bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>
              <span className="text-[11px] text-zinc-400 font-mono-numbers ml-auto">
                {periodInvoices.length} facturas · {periodExpenses.length} gastos en el intervalo
              </span>
            </div>
          ) : (
            <div className="pt-2.5 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
              <span>
                Mostrando operaciones desde{' '}
                <strong className="font-mono-numbers text-zinc-800">{dateRange.from}</strong> hasta{' '}
                <strong className="font-mono-numbers text-zinc-800">{dateRange.to}</strong> (
                {dateRange.label})
              </span>
              <span className="font-mono-numbers text-zinc-600 font-medium">
                {periodInvoices.length} facturas · {periodExpenses.length} gastos contabilizados
              </span>
            </div>
          )}
        </div>

        {/* =====================================================================
            SECTION 0: P&L (ESTADO DE RESULTADOS / PROFIT & LOSS)
        ===================================================================== */}
        {(reportSection === 'all' || reportSection === 'pnl') && (
          <section className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-zinc-900 text-white mt-0.5">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Estado de Resultados / Profit &amp; Loss (P&amp;L)
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                      Ingresos vs. Gastos
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Comparativa ejecutiva entre Ingresos Totales recaudados, Gastos Operativos por categoría y Beneficio Neto del periodo.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Link
                  href="/expenses"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 transition-colors"
                >
                  Gestionar Gastos →
                </Link>
                <button
                  type="button"
                  onClick={handleExportPnlCSV}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar P&amp;L (CSV)</span>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Top 3 P&L Equation Cards: Ingresos Cobrados - Gastos Totales = Beneficio Neto */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Ingresos Totales (Cobrados PAID + Devengados) */}
                <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      <span>(+) Ingresos Cobrados (PAID)</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="mt-2 text-2xl font-bold font-mono-numbers text-zinc-900">
                      {formatCurrency(pnlSummary.totalRevenuePaid, currency)}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-zinc-200/60 flex items-center justify-between text-[11px] font-mono-numbers text-zinc-500">
                    <span>Facturación emitida total:</span>
                    <strong className="text-zinc-800">
                      {formatCurrency(pnlSummary.totalRevenueBilled, currency)}
                    </strong>
                  </div>
                </div>

                {/* 2. Gastos Totales Operativos */}
                <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      <span>(−) Gastos Operativos Totales</span>
                      <Wallet className="w-3.5 h-3.5 text-zinc-600" />
                    </div>
                    <div className="mt-2 text-2xl font-bold font-mono-numbers text-zinc-900">
                      {formatCurrency(pnlSummary.totalExpenses, currency)}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-zinc-200/60 flex items-center justify-between text-[11px] font-mono-numbers text-zinc-500">
                    <span>Impuestos deducibles:</span>
                    <strong className="text-emerald-700">
                      {formatCurrency(pnlSummary.totalDeductibleTax, currency)}
                    </strong>
                  </div>
                </div>

                {/* 3. Beneficio Neto / Utilidad Neta */}
                <div
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    pnlSummary.netProfitPaid >= 0
                      ? 'bg-emerald-50/50 border-emerald-200/90'
                      : 'bg-rose-50/50 border-rose-200/90'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-700">
                      <span>(=) Beneficio Neto (Utilidad Neta)</span>
                      {pnlSummary.netProfitPaid >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-rose-600" />
                      )}
                    </div>
                    <div
                      className={`mt-2 text-2xl font-bold font-mono-numbers ${
                        pnlSummary.netProfitPaid >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(pnlSummary.netProfitPaid, currency)}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-zinc-200/60 flex items-center justify-between text-[11px] font-mono-numbers text-zinc-600">
                    <span>Resultado devengado (Facturado − Gastos):</span>
                    <strong className="text-zinc-900">
                      {formatCurrency(pnlSummary.netProfitAccrued, currency)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Tabla Contable P&L y Desglose por Categoría de Gasto */}
              <div className="border border-zinc-200/80 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/80 border-b border-zinc-200/70 text-zinc-500 text-[11px] font-medium uppercase tracking-wider">
                      <th className="py-2.5 px-4">Rubro / Categoría P&amp;L</th>
                      <th className="py-2.5 px-3 text-center">Comprobantes</th>
                      <th className="py-2.5 px-4">Distribución</th>
                      <th className="py-2.5 px-4 text-right">Importe ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {/* Ingresos Cobrados Row */}
                    <tr className="bg-emerald-50/20 font-semibold text-zinc-900">
                      <td className="py-3 px-4">
                        (+) Ingresos Operativos Cobrados (Facturas PAID)
                      </td>
                      <td className="py-3 px-3 text-center font-mono-numbers">
                        {periodInvoices.filter((i) => i.status === 'PAID').length}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-emerald-700">
                        Flujo efectivo de entrada
                      </td>
                      <td className="py-3 px-4 text-right font-mono-numbers text-emerald-700">
                        +{formatCurrency(pnlSummary.totalRevenuePaid, currency)}
                      </td>
                    </tr>

                    {/* Expense Categories Breakdown */}
                    {pnlSummary.byCategory.map((cat) => (
                      <tr key={cat.category} className="hover:bg-zinc-50/60">
                        <td className="py-2.5 px-4 pl-7">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${cat.badgeClass}`}
                          >
                            {cat.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono-numbers text-zinc-500">
                          {cat.count}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2 max-w-[180px]">
                            <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                              <div
                                className="h-full bg-zinc-800 rounded-full"
                                style={{ width: `${Math.min(100, cat.share)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono-numbers text-zinc-500 w-10 text-right">
                              {cat.share.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-numbers text-zinc-800">
                          {cat.amount > 0
                            ? `-${formatCurrency(cat.amount, currency)}`
                            : formatCurrency(0, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-900 text-white font-semibold">
                      <td className="py-3.5 px-4" colSpan={3}>
                        (=) BENEFICIO NETO DEL PERIODO (Ingresos Cobrados − Gastos Totales)
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers text-sm">
                        {formatCurrency(pnlSummary.netProfitPaid, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* =====================================================================
            SECTION 1: REPORTE DE INGRESOS POR CLIENTE
        ===================================================================== */}
        {(reportSection === 'all' || reportSection === 'customers') && (
          <section className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-zinc-100 text-zinc-800 border border-zinc-200/60 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    1. Reporte de Ingresos por Cliente
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Consolidado de facturación emitida, recaudo efectivo y saldo pendiente en cartera por cliente.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Filtrar cliente o NIT/EIN..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 w-52"
                  />
                </div>

                {/* Export CSV Button */}
                <button
                  type="button"
                  onClick={handleExportCustomerCSV}
                  disabled={loading || customerRevenueRows.length === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-11 bg-zinc-100 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : customerRevenueRows.length === 0 ? (
              <div className="p-12 text-center">
                <div className="h-11 w-11 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-3">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-medium text-zinc-900">
                  Sin facturación registrada en este periodo
                </h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                  No se encontraron facturas emitidas o pagadas entre {dateRange.from} y{' '}
                  {dateRange.to}. Prueba seleccionando &ldquo;Año a la Fecha (YTD)&rdquo; o emite una nueva factura.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/80 border-b border-zinc-200/70 text-zinc-500 text-[11px] font-medium uppercase tracking-wider">
                      <th className="py-3 px-5">Nombre del Cliente</th>
                      <th className="py-3 px-4">{isColombia ? 'NIT / ID' : 'EIN / Tax ID'}</th>
                      <th className="py-3 px-4 text-center">Cant. Facturas</th>
                      <th className="py-3 px-4 text-right">Monto Total Facturado</th>
                      <th className="py-3 px-4 text-right">Monto Pagado</th>
                      <th className="py-3 px-5 text-right">Saldo Pendiente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {customerRevenueRows.map((row) => {
                      const paidPct =
                        row.totalBilled > 0
                          ? Math.round((row.totalPaid / row.totalBilled) * 100)
                          : 0;

                      return (
                        <tr
                          key={row.customerId}
                          className="hover:bg-zinc-50/70 transition-colors"
                        >
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-zinc-900">{row.customerName}</div>
                            <div className="text-[11px] text-zinc-500">{row.email}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono-numbers text-zinc-600">
                            {row.taxId}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 font-mono-numbers font-semibold text-xs border border-zinc-200/60">
                              {row.invoiceCount}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono-numbers font-semibold text-zinc-900">
                            {formatCurrency(row.totalBilled, currency)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono-numbers">
                            <div className="font-semibold text-emerald-700">
                              {formatCurrency(row.totalPaid, currency)}
                            </div>
                            <div className="text-[10px] text-zinc-400">{paidPct}% recaudado</div>
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono-numbers">
                            <span
                              className={`font-semibold ${
                                row.outstandingBalance > 0
                                  ? 'text-amber-700'
                                  : 'text-zinc-400'
                              }`}
                            >
                              {formatCurrency(row.outstandingBalance, currency)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-50/90 border-t-2 border-zinc-200 font-semibold text-zinc-900">
                      <td className="py-3.5 px-5" colSpan={2}>
                        TOTAL CONSOLIDADO ({customerRevenueRows.length}{' '}
                        {customerRevenueRows.length === 1 ? 'cliente' : 'clientes'})
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono-numbers">
                        {customerReportTotals.invoiceCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers text-zinc-900">
                        {formatCurrency(customerReportTotals.totalBilled, currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers text-emerald-700">
                        {formatCurrency(customerReportTotals.totalPaid, currency)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono-numbers text-amber-700">
                        {formatCurrency(customerReportTotals.outstandingBalance, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )}

        {/* =====================================================================
            SECTION 2: RESUMEN FISCAL Y DE IMPUESTOS (TAX SUMMARY REPORT)
        ===================================================================== */}
        {(reportSection === 'all' || reportSection === 'taxes') && (
          <section className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-zinc-100 text-zinc-800 border border-zinc-200/60 mt-0.5">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      2. Resumen Fiscal y de Impuestos (Tax Summary Report)
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                      {isColombia ? '🇨🇴 Régimen Tributario DIAN' : '🇺🇸 IRS & State Sales Tax'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {isColombia
                      ? 'Agregación automática desde JSONB tax_breakdown: Base gravable, IVA generado (19%), Retención en la Fuente y ReteICA.'
                      : 'Agregación automática desde JSONB tax_breakdown: Gross Taxable Sales y Sales Tax recaudado por estado / jurisdicción.'}
                  </p>
                </div>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleExportTaxCSV}
                  disabled={loading || periodInvoices.length === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isColombia ? 'Exportar Anexo DIAN (CSV)' : 'Exportar Tax Summary (CSV)'}
                  </span>
                </button>
              )}
            </div>

            {/* Fiscal KPI Breakdown Cards */}
            <div className="p-5 space-y-6">
              {isColombia ? (
                /* COLOMBIA (CO) TAX SUMMARY CARDS */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Base Gravable (Subtotal) */}
                  <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80">
                    <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      Base Gravable (Subtotal)
                    </div>
                    <div className="mt-2 text-xl font-bold font-mono-numbers text-zinc-900">
                      {formatCurrency(taxSummary.subtotalSum, currency)}
                    </div>
                    <div className="mt-1.5 text-[11px] text-zinc-500 font-mono-numbers">
                      Sobre {periodInvoices.length} facturas del periodo
                    </div>
                  </div>

                  {/* Card 2: Total IVA Cobrado */}
                  <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                        Total IVA Cobrado (+)
                      </span>
                      <span className="text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-zinc-200/70 text-zinc-700 font-semibold">
                        IVA 19%
                      </span>
                    </div>
                    <div className="mt-2 text-xl font-bold font-mono-numbers text-zinc-900">
                      {formatCurrency(taxSummary.ivaTotalSum, currency)}
                    </div>
                    <div className="mt-1.5 text-[11px] text-zinc-500">
                      Impuesto sobre las ventas generado
                    </div>
                  </div>

                  {/* Card 3: Total Retefuente Retenida */}
                  <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-200/70">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-amber-900 uppercase tracking-wider">
                        Total Retefuente (-)
                      </span>
                      <span className="text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                        {taxSummary.retefuenteCount} fact.
                      </span>
                    </div>
                    <div className="mt-2 text-xl font-bold font-mono-numbers text-amber-800">
                      - {formatCurrency(taxSummary.retefuenteSum, currency)}
                    </div>
                    <div className="mt-1.5 text-[11px] text-amber-700">
                      Anticipo de renta practicado por clientes
                    </div>
                  </div>

                  {/* Card 4: Total ReteICA */}
                  <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-200/70">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-amber-900 uppercase tracking-wider">
                        Total ReteICA (-)
                      </span>
                      <span className="text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                        {taxSummary.reteicaCount} fact.
                      </span>
                    </div>
                    <div className="mt-2 text-xl font-bold font-mono-numbers text-amber-800">
                      - {formatCurrency(taxSummary.reteicaSum, currency)}
                    </div>
                    <div className="mt-1.5 text-[11px] text-amber-700">
                      Retención Industria y Comercio municipal
                    </div>
                  </div>
                </div>
              ) : (
                /* UNITED STATES (US) TAX SUMMARY CARDS */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Card 1: Gross Taxable Sales */}
                  <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80">
                    <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      Gross Taxable Sales (Subtotal)
                    </div>
                    <div className="mt-2 text-xl font-bold font-mono-numbers text-zinc-900">
                      {formatCurrency(taxSummary.subtotalSum, currency)}
                    </div>
                    <div className="mt-1.5 text-[11px] text-zinc-500 font-mono-numbers">
                      Across {periodInvoices.length} issued/paid invoices
                    </div>
                  </div>

                  {/* Card 2: Total Sales Tax Collected */}
                  <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                        Total Sales Tax Recaudado
                      </span>
                      <span className="text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-zinc-200/70 text-zinc-700 font-semibold">
                        State & County
                      </span>
                    </div>
                    <div className="mt-2 text-xl font-bold font-mono-numbers text-zinc-900">
                      {formatCurrency(taxSummary.usSalesTaxSum, currency)}
                    </div>
                    <div className="mt-1.5 text-[11px] text-zinc-500">
                      Impuesto estatal/condal recaudado en facturas
                    </div>
                  </div>

                  {/* Card 3: Net Total Invoiced */}
                  <div className="p-4 rounded-xl bg-zinc-900 text-white">
                    <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                      Total Facturado (Gross + Tax)
                    </div>
                    <div className="mt-2 text-xl font-bold font-mono-numbers text-white">
                      {formatCurrency(taxSummary.netTotalSum, currency)}
                    </div>
                    <div className="mt-1.5 text-[11px] text-zinc-400 font-mono-numbers">
                      Tasa efectiva promedio:{' '}
                      {taxSummary.subtotalSum > 0
                        ? `${((taxSummary.usSalesTaxSum / taxSummary.subtotalSum) * 100).toFixed(2)}%`
                        : '0.00%'}
                    </div>
                  </div>
                </div>
              )}

              {/* Equation Summary Bar for Colombia */}
              {isColombia && (
                <div className="p-4 rounded-xl bg-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">
                      Ecuación de Liquidación Mensual / Periodo (DIAN)
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 font-mono-numbers">
                      Subtotal ({formatCurrency(taxSummary.subtotalSum, currency)}) + IVA (
                      {formatCurrency(taxSummary.ivaTotalSum, currency)}) − Retenciones (
                      {formatCurrency(taxSummary.totalRetentions, currency)})
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Neto Total Facturado
                    </div>
                    <div className="text-lg font-bold font-mono-numbers text-white">
                      {formatCurrency(taxSummary.netTotalSum, currency)}
                    </div>
                  </div>
                </div>
              )}

              {/* US State/County Breakdown Table (When company is US) */}
              {!isColombia && taxSummary.usJurisdictions.length > 0 && (
                <div className="border border-zinc-200/80 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200/70 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-900">
                      Sales Tax Recaudado por Estado / Condado (State & Local Breakdown)
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono-numbers">
                      {taxSummary.usJurisdictions.length} jurisdicciones activas
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-50/50 border-b border-zinc-100 text-zinc-500 text-[11px] font-medium">
                          <th className="py-2.5 px-4">Estado / Condado / Jurisdicción</th>
                          <th className="py-2.5 px-3 text-center">Tasa Aplicada</th>
                          <th className="py-2.5 px-3 text-center">Facturas</th>
                          <th className="py-2.5 px-4 text-right">Ventas Gravables (Subtotal)</th>
                          <th className="py-2.5 px-4 text-right">Sales Tax Recaudado</th>
                          <th className="py-2.5 px-4 text-right">Total Facturado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {taxSummary.usJurisdictions.map((j, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50/60">
                            <td className="py-3 px-4 font-medium text-zinc-900">
                              {j.jurisdiction}
                            </td>
                            <td className="py-3 px-3 text-center font-mono-numbers text-zinc-600">
                              {j.rateLabel}
                            </td>
                            <td className="py-3 px-3 text-center font-mono-numbers text-zinc-600">
                              {j.invoiceCount}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-numbers text-zinc-700">
                              {formatCurrency(j.taxableSubtotal, currency)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-numbers font-semibold text-zinc-900">
                              {formatCurrency(j.salesTaxCollected, currency)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-numbers text-zinc-800">
                              {formatCurrency(j.grossTotal, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detailed Invoice-by-Invoice Tax Audit Table (Only for ADMIN) */}
              {isAdmin && periodInvoices.length > 0 && (
                <div className="border border-zinc-200/80 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200/70 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-zinc-900">
                        Anexo Contable Detallado por Factura (Auditoría{' '}
                        {isColombia ? 'DIAN' : 'IRS'})
                      </span>
                      <p className="text-[11px] text-zinc-500">
                        Desglose individual extraído de <code className="text-[10px]">tax_breakdown</code> para conciliación mensual.
                      </p>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-200/70 text-zinc-700">
                      Vista exclusiva ADMIN
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-50/60 border-b border-zinc-100 text-zinc-500 text-[11px] font-medium">
                          <th className="py-2.5 px-4">N° Factura</th>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-4">Cliente</th>
                          <th className="py-2.5 px-4 text-right">Subtotal</th>
                          {isColombia ? (
                            <>
                              <th className="py-2.5 px-3 text-right">IVA (+)</th>
                              <th className="py-2.5 px-3 text-right">Retefuente (-)</th>
                              <th className="py-2.5 px-3 text-right">ReteICA (-)</th>
                            </>
                          ) : (
                            <>
                              <th className="py-2.5 px-3 text-center">Tasa (%)</th>
                              <th className="py-2.5 px-3 text-right">Sales Tax (+)</th>
                            </>
                          )}
                          <th className="py-2.5 px-4 text-right">Total Neto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {periodInvoices.map((inv) => {
                          const cust = inv.customer as Customer | undefined;
                          const tb: TaxBreakdown = (inv.tax_breakdown as TaxBreakdown) || {};
                          const sub = Number(inv.subtotal) || 0;
                          const iva =
                            tb.iva_total !== undefined
                              ? Number(tb.iva_total)
                              : Math.max(0, Number(inv.tax_total) || 0);
                          const rf = Number(tb.retefuente_amount) || 0;
                          const rica = Number(tb.reteica_amount) || 0;
                          const salesTax =
                            (Number(tb.sales_tax_amount) || 0) +
                              (Number(tb.line_taxes_total) || 0) ||
                            Math.max(0, Number(inv.tax_total) || 0);
                          const usRate =
                            tb.sales_tax_rate !== undefined
                              ? Number(tb.sales_tax_rate)
                              : sub > 0
                              ? Number(((salesTax / sub) * 100).toFixed(2))
                              : 0;

                          return (
                            <tr key={inv.id} className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-mono-numbers font-semibold text-zinc-900">
                                <Link
                                  href={`/invoices/${inv.id}`}
                                  className="hover:text-indigo-600 transition-colors"
                                >
                                  {inv.invoice_number}
                                </Link>
                              </td>
                              <td className="py-2.5 px-3 font-mono-numbers text-zinc-500">
                                {formatDate(inv.issue_date)}
                              </td>
                              <td className="py-2.5 px-4 text-zinc-700 truncate max-w-[180px]">
                                {cust?.name || 'Cliente sin asignar'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-numbers text-zinc-700">
                                {formatCurrency(sub, currency)}
                              </td>
                              {isColombia ? (
                                <>
                                  <td className="py-2.5 px-3 text-right font-mono-numbers text-zinc-800">
                                    {formatCurrency(iva, currency)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono-numbers text-amber-700">
                                    {rf > 0 ? `- ${formatCurrency(rf, currency)}` : '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono-numbers text-amber-700">
                                    {rica > 0 ? `- ${formatCurrency(rica, currency)}` : '—'}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-2.5 px-3 text-center font-mono-numbers text-zinc-600">
                                    {usRate}%
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono-numbers text-zinc-800">
                                    {formatCurrency(salesTax, currency)}
                                  </td>
                                </>
                              )}
                              <td className="py-2.5 px-4 text-right font-mono-numbers font-semibold text-zinc-900">
                                {formatCurrency(inv.total, currency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
