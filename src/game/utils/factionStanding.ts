import { FactionId, StationMarketProfile } from "../../types/game";

export type FactionStandingTier =
  | "neutral-operator"
  | "licensed-contractor"
  | "auxiliary-affiliate"
  | "fleet-support"
  | "enlisted-ally"
  | "veteran-of-the-line";

const TIER_THRESHOLDS: Array<{ tier: FactionStandingTier; minimum: number }> = [
  { tier: "veteran-of-the-line", minimum: 3 },
  { tier: "enlisted-ally", minimum: 2.7 },
  { tier: "fleet-support", minimum: 1.9 },
  { tier: "auxiliary-affiliate", minimum: 1.1 },
  { tier: "licensed-contractor", minimum: 0.45 },
  { tier: "neutral-operator", minimum: 0 }
];

const TIER_LABELS: Record<FactionStandingTier, string> = {
  "neutral-operator": "Neutral Operator",
  "licensed-contractor": "Licensed Contractor",
  "auxiliary-affiliate": "Auxiliary Affiliate",
  "fleet-support": "Fleet Support",
  "enlisted-ally": "Enlisted Ally",
  "veteran-of-the-line": "Veteran of the Line"
};

export function getFactionStandingTier(value: number): FactionStandingTier {
  const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
  return TIER_THRESHOLDS.find((entry) => normalized >= entry.minimum)?.tier ?? "neutral-operator";
}

export function getFactionStandingLabel(value: number) {
  return TIER_LABELS[getFactionStandingTier(value)];
}

export function getStandingRequirementForAccessTier(
  accessTier: StationMarketProfile["shipAccessTier"],
  factionId: FactionId,
  stationProfile: StationMarketProfile | null
) {
  if (stationProfile?.standingRequirement !== undefined) return stationProfile.standingRequirement;
  if (accessTier === "native") return factionId === stationProfile?.factionControl ? 0.45 : 0.75;
  if (accessTier === "allied") return 1.1;
  if (accessTier === "export") return 1.9;
  if (accessTier === "neutral") return 2.7;
  return 0;
}

export function getContractStandingRequirement(risk: "low" | "medium" | "high" | "extreme") {
  if (risk === "low") return 0.45;
  if (risk === "medium") return 1.1;
  if (risk === "high") return 1.9;
  return 2.7;
}

export function getFactionStandingCommerceModifiers(
  factionId: FactionId,
  standing: number,
  stationProfile: StationMarketProfile | null
) {
  if (!stationProfile || stationProfile.factionControl !== factionId) return null;
  const tier = getFactionStandingTier(standing);
  if (tier === "neutral-operator" || tier === "licensed-contractor") return null;
  if (tier === "auxiliary-affiliate") {
    return { moduleBuyMultiplier: 0.985, shipBuyMultiplier: 0.99, commodityBuyMultiplier: 0.995 };
  }
  if (tier === "fleet-support") {
    return { moduleBuyMultiplier: 0.955, shipBuyMultiplier: 0.965, commodityBuyMultiplier: 0.985 };
  }
  if (tier === "enlisted-ally") {
    return { moduleBuyMultiplier: 0.925, shipBuyMultiplier: 0.94, commodityBuyMultiplier: 0.97 };
  }
  return { moduleBuyMultiplier: 0.9, shipBuyMultiplier: 0.92, commodityBuyMultiplier: 0.96 };
}
