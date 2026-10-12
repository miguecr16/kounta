export type CountryCode = 'CO' | 'US';
export type CompanyRole = 'ADMIN' | 'WORKER';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIAL_PAID' | 'PAID' | 'VOID';

export interface Company {
  id: string;
  name: string;
  legal_name: string;
  country: CountryCode;
  tax_id: string;
  base_currency: 'COP' | 'USD';
  created_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at?: string;
}

export interface CompanyMember {
  id: string;
  user_id: string;
  company_id: string;
  role: CompanyRole;
  created_at?: string;
  company?: Company;
  user?: UserProfile;
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  tax_id: string;
  email: string;
  billing_address?: string | null;
  created_at?: string;
}

export interface TaxBreakdown {
  country?: CountryCode;
  // Colombia (CO)
  iva_total?: number;
  retefuente_enabled?: boolean;
  retefuente_rate?: number;
  retefuente_amount?: number;
  reteica_enabled?: boolean;
  reteica_rate?: number;
  reteica_amount?: number;
  total_retentions?: number;
  // United States (US)
  sales_tax_rate?: number;
  sales_tax_amount?: number;
  line_taxes_total?: number;
}

export interface Invoice {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: string;
  exchange_rate_to_base?: number;
  subtotal: number;
  tax_total: number;
  total: number;
  tax_breakdown?: TaxBreakdown | null;
  created_by?: string | null;
  created_at?: string;
  customer?: Customer;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  company_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount: number;
}
