'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { createClient } from '@/lib/supabase/client';
import { CompanyRole, CountryCode } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Building2,
  Users,
  CreditCard,
  Shield,
  UserPlus,
  Loader2,
  Check,
  AlertTriangle,
  Trash2,
  Copy,
  Mail,
  Lock,
  CheckCircle2,
  Sparkles,
  Receipt,
  Globe2,
  Coins,
  X,
  Link2
} from 'lucide-react';
import { Toast, ToastMessage } from '@/components/ui/toast';

export type SettingsTab = 'general' | 'team' | 'billing';

interface PendingInvitation {
  id: string;
  email: string;
  role: CompanyRole;
  created_at: string;
  inviteUrl: string;
}

interface SettingsViewProps {
  initialTab?: SettingsTab;
}

export function SettingsView({ initialTab = 'general' }: SettingsViewProps) {
  const { activeCompany, user, refreshTenantData } = useAuth();
  const { isAdmin, isLoading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Sync tab if prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // 1. RBAC Guard: WORKER cannot access /settings; redirect to /dashboard with toast
  useEffect(() => {
    if (!permissionsLoading && !isAdmin) {
      router.replace('/dashboard?error=access_denied');
    }
  }, [permissionsLoading, isAdmin, router]);

  // ==========================================
  // TAB 1 STATE: PERFIL DE EMPRESA
  // ==========================================
  const [companyName, setCompanyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState<CountryCode>('CO');
  const [taxId, setTaxId] = useState('');
  const [baseCurrency, setBaseCurrency] = useState<'COP' | 'USD'>('COP');
  const [invoicesCount, setInvoicesCount] = useState<number>(0);
  const [monthlyInvoicesCount, setMonthlyInvoicesCount] = useState<number>(0);
  const [savingGeneral, setSavingGeneral] = useState(false);

  // ==========================================
  // TAB 2 STATE: EQUIPO Y PERMISOS
  // ==========================================
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  // Invite Modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CompanyRole>('WORKER');
  const [inviting, setInviting] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);

  // Revoke Confirmation Modal state
  const [memberToRevoke, setMemberToRevoke] = useState<any | null>(null);
  const [revoking, setRevoking] = useState(false);

  // ==========================================
  // TAB 3 STATE: SUSCRIPCIÓN Y FACTURACIÓN
  // ==========================================
  const [selectedPlan, setSelectedPlan] = useState<'STARTER' | 'GROWTH' | 'ENTERPRISE'>('GROWTH');

  // Populate initial company form values
  useEffect(() => {
    if (activeCompany) {
      setCompanyName(activeCompany.name || '');
      setLegalName(activeCompany.legal_name || '');
      setCountry(activeCompany.country || 'CO');
      setTaxId(activeCompany.tax_id || '');
      setBaseCurrency(activeCompany.base_currency || 'COP');

      // Load stored pending invitations for this company
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(`kounta_invites_${activeCompany.id}`);
        if (raw) {
          try {
            setPendingInvitations(JSON.parse(raw));
          } catch {
            setPendingInvitations([]);
          }
        } else {
          setPendingInvitations([]);
        }
      }
    }
  }, [activeCompany]);

  // Fetch company invoice counts and team members
  const loadSettingsData = useCallback(async () => {
    if (!activeCompany || !isAdmin) return;
    setLoadingMembers(true);

    try {
      // 1. Check total invoices count & current month invoices count
      const { data: invRows } = await supabase
        .from('invoices')
        .select('id, issue_date, created_at')
        .eq('company_id', activeCompany.id);

      if (invRows) {
        setInvoicesCount(invRows.length);
        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(
          now.getMonth() + 1
        ).padStart(2, '0')}`;
        const monthly = invRows.filter(
          (r) =>
            (r.issue_date && r.issue_date.startsWith(currentMonthPrefix)) ||
            (r.created_at && r.created_at.startsWith(currentMonthPrefix))
        ).length;
        setMonthlyInvoicesCount(monthly);
      }

      // 2. Fetch company members joined with users
      const { data: memberRows, error: memError } = await supabase
        .from('company_members')
        .select(`
          id,
          user_id,
          company_id,
          role,
          created_at,
          user:user_id (
            id,
            email,
            full_name
          )
        `)
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: true });

      if (!memError && memberRows) {
        setMembers(memberRows);
      }
    } catch (err) {
      console.error('Error loading settings data:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [activeCompany, isAdmin, supabase]);

  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  const handleTabSwitch = (tab: SettingsTab) => {
    setActiveTab(tab);
    router.push(`/settings/${tab}`, { scroll: false });
  };

  // ==========================================
  // HANDLER TAB 1: SAVE COMPANY PROFILE
  // ==========================================
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;

    if (!companyName.trim() || !legalName.trim() || !taxId.trim()) {
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Campos incompletos',
        description: 'Nombre comercial, razón social e identificación fiscal son obligatorios.',
      });
      return;
    }

    setSavingGeneral(true);
    try {
      const updatePayload: Record<string, any> = {
        name: companyName.trim(),
        legal_name: legalName.trim(),
        country,
        tax_id: taxId.trim(),
      };

      // Only allow updating base_currency if no invoices have been issued yet
      if (invoicesCount === 0) {
        updatePayload.base_currency = baseCurrency;
      }

      const { error } = await supabase
        .from('companies')
        .update(updatePayload)
        .eq('id', activeCompany.id);

      if (error) throw error;

      await refreshTenantData();
      setToast({
        id: String(Date.now()),
        type: 'success',
        title: 'Perfil de empresa actualizado',
        description: 'Los datos legales y fiscales se guardaron correctamente.',
      });
    } catch (err: any) {
      console.error('Error updating company:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Error al guardar cambios',
        description: err.message || 'No se pudo actualizar la configuración de la empresa.',
      });
    } finally {
      setSavingGeneral(false);
    }
  };

  // ==========================================
  // HANDLERS TAB 2: TEAM & RBAC
  // ==========================================
  const adminCount = members.filter((m) => m.role === 'ADMIN').length;

  const handleRoleChange = async (member: any, newRole: CompanyRole) => {
    if (!activeCompany) return;

    // Prevent self-downgrade if sole ADMIN
    const isSelf = member.user_id === user?.id;
    if (isSelf && member.role === 'ADMIN' && newRole !== 'ADMIN' && adminCount <= 1) {
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Acción no permitida',
        description: 'No puedes degradar tu propio rol porque eres el único ADMIN de la empresa.',
      });
      return;
    }

    setUpdatingMemberId(member.id);
    try {
      const { error } = await supabase
        .from('company_members')
        .update({ role: newRole })
        .eq('id', member.id)
        .eq('company_id', activeCompany.id);

      if (error) throw error;

      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      );

      setToast({
        id: String(Date.now()),
        type: 'success',
        title: 'Rol actualizado',
        description: `El permiso del miembro fue cambiado a ${newRole}.`,
      });
    } catch (err: any) {
      console.error('Error updating role:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Error al cambiar rol',
        description: err.message || 'No fue posible actualizar el rol.',
      });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!memberToRevoke || !activeCompany) return;

    const isSelf = memberToRevoke.user_id === user?.id;
    if (isSelf && memberToRevoke.role === 'ADMIN' && adminCount <= 1) {
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Acción bloqueada',
        description: 'No puedes revocar tu propio acceso siendo el único administrador.',
      });
      setMemberToRevoke(null);
      return;
    }

    setRevoking(true);
    try {
      const { error } = await supabase
        .from('company_members')
        .delete()
        .eq('id', memberToRevoke.id)
        .eq('company_id', activeCompany.id);

      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.id !== memberToRevoke.id));
      setToast({
        id: String(Date.now()),
        type: 'success',
        title: 'Acceso revocado',
        description: 'El usuario ya no tiene acceso a esta empresa.',
      });
      setMemberToRevoke(null);
    } catch (err: any) {
      console.error('Error revoking member:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Error al revocar acceso',
        description: err.message || 'No se pudo eliminar el miembro.',
      });
    } finally {
      setRevoking(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;

    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail) return;

    setInviting(true);
    setGeneratedInviteLink(null);

    try {
      // 1. Check if user already exists in public.users
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email, full_name')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (existingUser) {
        // Check if already in company_members
        const alreadyInTeam = members.some((m) => m.user_id === existingUser.id);
        if (alreadyInTeam) {
          setToast({
            id: String(Date.now()),
            type: 'error',
            title: 'Miembro ya registrado',
            description: `${normalizedEmail} ya forma parte del equipo de esta empresa.`,
          });
          setInviting(false);
          return;
        }

        // Direct insert into company_members
        const { data: newMember, error: insertError } = await supabase
          .from('company_members')
          .insert({
            company_id: activeCompany.id,
            user_id: existingUser.id,
            role: inviteRole,
          })
          .select(`
            id,
            user_id,
            company_id,
            role,
            created_at,
            user:user_id (
              id,
              email,
              full_name
            )
          `)
          .single();

        if (insertError) throw insertError;

        if (newMember) {
          setMembers((prev) => [...prev, newMember]);
        } else {
          await loadSettingsData();
        }

        setToast({
          id: String(Date.now()),
          type: 'success',
          title: 'Miembro vinculado exitosamente',
          description: `${normalizedEmail} fue agregado con rol ${inviteRole}.`,
        });
        setInviteEmail('');
        setIsInviteModalOpen(false);
      } else {
        // User does not exist yet in Supabase Users: register pending invitation & generate onboarding link
        const origin =
          typeof window !== 'undefined' ? window.location.origin : 'https://kounta.app';
        const inviteUrl = `${origin}/auth?invite_company=${
          activeCompany.id
        }&role=${inviteRole}&email=${encodeURIComponent(normalizedEmail)}`;

        const newInvite: PendingInvitation = {
          id: `inv-${Date.now()}`,
          email: normalizedEmail,
          role: inviteRole,
          created_at: new Date().toISOString(),
          inviteUrl,
        };

        const updatedInvites = [
          newInvite,
          ...pendingInvitations.filter((i) => i.email !== normalizedEmail),
        ];
        setPendingInvitations(updatedInvites);
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            `kounta_invites_${activeCompany.id}`,
            JSON.stringify(updatedInvites)
          );
        }

        setGeneratedInviteLink(inviteUrl);
        setToast({
          id: String(Date.now()),
          type: 'success',
          title: 'Invitación generada',
          description: `Comparte el enlace de invitación con ${normalizedEmail} para vincularlo al registrarse.`,
        });
      }
    } catch (err: any) {
      console.error('Error inviting member:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Error al procesar invitación',
        description: err.message || 'No se pudo agregar al colaborador.',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemovePendingInvite = (id: string) => {
    if (!activeCompany) return;
    const updated = pendingInvitations.filter((i) => i.id !== id);
    setPendingInvitations(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`kounta_invites_${activeCompany.id}`, JSON.stringify(updated));
    }
  };

  if (permissionsLoading || !isAdmin) {
    return (
      <div className="p-10 flex items-center justify-center text-xs text-zinc-400 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Verificando permisos de administrador...</span>
      </div>
    );
  }

  const isColombia = country === 'CO';

  return (
    <>
      {/* Top Bar with Tabs */}
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-md px-6 pt-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-zinc-900">
                  Configuración de la Organización
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800 border border-slate-300/80">
                  <Shield className="w-3 h-3 text-slate-700" />
                  ADMIN
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Administra los datos fiscales, miembros del equipo y suscripción de{' '}
                <strong className="text-zinc-700">{activeCompany?.name}</strong>
              </p>
            </div>
          </div>

          {/* Horizontal Stripe / Linear Tabs */}
          <div className="flex items-center gap-6 -mb-px overflow-x-auto">
            <button
              type="button"
              onClick={() => handleTabSwitch('general')}
              className={`pb-3 text-xs font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'general'
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Perfil de Empresa</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch('team')}
              className={`pb-3 text-xs font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'team'
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Equipo y Permisos</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono-numbers bg-zinc-100 text-zinc-700">
                {members.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch('billing')}
              className={`pb-3 text-xs font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'billing'
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Suscripción y Facturación</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-5xl w-full mx-auto space-y-6 pb-16">
        {/* ============================================================ */}
        {/* PESTAÑA 1: PERFIL DE EMPRESA (/settings/general)             */}
        {/* ============================================================ */}
        {activeTab === 'general' && (
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Información Legal y Tributaria
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Estos datos aparecen en el encabezado oficial de todas tus facturas y documentos PDF.
                </p>
              </div>
              <span className="text-xl">{isColombia ? '🇨🇴' : '🇺🇸'}</span>
            </div>

            <form onSubmit={handleSaveGeneral} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Nombre Comercial */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Nombre comercial <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ej. Kounta Colombia"
                    className="w-full px-3.5 py-2 text-xs bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                  />
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Nombre visible en el selector de empresas y barra lateral
                  </p>
                </div>

                {/* Razón Social */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Razón social (`legal_name`) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder={isColombia ? 'Ej. Kounta S.A.S.' : 'Ej. Kounta Technologies Inc.'}
                    className="w-full px-3.5 py-2 text-xs bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                  />
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Denominación legal inscrita ante {isColombia ? 'Cámara de Comercio / DIAN' : 'el Estado / IRS'}
                  </p>
                </div>

                {/* País de Operación */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <Globe2 className="w-3.5 h-3.5 text-zinc-400" />
                    Jurisdicción Fiscal
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value as CountryCode)}
                    className="w-full px-3.5 py-2 text-xs bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900 cursor-pointer"
                  >
                    <option value="CO">🇨🇴 Colombia (DIAN · NIT)</option>
                    <option value="US">🇺🇸 Estados Unidos (IRS · EIN)</option>
                  </select>
                </div>

                {/* Identificación Fiscal (NIT o EIN) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    {isColombia
                      ? 'Identificación Fiscal (NIT con dígito de verificación)'
                      : 'Employer Identification Number (EIN)'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder={isColombia ? '901.234.567-8' : '12-3456789'}
                    className="w-full px-3.5 py-2 text-xs font-mono-numbers bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                  />
                </div>

                {/* Moneda Base (Bloqueada si ya existen facturas emitidas) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-zinc-400" />
                    Moneda Contable Base
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    <select
                      value={baseCurrency}
                      disabled={invoicesCount > 0}
                      onChange={(e) => setBaseCurrency(e.target.value as 'COP' | 'USD')}
                      className="w-full px-3.5 py-2 text-xs font-mono-numbers bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed focus:bg-white focus:outline-none focus:border-zinc-900"
                    >
                      <option value="COP">COP — Peso Colombiano ($)</option>
                      <option value="USD">USD — US Dollar ($)</option>
                    </select>

                    {invoicesCount > 0 ? (
                      <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/70 text-amber-800 text-[11px] flex items-start gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          La moneda base (<strong>{activeCompany?.base_currency}</strong>) se encuentra bloqueada porque ya existen{' '}
                          <strong className="font-mono-numbers">{invoicesCount}</strong> facturas registradas en esta empresa.
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/70 text-zinc-500 text-[11px]">
                        Puedes cambiar la moneda base mientras la empresa aún no tenga comprobantes emitidos.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingGeneral}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingGeneral ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 2: EQUIPO Y PERMISOS (/settings/team)                */}
        {/* ============================================================ */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
              {/* Cabecera */}
              <div className="px-6 py-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Miembros del Equipo
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Gestiona quién tiene acceso a <strong>{activeCompany?.name}</strong> y sus niveles de permiso (RBAC).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInviteEmail('');
                    setInviteRole('WORKER');
                    setGeneratedInviteLink(null);
                    setIsInviteModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Invitar Miembro</span>
                </button>
              </div>

              {/* Tabla de Miembros */}
              {loadingMembers ? (
                <div className="p-6 space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-12 bg-zinc-100 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/80 border-b border-zinc-200/80 text-zinc-500 text-[11px] font-medium">
                        <th className="py-3 px-5">Usuario</th>
                        <th className="py-3 px-4">Rol</th>
                        <th className="py-3 px-4">Fecha de ingreso</th>
                        <th className="py-3 px-5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {members.map((mem) => {
                        const isSelf = mem.user_id === user?.id;
                        const isSoleAdmin =
                          isSelf && mem.role === 'ADMIN' && adminCount <= 1;
                        const email =
                          mem.user?.email || (isSelf ? user?.email : 'Miembro');
                        const fullName =
                          mem.user?.full_name ||
                          (isSelf ? user?.user_metadata?.full_name : null) ||
                          email.split('@')[0];

                        return (
                          <tr key={mem.id} className="hover:bg-zinc-50/60 transition-colors">
                            {/* Col 1: Usuario (Nombre y Email) */}
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-semibold text-xs shrink-0">
                                  {String(fullName).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-zinc-900 flex items-center gap-1.5">
                                    <span>{fullName}</span>
                                    {isSelf && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                                        Tú
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-zinc-500 font-mono-numbers">
                                    {email}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Col 2: Rol Badge (ADMIN en gris/azul neutro, WORKER en gris claro) */}
                            <td className="py-3.5 px-4">
                              {mem.role === 'ADMIN' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-300/80">
                                  <Shield className="w-3 h-3 text-slate-700" />
                                  ADMIN
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  WORKER
                                </span>
                              )}
                            </td>

                            {/* Col 3: Fecha de ingreso */}
                            <td className="py-3.5 px-4 text-zinc-500 font-mono-numbers">
                              {formatDate(mem.created_at)}
                            </td>

                            {/* Col 4: Acciones (Cambio de rol dinámico + Revocar acceso) */}
                            <td className="py-3.5 px-5 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <select
                                  value={mem.role}
                                  disabled={
                                    updatingMemberId === mem.id || isSoleAdmin
                                  }
                                  onChange={(e) =>
                                    handleRoleChange(
                                      mem,
                                      e.target.value as CompanyRole
                                    )
                                  }
                                  title={
                                    isSoleAdmin
                                      ? 'No puedes degradar tu rol siendo el único ADMIN'
                                      : 'Cambiar rol del miembro'
                                  }
                                  className="px-2.5 py-1 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-800 font-medium focus:outline-none focus:border-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <option value="ADMIN">ADMIN</option>
                                  <option value="WORKER">WORKER</option>
                                </select>

                                <button
                                  type="button"
                                  disabled={isSoleAdmin}
                                  onClick={() => setMemberToRevoke(mem)}
                                  title={
                                    isSoleAdmin
                                      ? 'El único ADMIN no puede revocar su propio acceso'
                                      : 'Revocar acceso a la empresa'
                                  }
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Invitaciones Pendientes (si se invitó a usuarios aún no registrados) */}
            {pendingInvitations.length > 0 && (
              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Invitaciones Pendientes de Registro ({pendingInvitations.length})
                  </h3>
                </div>
                <div className="divide-y divide-zinc-100">
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <Mail className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-mono-numbers font-medium text-zinc-800">
                          {inv.email}
                        </span>
                        <span className="px-2 py-0.2 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                          {inv.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(inv.inviteUrl);
                            setToast({
                              id: String(Date.now()),
                              type: 'success',
                              title: 'Enlace copiado',
                              description: `Enlace de acceso para ${inv.email} copiado al portapapeles.`,
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copiar enlace</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePendingInvite(inv.id)}
                          className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer"
                          title="Cancelar invitación"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 3: SUSCRIPCIÓN Y FACTURACIÓN (/settings/billing)     */}
        {/* ============================================================ */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Plan Cards Grid (Starter, Growth, Enterprise) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'STARTER' as const,
                  name: 'Starter',
                  price: activeCompany?.base_currency === 'COP' ? '$79.000' : '$19',
                  period: '/ mes',
                  desc: 'Para emprendedores y pequeñas empresas en etapa inicial.',
                  maxUsers: 3,
                  maxInvoices: 50,
                },
                {
                  id: 'GROWTH' as const,
                  name: 'Growth',
                  price: activeCompany?.base_currency === 'COP' ? '$199.000' : '$49',
                  period: '/ mes',
                  desc: 'Para operaciones comerciales en crecimiento en CO y US.',
                  maxUsers: 10,
                  maxInvoices: 500,
                  popular: true,
                },
                {
                  id: 'ENTERPRISE' as const,
                  name: 'Enterprise',
                  price: activeCompany?.base_currency === 'COP' ? '$590.000' : '$149',
                  period: '/ mes',
                  desc: 'Multi-entidad sin límites, soporte prioritario y auditoría RLS.',
                  maxUsers: 999,
                  maxInvoices: 10000,
                },
              ].map((plan) => {
                const isCurrent = selectedPlan === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                      isCurrent
                        ? 'bg-white border-zinc-900 ring-1 ring-zinc-900 shadow-xs'
                        : 'bg-white border-zinc-200/80 hover:border-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-zinc-900">
                          Kounta {plan.name}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 text-white">
                            Plan Actual
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed min-h-[34px]">
                        {plan.desc}
                      </p>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-2xl font-bold font-mono-numbers text-zinc-900">
                          {plan.price}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {activeCompany?.base_currency} {plan.period}
                        </span>
                      </div>
                      <ul className="mt-4 pt-4 border-t border-zinc-100 space-y-2 text-xs text-zinc-600">
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-zinc-900" />
                          <span>
                            Hasta{' '}
                            <strong className="font-mono-numbers">
                              {plan.maxUsers === 999 ? 'Ilimitados' : plan.maxUsers}
                            </strong>{' '}
                            colaboradores
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-zinc-900" />
                          <span>
                            <strong className="font-mono-numbers">
                              {plan.maxInvoices.toLocaleString()}
                            </strong>{' '}
                            facturas / mes
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-zinc-900" />
                          <span>Exportación PDF Corporativo</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      disabled={isCurrent}
                      onClick={() => {
                        setSelectedPlan(plan.id);
                        setToast({
                          id: String(Date.now()),
                          type: 'success',
                          title: `Plan actualizado a Kounta ${plan.name}`,
                          description: 'Los nuevos límites de tu suscripción ya están activos.',
                        });
                      }}
                      className={`mt-5 w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-zinc-100 text-zinc-500 cursor-default'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                      }`}
                    >
                      {isCurrent ? 'Plan Activo' : `Cambiar a ${plan.name}`}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Límites del Plan y Método de Pago */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Uso actual del plan (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Consumo y Límites del Plan ({selectedPlan})
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Métricas en tiempo real del ciclo de facturación actual
                  </p>
                </div>

                {/* Progress 1: Colaboradores */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-700">
                      Colaboradores en el Equipo
                    </span>
                    <span className="font-mono-numbers font-semibold text-zinc-900">
                      {members.length} /{' '}
                      {selectedPlan === 'STARTER'
                        ? 3
                        : selectedPlan === 'GROWTH'
                        ? 10
                        : 'Ilimitados'}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-zinc-900 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (members.length /
                            (selectedPlan === 'STARTER'
                              ? 3
                              : selectedPlan === 'GROWTH'
                              ? 10
                              : 50)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Progress 2: Facturas emitidas este mes */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-700">
                      Facturas Emitidas este Mes
                    </span>
                    <span className="font-mono-numbers font-semibold text-zinc-900">
                      {monthlyInvoicesCount} /{' '}
                      {selectedPlan === 'STARTER'
                        ? 50
                        : selectedPlan === 'GROWTH'
                        ? 500
                        : '10,000'}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            4,
                            (monthlyInvoicesCount /
                              (selectedPlan === 'STARTER'
                                ? 50
                                : selectedPlan === 'GROWTH'
                                ? 500
                                : 10000)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Total histórico acumulado: {invoicesCount} comprobantes
                  </p>
                </div>
              </div>

              {/* Tarjeta de Resumen de Pago (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Método de Pago
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      Al día
                    </span>
                  </div>

                  {/* Visual Corporate Card */}
                  <div className="p-4 rounded-xl bg-zinc-950 text-white space-y-4">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Tarjeta Corporativa</span>
                      <CreditCard className="w-4 h-4 text-zinc-300" />
                    </div>
                    <div className="font-mono-numbers text-sm tracking-widest">
                      •••• •••• •••• 4242
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>{activeCompany?.legal_name}</span>
                      <span className="font-mono-numbers">EXP 08/28</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-zinc-500">
                      <span>Próximo corte:</span>
                      <span className="font-mono-numbers text-zinc-900 font-medium">
                        01 Nov 2026
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Facturación a:</span>
                      <span className="font-mono-numbers text-zinc-900">
                        {user?.email}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setToast({
                      id: String(Date.now()),
                      type: 'success',
                      title: 'Pasarela de pagos lista',
                      description: 'Integración con Stripe Billing preparada para producción.',
                    })
                  }
                  className="w-full py-2 px-3 rounded-lg bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Actualizar Método de Pago
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* MODAL: INVITAR MIEMBRO                                       */}
      {/* ============================================================ */}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsInviteModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-zinc-900 text-white">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Invitar Miembro al Equipo
                  </h3>
                  <p className="text-[11px] text-zinc-500">{activeCompany?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Correo electrónico del colaborador <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colaborador@empresa.com"
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-50/70 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Rol asignado
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as CompanyRole)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50/70 border border-zinc-200 rounded-lg text-zinc-900 font-medium focus:bg-white focus:outline-none focus:border-zinc-900 cursor-pointer"
                >
                  <option value="WORKER">WORKER — Operativo (Facturas y Clientes)</option>
                  <option value="ADMIN">ADMIN — Administrador Total (Configuración y Equipo)</option>
                </select>
                <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed">
                  {inviteRole === 'ADMIN'
                    ? 'Tendrá control total sobre la configuración fiscal, facturación, anulación de documentos y gestión de usuarios.'
                    : 'Podrá consultar y emitir facturas y clientes, sin acceso a ajustes de empresa ni gestión del equipo.'}
                </p>
              </div>

              {generatedInviteLink && (
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
                    <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Usuario nuevo — Enlace de acceso directo</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Este correo aún no tiene cuenta en Kounta. Comparte este enlace para que al registrarse quede vinculado automáticamente a <strong>{activeCompany?.name}</strong>:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteLink}
                      className="flex-1 px-2.5 py-1.5 text-[11px] font-mono-numbers bg-white border border-zinc-200 rounded-md text-zinc-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInviteLink);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-md bg-zinc-900 text-white text-[11px] font-medium flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enviar / Vincular</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DIÁLOGO DE CONFIRMACIÓN AL REVOCAR ACCESO                    */}
      {/* ============================================================ */}
      {memberToRevoke && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setMemberToRevoke(null)}
        >
          <div
            className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  ¿Revocar acceso del miembro?
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Estás a punto de remover a{' '}
                  <strong className="text-zinc-800">
                    {memberToRevoke.user?.email || 'este usuario'}
                  </strong>{' '}
                  de <strong>{activeCompany?.name}</strong>. Perderá inmediatamente el acceso a las facturas y clientes de esta organización.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMemberToRevoke(null)}
                className="px-3.5 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={revoking}
                onClick={handleConfirmRevoke}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {revoking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Sí, revocar acceso</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
