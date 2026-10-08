'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/auth-context';
import { Customer } from '@/types/database';
import { X, Loader2, UserPlus, AlertCircle } from 'lucide-react';

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
}

export function CreateCustomerModal({ isOpen, onClose, onCustomerCreated }: CreateCustomerModalProps) {
  const { activeCompany } = useAuth();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!activeCompany) {
      setErrorMessage('No hay empresa activa seleccionada.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          company_id: activeCompany.id,
          name: name.trim(),
          tax_id: taxId.trim(),
          email: email.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onCustomerCreated(data as Customer);
        onClose();
        setName('');
        setTaxId('');
        setEmail('');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error al guardar el cliente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-900">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">Registrar Cliente</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Nombre o Razón Social
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Distribuidora del Norte SAS"
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              {activeCompany?.country === 'CO' ? 'NIT / Cédula del Cliente' : 'Tax ID / EIN / SSN'}
            </label>
            <input
              type="text"
              required
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder={activeCompany?.country === 'CO' ? '900.876.543-2' : '12-3456789'}
              className="w-full px-3 py-2 text-xs font-mono-numbers bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Correo Electrónico de Facturación
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="facturacion@cliente.com"
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Guardar Cliente</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
