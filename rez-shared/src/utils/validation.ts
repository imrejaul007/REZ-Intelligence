export function isValidIndianPhone(phone: string): boolean {
  return /^[6-9][0-9]{9}$/.test(phone.replace(/\s|-/g, ''));
}

export function isValidGSTIN(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
}

export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
}

export function isValidUPI(upi: string): boolean {
  return /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(upi);
}
