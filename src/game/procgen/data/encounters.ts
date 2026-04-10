export interface EncounterPackTemplate {
  id: string;
  context: "belt" | "gate";
  minDanger: number;
  maxDanger: number;
  security?: Array<"high" | "medium" | "low" | "frontier">;
  weight: number;
  roles: Array<"swarm" | "tackle" | "sniper" | "brawler" | "support" | "skirmisher" | "anchor" | "escort" | "artillery" | "hunter">;
}

export interface LootBonusTemplate {
  id: string;
  weight: number;
  factions?: string[];
  combatStyles?: Array<"shield" | "armor" | "speed">;
  commodities: Array<{
    commodityId: "salvage-scrap" | "weapons-components" | "coolant-gel" | "drone-parts" | "reactor-coils";
    amountRange: [number, number];
    chance: number;
  }>;
}

export const encounterPackTemplates: EncounterPackTemplate[] = [
  { id: "belt-swarm-pack", context: "belt", minDanger: 1, maxDanger: 3, weight: 4, roles: ["swarm", "swarm", "support"] },
  { id: "belt-light-pair", context: "belt", minDanger: 1, maxDanger: 2, weight: 3, roles: ["tackle", "sniper"] },
  { id: "belt-control-screen", context: "belt", minDanger: 3, maxDanger: 6, security: ["low", "frontier"], weight: 3, roles: ["tackle", "sniper", "support"] },
  { id: "belt-mining-harass", context: "belt", minDanger: 4, maxDanger: 4, weight: 0.5, roles: ["brawler", "support"] },
  { id: "belt-frontier-wave", context: "belt", minDanger: 4, maxDanger: 6, security: ["frontier", "low"], weight: 4, roles: ["anchor", "escort"] },
  { id: "belt-artillery-lane", context: "belt", minDanger: 3, maxDanger: 6, security: ["low", "frontier"], weight: 3, roles: ["artillery", "hunter", "escort"] },
  { id: "belt-skirmish-net", context: "belt", minDanger: 3, maxDanger: 6, weight: 2, roles: ["skirmisher", "skirmisher", "support"] },
  { id: "belt-relic-kill-box", context: "belt", minDanger: 5, maxDanger: 6, security: ["frontier"], weight: 2.4, roles: ["tackle", "artillery", "support", "escort"] },
  { id: "belt-apex-screen", context: "belt", minDanger: 5, maxDanger: 6, security: ["frontier"], weight: 2.2, roles: ["hunter", "tackle", "sniper", "support"] },
  { id: "belt-frontier-command-net", context: "belt", minDanger: 6, maxDanger: 6, security: ["frontier"], weight: 1.8, roles: ["anchor", "support", "escort", "artillery"] },
  { id: "gate-check", context: "gate", minDanger: 1, maxDanger: 2, weight: 4, roles: ["tackle", "sniper"] },
  { id: "gate-patrol", context: "gate", minDanger: 2, maxDanger: 4, weight: 3, roles: ["brawler", "support"] },
  { id: "gate-pressure-line", context: "gate", minDanger: 3, maxDanger: 6, security: ["low", "frontier"], weight: 3, roles: ["swarm", "tackle", "support"] },
  { id: "gate-frontier-wall", context: "gate", minDanger: 4, maxDanger: 6, security: ["frontier", "low"], weight: 4, roles: ["anchor", "escort"] },
  { id: "gate-command-pair", context: "gate", minDanger: 4, maxDanger: 6, security: ["medium", "low", "frontier"], weight: 2, roles: ["brawler", "sniper", "support"] },
  { id: "gate-pincer", context: "gate", minDanger: 3, maxDanger: 6, weight: 2, roles: ["skirmisher", "hunter", "support"] },
  { id: "gate-swarm-ambush", context: "gate", minDanger: 2, maxDanger: 5, security: ["low", "frontier"], weight: 3, roles: ["swarm", "swarm", "tackle"] },
  { id: "gate-sniper-screen", context: "gate", minDanger: 3, maxDanger: 6, security: ["medium", "low", "frontier"], weight: 2, roles: ["sniper", "tackle", "support"] },
  { id: "gate-raid-net", context: "gate", minDanger: 5, maxDanger: 6, security: ["frontier"], weight: 2.3, roles: ["tackle", "hunter", "support", "skirmisher"] },
  { id: "gate-relic-wall", context: "gate", minDanger: 5, maxDanger: 6, security: ["frontier"], weight: 2, roles: ["anchor", "escort", "support", "artillery"] },
  { id: "gate-apex-pincer", context: "gate", minDanger: 6, maxDanger: 6, security: ["frontier"], weight: 1.7, roles: ["tackle", "sniper", "support", "escort", "hunter"] }
];

export const lootBonusTemplates: LootBonusTemplate[] = [
  {
    id: "pirate-scrap",
    weight: 4,
    factions: ["veilborn"],
    commodities: [
      { commodityId: "salvage-scrap", amountRange: [1, 3], chance: 1 },
      { commodityId: "weapons-components", amountRange: [0, 1], chance: 0.3 }
    ]
  },
  {
    id: "union-cache",
    weight: 3,
    factions: ["cinder-union"],
    combatStyles: ["armor"],
    commodities: [
      { commodityId: "coolant-gel", amountRange: [1, 2], chance: 0.45 },
      { commodityId: "reactor-coils", amountRange: [1, 1], chance: 0.22 }
    ]
  },
  {
    id: "speed-kit",
    weight: 2,
    combatStyles: ["speed"],
    commodities: [
      { commodityId: "drone-parts", amountRange: [1, 2], chance: 0.35 },
      { commodityId: "salvage-scrap", amountRange: [1, 2], chance: 0.8 }
    ]
  }
];
