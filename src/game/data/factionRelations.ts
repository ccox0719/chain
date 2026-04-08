import { FactionId } from "../../types/game";
import { factionData } from "./factions";

export type FactionRelationKind = "ally" | "friendly" | "neutral" | "hostile" | "rival";

function uniqueFactions(factions: FactionId[]) {
  return Array.from(new Set(factions));
}

export function getFactionRelation(leftFactionId: FactionId, rightFactionId: FactionId): FactionRelationKind {
  if (leftFactionId === rightFactionId) return "ally";

  const left = factionData[leftFactionId];
  const right = factionData[rightFactionId];
  if (left.allies?.includes(rightFactionId) || right.allies?.includes(leftFactionId)) return "ally";
  if (left.rivals?.includes(rightFactionId) || right.rivals?.includes(leftFactionId)) return "rival";
  const sharedAlly = (left.allies ?? []).some((allyId) => right.allies?.includes(allyId));
  if (sharedAlly) return "friendly";
  const sharedRival = (left.rivals ?? []).some((rivalId) => right.rivals?.includes(rivalId));
  if (sharedRival) return "hostile";
  return "neutral";
}

export function getFactionRelationScore(leftFactionId: FactionId, rightFactionId: FactionId) {
  const relation = getFactionRelation(leftFactionId, rightFactionId);
  switch (relation) {
    case "ally":
      return 1;
    case "friendly":
      return 0.45;
    case "neutral":
      return 0;
    case "hostile":
      return -0.5;
    case "rival":
      return -1;
  }
}

export function getFactionCoalitionFactions(factionId: FactionId) {
  return uniqueFactions([factionId, ...(factionData[factionId].allies ?? [])]);
}

export function getFactionCoalitionSupportScore(factionId: FactionId) {
  const faction = factionData[factionId];
  const allyScore = (faction.allies ?? []).length * 0.22;
  const rivalPenalty = (faction.rivals ?? []).length * 0.08;
  return Math.max(0.7, 1 + allyScore - rivalPenalty);
}
