'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/auth-context';
import { Customer } from '@/types/database';
import {
  X,
  Loader2,
  UserPlus,
  Pencil,
  AlertCircle,
  Building2,
  Mail,
  MapPin,
  FileText
} from 'lucide-react';

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated?: (customer: Customer) => void;
  onCustomerSaved?: (customer: Customer, mode: 'create' | 'edit') => void;
  customerToEdit?: Customer | null;
}

export function CreateCustomerModal({
  isOpen,
  onClose,
  onCustomerCreated,
  onCustomerSaved,
  customerToEdit = null,
}: CreateCustomerModalProps) {
  const { activeCompany } = useAuth();
  const supabase = createClient();

  const isEditMode = Boolean(customerToEdit);
  const isColombia = activeCompany?.country !== 'US'; // Default CO if not US

  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preload fields when opening modal or changing customerToEdit
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (customerToEdit) {
        setName(customerToEdit.name || '');
        setTaxId(customerToEdit.tax_id || '');
        setEmail(customerToEdit.email || '');
        setBillingAddress(customerToEdit.billing_address || '');
      } else {
        setName('');
        setTaxId('');
        setEmail('');
        setBillingAddress('');
      }
    }
  }, [isOpen, customerToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!activeCompany) {
      setErrorMessage('No hay una empresa activa seleccionada.');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('El nombre o razón social del cliente es obligatorio.');
      return;
    }

    setLoading(true);

    try {
      if (isEditMode && customerToEdit) {
        // Update existing customer
        const { data, error } = await supabase
          .from('customers')
          .update({
            name: name.trim(),
            tax_id: taxId.trim(),
            email: email.trim(),
            billing_address: billingAddress.trim() || null,
          })
          .eq('id', customerToEdit.id)
          .eq('company_id', activeCompany.id)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const updatedCustomer = data as Customer;
          onCustomerSaved?.(updatedCustomer, 'edit');
          onCustomerCreated?.(updatedCustomer);
          onClose();
        }
      } else {
        // Insert new customer
        const { data, error } = await supabase
          .from('customers')
          .insert({
            company_id: activeCompany.id,
            name: name.trim(),
            tax_id: taxId.trim(),
            email: email.trim(),
            billing_address: billingAddress.trim() || null,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const newCustomer = data as Customer;
          onCustomerSaved?.(newCustomer, 'create');
          onCustomerCreated?.(newCustomer);
          onClose();
        }
      }
    } catch (err: any) {
      console.error('Error saving customer:', err);
      setErrorMessage(err.message || 'Ocurrió un error al guardar el cliente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl border border-zinc-200/90 shadow-xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-900 text-white shadow-xs">
              {isEditMode ? (
                <Pencil className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                {isEditMode ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <p className="text-[11px] text-zinc-500">
                {isColombia
                  ? `🇨🇴 Jurisdicción Colombia (${activeCompany?.name})`
                  : `🇺🇸 Jurisdicción EE. UU. (${activeCompany?.name})`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Nombre o Razón Social */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Nombre o Razón Social <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  isColombia
                    ? 'ej. Inversiones y Suministros del Norte S.A.S.'
                    : 'ej. Apex Global Holdings LLC'
                }
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
              />
            </div>
          </div>

          {/* Identificación Fiscal & Correo en Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                {isColombia ? 'NIT / Documento' : 'Tax ID / EIN'}
              </label>
              <div className="relative">
                <FileText className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder={isColombia ? 'ej. 900.123.456-1' : 'ej. 12-3456789'}
                  className="w-full pl-9 pr-3.5 py-2 text-xs font-mono-numbers bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                />
              </div>
              <p className="mt-1 text-[10px] text-zinc-400">
                {isColombia ? 'NIT con dígito de verificación o CC' : 'Formato federal de 9 dígitos'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Correo electrónico de facturación
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="facturacion@empresa.com"
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                />
              </div>
              <p className="mt-1 text-[10px] text-zinc-400">
                Receptor de comprobantes y alertas
              </p>
            </div>
          </div>

          {/* Dirección Fiscal (billing_address) */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Dirección fiscal
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <textarea
                rows={2}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder={
                  isColombia
                    ? 'ej. Calle 93B # 13-47 Of. 401, Bogotá D.C., Colombia'
                    : 'ej. 548 Market St, Suite 32114, San Francisco, CA 94104'
                }
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-50/60 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEditMode ? 'Guardar Cambios' : 'Guardar Cliente'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
