import { BossEncounterDefinition, FactionId } from "../../types/game";

export interface BossDefinition extends BossEncounterDefinition {
  id: string;
  faction: FactionId;
  archetype: string;
  variantId: string;
  missionId: string;
  loreBlurb: string;
}

export const bossCatalog: BossDefinition[] = [
  {
    id: "helion-prism-archon",
    faction: "helion-cabal",
    archetype: "siege_sniper",
    variantId: "helion-prism-archon",
    missionId: "prism-breach",
    bossVariantId: "helion-prism-archon",
    bossTitle: "Prism Archon",
    escortVariantIds: ["helion-support-wing", "helion-support-wing"],
    missionBriefing: "Helion command has deployed a prism-bore archon. It is a long-range shield command ship with escort support.",
    specialMechanicTags: ["long-range", "shield-command", "escort-support"],
    rewardCreditsBonus: 1600,
    threatSummary: "Extreme-range EM/Thermal sniper command hull backed by shield support.",
    loreBlurb: "A Cabal commander hull built to turn open space into a controlled firing lane."
  },
  {
    id: "ironbound-siege-hammer",
    faction: "ironbound-syndicate",
    archetype: "heavy_bruiser",
    variantId: "ironbound-siege-hammer",
    missionId: "hammerfall",
    bossVariantId: "ironbound-siege-hammer",
    bossTitle: "Siege Hammer",
    escortVariantIds: ["ironbound-bruiser", "ironbound-artillery"],
    missionBriefing: "Ironbound forces are fielding a siege hammer prototype. Expect armor pressure, rail fire, and heavy escorts.",
    specialMechanicTags: ["armor-wall", "midrange-pressure", "repair-support"],
    rewardCreditsBonus: 1800,
    threatSummary: "Armor-heavy bruiser commander with rail escorts and sustained pressure.",
    loreBlurb: "A foundry-built command hull that crushes lanes by force and bulk."
  },
  {
    id: "blackwake-wake-queen",
    faction: "blackwake-clans",
    archetype: "swarm",
    variantId: "blackwake-wake-queen",
    missionId: "wake-queen",
    bossVariantId: "blackwake-wake-queen",
    bossTitle: "Wake Queen",
    escortVariantIds: ["blackwake-swarm", "blackwake-interceptor", "blackwake-swarm"],
    missionBriefing: "Blackwake raiders have crowned a swarm queen. It arrives with fast harassment ships and disruption escorts.",
    specialMechanicTags: ["swarm", "tackle", "pirate-disruption"],
    rewardCreditsBonus: 1500,
    threatSummary: "Fast pirate swarm commander that overwhelms through numbers and tackle.",
    loreBlurb: "A pirate flagship that turns loose raiders into a coordinated hunting pack."
  },
  {
    id: "veilborn-reaper-savant",
    faction: "veilborn",
    archetype: "missile_skirmisher",
    variantId: "veilborn-reaper-savant",
    missionId: "shadow-run",
    bossVariantId: "veilborn-reaper-savant",
    bossTitle: "Reaper Savant",
    escortVariantIds: ["veilborn-hunter", "veilborn-support", "veilborn-hunter"],
    missionBriefing: "A Veilborn reaper savant is coordinating mixed skirmish pressure and control in the frontier lanes.",
    specialMechanicTags: ["mixed-pressure", "control", "skirmish"],
    rewardCreditsBonus: 1400,
    threatSummary: "Mixed pirate skirmisher boss with disruption and flanking escorts.",
    loreBlurb: "A raider tactician that wins by keeping the fight chaotic and asymmetric."
  },
  {
    id: "veilborn-hush-oracle",
    faction: "veilborn",
    archetype: "siege_sniper",
    variantId: "veilborn-hush-oracle",
    missionId: "hush-oracle",
    bossVariantId: "veilborn-hush-oracle",
    bossTitle: "Hush Oracle",
    escortVariantIds: ["veilborn-hunter", "veilborn-support", "veilborn-hunter"],
    missionBriefing: "A Veilborn hush oracle has sealed the quiet pocket in Hush Atlas. Break its command hull and clear the escort screen.",
    specialMechanicTags: ["long-range", "control", "escort-support"],
    rewardCreditsBonus: 2400,
    threatSummary: "Veilborn command sniper with control escorts in the Hush Atlas pocket.",
    loreBlurb: "A sealed-pocket command hull that denies approach and collapses sensor discipline."
  },
  {
    id: "blackwake-abyss-king",
    faction: "blackwake-clans",
    archetype: "interceptor",
    variantId: "blackwake-abyss-king",
    missionId: "abyss-crown",
    bossVariantId: "blackwake-abyss-king",
    bossTitle: "Abyss King",
    escortVariantIds: ["blackwake-reaver-captain", "blackwake-reaver", "blackwake-interceptor"],
    missionBriefing: "A Blackwake command raider has pushed into Revenant Crossing to dominate the salvage lanes.",
    specialMechanicTags: ["tackle", "disruption", "raider-command"],
    rewardCreditsBonus: 2600,
    threatSummary: "Blackwake apex command hull pushing deep into frontier salvage lanes.",
    loreBlurb: "A raider sovereign built to take a salvage lane by force, speed, and disruption."
  }
];

export const bossById = Object.fromEntries(bossCatalog.map((entry) => [entry.id, entry])) as Record<
  string,
  BossDefinition
>;

export const bossByMissionId = Object.fromEntries(bossCatalog.map((entry) => [entry.missionId, entry])) as Record<
  string,
  BossDefinition
>;
