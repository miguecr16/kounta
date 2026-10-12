'use client';

import React, { Suspense } from 'react';
import { InvoicesView } from '@/components/invoices/invoices-view';

export default function DashboardInvoicesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-zinc-400">Cargando facturas...</div>}>
      <InvoicesView />
    </Suspense>
  );
}
