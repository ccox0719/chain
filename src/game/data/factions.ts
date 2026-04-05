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
    icon: "Diamond",
    description: "Orderly trade fleets, bright shield tech, and disciplined pilots.",
    loreBlurb:
      "The League holds the core together through convoy law, polished shield doctrine, and the belief that secure trade is civilization made visible.",
    visualIdentity: "Blue-white civic hulls, bright shield bloom, and orderly lane geometry.",
    preferredDamageProfile: damage(0.54, 0.34, 0.08, 0.04),
    preferredResistanceProfile: resist(0.2, 0.26, 0.22, 0.16),
    tankStyle: "shield",
    doctrineTags: ["laser", "mid-range", "shield", "discipline"],
    doctrineSummary:
      "Disciplined shield fleets that prefer clean lanes, stable range control, and laser pressure before a fight turns messy.",
    enemyArchetypePreferences: ["security line ship", "escort skirmisher", "shield support"],
    prepAdvice: "Prepare for EM/Thermal shield fleets, orderly focus fire, and solid mid-range coverage.",
    regions: ["aurelian-core"],
    threatSummary: "EM/Thermal shield pressure with disciplined mid-range formations."
  },
  "cinder-union": {
    id: "cinder-union",
    name: "Cinder Union",
    color: "#ff9d6e",
    icon: "Anvil",
    description: "Hard-burn prospectors and militias that turn mining lanes into war zones.",
    loreBlurb:
      "The Union builds wealth out of ore, heat, and convoy discipline, then arms that whole machine when someone threatens the route.",
    visualIdentity: "Soot-orange foundry plating, industrial glare, and armored convoy silhouettes.",
    preferredDamageProfile: damage(0.08, 0.38, 0.34, 0.2),
    preferredResistanceProfile: resist(0.16, 0.24, 0.28, 0.18),
    tankStyle: "armor",
    doctrineTags: ["rail", "missile", "armor", "brawl"],
    doctrineSummary:
      "Armor-heavy industrial warfleets that force commitments, grind with rails, and use convoy mass to own space.",
    enemyArchetypePreferences: ["heavy bruiser", "missile skirmisher", "convoy artillery"],
    prepAdvice: "Expect thicker armor, kinetic-heavy pressure, and opponents that are slow until they pin the fight.",
    regions: ["industrial-fringe"],
    threatSummary: "Kinetic/Thermal armor fleets built to grind through convoy lanes."
  },
  veilborn: {
    id: "veilborn",
    name: "Veilborn",
    color: "#c795ff",
    icon: "Veil",
    description: "Fast opportunists, scavenger crews, and quiet raiders from the edge.",
    loreBlurb:
      "The Veilborn survive by knowing dark lanes better than anyone else and turning drift, silence, and bad geometry into tactical advantage.",
    visualIdentity: "Cold violet signatures, low-visibility hulls, and ghostlight trail effects.",
    preferredDamageProfile: damage(0.1, 0.2, 0.36, 0.34),
    preferredResistanceProfile: resist(0.12, 0.18, 0.26, 0.22),
    tankStyle: "mixed",
    doctrineTags: ["skirmish", "control", "speed", "missile"],
    doctrineSummary:
      "Fast control fleets that distort positioning, collapse isolated targets, and punish pilots who drift into bad space.",
    enemyArchetypePreferences: ["hunter", "control support", "missile skirmisher"],
    prepAdvice: "Bring answers to tackle and range control. Veilborn fights are won by geometry before raw damage.",
    regions: ["frontier-march"],
    threatSummary: "Mixed burst damage, control tools, and fast skirmishing pressure."
  },
  "helion-cabal": {
    id: "helion-cabal",
    name: "Helion Cabal",
    color: "#8fd3ff",
    icon: "Prism",
    description: "Precision-minded technocrats who weaponize optics, shields, and clean orbital fire.",
    loreBlurb:
      "The Cabal treats combat like a solved technical problem, preferring superior telemetry, shield quality, and surgical fire control.",
    visualIdentity: "Prismatic shield flares, pale laser lances, and mirrored hull accents.",
    preferredDamageProfile: damage(0.52, 0.34, 0.08, 0.06),
    preferredResistanceProfile: resist(0.24, 0.28, 0.18, 0.14),
    tankStyle: "shield",
    doctrineTags: ["laser", "sniper", "shield", "precision"],
    doctrineSummary:
      "Precision shield doctrine built around long-range laser pressure, overwatch ships, and clean target discipline.",
    enemyArchetypePreferences: ["siege sniper", "precision line ship", "sensor support"],
    prepAdvice: "Use terrain, close distance deliberately, and do not give Cabal snipers a stable firing lane.",
    regions: ["aurelian-core"],
    threatSummary: "EM/Thermal shield fleets that fight at range with precise laser pressure."
  },
  "ironbound-syndicate": {
    id: "ironbound-syndicate",
    name: "Ironbound Syndicate",
    color: "#d2a06a",
    icon: "Bulwark",
    description: "Contract haulers and warfoundry crews that defend the fringe with armored bulk.",
    loreBlurb:
      "Ironbound sells security the way it sells freight capacity: in thick plating, hard contracts, and reliable violence.",
    visualIdentity: "Bronze armor slabs, heavy silhouettes, and furnace-lit broadside flashes.",
    preferredDamageProfile: damage(0.08, 0.18, 0.42, 0.32),
    preferredResistanceProfile: resist(0.14, 0.18, 0.3, 0.2),
    tankStyle: "armor",
    doctrineTags: ["armor", "brawl", "rail", "artillery"],
    doctrineSummary:
      "Hard armor formations that anchor lanes, punish overcommitment, and combine artillery screens with bruiser hulls.",
    enemyArchetypePreferences: ["heavy bruiser", "artillery gunship", "armor command hull"],
    prepAdvice: "Bring tools to break armor and enough mobility to avoid feeding their preferred short-to-mid range brawl.",
    regions: ["industrial-fringe"],
    threatSummary: "Kinetic/Explosive armor hulls that hit hard and hold the line."
  },
  "blackwake-clans": {
    id: "blackwake-clans",
    name: "Blackwake Clans",
    color: "#ff7e8c",
    icon: "Skull",
    description: "Raider clans and salvage fleets that survive by speed, disruption, and ugly improvisation.",
    loreBlurb:
      "Blackwake clans turn broken routes into hunting grounds, treating ambush, salvage, and intimidation as one continuous business model.",
    visualIdentity: "Red wake flashes, dirty salvage plating, and violent close-range engine bloom.",
    preferredDamageProfile: damage(0.08, 0.14, 0.38, 0.4),
    preferredResistanceProfile: resist(0.1, 0.14, 0.22, 0.2),
    tankStyle: "mixed",
    doctrineTags: ["pirate", "skirmish", "control", "ambush"],
    doctrineSummary:
      "Pirate ambush doctrine built on tackle, swarm pressure, disruption, and ugly close-range burst once you are pinned.",
    enemyArchetypePreferences: ["swarm raider", "interceptor", "reaver bruiser"],
    prepAdvice: "Kill tackle early, respect disruption, and assume a Blackwake lane gets worse if you linger.",
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
