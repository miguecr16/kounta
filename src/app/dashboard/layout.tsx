'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, activeCompany, isLoading, companies } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth');
      } else if (companies.length === 0) {
        router.push('/onboarding');
      }
    }
  }, [user, companies, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-bold text-sm shadow-sm animate-pulse">
            K
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono-numbers">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600" />
            <span>Cargando Kounta...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
