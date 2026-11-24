/**
 * Currency and Exchange Rate (TRM) Utilities for Kounta
 * Multi-Currency support: COP (Colombia) and USD (United States)
 */

export interface ExchangeRateResult {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  isLive: boolean;
  date?: string;
  error?: string;
}

// Sensible baseline rates for fallback if API is unreachable (e.g. offline sandbox)
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  USD: {
    COP: 4185.5,
    USD: 1,
  },
  COP: {
    USD: 0.0002389,
    COP: 1,
  },
};

/**
 * Fetches the real-time exchange rate (TRM) from open.er-api.com
 * Includes an automatic timeout and offline fallback.
 */
export async function fetchExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<ExchangeRateResult> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) {
    return {
      fromCurrency: from,
      toCurrency: to,
      rate: 1,
      isLive: true,
      date: new Date().toISOString(),
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Exchange rate API responded with status ${res.status}`);
    }

    const data = await res.json();
    if (data && data.rates && typeof data.rates[to] === 'number') {
      return {
        fromCurrency: from,
        toCurrency: to,
        rate: Number(data.rates[to]),
        isLive: true,
        date: data.time_last_update_utc || new Date().toISOString(),
      };
    }

    throw new Error(`Target currency ${to} not found in exchange rate response.`);
  } catch (err: unknown) {
    console.warn(`[Currency] Error fetching live rate for ${from}->${to}, using baseline fallback:`, err);

    // Fallback logic
    const fallbackRate =
      FALLBACK_RATES[from]?.[to] ||
      (from === 'USD' && to === 'COP'
        ? 4185.5
        : from === 'COP' && to === 'USD'
        ? 0.0002389
        : 1);

    return {
      fromCurrency: from,
      toCurrency: to,
      rate: fallbackRate,
      isLive: false,
      date: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Error al conectar con el servicio de TRM',
    };
  }
}

/**
 * Calculates the consolidated amount in company's base currency.
 * Total in Base = invoice.total * (invoice.exchange_rate_to_base || 1)
 */
export function getInvoiceAmountInBase(
  invoice: {
    total?: number | null;
    currency?: string | null;
    exchange_rate_to_base?: number | null;
  },
  baseCurrency: string = 'COP'
): number {
  const rawTotal = Number(invoice.total) || 0;
  const invCurrency = (invoice.currency || baseCurrency).toUpperCase();
  const targetBase = baseCurrency.toUpperCase();

  if (invCurrency === targetBase) {
    return rawTotal;
  }

  const rate = Number(invoice.exchange_rate_to_base) || 1;
  return rawTotal * rate;
}

/**
 * Formats a clean exchange rate representation for the UI
 * e.g. "1 USD = $4,185.50 COP" or "1 COP = $0.000239 USD"
 */
export function formatExchangeRateDisplay(
  fromCurrency: string,
  toCurrency: string,
  rate: number
): string {
  const formattedRate =
    toCurrency.toUpperCase() === 'COP'
      ? new Intl.NumberFormat('es-CO', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(rate)
      : new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 4,
          maximumFractionDigits: 6,
        }).format(rate);

  return `1 ${fromCurrency.toUpperCase()} = $${formattedRate} ${toCurrency.toUpperCase()}`;
}
