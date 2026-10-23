// Deterministic offline insights over the tenant's own procurement records.
// Never calls a provider; every result is labelled aiGenerated:false.

export type Section = { title: string; detail: string | string[] | number | boolean };
export type FallbackResult = {
  aiGenerated: false; source: 'deterministic-fallback'; summary: string; sections: Section[];
  disclaimer: string;
};

const DISCLAIMER = 'Deterministic summary computed locally from your procurement records; it is not AI-generated. Validate before acting.';

function labelled(summary: string, sections: Section[]): FallbackResult {
  return { aiGenerated: false, source: 'deterministic-fallback', summary, sections, disclaimer: DISCLAIMER };
}

export function vendorRiskFallback(vendor: Record<string, unknown>, bids: Record<string, unknown>[]): FallbackResult {
  const own = bids.filter((b) => b.vendorId === vendor.id);
  return labelled(
    `Vendor ${String(vendor.name ?? vendor.id)} is ${String(vendor.qualificationStatus ?? 'PENDING')} with risk level ${String(vendor.riskLevel ?? 'MEDIUM')} and ${own.length} recorded bids.`,
    [
      { title: 'Qualification status', detail: String(vendor.qualificationStatus ?? 'PENDING') },
      { title: 'Active', detail: Boolean(vendor.isActive) },
      { title: 'Recorded bids', detail: own.length },
      { title: 'Overall score', detail: typeof vendor.overallScore === 'number' ? vendor.overallScore : 0 },
    ],
  );
}

export function bidComparisonFallback(bids: Record<string, unknown>[]): FallbackResult {
  const priced = bids.filter((b) => typeof b.proposedAmount === 'number');
  const sorted = [...priced].sort((a, b) => Number(a.proposedAmount) - Number(b.proposedAmount));
  const lowest = sorted[0];
  return labelled(
    lowest ? `Lowest priced bid is ${String(lowest.title ?? lowest.id)} at ${Number(lowest.proposedAmount)} across ${priced.length} priced bids.` : 'No priced bids were found for comparison.',
    [
      { title: 'Bids compared', detail: bids.length },
      { title: 'Priced bids', detail: priced.length },
      { title: 'Ranked by proposed amount', detail: sorted.map((b) => `${String(b.title ?? b.id)}: ${Number(b.proposedAmount)}`) },
    ],
  );
}

export function complianceGapsFallback(vendors: Record<string, unknown>[]): FallbackResult {
  const pending = vendors.filter((v) => v.qualificationStatus === 'PENDING' || v.qualificationStatus === 'UNDER_REVIEW');
  const inactive = vendors.filter((v) => !v.isActive);
  return labelled(
    `${pending.length} of ${vendors.length} vendors still need qualification review; ${inactive.length} are inactive.`,
    [
      { title: 'Vendors recorded', detail: vendors.length },
      { title: 'Pending or under review', detail: pending.map((v) => String(v.name ?? v.id)) },
      { title: 'Inactive vendors', detail: inactive.length },
    ],
  );
}
