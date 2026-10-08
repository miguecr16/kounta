'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CountryCode } from '@/types/database';
import {
  Building2,
  ArrowRight,
  Loader2,
  Check,
  ShieldCheck,
  Globe2,
  Coins,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

export default function OnboardingPage() {
  const { user, refreshTenantData, companies, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState<CountryCode>('CO');
  const [taxId, setTaxId] = useState('');
  const [baseCurrency, setBaseCurrency] = useState<'COP' | 'USD'>('COP');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If country changes, adapt default currency and reset/adapt placeholder
  const handleCountryChange = (newCountry: CountryCode) => {
    setCountry(newCountry);
    if (newCountry === 'CO') {
      setBaseCurrency('COP');
    } else {
      setBaseCurrency('USD');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!user) {
      setErrorMessage('Tu sesión ha expirado o no estás autenticado. Inicia sesión nuevamente.');
      return;
    }

    if (!name.trim() || !legalName.trim() || !taxId.trim()) {
      setErrorMessage('Por favor completa todos los campos requeridos.');
      return;
    }

    setLoading(true);

    try {
      // 0. Ensure public.users has a profile record if the table is used
      try {
        await supabase.from('users').upsert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || name.trim(),
        });
      } catch (userErr) {
        console.log('User profile sync notice:', userErr);
      }

      // 1. Insert into companies
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: name.trim(),
          legal_name: legalName.trim(),
          country,
          tax_id: taxId.trim(),
          base_currency: baseCurrency,
        })
        .select()
        .single();

      if (companyError) {
        throw new Error(`Error creando la empresa: ${companyError.message}`);
      }

      if (!companyData) {
        throw new Error('No se pudo obtener la información de la empresa creada.');
      }

      // 2. Insert into company_members with role 'ADMIN'
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          company_id: companyData.id,
          user_id: user.id,
          role: 'ADMIN',
        });

      if (memberError) {
        throw new Error(`Error vinculando rol de administrador: ${memberError.message}`);
      }

      // 3. Set active company in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('kounta_active_company_id', companyData.id);
      }

      // 4. Refresh auth context and redirect to dashboard
      await refreshTenantData();
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ocurrió un error inesperado al registrar la empresa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Decorative clean background subtle pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none opacity-60" />

      <div className="relative sm:mx-auto sm:w-full sm:max-w-xl z-10">
        {/* Onboarding Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
            Paso 1 de 1 · Configuración de tu Empresa
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Crea tu primera empresa en Kounta
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 max-w-md mx-auto">
            Configura la entidad legal y moneda base. Tendrás rol <strong className="text-zinc-800">ADMIN</strong> con control total de facturación y equipo.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xs border border-zinc-200/80 rounded-2xl">
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50/80 border border-rose-200/60 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Country Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-zinc-500" />
                País de Operación
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleCountryChange('CO')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    country === 'CO'
                      ? 'border-zinc-900 bg-zinc-900/5 ring-1 ring-zinc-900'
                      : 'border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-300'
                  }`}
                >
                  <span className="text-2xl">🇨🇴</span>
                  <div>
                    <div className="text-xs font-medium text-zinc-900">Colombia</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">Régimen DIAN · NIT · COP</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleCountryChange('US')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    country === 'US'
                      ? 'border-zinc-900 bg-zinc-900/5 ring-1 ring-zinc-900'
                      : 'border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-300'
                  }`}
                >
                  <span className="text-2xl">🇺🇸</span>
                  <div>
                    <div className="text-xs font-medium text-zinc-900">Estados Unidos</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">IRS · EIN · USD</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Nombre comercial
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={country === 'CO' ? 'Ej. Kounta Colombia' : 'Ej. Kounta LLC'}
                  className="w-full px-3.5 py-2.5 text-sm bg-zinc-50/50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
                />
                <p className="mt-1 text-[11px] text-zinc-400">Nombre visible de la marca</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Razón social (Legal Name)
                </label>
                <input
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder={country === 'CO' ? 'Ej. Kounta SAS' : 'Ej. Kounta Technologies Inc.'}
                  className="w-full px-3.5 py-2.5 text-sm bg-zinc-50/50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
                />
                <p className="mt-1 text-[11px] text-zinc-400">Razón legal constituida</p>
              </div>
            </div>

            {/* Tax ID & Base Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  {country === 'CO' ? 'NIT (Identificación Tributaria)' : 'EIN (Employer Identification)'}
                </label>
                <input
                  type="text"
                  required
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder={country === 'CO' ? '901.234.567-8' : '12-3456789'}
                  className="w-full px-3.5 py-2.5 text-sm font-mono-numbers bg-zinc-50/50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  {country === 'CO' ? 'Incluye dígito de verificación' : 'Formato de 9 dígitos del IRS'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-zinc-500" />
                  Moneda base
                </label>
                <select
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value as 'COP' | 'USD')}
                  className="w-full px-3.5 py-2.5 text-sm bg-zinc-50/50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors cursor-pointer"
                >
                  <option value="COP">COP — Peso Colombiano ($)</option>
                  <option value="USD">USD — United States Dollar ($)</option>
                </select>
                <p className="mt-1 text-[11px] text-zinc-400">Moneda contable por defecto</p>
              </div>
            </div>

            {/* Summary Box */}
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs space-y-1.5">
              <div className="font-medium text-zinc-800 flex items-center justify-between">
                <span>Tu membresía inicial:</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  <Check className="w-3 h-3 text-emerald-600" /> ADMIN (Propietario)
                </span>
              </div>
              <p className="text-zinc-500 leading-relaxed text-[11px]">
                Como administrador tendrás acceso completo a invitar miembros, emitir facturas en {baseCurrency}, gestionar clientes y configurar la información fiscal ante {country === 'CO' ? 'la DIAN' : 'el IRS'}.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium tracking-tight shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creando empresa y configurando permisos...</span>
                </>
              ) : (
                <>
                  <span>Crear Empresa y Continuar al Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-zinc-400" />
          <span>Multi-tenant seguro · Políticas RLS aisladas</span>
        </div>
      </div>
    </div>
  );
}
