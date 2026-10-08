'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, companies, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth');
      } else if (companies.length === 0) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, companies, isLoading, router]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-bold text-sm shadow-sm animate-pulse">
          K
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono-numbers">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600" />
          <span>Iniciando Kounta...</span>
        </div>
      </div>
    </div>
  );
}
