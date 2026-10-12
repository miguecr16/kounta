'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { InvoiceDetailView } from '@/components/invoices/invoice-detail-view';

function InvoiceDetailPageContent() {
  const params = useParams<{ id: string }>();
  return <InvoiceDetailView invoiceId={params.id} />;
}

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-zinc-400">Cargando comprobante...</div>}>
      <InvoiceDetailPageContent />
    </Suspense>
  );
}
