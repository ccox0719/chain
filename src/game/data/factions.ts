import { DamageProfile, FactionDefinition, FactionId, ResistProfile } from "../../types/game";

const damage = (em: number, thermal: number, kinetic: number, explosive: number): DamageProfile => ({
  em,
  thermal,
  kinetic,
  explosive
});

const resist = (em: number, thermal: number, kinetic: number, explosive: number): ResistProfile => ({
  em,
  thermal,
  kinetic,
  explosive
});

export const factionData: Record<FactionId, FactionDefinition> = {
  "aurelian-league": {
    id: "aurelian-league",
    name: "Aurelian League",
    color: "#79b8ff",
    icon: "◈",
    description: "Orderly trade fleets, bright shield tech, and disciplined pilots.",
    preferredDamageProfile: damage(0.54, 0.34, 0.08, 0.04),
    preferredResistanceProfile: resist(0.2, 0.26, 0.22, 0.16),
    tankStyle: "shield",
    doctrineTags: ["laser", "mid-range", "shield", "discipline"],
    regions: ["aurelian-core"],
    threatSummary: "EM/Thermal shield pressure with disciplined mid-range formations."
  },
  "cinder-union": {
    id: "cinder-union",
    name: "Cinder Union",
    color: "#ff9d6e",
    icon: "▲",
    description: "Hard-burn prospectors and militias that turn mining lanes into war zones.",
    preferredDamageProfile: damage(0.08, 0.38, 0.34, 0.2),
    preferredResistanceProfile: resist(0.16, 0.24, 0.28, 0.18),
    tankStyle: "armor",
    doctrineTags: ["rail", "missile", "armor", "brawl"],
    regions: ["industrial-fringe"],
    threatSummary: "Kinetic/Thermal armor fleets built to grind through convoy lanes."
  },
  veilborn: {
    id: "veilborn",
    name: "Veilborn",
    color: "#c795ff",
    icon: "◆",
    description: "Fast opportunists, scavenger crews, and quiet raiders from the edge.",
    preferredDamageProfile: damage(0.1, 0.2, 0.36, 0.34),
    preferredResistanceProfile: resist(0.12, 0.18, 0.26, 0.22),
    tankStyle: "mixed",
    doctrineTags: ["skirmish", "control", "speed", "missile"],
    regions: ["frontier-march"],
    threatSummary: "Mixed burst damage, control tools, and fast skirmishing pressure."
  },
  "helion-cabal": {
    id: "helion-cabal",
    name: "Helion Cabal",
    color: "#8fd3ff",
    icon: "✦",
    description: "Precision-minded technocrats who weaponize optics, shields, and clean orbital fire.",
    preferredDamageProfile: damage(0.52, 0.34, 0.08, 0.06),
    preferredResistanceProfile: resist(0.24, 0.28, 0.18, 0.14),
    tankStyle: "shield",
    doctrineTags: ["laser", "sniper", "shield", "precision"],
    regions: ["aurelian-core"],
    threatSummary: "EM/Thermal shield fleets that fight at range with precise laser pressure."
  },
  "ironbound-syndicate": {
    id: "ironbound-syndicate",
    name: "Ironbound Syndicate",
    color: "#d2a06a",
    icon: "⬢",
    description: "Contract haulers and warfoundry crews that defend the fringe with armored bulk.",
    preferredDamageProfile: damage(0.08, 0.18, 0.42, 0.32),
    preferredResistanceProfile: resist(0.14, 0.18, 0.3, 0.2),
    tankStyle: "armor",
    doctrineTags: ["armor", "brawl", "rail", "artillery"],
    regions: ["industrial-fringe"],
    threatSummary: "Kinetic/Explosive armor hulls that hit hard and hold the line."
  },
  "blackwake-clans": {
    id: "blackwake-clans",
    name: "Blackwake Clans",
    color: "#ff7e8c",
    icon: "☠",
    description: "Raider clans and salvage fleets that survive by speed, disruption, and ugly improvisation.",
    preferredDamageProfile: damage(0.08, 0.14, 0.38, 0.4),
    preferredResistanceProfile: resist(0.1, 0.14, 0.22, 0.2),
    tankStyle: "mixed",
    doctrineTags: ["pirate", "skirmish", "control", "ambush"],
    regions: ["frontier-march"],
    threatSummary: "Mixed pirate raids with control modules, ambush pressure, and erratic burst damage."
  }
};

export function factionDamageLabel(factionId: FactionId) {
  const profile = factionData[factionId].preferredDamageProfile;
  const entries = Object.entries(profile).sort((left, right) => right[1] - left[1]);
  return entries
    .filter(([, value]) => value >= 0.15)
    .slice(0, 2)
    .map(([key]) => key.toUpperCase())
    .join(" / ") || "Mixed";
}

export function factionResistLabel(factionId: FactionId) {
  const profile = factionData[factionId].preferredResistanceProfile;
  const entries = Object.entries(profile).sort((left, right) => right[1] - left[1]);
  return entries
    .filter(([, value]) => value >= 0.12)
    .slice(0, 2)
    .map(([key]) => key.toUpperCase())
    .join(" / ") || "Mixed";
}
