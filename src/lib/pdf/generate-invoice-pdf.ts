import { jsPDF } from 'jspdf';
import { Company, Customer, Invoice, InvoiceItem } from '@/types/database';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';

interface GenerateInvoicePdfParams {
  invoice: Invoice;
  company: Company;
  customer: Customer | null;
  items: InvoiceItem[];
  emitterEmail?: string | null;
}

export function generateInvoicePdf({
  invoice,
  company,
  customer,
  items,
  emitterEmail,
}: GenerateInvoicePdfParams) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2; // 170mm

  const isColombia =
    (invoice.tax_breakdown?.country || company.country) !== 'US';
  const currency = invoice.currency || company.base_currency || 'COP';
  const breakdown = invoice.tax_breakdown || {};
  const statusInfo = getStatusBadge(invoice.status);

  // Top Editorial Accent Bar (Monochrome Zinc-950)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 3, 'F');

  let y = 22;

  // ==========================================
  // 1. ENCABEZADO (Emisor + Datos del Documento)
  // ==========================================
  // Left: Company Brand & Legal Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(9, 9, 11);
  doc.text(company.legal_name || company.name, marginX, y);

  // Right: FACTURA Title & Number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(113, 113, 122);
  doc.text(
    isColombia ? 'FACTURA DE VENTA' : 'COMMERCIAL INVOICE',
    pageWidth - marginX,
    y - 3,
    { align: 'right' }
  );

  doc.setFont('courier', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(9, 9, 11);
  doc.text(invoice.invoice_number, pageWidth - marginX, y + 3, {
    align: 'right',
  });

  y += 6;

  // Company Sub-details (Tax ID & Contact)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(82, 82, 91);
  if (company.name && company.name !== company.legal_name) {
    doc.text(`Nombre comercial: ${company.name}`, marginX, y);
    y += 4.5;
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${isColombia ? 'NIT' : 'EIN / Tax ID'}: ${company.tax_id}`,
    marginX,
    y
  );

  // Status Pill on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(63, 63, 70);
  doc.text(
    `ESTADO: ${statusInfo.label.toUpperCase()} (${invoice.status})`,
    pageWidth - marginX,
    y,
    { align: 'right' }
  );

  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(113, 113, 122);
  const contactLine = [
    isColombia ? 'Colombia (Régimen DIAN)' : 'United States (IRS Standard)',
    emitterEmail || null,
  ]
    .filter(Boolean)
    .join(' · ');
  doc.text(contactLine, marginX, y);

  y += 8;

  // Hairline Divider
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.3);
  doc.line(marginX, y, pageWidth - marginX, y);

  y += 8;

  // ==========================================
  // 2. BLOQUE DEL CLIENTE ("Facturado a") & FECHAS
  // ==========================================
  const blockStartY = y;

  // Left Column: Facturado a
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(113, 113, 122);
  doc.text('FACTURADO A', marginX, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(9, 9, 11);
  doc.text(customer?.name || 'Cliente General', marginX, y);

  y += 4.8;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(63, 63, 70);
  doc.text(
    `${isColombia ? 'NIT / Doc' : 'Tax ID / EIN'}: ${
      customer?.tax_id || 'No registrado'
    }`,
    marginX,
    y
  );

  if (customer?.email) {
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(82, 82, 91);
    doc.text(customer.email, marginX, y);
  }

  if (customer?.billing_address) {
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(82, 82, 91);
    const addrLines = doc.splitTextToSize(customer.billing_address, 95);
    doc.text(addrLines, marginX, y);
    y += (addrLines.length - 1) * 4;
  }

  // Right Column: Metadata (Dates & Currency)
  let rightY = blockStartY;
  const metaLabelX = pageWidth - marginX - 65;
  const metaValueX = pageWidth - marginX;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(113, 113, 122);
  doc.text('DETALLES DEL DOCUMENTO', metaValueX, rightY, { align: 'right' });

  rightY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(113, 113, 122);
  doc.text('Fecha de emisión:', metaLabelX, rightY);
  doc.setFont('courier', 'normal');
  doc.setTextColor(24, 24, 27);
  doc.text(formatDate(invoice.issue_date), metaValueX, rightY, {
    align: 'right',
  });

  rightY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(113, 113, 122);
  doc.text('Fecha de vencimiento:', metaLabelX, rightY);
  doc.setFont('courier', 'normal');
  doc.setTextColor(24, 24, 27);
  doc.text(formatDate(invoice.due_date), metaValueX, rightY, {
    align: 'right',
  });

  rightY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(113, 113, 122);
  doc.text('Moneda del documento:', metaLabelX, rightY);
  doc.setFont('courier', 'bold');
  doc.setTextColor(24, 24, 27);
  doc.text(currency, metaValueX, rightY, { align: 'right' });

  y = Math.max(y, rightY) + 10;

  // ==========================================
  // 3. TABLA DE CONCEPTOS
  // ==========================================
  // Table Header Background
  doc.setFillColor(244, 244, 245); // Zinc-100
  doc.rect(marginX, y, contentWidth, 8, 'F');
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.25);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.line(marginX, y + 8, pageWidth - marginX, y + 8);

  const colDescX = marginX + 3;
  const colQtyX = marginX + 102;
  const colPriceX = marginX + 135;
  const colTotalX = pageWidth - marginX - 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(82, 82, 91);
  doc.text('DESCRIPCIÓN', colDescX, y + 5.3);
  doc.text('CANT.', colQtyX, y + 5.3, { align: 'right' });
  doc.text('PRECIO UNIT.', colPriceX, y + 5.3, { align: 'right' });
  doc.text('TOTAL LÍNEA', colTotalX, y + 5.3, { align: 'right' });

  y += 8;

  // Table Rows
  const safeItems = items.length > 0 ? items : [];
  safeItems.forEach((item) => {
    if (y > pageHeight - 65) {
      doc.addPage();
      y = 25;
    }

    const descLines = doc.splitTextToSize(item.description || '-', 85);
    const rowHeight = Math.max(9, descLines.length * 4.5 + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(24, 24, 27);
    doc.text(descLines, colDescX, y + 5.5);

    // Monospace numbers for clean decimal alignment
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(63, 63, 70);
    doc.text(String(item.quantity), colQtyX, y + 5.5, { align: 'right' });
    doc.text(
      formatCurrency(Number(item.unit_price), currency),
      colPriceX,
      y + 5.5,
      { align: 'right' }
    );

    doc.setFont('courier', 'bold');
    doc.setTextColor(9, 9, 11);
    doc.text(
      formatCurrency(Number(item.amount), currency),
      colTotalX,
      y + 5.5,
      { align: 'right' }
    );

    y += rowHeight;
    doc.setDrawColor(244, 244, 245);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, pageWidth - marginX, y);
  });

  y += 6;

  // ==========================================
  // 4. BLOQUE DE TOTALES (Localización Fiscal CO / US)
  // ==========================================
  const totalsLeftX = pageWidth - marginX - 78;
  const totalsRightX = pageWidth - marginX - 3;

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(82, 82, 91);
  doc.text('Subtotal', totalsLeftX, y);
  doc.setFont('courier', 'normal');
  doc.setTextColor(24, 24, 27);
  doc.text(formatCurrency(Number(invoice.subtotal), currency), totalsRightX, y, {
    align: 'right',
  });

  y += 5.5;

  if (isColombia) {
    // Colombia: IVA (19%) + Retefuente + ReteICA
    const ivaVal =
      breakdown.iva_total !== undefined
        ? Number(breakdown.iva_total)
        : Number(invoice.tax_total) || 0;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(82, 82, 91);
    doc.text('IVA (19%)', totalsLeftX, y);
    doc.setFont('courier', 'normal');
    doc.setTextColor(24, 24, 27);
    doc.text(`+${formatCurrency(ivaVal, currency)}`, totalsRightX, y, {
      align: 'right',
    });
    y += 5.5;

    if (breakdown.retefuente_enabled && (breakdown.retefuente_amount ?? 0) > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 35, 24);
      doc.text(
        `Retefuente (${breakdown.retefuente_rate ?? 2.5}%)`,
        totalsLeftX,
        y
      );
      doc.setFont('courier', 'normal');
      doc.text(
        `-${formatCurrency(Number(breakdown.retefuente_amount), currency)}`,
        totalsRightX,
        y,
        { align: 'right' }
      );
      y += 5.5;
    }

    if (breakdown.reteica_enabled && (breakdown.reteica_amount ?? 0) > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 35, 24);
      doc.text(`ReteICA (${breakdown.reteica_rate ?? 0}%)`, totalsLeftX, y);
      doc.setFont('courier', 'normal');
      doc.text(
        `-${formatCurrency(Number(breakdown.reteica_amount), currency)}`,
        totalsRightX,
        y,
        { align: 'right' }
      );
      y += 5.5;
    }
  } else {
    // US: Sales Tax
    const salesTaxRate = breakdown.sales_tax_rate ?? 0;
    const salesTaxVal =
      breakdown.sales_tax_amount !== undefined
        ? Number(breakdown.sales_tax_amount)
        : Number(invoice.tax_total) || 0;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(82, 82, 91);
    doc.text(`Sales Tax (${salesTaxRate}%)`, totalsLeftX, y);
    doc.setFont('courier', 'normal');
    doc.setTextColor(24, 24, 27);
    doc.text(`+${formatCurrency(salesTaxVal, currency)}`, totalsRightX, y, {
      align: 'right',
    });
    y += 5.5;
  }

  // Highlighted Final Total Box
  y += 1.5;
  doc.setDrawColor(24, 24, 27);
  doc.setLineWidth(0.4);
  doc.line(totalsLeftX, y, pageWidth - marginX, y);

  y += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(9, 9, 11);
  doc.text(`Total (${currency})`, totalsLeftX, y);

  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.text(
    `${formatCurrency(Number(invoice.total), currency)} ${currency}`,
    totalsRightX,
    y,
    { align: 'right' }
  );

  // ==========================================
  // 5. PIE DE PÁGINA (Términos de pago, notas bancarias y sello Kounta)
  // ==========================================
  const footerStartY = Math.max(y + 18, pageHeight - 52);

  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.25);
  doc.line(marginX, footerStartY, pageWidth - marginX, footerStartY);

  let fy = footerStartY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(82, 82, 91);
  doc.text('TÉRMINOS DE PAGO E INSTRUCCIONES BANCARIAS', marginX, fy);

  fy += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122);
  const termsText = isColombia
    ? `Favor realizar el pago antes del ${formatDate(
        invoice.due_date
      )} mediante transferencia electrónica ACH / PSE a nombre de ${
        company.legal_name
      } (NIT ${company.tax_id}). Esta factura se asimila en todos sus efectos a una letra de cambio según el Art. 774 del Código de Comercio.`
    : `Please remit payment by ${formatDate(
        invoice.due_date
      )} via ACH or Wire Transfer payable to ${company.legal_name} (EIN ${
        company.tax_id
      }). Please reference invoice number ${
        invoice.invoice_number
      } on your payment advice.`;

  const termsLines = doc.splitTextToSize(termsText, contentWidth);
  doc.text(termsLines, marginX, fy);

  // Discreet Kounta Footer at bottom of page
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text('Generado a través de Kounta', pageWidth / 2, pageHeight - 12, {
    align: 'center',
  });

  doc.save(`${invoice.invoice_number}.pdf`);
}
