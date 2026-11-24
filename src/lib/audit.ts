import { createClient } from '@/lib/supabase/client';
import { AuditAction, AuditEntityType, AuditLog } from '@/types/database';
import { formatCurrency } from '@/lib/utils';

export interface LogAuditParams {
  companyId: string;
  action: AuditAction | string;
  entityType: AuditEntityType | string;
  entityId?: string | null;
  details?: Record<string, any>;
  userId?: string | null;
}

/**
 * Silently records an audit event in the `audit_logs` table.
 * Designed to never throw or break the calling operation.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    const supabase = createClient();

    let actorId = params.userId;
    if (!actorId) {
      const { data: authData } = await supabase.auth.getUser();
      actorId = authData.user?.id || null;
    }

    const payload = {
      company_id: params.companyId,
      user_id: actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      details: params.details || {},
    };

    const { error } = await supabase.from('audit_logs').insert(payload);
    if (error) {
      console.warn('[Audit] Could not insert audit log:', error.message);
    }
  } catch (err) {
    console.warn('[Audit] Exception in logAuditEvent:', err);
  }
}

/**
 * Returns a styled badge config for each audit action
 */
export function getAuditActionBadge(action: string): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (action) {
    case 'INVOICE_CREATED':
      return {
        label: 'Factura Creada',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40',
        dotClass: 'bg-blue-500',
      };
    case 'INVOICE_PAID':
      return {
        label: 'Factura Pagada',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40',
        dotClass: 'bg-emerald-500',
      };
    case 'INVOICE_VOIDED':
      return {
        label: 'Factura Anulada',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/40',
        dotClass: 'bg-rose-500',
      };
    case 'EXPENSE_CREATED':
      return {
        label: 'Gasto Registrado',
        badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
        dotClass: 'bg-zinc-500',
      };
    case 'EXPENSE_DELETED':
      return {
        label: 'Gasto Eliminado',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/40',
        dotClass: 'bg-rose-500',
      };
    case 'MEMBER_INVITED':
      return {
        label: 'Miembro Invitado',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800/40',
        dotClass: 'bg-indigo-500',
      };
    case 'ROLE_CHANGED':
      return {
        label: 'Rol Modificado',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40',
        dotClass: 'bg-amber-500',
      };
    case 'TRANSACTION_MATCHED':
      return {
        label: 'Conciliación Bancaria',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40',
        dotClass: 'bg-emerald-500',
      };
    default:
      return {
        label: action.replace(/_/g, ' '),
        badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        dotClass: 'bg-zinc-400',
      };
  }
}

/**
 * Produces a clear, executive-friendly description of the audited event
 */
export function getAuditReadableDescription(log: AuditLog): string {
  const d = log.details || {};

  switch (log.action) {
    case 'INVOICE_CREATED': {
      const invNum = d.invoice_number || 'Factura';
      const totalStr = d.total != null ? formatCurrency(d.total, d.currency || 'COP') : '';
      const customerStr = d.customer_name ? ` para ${d.customer_name}` : '';
      const statusStr = d.status === 'ISSUED' ? 'emitida' : 'en borrador';
      return `Creó la factura ${invNum} (${statusStr})${customerStr}${totalStr ? ` por ${totalStr}` : ''}.`;
    }
    case 'INVOICE_PAID': {
      const invNum = d.invoice_number || 'Factura';
      const totalStr = d.total != null ? formatCurrency(d.total, d.currency || 'COP') : '';
      const methodStr = d.method ? ` vía ${d.method}` : '';
      return `Marcó la factura ${invNum} como Pagada${totalStr ? ` por ${totalStr}` : ''}${methodStr}.`;
    }
    case 'INVOICE_VOIDED': {
      const invNum = d.invoice_number || 'Factura';
      const reasonStr = d.reason ? ` Motivo: "${d.reason}"` : '';
      return `Anuló la factura ${invNum}.${reasonStr}`;
    }
    case 'EXPENSE_CREATED': {
      const vendor = d.vendor_name || 'Proveedor';
      const totalStr = d.amount != null ? formatCurrency(d.amount, d.currency || 'COP') : '';
      const cat = d.category ? ` (${d.category})` : '';
      return `Registró gasto a ${vendor}${cat}${totalStr ? ` por valor de ${totalStr}` : ''}.`;
    }
    case 'EXPENSE_DELETED': {
      const vendor = d.vendor_name || 'Proveedor';
      const totalStr = d.amount != null ? formatCurrency(d.amount, d.currency || 'COP') : '';
      return `Eliminó el gasto registrado para ${vendor}${totalStr ? ` (${totalStr})` : ''}.`;
    }
    case 'MEMBER_INVITED': {
      const email = d.invited_email || d.email || 'usuario';
      const role = d.role || 'WORKER';
      return `Envió invitación de acceso a ${email} con rol ${role}.`;
    }
    case 'ROLE_CHANGED': {
      const targetUser = d.target_user_name || d.target_email || 'miembro';
      const oldRole = d.old_role || 'anterior';
      const newRole = d.new_role || 'nuevo';
      return `Actualizó el rol de ${targetUser}: ${oldRole} → ${newRole}.`;
    }
    case 'TRANSACTION_MATCHED': {
      const desc = d.description || 'Movimiento bancario';
      const amountStr = d.amount != null ? formatCurrency(Math.abs(d.amount), d.currency || 'COP') : '';
      const matchTarget = d.matched_invoice_number
        ? `con la Factura ${d.matched_invoice_number}`
        : d.matched_vendor
        ? `con gasto de ${d.matched_vendor}`
        : 'en contabilidad';
      return `Concilió movimiento "${desc}" (${amountStr}) ${matchTarget}.`;
    }
    default: {
      if (d.message) return d.message;
      return `Ejecutó la acción ${log.action} sobre ${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}.`;
    }
  }
}
