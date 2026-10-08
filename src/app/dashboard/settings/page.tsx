'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { CompanyMember, CompanyRole } from '@/types/database';
import { formatDate } from '@/lib/utils';
import {
  Settings,
  Shield,
  ShieldAlert,
  UserPlus,
  Building2,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Coins,
  Globe2,
  Lock
} from 'lucide-react';

export default function SettingsPage() {
  const { activeCompany, activeRole, user, refreshTenantData } = useAuth();
  const supabase = createClient();

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CompanyRole>('WORKER');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadMembers = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
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
        .eq('company_id', activeCompany.id);

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Error loading team members:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCompany, supabase]);

  useEffect(() => {
    if (activeRole === 'ADMIN') {
      loadMembers();
    }
  }, [activeRole, loadMembers]);

  // RBAC Guard: If not ADMIN, display clean forbidden notice
  if (activeRole !== 'ADMIN') {
    return (
      <>
        <Header title="Configuración" subtitle="Acceso restringido" />
        <main className="p-6 max-w-4xl w-full mx-auto">
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-8 text-center max-w-lg mx-auto mt-12 shadow-xs">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200/50">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900">Acceso Exclusivo para Administradores</h2>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Tu cuenta tiene el rol <strong className="text-zinc-800">WORKER (Colaborador)</strong>. Solo los usuarios con rol <strong className="text-zinc-800">ADMIN</strong> pueden modificar la configuración fiscal, moneda y miembros de la empresa.
            </p>
          </div>
        </main>
      </>
    );
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMessage(null);

    if (!activeCompany) return;
    setInviteLoading(true);

    try {
      // 1. Look up user by email in public.users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', inviteEmail.trim().toLowerCase())
        .maybeSingle();

      if (userError) throw userError;

      if (!userData) {
        throw new Error(
          'No se encontró ningún usuario registrado con este correo. El colaborador debe registrarse primero en Kounta para poder vincularlo.'
        );
      }

      // Check if already a member
      const isAlreadyMember = members.some((m) => m.user_id === userData.id);
      if (isAlreadyMember) {
        throw new Error('Este usuario ya es miembro de la empresa.');
      }

      // 2. Insert into company_members
      const { error: insertError } = await supabase
        .from('company_members')
        .insert({
          company_id: activeCompany.id,
          user_id: userData.id,
          role: inviteRole,
        });

      if (insertError) throw insertError;

      setInviteMessage({
        type: 'success',
        text: `¡Miembro vinculado exitosamente con rol ${inviteRole}!`,
      });
      setInviteEmail('');
      await loadMembers();
    } catch (err: any) {
      console.error(err);
      setInviteMessage({
        type: 'error',
        text: err.message || 'Error al vincular el miembro.',
      });
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <>
      <Header
        title="Configuración de Empresa y Equipo"
        subtitle={`Panel administrativo de ${activeCompany?.name}`}
      />

      <main className="p-6 max-w-5xl w-full mx-auto space-y-8">
        {/* Section 1: Company Profile */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-100 mb-5">
            <div className="p-2 rounded-lg bg-zinc-100 text-zinc-800">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Datos Fiscales de la Empresa</h2>
              <p className="text-xs text-zinc-500">Configuración tributaria y moneda base</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-zinc-500 text-[11px]">Nombre Comercial:</span>
              <div className="text-sm font-semibold text-zinc-900 mt-0.5">{activeCompany?.name}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-zinc-500 text-[11px]">Razón Social (Legal Name):</span>
              <div className="text-sm font-semibold text-zinc-900 mt-0.5">{activeCompany?.legal_name}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-zinc-500 text-[11px]">País y Jurisdicción:</span>
              <div className="text-sm font-semibold text-zinc-900 mt-0.5 flex items-center gap-1.5">
                <span>{activeCompany?.country === 'CO' ? '🇨🇴 Colombia (DIAN)' : '🇺🇸 Estados Unidos (IRS)'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-zinc-500 text-[11px]">
                {activeCompany?.country === 'CO' ? 'NIT:' : 'EIN:'}
              </span>
              <div className="text-sm font-mono-numbers font-semibold text-zinc-900 mt-0.5">
                {activeCompany?.tax_id}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-zinc-500 text-[11px]">Moneda Contable Base:</span>
              <div className="text-sm font-mono-numbers font-semibold text-zinc-900 mt-0.5">
                {activeCompany?.base_currency} ({activeCompany?.base_currency === 'COP' ? 'Peso Colombiano' : 'Dólar Estadounidense'})
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70 flex items-center justify-between">
              <div>
                <span className="text-zinc-500 text-[11px]">Aislamiento RLS:</span>
                <div className="text-sm font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" /> Multi-Tenant Activo
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Team Members & RBAC */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-zinc-100 text-zinc-800">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Equipo y Control de Acceso (RBAC)</h2>
                <p className="text-xs text-zinc-500">
                  ADMIN tiene control total; WORKER puede crear facturas y clientes sin acceso a ajustes.
                </p>
              </div>
            </div>
          </div>

          {/* Invite form */}
          <form onSubmit={handleAddMember} className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/80 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-800">Vincular Colaborador a la Empresa</h3>

            {inviteMessage && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  inviteMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {inviteMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{inviteMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="correo@colaborador.com (debe estar registrado en Kounta)"
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as CompanyRole)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 cursor-pointer"
                >
                  <option value="WORKER">WORKER (Operativo)</option>
                  <option value="ADMIN">ADMIN (Control Total)</option>
                </select>

                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium shrink-0 transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                >
                  {inviteLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Vincular</span>
                </button>
              </div>
            </div>
          </form>

          {/* Members Table */}
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-2">
                <div className="h-10 bg-zinc-100 animate-pulse rounded" />
                <div className="h-10 bg-zinc-100 animate-pulse rounded" />
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium text-[11px]">
                    <th className="py-2.5 px-4">Usuario</th>
                    <th className="py-2.5 px-4">Correo</th>
                    <th className="py-2.5 px-4">Rol Asignado</th>
                    <th className="py-2.5 px-4">Miembro Desde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {members.map((mem) => {
                    const isSelf = mem.user_id === user?.id;
                    const email = mem.user?.email || (isSelf ? user?.email : 'Usuario');
                    const fullName = mem.user?.full_name || (isSelf ? user?.user_metadata?.full_name : null);

                    return (
                      <tr key={mem.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="py-3 px-4 font-medium text-zinc-900">
                          <div className="flex items-center gap-1.5">
                            <span>{fullName || email.split('@')[0]}</span>
                            {isSelf && (
                              <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.2 rounded">
                                Tú
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-600 font-mono-numbers">
                          {email}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              mem.role === 'ADMIN'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                : 'bg-blue-50 text-blue-700 border-blue-200/60'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            {mem.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-400 font-mono-numbers">
                          {formatDate(mem.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
