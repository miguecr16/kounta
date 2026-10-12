'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type?: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 text-white border border-zinc-800 shadow-lg max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-200">
      {isError ? (
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white truncate">{toast.title}</p>
        {toast.description && (
          <p className="text-[11px] text-zinc-400 truncate mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        aria-label="Cerrar notificación"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
