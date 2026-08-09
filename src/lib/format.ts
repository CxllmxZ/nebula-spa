/**
 * Thai locale formatters — reused across dashboard, bookings table, confirmation page.
 */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("th-TH").format(n);
}
