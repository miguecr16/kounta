'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import {
  ArrowRight,
  Check,
  Shield,
  ShieldCheck,
  Building2,
  Sparkles,
  Globe,
  Coins,
  FileText,
  Receipt,
  Landmark,
  TrendingUp,
  BarChart3,
  Users,
  Lock,
  Scale,
  ChevronRight,
  Download,
  CheckCircle2,
  ArrowUpRight,
  Layers,
  FileSpreadsheet
} from 'lucide-react';

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const [pricingCurrency, setPricingCurrency] = useState<'USD' | 'COP'>('USD');

  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP ANNOUNCEMENT BANNER                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-zinc-950 text-zinc-300 text-xs py-2 px-4 border-b border-zinc-800 text-center font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            TRM en vivo
          </span>
          <span className="hidden sm:inline">
            Sincronización cambiaria diaria USD/COP y cumplimiento fiscal DIAN & IRS.
          </span>
          <span className="sm:hidden">Cumplimiento DIAN & IRS en tiempo real.</span>
          <Link
            href="/signup?plan=growth"
            className="text-white hover:text-zinc-200 underline font-semibold ml-1 inline-flex items-center"
          >
            Prueba 14 días gratis <ChevronRight className="w-3 h-3 ml-0.5 inline" />
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. NAVBAR                                                     */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-8 w-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs group-hover:bg-zinc-800 transition-colors">
                K
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-semibold tracking-tight text-zinc-950">Kounta</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200/60">
                  Fintech
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-600">
              <a href="#caracteristicas" className="hover:text-zinc-950 transition-colors">
                Características
              </a>
              <a href="#mercados" className="hover:text-zinc-950 transition-colors">
                Colombia & USA
              </a>
              <a href="#seguridad" className="hover:text-zinc-950 transition-colors">
                Seguridad & Roles
              </a>
              <a href="#precios" className="hover:text-zinc-950 transition-colors">
                Precios
              </a>
            </nav>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {!isLoading && user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-colors"
              >
                <span>Ir al Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-colors"
                >
                  <span>Crear Cuenta Gratis</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 3. HERO SECTION                                               */}
      {/* ------------------------------------------------------------- */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-50 via-white to-white border-b border-zinc-200/70">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Top Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100/90 border border-zinc-200/90 text-zinc-700 text-xs font-medium shadow-2xs">
              <span className="flex items-center gap-1 text-zinc-900 font-semibold">
                🇨🇴 DIAN · 🇺🇸 IRS
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-400"></span>
              <span>Plataforma Contable Binacional Multi-Empresa</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-zinc-950 leading-[1.12]">
              Contabilidad binacional sin fricciones para empresas en{' '}
              <span className="underline decoration-zinc-300 underline-offset-8">Colombia</span> y{' '}
              <span className="underline decoration-zinc-300 underline-offset-8">Estados Unidos</span>.
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-zinc-600 font-normal leading-relaxed max-w-2xl mx-auto">
              Emite facturas fiscales con retenciones automáticas, concilia cuentas bancarias en COP y USD con TRM en tiempo real, liquida impuestos y genera estados de pérdidas y ganancias con precisión corporativa.
            </p>

            {/* Hero CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/signup?plan=growth"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-sm font-medium shadow-sm transition-all"
              >
                <span>Empezar Prueba Gratuita (14 días)</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#precios"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 text-sm font-medium border border-zinc-200 transition-colors"
              >
                <span>Ver Planes y Precios</span>
              </a>
            </div>

            {/* Quick trust metrics */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-8 text-xs text-zinc-500 font-medium">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sin tarjeta de crédito requerida</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Configuración instantánea en 2 minutos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Multi-tenant seguro con Supabase RLS</span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* HERO EDITORIAL UI MOCKUP (Linear / Mercury / Stripe Style)   */}
          {/* ------------------------------------------------------------- */}
          <div className="mt-14 max-w-5xl mx-auto">
            <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-xl overflow-hidden">
              {/* Window Header */}
              <div className="px-4 py-3 bg-zinc-50/80 border-b border-zinc-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-300"></div>
                  <span className="ml-2 text-xs font-mono text-zinc-500">app.kounta.co/invoices/inv-2026-0042</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono-numbers px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> FACTURA EMITIDA · DIAN REG.
                  </span>
                </div>
              </div>

              {/* Mockup Canvas */}
              <div className="p-6 sm:p-8 bg-zinc-50/30">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Live Monospace Invoice Preview */}
                  <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-xl p-6 shadow-xs space-y-6">
                    {/* Invoice Header */}
                    <div className="flex justify-between items-start border-b border-zinc-100 pb-5">
                      <div>
                        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Documento Tributario</div>
                        <h3 className="text-xl font-bold tracking-tight text-zinc-900 mt-0.5">FACTURA DE VENTA #0042</h3>
                        <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                          <span>Emisión: 23 Nov 2026</span>
                          <span>·</span>
                          <span>Vencimiento: 23 Dic 2026</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-zinc-900">Kounta Global Inc.</div>
                        <div className="text-[11px] text-zinc-500 font-mono-numbers">EIN 84-2938174 · Delaware, USA</div>
                        <div className="text-[11px] text-zinc-500 font-mono-numbers">NIT 901.482.910-4 · Bogotá, CO</div>
                      </div>
                    </div>

                    {/* Customer & Multi-Currency Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200/60">
                        <div className="text-[11px] text-zinc-400 font-medium uppercase">Cliente Facturado</div>
                        <div className="font-semibold text-zinc-900 mt-0.5">Andes Cloud Technologies S.A.S.</div>
                        <div className="text-zinc-500 font-mono-numbers mt-0.5">NIT: 900.824.112-1</div>
                        <div className="text-zinc-500">Bogotá D.C., Colombia</div>
                      </div>
                      <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-100 flex flex-col justify-between">
                        <div>
                          <div className="text-[11px] text-indigo-700 font-semibold uppercase tracking-wider flex items-center gap-1">
                            <Coins className="w-3 h-3 text-indigo-600" />
                            Facturación Multi-Moneda
                          </div>
                          <div className="text-xs text-zinc-700 mt-1">
                            Moneda de emisión: <strong className="font-mono-numbers text-zinc-950">USD ($)</strong>
                          </div>
                        </div>
                        <div className="text-[11px] text-indigo-900/80 font-mono-numbers mt-2 pt-1.5 border-t border-indigo-100/80 flex items-center justify-between">
                          <span>TRM Oficial del Día:</span>
                          <strong>1 USD = 4,198.50 COP</strong>
                        </div>
                      </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="border border-zinc-200/80 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-zinc-50/80 border-b border-zinc-200/80 text-zinc-500 uppercase font-semibold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3 text-left">Descripción del Servicio</th>
                            <th className="py-2.5 px-3 text-center">Cant.</th>
                            <th className="py-2.5 px-3 text-right">Precio Unit. (USD)</th>
                            <th className="py-2.5 px-3 text-right">IVA</th>
                            <th className="py-2.5 px-3 text-right">Total (USD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 font-mono-numbers text-zinc-800">
                          <tr>
                            <td className="py-2.5 px-3 font-sans font-medium text-zinc-900">
                              Servicios de Consultoría Cloud Architecture Q4
                            </td>
                            <td className="py-2.5 px-3 text-center">1</td>
                            <td className="py-2.5 px-3 text-right">$ 2,000.00</td>
                            <td className="py-2.5 px-3 text-right text-zinc-500">19%</td>
                            <td className="py-2.5 px-3 text-right font-medium">$ 2,000.00</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-sans font-medium text-zinc-900">
                              Implementación de Seguridad Binacional SOC2
                            </td>
                            <td className="py-2.5 px-3 text-center">1</td>
                            <td className="py-2.5 px-3 text-right">$ 450.00</td>
                            <td className="py-2.5 px-3 text-right text-zinc-500">19%</td>
                            <td className="py-2.5 px-3 text-right font-medium">$ 450.00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Breakdown & Totals */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-2">
                      <div className="text-[11px] text-zinc-500 space-y-1">
                        <div className="flex items-center gap-1.5 text-zinc-700 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Retenciones liquidadas automáticamente:</span>
                        </div>
                        <div>• Retefuente 11% (Servicios): -$ 269.50 USD (-$1,131,495 COP)</div>
                        <div>• ReteICA 0.966%: -$ 23.67 USD (-$99,378 COP)</div>
                      </div>

                      <div className="w-full sm:w-64 space-y-1.5 text-xs">
                        <div className="flex justify-between text-zinc-500">
                          <span>Subtotal:</span>
                          <span className="font-mono-numbers">$ 2,450.00 USD</span>
                        </div>
                        <div className="flex justify-between text-zinc-500">
                          <span>IVA (19%):</span>
                          <span className="font-mono-numbers">$ 465.50 USD</span>
                        </div>
                        <div className="flex justify-between text-zinc-500">
                          <span>Retenciones aplicadas:</span>
                          <span className="font-mono-numbers text-rose-600">-$ 293.17 USD</span>
                        </div>
                        <div className="pt-2 border-t border-zinc-200 flex justify-between font-bold text-zinc-950 text-sm">
                          <span>Neto a Pagar:</span>
                          <div className="text-right">
                            <div className="font-mono-numbers">$ 2,622.33 USD</div>
                            <div className="text-[10px] text-zinc-400 font-normal font-mono-numbers">
                              ≈ $ 11,009,852 COP
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Treasury & KPI Cards */}
                  <div className="lg:col-span-4 space-y-4">
                    {/* Bank Reconciliation Card */}
                    <div className="bg-white border border-zinc-200/90 rounded-xl p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Landmark className="w-4 h-4 text-zinc-600" />
                          <span className="text-xs font-semibold text-zinc-900">Conciliación Bancaria</span>
                        </div>
                        <span className="text-[10px] font-mono-numbers bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                          AUTO-MATCH
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/60 flex items-center justify-between">
                          <div>
                            <div className="font-medium text-zinc-800">Mercury Checking (USD)</div>
                            <div className="text-[11px] text-zinc-400">•••• 8102 · Depósito Wire</div>
                          </div>
                          <span className="font-mono-numbers font-semibold text-emerald-600">+$2,622.33</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/60 flex items-center justify-between">
                          <div>
                            <div className="font-medium text-zinc-800">Bancolombia Ahorros (COP)</div>
                            <div className="text-[11px] text-zinc-400">•••• 4920 · Nómina Q4</div>
                          </div>
                          <span className="font-mono-numbers font-semibold text-zinc-700">-$6,400,000</span>
                        </div>
                      </div>
                      <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>Tasa de Conciliación</span>
                        <strong className="font-mono-numbers text-zinc-900">98.4% al día</strong>
                      </div>
                    </div>

                    {/* KPI Highlights */}
                    <div className="bg-white border border-zinc-200/90 rounded-xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-900">Salud Financiera Q4</span>
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Ingresos Facturados</div>
                        <div className="text-2xl font-bold font-mono-numbers text-zinc-950 tracking-tight mt-0.5">
                          $ 84,250.00 <span className="text-xs font-normal text-zinc-400">USD</span>
                        </div>
                        <div className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1 font-mono-numbers">
                          <span>↑ 18.2% vs mes anterior</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-100 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-[10px] text-zinc-400">Tasa de Recaudo</div>
                          <div className="font-mono-numbers font-semibold text-zinc-900 mt-0.5">94.8%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-400">Estatus Auditoría</div>
                          <div className="font-semibold text-emerald-700 mt-0.5">Inmutable</div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Audit Stamp */}
                    <div className="p-3.5 rounded-xl bg-zinc-900 text-white text-xs flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="leading-tight">
                        <div className="font-medium text-zinc-100">Auditoría Criptográfica</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">Hash inalterable por RLS en Supabase</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. VALUE PROPOSITION STATS & METRICS                         */}
      {/* ------------------------------------------------------------- */}
      <section className="py-12 bg-zinc-50 border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-4">
              <div className="text-2xl sm:text-3xl font-bold font-mono-numbers text-zinc-950">2 Países</div>
              <div className="text-xs text-zinc-500 mt-1 font-medium">Compliance nativo DIAN y IRS</div>
            </div>
            <div className="p-4">
              <div className="text-2xl sm:text-3xl font-bold font-mono-numbers text-zinc-950">100% TRM</div>
              <div className="text-xs text-zinc-500 mt-1 font-medium">Actualización automática diaria</div>
            </div>
            <div className="p-4">
              <div className="text-2xl sm:text-3xl font-bold font-mono-numbers text-zinc-950">&lt; 30 seg</div>
              <div className="text-xs text-zinc-500 mt-1 font-medium">Conciliación con extractos CSV</div>
            </div>
            <div className="p-4">
              <div className="text-2xl sm:text-3xl font-bold font-mono-numbers text-zinc-950">99.9% Uptime</div>
              <div className="text-xs text-zinc-500 mt-1 font-medium">Infraestructura multi-tenant RLS</div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. BIMARKET COMPARISON GRID (Colombia 🇨🇴 vs. USA 🇺🇸)         */}
      {/* ------------------------------------------------------------- */}
      <section id="mercados" className="py-20 sm:py-28 bg-white border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs font-medium">
              <Globe className="w-3.5 h-3.5 text-zinc-500" />
              Arquitectura Tributaria Dual
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              Diseñada específicamente para ambos mercados
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
              No adaptes un software estadounidense a Colombia ni fuerces un software local a gestionar USD. Kounta comprende las dos jurisdicciones en profundidad.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Colombia Card */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-8 flex flex-col justify-between hover:border-zinc-300 transition-all shadow-xs">
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-zinc-200">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🇨🇴</span>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-950">Colombia</h3>
                      <p className="text-xs text-zinc-500">Régimen DIAN · Moneda Base COP</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                    NIT & Retenciones
                  </span>
                </div>

                <ul className="mt-6 space-y-4 text-xs text-zinc-700">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-zinc-900">Validación de NIT con Dígito de Verificación:</strong> Algoritmo oficial de módulo 11 integrado para evitar rechazos en facturas.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-zinc-900">Desglose Fiscal Automatizado:</strong> IVA (19%), Retefuente configurable (2.5%, 3.5%, 11%) y ReteICA territorial (0.966%).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-zinc-900">Facturación en COP o USD con TRM Oficial:</strong> Factura a clientes extranjeros en dólares calculando la equivalencia en pesos según la TRM del día.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-zinc-900">Reporte Tributario para Revisoría Fiscal:</strong> Exporta acumulados de retenciones practicadas y asumidas con un solo clic.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-zinc-200/80 flex items-center justify-between text-xs text-zinc-500">
                <span>Bancos locales: Bancolombia, Davivienda, BBVA</span>
                <span className="font-mono-numbers font-medium text-zinc-700">Norma NIIF / DIAN</span>
              </div>
            </div>

            {/* United States Card */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-8 flex flex-col justify-between hover:border-zinc-300 transition-all shadow-xs">
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-zinc-200">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🇺🇸</span>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-950">Estados Unidos</h3>
                      <p className="text-xs text-zinc-500">Régimen IRS · Moneda Base USD</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                    EIN & GAAP P&L
                  </span>
                </div>

                <ul className="mt-6 space-y-4 text-xs text-zinc-700">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-zinc-900">Identificación Tributaria EIN:</strong> Validación de 9 dígitos del IRS para LLCs y C-Corps americanas.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-zinc-900">Sales Tax por Estado / Condado:</strong> Soporte para tasas de impuestos sobre ventas personalizadas en cada factura.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-zinc-900">P&L Ejecutivo (Profit & Loss):</strong> Estados de resultados en tiempo real calculando margen operativo y deducciones fiscales.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-zinc-900">Conciliación con Neobancos US:</strong> Carga masiva de extractos CSV de Mercury, Brex, Chase, Silicon Valley Bank y Stripe.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-zinc-200/80 flex items-center justify-between text-xs text-zinc-500">
                <span>Neobancos: Mercury, Brex, Stripe, Wise</span>
                <span className="font-mono-numbers font-medium text-zinc-700">US GAAP Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. COMPLETE PLATFORM FEATURES                                 */}
      {/* ------------------------------------------------------------- */}
      <section id="caracteristicas" className="py-20 sm:py-28 bg-zinc-50/50 border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs font-medium">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              Módulos Integrados
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              Todo el ciclo financiero en una sola interfaz
            </h2>
            <p className="text-sm sm:text-base text-zinc-600">
              Elimina las hojas de cálculo dispersas y la doble contabilidad.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-950">Facturación & PDF Editorial</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Emite facturas elegantes con tipografía corporativa monocromática. Descarga PDFs listos para imprimir o envía directo a tus clientes con desglose tributario impecable.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-950">Gastos & Comprobantes</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Control de egresos por categorías (nómina, software, marketing, impuestos), soporte para adjuntar recibos digitales y marcación de gastos deducibles.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center">
                <Landmark className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-950">Bancos & Conciliación CSV</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Registra múltiples cuentas bancarias en COP y USD. Importa extractos bancarios en CSV con mapeo automático y concilia cobros y egresos en un clic.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-950">TRM Multi-Moneda en Vivo</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Cálculo automático de la tasa de cambio oficial entre USD y COP en cada transacción. Mantén tus libros contables consistentes en tu moneda base.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-950">Reportes Financieros & P&L</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Monitorea ingresos cobrados, cuentas por cobrar, margen neto de ganancia y resúmenes tributarios listos para presentar ante DIAN o IRS.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-950">Registro de Auditoría (Audit Log)</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Bitácora de seguridad inmutable que registra cada creación, edición y anulación con usuario responsable, timestamp y detalles técnicos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7. RBAC & SECURITY SECTION                                    */}
      {/* ------------------------------------------------------------- */}
      <section id="seguridad" className="py-20 sm:py-28 bg-white border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs font-medium">
              <Lock className="w-3.5 h-3.5 text-zinc-500" />
              Control Granular de Acceso (RBAC)
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              Protección estricta para las finanzas de tu empresa
            </h2>
            <p className="text-sm sm:text-base text-zinc-600">
              Mantén los datos sensibles de tesorería y balances bajo el control exclusivo de los fundadores y la gerencia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* ADMIN Role Card */}
            <div className="rounded-2xl border-2 border-zinc-900 bg-white p-7 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs">
                    👑
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-950">Rol ADMIN</h3>
                    <p className="text-[11px] text-zinc-500">Gerencia, Propietarios & Contadores</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-900 text-white">
                  Acceso Total
                </span>
              </div>

              <ul className="space-y-3 text-xs text-zinc-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Acceso irrestricto a P&L, saldos bancarios y rentabilidad</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Configuración de la empresa, planes y facturación</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Gestión del equipo: invitar y remover miembros</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Poder para anular facturas y consultar el registro de auditoría</span>
                </li>
              </ul>
            </div>

            {/* WORKER Role Card */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-7 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-xs">
                    💼
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-950">Rol WORKER</h3>
                    <p className="text-[11px] text-zinc-500">Operaciones, Ventas & Soporte</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-200 text-zinc-700">
                  Operativo Seguro
                </span>
              </div>

              <ul className="space-y-3 text-xs text-zinc-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>Creación y emisión de facturas a clientes autorizados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>Registro de clientes y subida de comprobantes de gastos</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-400">
                  <span className="w-4 h-4 text-rose-500 font-bold shrink-0 text-center">✕</span>
                  <span>Sin visibilidad del menú de Ajustes ni Facturación</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-400">
                  <span className="w-4 h-4 text-rose-500 font-bold shrink-0 text-center">✕</span>
                  <span>Sin acceso a márgenes globales, auditoría ni cuentas de banco</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 8. PRICING SECTION (USD / COP Dynamic Switch)                 */}
      {/* ------------------------------------------------------------- */}
      <section id="precios" className="py-20 sm:py-28 bg-zinc-50/60 border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-200/80 text-zinc-800 text-xs font-medium">
              <Coins className="w-3.5 h-3.5 text-zinc-600" />
              Tarifas Claras y Transparentes
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              Planes diseñados para cada etapa de tu negocio
            </h2>
            <p className="text-sm sm:text-base text-zinc-600">
              Todos los planes incluyen 14 días de prueba gratuita sin compromiso. Cancela cuando quieras.
            </p>

            {/* Currency Selector Switch */}
            <div className="pt-4 flex items-center justify-center">
              <div className="p-1 bg-zinc-200/80 rounded-xl inline-flex items-center gap-1 border border-zinc-300/60">
                <button
                  type="button"
                  onClick={() => setPricingCurrency('USD')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    pricingCurrency === 'USD'
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  🇺🇸 Facturación en USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setPricingCurrency('COP')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    pricingCurrency === 'COP'
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  🇨🇴 Facturación en COP (Pesos)
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {/* Starter Plan */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 flex flex-col justify-between shadow-xs hover:border-zinc-300 transition-all">
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Starter</h3>
                  <p className="text-xs text-zinc-500 mt-1">Para independientes y pequeñas firmas.</p>
                </div>

                <div className="pt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold font-mono-numbers text-zinc-950">
                      {pricingCurrency === 'USD' ? '$19' : '$79.000'}
                    </span>
                    <span className="text-xs text-zinc-500 font-medium">
                      {pricingCurrency === 'USD' ? 'USD / mes' : 'COP / mes'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 font-mono-numbers">Facturación mensual simple</p>
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-100 text-xs text-zinc-700">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Hasta <strong>50 facturas</strong> / mes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Hasta <strong>3 usuarios</strong> de equipo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Reportes básicos de ingresos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Emisión de PDF corporativo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Soporte por correo electrónico</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100">
                <Link
                  href="/signup?plan=starter"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 text-xs font-semibold border border-zinc-200 transition-colors"
                >
                  <span>Comenzar con Starter</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Growth Plan (Popular) */}
            <div className="relative rounded-2xl border-2 border-zinc-900 bg-white p-8 flex flex-col justify-between shadow-md">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 rounded-full bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                  Más Popular · Recomendado
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Growth</h3>
                  <p className="text-xs text-zinc-500 mt-1">Escalamiento comercial y cumplimiento tributario.</p>
                </div>

                <div className="pt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold font-mono-numbers text-zinc-950">
                      {pricingCurrency === 'USD' ? '$49' : '$199.000'}
                    </span>
                    <span className="text-xs text-zinc-500 font-medium">
                      {pricingCurrency === 'USD' ? 'USD / mes' : 'COP / mes'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 font-mono-numbers">Incluye 14 días de prueba</p>
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-100 text-xs text-zinc-700">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Facturación mensual ILIMITADA</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Hasta <strong>10 miembros</strong> de equipo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Conciliación bancaria vía extractos CSV</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Reportes fiscales DIAN & IRS avanzados</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Exportación contable estructurada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Soporte prioritario por chat</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100">
                <Link
                  href="/signup?plan=growth"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <span>Probar Growth 14 días Gratis</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 flex flex-col justify-between shadow-xs hover:border-zinc-300 transition-all">
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Enterprise</h3>
                  <p className="text-xs text-zinc-500 mt-1">Operación corporativa binacional sin límites.</p>
                </div>

                <div className="pt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold font-mono-numbers text-zinc-950">
                      {pricingCurrency === 'USD' ? '$99' : '$399.000'}
                    </span>
                    <span className="text-xs text-zinc-500 font-medium">
                      {pricingCurrency === 'USD' ? 'USD / mes' : 'COP / mes'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 font-mono-numbers">Para corporaciones consolidadas</p>
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-100 text-xs text-zinc-700">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Facturación y transacciones ILIMITADAS</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Miembros de equipo ILIMITADOS</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Multi-moneda en tiempo real (TRM diaria)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Registro de auditoría (Audit Log) inmutable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Gestor de cuenta y soporte telefónico</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Acuerdo de nivel de servicio (SLA 99.9%)</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100">
                <Link
                  href="/signup?plan=enterprise"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 text-xs font-semibold border border-zinc-200 transition-colors"
                >
                  <span>Comenzar con Enterprise</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 9. BOTTOM CALL TO ACTION                                      */}
      {/* ------------------------------------------------------------- */}
      <section className="py-16 sm:py-20 bg-zinc-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Empieza en 2 minutos
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white max-w-2xl mx-auto">
            La contabilidad de tu empresa en Colombia y Estados Unidos bajo control.
          </h2>

          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
            Únete a las empresas que ya simplificaron sus declaraciones fiscales, facturación binacional y conciliación bancaria.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup?plan=growth"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 text-sm font-semibold shadow-xs transition-colors"
            >
              <span>Crear Cuenta y Probar Gratis</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-medium border border-zinc-800 transition-colors"
            >
              <span>Ya tengo cuenta</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 10. CORPORATE FOOTER                                          */}
      {/* ------------------------------------------------------------- */}
      <footer className="bg-white border-t border-zinc-200/80 py-12 text-zinc-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 pb-10 border-b border-zinc-200/80">
            {/* Col 1: Brand */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold text-xs">
                  K
                </div>
                <span className="text-base font-semibold text-zinc-900 tracking-tight">Kounta</span>
              </div>
              <p className="text-zinc-500 max-w-sm leading-relaxed">
                Plataforma de contabilidad, facturación fiscal y conciliación bancaria binacional para empresas constituidas en Colombia y Estados Unidos.
              </p>
              <div className="flex items-center gap-2 text-zinc-400 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px]">Seguridad de Grado Bancario · RLS Aislado</span>
              </div>
            </div>

            {/* Col 2: Soluciones */}
            <div className="space-y-2.5">
              <div className="text-zinc-900 font-semibold uppercase tracking-wider text-[11px]">Soluciones</div>
              <ul className="space-y-2">
                <li><a href="#mercados" className="hover:text-zinc-900 transition-colors">Facturación Colombia (DIAN)</a></li>
                <li><a href="#mercados" className="hover:text-zinc-900 transition-colors">Facturación USA (IRS)</a></li>
                <li><a href="#caracteristicas" className="hover:text-zinc-900 transition-colors">Conciliación Bancaria CSV</a></li>
                <li><a href="#caracteristicas" className="hover:text-zinc-900 transition-colors">Reportes Financieros P&L</a></li>
              </ul>
            </div>

            {/* Col 3: Empresa */}
            <div className="space-y-2.5">
              <div className="text-zinc-900 font-semibold uppercase tracking-wider text-[11px]">Plataforma</div>
              <ul className="space-y-2">
                <li><a href="#caracteristicas" className="hover:text-zinc-900 transition-colors">Características</a></li>
                <li><a href="#seguridad" className="hover:text-zinc-900 transition-colors">Seguridad & RBAC</a></li>
                <li><a href="#precios" className="hover:text-zinc-900 transition-colors">Precios y Planes</a></li>
                <li><Link href="/login" className="hover:text-zinc-900 transition-colors">Iniciar Sesión</Link></li>
              </ul>
            </div>

            {/* Col 4: Jurisdicciones */}
            <div className="space-y-2.5">
              <div className="text-zinc-900 font-semibold uppercase tracking-wider text-[11px]">Jurisdicciones</div>
              <ul className="space-y-2">
                <li className="flex items-center gap-1.5">
                  <span>🇨🇴</span> <span>Colombia (NIT, Retefuente, ReteICA)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span>🇺🇸</span> <span>United States (EIN, Sales Tax)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span>🌐</span> <span>TRM Oficial Banco de la República</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400">
            <div>
              © {new Date().getFullYear()} Kounta Technologies Inc. Todos los derechos reservados.
            </div>
            <div className="flex items-center gap-6">
              <span className="hover:text-zinc-600 cursor-pointer">Términos del Servicio</span>
              <span className="hover:text-zinc-600 cursor-pointer">Política de Privacidad</span>
              <span className="hover:text-zinc-600 cursor-pointer">Seguridad de Datos</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
