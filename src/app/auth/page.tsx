'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Building2, ArrowRight, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { CompanyRole } from '@/types/database';

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [inviteCompanyId, setInviteCompanyId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<CompanyRole>('WORKER');

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const invitedCo = params.get('invite_company');
      const invitedRole = params.get('role');
      const invitedEmail = params.get('email');

      if (invitedCo) {
        setInviteCompanyId(invitedCo);
        setMode('signup');
      }
      if (invitedRole === 'ADMIN' || invitedRole === 'WORKER') {
        setInviteRole(invitedRole);
      }
      if (invitedEmail) {
        setEmail(invitedEmail);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Credenciales incorrectas. Verifica tu correo y contraseña.');
          } else if (error.message.includes('Email not confirmed')) {
            throw new Error('Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada.');
          }
          throw error;
        }

        if (data.user) {
          if (inviteCompanyId) {
            try {
              await supabase.from('company_members').insert({
                company_id: inviteCompanyId,
                user_id: data.user.id,
                role: inviteRole,
              });
            } catch {
              // Ignore if already a member or RLS blocks
            }
          }

          // Check if user has companies
          const { data: memberRows } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('user_id', data.user.id)
            .limit(1);

          if (!memberRows || memberRows.length === 0) {
            router.push('/onboarding');
          } else {
            router.push('/dashboard');
          }
        }
      } else {
        // Sign up flow
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || undefined,
            },
          },
        });

        if (error) {
          if (error.message.includes('rate limit')) {
            throw new Error(
              'Límite de correos de Supabase alcanzado temporalmente. Si estás configurando el proyecto, desactiva "Confirm email" en Supabase Auth > Providers > Email para registro directo sin confirmación.'
            );
          } else if (error.message.includes('User already registered')) {
            throw new Error('Este correo ya está registrado. Por favor inicia sesión.');
          }
          throw error;
        }

        if (data.session) {
          // Direct session established (email confirmation disabled in Supabase)
          // Also optionally insert into public.users if table exists
          try {
            await supabase.from('users').upsert({
              id: data.user!.id,
              email: data.user!.email!,
              full_name: fullName.trim() || null,
            });
          } catch (e) {
            console.log('User table sync note:', e);
          }

          if (inviteCompanyId && data.user) {
            try {
              const { error: memberErr } = await supabase.from('company_members').insert({
                company_id: inviteCompanyId,
                user_id: data.user.id,
                role: inviteRole,
              });
              if (!memberErr) {
                router.push('/dashboard');
                return;
              }
            } catch {
              // Fallback to onboarding if RLS requires admin direct insert
            }
          }

          router.push('/onboarding');
        } else if (data.user && !data.session) {
          // Confirmation email sent
          setSuccessNotice(
            '¡Cuenta creada! Hemos enviado un enlace de confirmación a tu correo. Por favor confírmalo para ingresar.'
          );
          setMode('signin');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocurrió un error inesperado al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Decorative clean background subtle pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none opacity-60" />

      <div className="relative sm:mx-auto sm:w-full sm:max-w-md z-10">
        {/* Brand identity */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-11 w-11 rounded-xl bg-zinc-950 text-white flex items-center justify-center shadow-sm border border-zinc-800">
            <span className="font-bold text-lg tracking-wider">K</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">
            Kounta
          </h1>
          <p className="mt-1 text-sm text-zinc-500 text-center">
            Contabilidad multi-tenant para empresas en Colombia y Estados Unidos
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-zinc-500 bg-white border border-zinc-200/80 px-2.5 py-1 rounded-full shadow-xs">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>🇨🇴 NIT (DIAN) · 🇺🇸 EIN (IRS)</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xs border border-zinc-200/80 rounded-2xl">
          {/* Segmented Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-lg mb-6 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
              }}
              className={`py-2 text-center rounded-md transition-all ${
                mode === 'signin'
                  ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
              }}
              className={`py-2 text-center rounded-md transition-all ${
                mode === 'signup'
                  ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50/80 border border-rose-200/60 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successNotice && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/60 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successNotice}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Carlos Mendoza"
                  className="w-full px-3.5 py-2.5 text-sm bg-zinc-50/50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Correo corporativo
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                className="w-full px-3.5 py-2.5 text-sm bg-zinc-50/50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-700">
                  Contraseña
                </label>
                {mode === 'signin' && (
                  <span className="text-[11px] text-zinc-400 hover:text-zinc-600 cursor-pointer">
                    ¿Olvidaste tu contraseña?
                  </span>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 text-sm bg-zinc-50/50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
              />
              {mode === 'signup' && (
                <p className="mt-1 text-[11px] text-zinc-400">
                  Mínimo 6 caracteres
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium tracking-tight shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === 'signin' ? 'Entrar a Kounta' : 'Crear cuenta y comenzar'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Security badge */}
          <div className="mt-6 pt-5 border-t border-zinc-100 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>Seguridad bancaria con Row Level Security (RLS)</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Kounta Financial Systems · Aislamiento estricto por compañía
        </p>
      </div>
    </div>
  );
}
