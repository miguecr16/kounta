import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ExpenseCategory, InvoiceStatus } from '@/types/database';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'COP'): string {
  const isCop = currency.toUpperCase() === 'COP';

  return new Intl.NumberFormat(isCop ? 'es-CO' : 'en-US', {
    style: 'currency',
    currency: isCop ? 'COP' : 'USD',
    minimumFractionDigits: isCop ? 0 : 2,
    maximumFractionDigits: isCop ? 0 : 2,
  }).format(amount);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function getStatusBadge(status: InvoiceStatus) {
  switch (status) {
    case 'PAID':
      return {
        label: 'Pagada',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40',
        dot: 'bg-emerald-500',
      };
    case 'ISSUED':
      return {
        label: 'Emitida',
        bg: 'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40',
        dot: 'bg-blue-500',
      };
    case 'PARTIAL_PAID':
      return {
        label: 'Pago Parcial',
        bg: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40',
        dot: 'bg-amber-500',
      };
    case 'DRAFT':
      return {
        label: 'Borrador',
        bg: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
        dot: 'bg-zinc-400',
      };
    case 'VOID':
      return {
        label: 'Anulada',
        bg: 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40',
        dot: 'bg-rose-500',
      };
    default:
      return {
        label: status,
        bg: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        dot: 'bg-zinc-400',
      };
  }
}

export const EXPENSE_CATEGORY_OPTIONS: {
  value: ExpenseCategory;
  label: string;
  badgeClass: string;
}[] = [
  {
    value: 'PAYROLL',
    label: 'Nómina',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200/90',
  },
  {
    value: 'RENT',
    label: 'Arriendo',
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-200/90',
  },
  {
    value: 'UTILITIES',
    label: 'Servicios Públicos',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200/70',
  },
  {
    value: 'SOFTWARE',
    label: 'Software / SaaS',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200/70',
  },
  {
    value: 'MARKETING',
    label: 'Marketing',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/70',
  },
  {
    value: 'OFFICE_SUPPLIES',
    label: 'Suministros de Oficina',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200/90',
  },
  {
    value: 'TAXES',
    label: 'Impuestos',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/70',
  },
  {
    value: 'OTHER',
    label: 'Otros',
    badgeClass: 'bg-zinc-100 text-zinc-600 border-zinc-200/80',
  },
];

export function getExpenseCategoryBadge(category?: ExpenseCategory | string | null) {
  const found = EXPENSE_CATEGORY_OPTIONS.find((c) => c.value === category);
  if (found) {
    return {
      label: found.label,
      badgeClass: found.badgeClass,
    };
  }
  return {
    label: category || 'Otros',
    badgeClass: 'bg-zinc-100 text-zinc-600 border-zinc-200/80',
  };
}
