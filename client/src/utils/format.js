const inrFmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

// Prices are INR rupees (not cents) everywhere in Roomly. No decimals needed
// for display; use inrPrecise when a stored rupee amount has decimals.
const inrFmtPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateFmtTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Format a whole-rupee number as ₹, e.g. 9500 -> "₹9,500". */
export function inr(n) {
  return inrFmt.format(Math.round(Number(n) || 0));
}

/** Format a rupee number that may have paise, e.g. 10233.75 -> "₹10,233.75". */
export function inrPrecise(n) {
  return inrFmtPrecise.format(Number(n) || 0);
}

/** "DD MMM YYYY", e.g. 2026-11-04T14:00:00Z -> "04 Nov 2026". */
export function dateIN(iso) {
  if (!iso) return '';
  return dateFmt.format(new Date(iso));
}

/** "DD MMM YYYY, hh:mm" */
export function dateTimeIN(iso) {
  if (!iso) return '';
  return dateFmtTime.format(new Date(iso));
}

/** "$X / night" style chip text, in INR. */
export function perNight(n) {
  return `${inr(n)} / night`;
}
