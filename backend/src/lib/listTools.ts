// Pure list helpers for vendors: search/filter + CSV export. No I/O.

export const VENDOR_COLUMNS = ['name', 'email', 'industryType', 'qualificationStatus', 'isActive', 'riskLevel'];

type VendorLike = Record<string, unknown>;

export function filterVendors(rows: VendorLike[], { q = '', qualificationStatus = '' }: { q?: string; qualificationStatus?: string } = {}): VendorLike[] {
  const needle = String(q || '').trim().toLowerCase();
  return (rows || []).filter((row) => {
    if (qualificationStatus && row.qualificationStatus !== qualificationStatus) return false;
    if (!needle) return true;
    return [row.name, row.email, row.industryType, row.qualificationStatus]
      .some((value) => String(value ?? '').toLowerCase().includes(needle));
  });
}

export function toCsv(rows: VendorLike[], columns: string[] = VENDOR_COLUMNS): string {
  const esc = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  return [columns.join(','), ...(rows || []).map((row) => columns.map((col) => esc(row[col])).join(','))].join('\n');
}
