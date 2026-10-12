'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';
import { Plus, Bell, Search } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onNewInvoiceClick?: () => void;
}

export function Header({ title = 'Resumen Contable', subtitle, onNewInvoiceClick }: HeaderProps) {
  const { activeCompany, activeRole } = useAuth();

  return (
    <header className="h-16 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle ? (
          <p className="text-xs text-zinc-500">{subtitle}</p>
        ) : (
          <p className="text-[11px] text-zinc-500 font-mono-numbers">
            {activeCompany?.legal_name} · {activeCompany?.country === 'CO' ? `NIT ${activeCompany?.tax_id}` : `EIN ${activeCompany?.tax_id}`} · {activeCompany?.base_currency}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 text-[11px] font-mono-numbers border border-zinc-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>{activeCompany?.base_currency || 'COP'}</span>
        </div>

        {onNewInvoiceClick ? (
          <button
            type="button"
            onClick={onNewInvoiceClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium tracking-tight shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Factura</span>
          </button>
        ) : (
          <Link
            href="/invoices/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium tracking-tight shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Factura</span>
          </Link>
        )}
      </div>
    </header>
  );
}
