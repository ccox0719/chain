import { FactionId } from "../../types/game";

export interface FactionRewardDefinition {
  factionId: FactionId;
  standingRequirement: number;
  moduleId: string;
  title: string;
  description: string;
}

export const factionRewardCatalog: Partial<Record<FactionId, FactionRewardDefinition>> = {
  "aurelian-league": {
    factionId: "aurelian-league",
    standingRequirement: 3,
    moduleId: "aeon-command-core",
    title: "League Command Core",
    description: "A battlefield command lattice granted only to proven League captains."
  },
  "cinder-union": {
    factionId: "cinder-union",
    standingRequirement: 3,
    moduleId: "apex-ward-matrix",
    title: "Union Apex Ward",
    description: "A siege-grade shield matrix issued to captains the Union trusts with its hardest fronts."
  },
  veilborn: {
    factionId: "veilborn",
    standingRequirement: 3,
    moduleId: "atlas-salvage-array",
    title: "Veilborn Atlas Array",
    description: "A relic recovery net that only opens for crews who have earned Veilborn silence and trust."
  },
  "helion-cabal": {
    factionId: "helion-cabal",
    standingRequirement: 3,
    moduleId: "solar-prism-cannon",
    title: "Cabal Prism Mandate",
    description: "A clean, overwhelming forward weapon reserved for the Cabal's highest technical circles."
  }
};

export function getFactionRewardDefinition(factionId: FactionId) {
  return factionRewardCatalog[factionId] ?? null;
}
