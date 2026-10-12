'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Customer } from '@/types/database';
import {
  Users,
  Plus,
  Search,
  Mail,
  MapPin,
  Pencil,
  Eye,
  X,
  FileText,
  Building2
} from 'lucide-react';
import { CreateCustomerModal } from '@/components/modals/create-customer-modal';
import { CustomerDetailsModal } from '@/components/modals/customer-details-modal';
import { Toast, ToastMessage } from '@/components/ui/toast';

export function CustomersView() {
  const { activeCompany } = useAuth();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [selectedCustomerForDetails, setSelectedCustomerForDetails] = useState<Customer | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const isColombia = activeCompany?.country !== 'US';

  const loadCustomers = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_id, name, tax_id, email, billing_address, created_at')
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

  const handleOpenCreateModal = () => {
    setCustomerToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setCustomerToEdit(customer);
    setIsFormModalOpen(true);
  };

  const handleCustomerSaved = (savedCustomer: Customer, mode: 'create' | 'edit') => {
    if (mode === 'create') {
      // Real-time optimistic list update without full page reload
      setCustomers((prev) => [savedCustomer, ...prev]);
      setToast({
        id: String(Date.now()),
        type: 'success',
        title: 'Cliente guardado exitosamente',
        description: `${savedCustomer.name} ha sido agregado al directorio.`,
      });
    } else {
      // Update existing customer in real-time
      setCustomers((prev) =>
        prev.map((c) => (c.id === savedCustomer.id ? savedCustomer : c))
      );
      setToast({
        id: String(Date.now()),
        type: 'success',
        title: 'Cliente guardado exitosamente',
        description: `Los datos de ${savedCustomer.name} fueron actualizados.`,
      });
    }
  };

  // Reactive search by name or Tax ID / NIT (and email)
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCustomers = customers.filter((cust) => {
    if (!normalizedQuery) return true;
    const matchName = (cust.name || '').toLowerCase().includes(normalizedQuery);
    const matchTaxId = (cust.tax_id || '').toLowerCase().includes(normalizedQuery);
    const matchEmail = (cust.email || '').toLowerCase().includes(normalizedQuery);
    return matchName || matchTaxId || matchEmail;
  });

  return (
    <>
      {/* Top Page Header (Fintech Premium Style) */}
      <header className="h-16 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-semibold tracking-tight text-zinc-900">
                Clientes
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono-numbers font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/80">
                {loading ? '—' : customers.length} {customers.length === 1 ? 'cliente' : 'clientes'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Directorio fiscal y comercial de {activeCompany?.name || 'tu empresa'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium tracking-tight shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nuevo Cliente</span>
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl w-full mx-auto space-y-5">
        {/* Reactive Search Bar & Filter Summary */}
        <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isColombia
                  ? 'Buscar por nombre o NIT / Documento...'
                  : 'Buscar por nombre o Tax ID / EIN...'
              }
              className="w-full pl-9 pr-8 py-2 text-xs bg-zinc-50/70 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-400 hover:text-zinc-700 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-zinc-500">
            {searchQuery && !loading && (
              <span className="font-mono-numbers text-[11px]">
                Mostrando {filteredCustomers.length} de {customers.length}
              </span>
            )}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-50 border border-zinc-200/70 text-[11px] text-zinc-600">
              <span>{isColombia ? '🇨🇴 Régimen DIAN (NIT)' : '🇺🇸 IRS Standard (EIN)'}</span>
            </div>
          </div>
        </div>

        {/* Styled Customers Table */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
          {loading ? (
            /* Skeleton Loading States */
            <div className="divide-y divide-zinc-100">
              <div className="bg-zinc-50/70 border-b border-zinc-100 py-3 px-5 grid grid-cols-12 gap-4">
                <div className="col-span-4 h-3.5 w-24 bg-zinc-200/70 rounded animate-pulse" />
                <div className="col-span-2 h-3.5 w-20 bg-zinc-200/70 rounded animate-pulse" />
                <div className="col-span-4 h-3.5 w-32 bg-zinc-200/70 rounded animate-pulse" />
                <div className="col-span-2 h-3.5 w-16 bg-zinc-200/70 rounded animate-pulse ml-auto" />
              </div>
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="py-4 px-5 grid grid-cols-12 items-center gap-4"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-zinc-100 animate-pulse shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 w-36 bg-zinc-100 rounded animate-pulse" />
                      <div className="h-2.5 w-44 bg-zinc-100/80 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="h-5 w-28 bg-zinc-100 rounded-md animate-pulse" />
                  </div>
                  <div className="col-span-4">
                    <div className="h-3.5 w-52 bg-zinc-100 rounded animate-pulse" />
                  </div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <div className="h-7 w-16 bg-zinc-100 rounded-lg animate-pulse" />
                    <div className="h-7 w-20 bg-zinc-100 rounded-lg animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            /* Elegant Empty State when company has no customers yet */
            <div className="py-16 px-6 text-center flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-2xl bg-zinc-100 border border-zinc-200/60 text-zinc-500 flex items-center justify-center mb-3.5 shadow-2xs">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Aún no tienes clientes registrados
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm leading-relaxed">
                Agrega tu primer cliente con su {isColombia ? 'NIT' : 'Tax ID / EIN'} y dirección fiscal para comenzar a emitir facturas y gestionar cuentas por cobrar.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="mt-5 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nuevo Cliente</span>
              </button>
            </div>
          ) : filteredCustomers.length === 0 ? (
            /* Empty Search Results State */
            <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
              <div className="h-11 w-11 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mb-3">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-medium text-zinc-900">
                Sin resultados para &ldquo;{searchQuery}&rdquo;
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                No encontramos ningún cliente que coincida con ese nombre o identificación fiscal.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-4 px-3.5 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 rounded-lg transition-colors cursor-pointer"
              >
                Limpiar filtro de búsqueda
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-zinc-200/80 text-zinc-500 text-[11px] font-medium">
                    <th className="py-3 px-5">Cliente</th>
                    <th className="py-3 px-4">
                      {isColombia ? 'NIT / Documento' : 'Tax ID / EIN'}
                    </th>
                    <th className="py-3 px-4">Dirección de Facturación</th>
                    <th className="py-3 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredCustomers.map((cust) => (
                    <tr
                      key={cust.id}
                      className="hover:bg-zinc-50/70 transition-colors group"
                    >
                      {/* Col 1: Cliente (Nombre + Email en tipografía secundaria) */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-zinc-100 border border-zinc-200/70 text-zinc-800 flex items-center justify-center font-semibold text-xs shrink-0 group-hover:bg-zinc-900 group-hover:text-white group-hover:border-zinc-900 transition-colors">
                            {cust.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-zinc-900 truncate max-w-[240px]">
                              {cust.name}
                            </div>
                            <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5 truncate max-w-[240px]">
                              <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span className="truncate">
                                {cust.email || 'Sin correo electrónico'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Tax ID / NIT (Monospace) */}
                      <td className="py-3.5 px-4">
                        {cust.tax_id ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-zinc-100/80 border border-zinc-200/70 font-mono-numbers text-xs font-medium text-zinc-800">
                            {cust.tax_id}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">No registrado</span>
                        )}
                      </td>

                      {/* Col 3: Dirección de Facturación */}
                      <td className="py-3.5 px-4">
                        {cust.billing_address ? (
                          <div className="flex items-start gap-1.5 text-zinc-600 max-w-xs">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                            <span className="truncate">{cust.billing_address}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">
                            Sin dirección fiscal
                          </span>
                        )}
                      </td>

                      {/* Col 4: Acciones (Editar / Ver detalles) */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerForDetails(cust)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent hover:border-zinc-200/80 transition-all cursor-pointer"
                            title="Ver detalles y estado de cuenta"
                          >
                            <Eye className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Ver detalles</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(cust)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200/90 shadow-2xs transition-all cursor-pointer"
                            title="Editar datos del cliente"
                          >
                            <Pencil className="w-3 h-3 text-zinc-500" />
                            <span>Editar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Crear / Editar Cliente */}
      <CreateCustomerModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setCustomerToEdit(null);
        }}
        customerToEdit={customerToEdit}
        onCustomerSaved={handleCustomerSaved}
      />

      {/* Modal Ver Detalles del Cliente */}
      <CustomerDetailsModal
        customer={selectedCustomerForDetails}
        isOpen={Boolean(selectedCustomerForDetails)}
        onClose={() => setSelectedCustomerForDetails(null)}
        onEditCustomer={(cust) => handleOpenEditModal(cust)}
      />

      {/* Notificación Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
