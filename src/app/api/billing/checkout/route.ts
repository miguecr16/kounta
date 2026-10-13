import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SUBSCRIPTION_PLANS } from '@/lib/billing/subscription-service';
import { SubscriptionStatus, SubscriptionTier } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || '');
    const rawTier = String(body.targetTier || 'starter').toLowerCase();
    const targetStatus: SubscriptionStatus = body.targetStatus || 'active';

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'El identificador de la empresa (companyId) es requerido.' },
        { status: 400 }
      );
    }

    const targetTier: SubscriptionTier =
      rawTier === 'growth' || rawTier === 'enterprise' || rawTier === 'starter'
        ? (rawTier as SubscriptionTier)
        : 'starter';

    const plan = SUBSCRIPTION_PLANS[targetTier];
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + 30);
    const currentPeriodEnd = renewalDate.toISOString();

    const supabase = await createClient();

    const { error } = await supabase
      .from('companies')
      .update({
        subscription_tier: targetTier,
        subscription_status: targetStatus,
        current_period_end: currentPeriodEnd,
        max_invoices_per_month: plan.maxInvoicesPerMonth,
        max_members: plan.maxMembers,
      })
      .eq('id', companyId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      checkoutSessionId: `cs_kounta_${targetTier}_${Date.now()}`,
      customerPortalUrl: `/settings/billing?session=cs_kounta_${targetTier}`,
      tier: targetTier,
      status: targetStatus,
      max_invoices_per_month: plan.maxInvoicesPerMonth,
      max_members: plan.maxMembers,
      current_period_end: currentPeriodEnd,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Error al procesar la sesión de suscripción.',
      },
      { status: 500 }
    );
  }
}
