'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  LayoutDashboard,
  Receipt,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Shield,
  Check,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeCompany, activeRole, companies, switchCompany, signOut } = useAuth();
  const { canManageSettings, canViewReports } = usePermissions();
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      matchPaths: ['/dashboard'],
      icon: LayoutDashboard,
    },
    {
      name: 'Facturas',
      href: '/invoices',
      matchPaths: ['/invoices', '/invoices/new', '/dashboard/invoices', '/dashboard/invoices/new'],
      icon: Receipt,
    },
    {
      name: 'Clientes',
      href: '/customers',
      matchPaths: ['/customers', '/dashboard/customers'],
      icon: Users,
    },
    ...(canViewReports
      ? [
          {
            name: 'Reportes',
            href: '/reports',
            matchPaths: ['/reports', '/dashboard/reports'],
            icon: BarChart3,
          },
        ]
      : []),
    // Only visible for ADMIN (restricted from WORKER)
    ...(canManageSettings
      ? [
          {
            name: 'Configuración',
            href: '/settings/general',
            matchPaths: [
              '/settings',
              '/settings/general',
              '/settings/team',
              '/settings/billing',
              '/dashboard/settings',
            ],
            icon: Settings,
          },
        ]
      : []),
  ];

  return (
    <aside className="w-64 bg-white border-r border-zinc-200/80 flex flex-col h-screen select-none shrink-0 z-30">
      {/* App Header & Company Switcher */}
      <div className="p-4 border-b border-zinc-200/80 relative">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="h-7 w-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold text-xs">
            K
          </div>
          <span className="font-semibold text-sm tracking-tight text-zinc-900">Kounta</span>
          <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200 ml-auto">
            SaaS
          </span>
        </div>

        {/* Company Switcher Pill */}
        <button
          type="button"
          onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
          className="w-full flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-200/70 hover:bg-zinc-100/70 hover:border-zinc-300 transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base shrink-0">
              {activeCompany?.country === 'CO' ? '🇨🇴' : '🇺🇸'}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-900 truncate group-hover:text-black">
                {activeCompany?.name || 'Seleccionar empresa'}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono-numbers truncate">
                {activeCompany?.tax_id ? `${activeCompany.tax_id} · ${activeCompany.base_currency}` : 'Sin empresa'}
              </div>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 shrink-0 transition-transform duration-200',
              companyDropdownOpen && 'rotate-180'
            )}
          />
        </button>

        {/* Company Dropdown Menu */}
        {companyDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setCompanyDropdownOpen(false)}
            />
            <div className="absolute top-[calc(100%-4px)] left-4 right-4 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg p-1.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-2 py-1.5">
                Mis Empresas
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {companies.map((c) => {
                  const isActive = c.id === activeCompany?.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        switchCompany(c.id);
                        setCompanyDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer',
                        isActive
                          ? 'bg-zinc-100 text-zinc-900 font-medium'
                          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{c.country === 'CO' ? '🇨🇴' : '🇺🇸'}</span>
                        <div className="truncate">
                          <div className="truncate font-medium">{c.name}</div>
                          <div className="text-[10px] text-zinc-400 font-mono-numbers">
                            {c.base_currency} · {c.tax_id}
                          </div>
                        </div>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-zinc-900 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-1.5 pt-1.5 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setCompanyDropdownOpen(false);
                    router.push('/onboarding');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear nueva empresa</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-2 mb-2">
          Módulos
        </div>
        {navigation.map((item) => {
          const isActive =
            item.matchPaths.includes(pathname) ||
            (item.href === '/invoices' &&
              (pathname.startsWith('/invoices/') || pathname.startsWith('/dashboard/invoices/')));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all',
                isActive
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-zinc-500')} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Role Indicator & User Footer */}
      <div className="p-3 border-t border-zinc-200/80 bg-zinc-50/50">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex items-center gap-1.5">
            {activeRole === 'ADMIN' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                <Shield className="w-3 h-3 text-emerald-600" /> ADMIN
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                <Briefcase className="w-3 h-3 text-blue-600" /> WORKER
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-400 font-mono-numbers">
            {activeCompany?.country === 'CO' ? 'DIAN CO' : 'IRS US'}
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-medium text-zinc-900 truncate">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'}
            </div>
            <div className="text-[10px] text-zinc-500 truncate">{user?.email}</div>
          </div>
          <button
            type="button"
            onClick={signOut}
            title="Cerrar sesión"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
