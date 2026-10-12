'use client';

import { useAuth } from '@/context/auth-context';
import { CompanyRole } from '@/types/database';

export interface PermissionsState {
  role: CompanyRole | null;
  isAdmin: boolean;
  isWorker: boolean;
  canManageSettings: boolean;
  canManageTeam: boolean;
  canVoidInvoices: boolean;
  canManageBilling: boolean;
  canViewReports: boolean;
  canViewFullTaxReport: boolean;
  isLoading: boolean;
}

export function useCurrentRole(): CompanyRole | null {
  const { activeRole } = useAuth();
  return activeRole;
}

export function usePermissions(): PermissionsState {
  const { activeRole, isLoading } = useAuth();

  const isAdmin = activeRole === 'ADMIN';
  const isWorker = activeRole === 'WORKER';

  return {
    role: activeRole,
    isAdmin,
    isWorker,
    canManageSettings: isAdmin,
    canManageTeam: isAdmin,
    canVoidInvoices: isAdmin,
    canManageBilling: isAdmin,
    canViewReports: isAdmin || isWorker,
    canViewFullTaxReport: isAdmin,
    isLoading,
  };
}
