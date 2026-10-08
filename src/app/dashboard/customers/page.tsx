'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Customer } from '@/types/database';
import { formatDate } from '@/lib/utils';
import {
  Users,
  Plus,
  Search,
  Mail,
  Building,
  UserCheck,
  FileSpreadsheet
} from 'lucide-react';
import { CreateCustomerModal } from '@/components/modals/create-customer-modal';

export default function CustomersPage() {
  const { activeCompany } = useAuth();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadCustomers = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers((data as Customer[]) || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCompany, supabase]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = customers.filter((cust) => {
    return (
      cust.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cust.tax_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cust.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <>
      <Header
        title="Directorio de Clientes"
        subtitle={`Cartera comercial de ${activeCompany?.name}`}
      />

      <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Top Controls */}
        <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, NIT, EIN o correo..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium tracking-tight shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Cliente</span>
          </button>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-zinc-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-medium text-zinc-900">No se encontraron clientes</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                {searchQuery
                  ? 'No hay clientes que coincidan con la búsqueda.'
                  : 'Registra los clientes de tu empresa para poder emitirles facturas rápidamente.'}
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar primer cliente</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/70 border-b border-zinc-100 text-zinc-500 text-[11px] font-medium">
                    <th className="py-3 px-4">Nombre / Razón Social</th>
                    <th className="py-3 px-4">
                      {activeCompany?.country === 'CO' ? 'NIT' : 'EIN / Tax ID'}
                    </th>
                    <th className="py-3 px-4">Correo Electrónico</th>
                    <th className="py-3 px-4">Fecha de Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-zinc-900">
                        {cust.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono-numbers text-zinc-700">
                        {cust.tax_id}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-zinc-400" />
                          <span>{cust.email}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-mono-numbers">
                        {formatDate(cust.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <CreateCustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCustomerCreated={loadCustomers}
      />
    </>
  );
}
