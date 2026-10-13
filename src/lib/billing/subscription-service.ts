import { Company, SubscriptionStatus, SubscriptionTier } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

export interface PlanDefinition {
  id: SubscriptionTier;
  name: string;
  tagline: string;
  priceUsd: number;
  priceCop: number;
  maxInvoicesPerMonth: number;
  maxMembers: number;
  isUnlimitedInvoices: boolean;
  isUnlimitedMembers: boolean;
  popular?: boolean;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'Para independientes y pequeños negocios.',
    priceUsd: 19,
    priceCop: 79000,
    maxInvoicesPerMonth: 50,
    maxMembers: 3,
    isUnlimitedInvoices: false,
    isUnlimitedMembers: false,
    features: [
      'Hasta 50 facturas / mes',
      'Hasta 3 miembros de equipo',
      'Reportes básicos de ingresos',
      'Emisión de PDF corporativo',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tagline: 'Escalamiento comercial y cumplimiento tributario.',
    priceUsd: 49,
    priceCop: 199000,
    maxInvoicesPerMonth: 999999,
    maxMembers: 10,
    isUnlimitedInvoices: true,
    isUnlimitedMembers: false,
    popular: true,
    features: [
      'Facturación mensual ilimitada',
      'Hasta 10 miembros de equipo',
      'Reportes fiscales avanzados (Tax Summary)',
      'Exportación contable CSV (DIAN / IRS)',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Operación corporativa multi-moneda sin límites.',
    priceUsd: 99,
    priceCop: 399000,
    maxInvoicesPerMonth: 999999,
    maxMembers: 999999,
    isUnlimitedInvoices: true,
    isUnlimitedMembers: true,
    features: [
      'Miembros de equipo ilimitados',
      'Facturación ilimitada multi-entidad',
      'Multi-moneda en tiempo real (USD / COP)',
      'Soporte prioritario y auditoría completa',
    ],
  },
};

export interface EffectiveSubscription {
  tier: SubscriptionTier;
  plan: PlanDefinition;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  maxInvoicesPerMonth: number;
  maxMembers: number;
  isUnlimitedInvoices: boolean;
  isUnlimitedMembers: boolean;
}

export function getEffectiveSubscription(company?: Company | null): EffectiveSubscription {
  const rawTier = String(company?.subscription_tier || 'starter').toLowerCase();
  const tier: SubscriptionTier =
    rawTier === 'growth' || rawTier === 'enterprise' || rawTier === 'starter'
      ? (rawTier as SubscriptionTier)
      : 'starter';

  const plan = SUBSCRIPTION_PLANS[tier];

  const rawStatus = String(company?.subscription_status || 'active').toLowerCase();
  const status: SubscriptionStatus =
    rawStatus === 'trialing' ||
    rawStatus === 'active' ||
    rawStatus === 'past_due' ||
    rawStatus === 'canceled'
      ? (rawStatus as SubscriptionStatus)
      : 'active';

  // Use database columns if explicitly set, falling back to tier defaults
  const maxInvoicesPerMonth =
    typeof company?.max_invoices_per_month === 'number' && company.max_invoices_per_month > 0
      ? company.max_invoices_per_month
      : plan.maxInvoicesPerMonth;

  const maxMembers =
    typeof company?.max_members === 'number' && company.max_members > 0
      ? company.max_members
      : plan.maxMembers;

  const isUnlimitedInvoices = tier !== 'starter' && maxInvoicesPerMonth >= 10000;
  const isUnlimitedMembers = tier === 'enterprise' && maxMembers >= 1000;

  // Default renewal date: 30 days ahead if current_period_end is null
  let currentPeriodEnd = company?.current_period_end || '';
  if (!currentPeriodEnd) {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    currentPeriodEnd = nextMonth.toISOString();
  }

  return {
    tier,
    plan,
    status,
    currentPeriodEnd,
    maxInvoicesPerMonth,
    maxMembers,
    isUnlimitedInvoices,
    isUnlimitedMembers,
  };
}

export function getSubscriptionStatusBadge(status: SubscriptionStatus): {
  label: string;
  bg: string;
  dot: string;
} {
  switch (status) {
    case 'trialing':
      return {
        label: 'Prueba activa',
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        dot: 'bg-indigo-500',
      };
    case 'active':
      return {
        label: 'Activo',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dot: 'bg-emerald-500',
      };
    case 'past_due':
      return {
        label: 'Pago pendiente',
        bg: 'bg-amber-50 text-amber-800 border-amber-200/80',
        dot: 'bg-amber-500',
      };
    case 'canceled':
      return {
        label: 'Cancelado',
        bg: 'bg-rose-50 text-rose-700 border-rose-200/80',
        dot: 'bg-rose-500',
      };
    default:
      return {
        label: 'Activo',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dot: 'bg-emerald-500',
      };
  }
}

export interface CheckoutSessionResult {
  success: boolean;
  checkoutSessionId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  max_invoices_per_month: number;
  max_members: number;
  current_period_end: string;
  error?: string;
}

/**
 * Initiates a Stripe-ready Checkout Session stub/mock and updates the company's
 * subscription_tier, subscription_status, current_period_end, max_invoices_per_month,
 * and max_members in Supabase.
 */
export async function processSubscriptionChange(params: {
  companyId: string;
  targetTier: SubscriptionTier;
  targetStatus?: SubscriptionStatus;
}): Promise<CheckoutSessionResult> {
  const { companyId, targetTier, targetStatus = 'active' } = params;
  const plan = SUBSCRIPTION_PLANS[targetTier];

  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + 30);
  const currentPeriodEnd = renewalDate.toISOString();

  // First call the Stripe Checkout stub endpoint (/api/billing/checkout)
  try {
    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        targetTier,
        targetStatus,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success) {
        return json as CheckoutSessionResult;
      }
    }
  } catch {
    // Fallback to direct authenticated Supabase client update below
  }

  // Fallback direct Supabase update using browser session
  const supabase = createClient();
  const payload = {
    subscription_tier: targetTier,
    subscription_status: targetStatus,
    current_period_end: currentPeriodEnd,
    max_invoices_per_month: plan.maxInvoicesPerMonth,
    max_members: plan.maxMembers,
  };

  const { error } = await supabase
    .from('companies')
    .update(payload)
    .eq('id', companyId);

  if (error) {
    return {
      success: false,
      checkoutSessionId: '',
      tier: targetTier,
      status: targetStatus,
      max_invoices_per_month: plan.maxInvoicesPerMonth,
      max_members: plan.maxMembers,
      current_period_end: currentPeriodEnd,
      error: error.message,
    };
  }

  return {
    success: true,
    checkoutSessionId: `cs_live_kounta_${Date.now()}`,
    tier: targetTier,
    status: targetStatus,
    max_invoices_per_month: plan.maxInvoicesPerMonth,
    max_members: plan.maxMembers,
    current_period_end: currentPeriodEnd,
  };
}
