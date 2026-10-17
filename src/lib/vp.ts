// Vuka Points economics (locked contract):
//   monthly staircase — 5,000 VP = R50, 10,000 VP = R100, 15,000 VP = R150;
//   above the reached tier, a linear top-up of R1 per 100 VP.

export interface VpTier {
  threshold: number;
  baseRand: number;
}

export const VP_TIERS: VpTier[] = [
  { threshold: 5000, baseRand: 50 },
  { threshold: 10000, baseRand: 100 },
  { threshold: 15000, baseRand: 150 },
];

/** The tier a balance has reached (highest qualifying), or null below 5k. */
export function reachedTier(vp: number): VpTier | null {
  let hit: VpTier | null = null;
  for (const t of VP_TIERS) {
    if (vp >= t.threshold) hit = t;
  }
  return hit;
}

/** Next tier above the current balance, for progress displays. */
export function nextTier(vp: number): VpTier | null {
  for (const t of VP_TIERS) {
    if (vp < t.threshold) return t;
  }
  return null;
}

/** Estimated monthly payout in Rand: tier base + R1 per 100 VP above the tier. */
export function estimatePayoutRand(vp: number): number {
  const tier = reachedTier(vp);
  if (!tier) return 0;
  return tier.baseRand + Math.floor((vp - tier.threshold) / 100);
}

export function formatRand(rand: number): string {
  return `R${rand.toLocaleString('en-ZA')}`;
}
