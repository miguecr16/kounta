import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InvoiceStatus } from '@/types/database';

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
