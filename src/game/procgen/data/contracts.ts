import { ProceduralContractType, ResourceId } from "../../../types/game";

export interface ProceduralTypeWeightTemplate {
  id: string;
  type: ProceduralContractType;
  weight: number;
  stationTags?: string[];
  systemTags?: string[];
  regionIds?: string[];
}

export interface TransportCargoTemplate {
  id: string;
  weight: number;
  cargoType: string;
  label: string;
  titleNouns: string[];
  description: string;
  tags: string[];
  volumeRange: [number, number];
  unitValueRange: [number, number];
  routePreference: "shortest" | "safer";
}

export interface MiningContractTemplate {
  id: string;
  weight: number;
  resource: ResourceId | "local";
  titleVerb: string;
  description: string;
  tags: string[];
  countRange: [number, number];
}

export interface BountyContractTemplate {
  id: string;
  weight: number;
  titlePrefix: string;
  description: string;
  tags: string[];
  countRange: [number, number];
}

export const proceduralTypeWeights: ProceduralTypeWeightTemplate[] = [
  { id: "trade-lane-haul", type: "transport", weight: 4, stationTags: ["market", "logistics"] },
  { id: "industrial-haul", type: "transport", weight: 3, stationTags: ["industrial", "repair", "mining"] },
  { id: "local-extraction", type: "mining", weight: 3, stationTags: ["mining", "industrial"], systemTags: ["mining"] },
  { id: "frontier-sweep", type: "bounty", weight: 2, stationTags: ["frontier", "repair"], systemTags: ["combat"] },
  { id: "checkpoint-patrol", type: "bounty", weight: 2, stationTags: ["military", "repair"], regionIds: ["industrial-fringe", "frontier-march"] },
  { id: "civil-priority", type: "transport", weight: 2, regionIds: ["aurelian-core"] },
  { id: "ore-charter", type: "mining", weight: 2, regionIds: ["industrial-fringe", "frontier-march"] }
];

export const transportCargoTemplates: TransportCargoTemplate[] = [
  {
    id: "medical-relief",
    weight: 2,
    cargoType: "medical-supplies",
    label: "medical relief",
    titleNouns: ["Relief Run", "Clinic Draft", "Emergency Span"],
    description: "Move clinic-grade cargo before local triage reserves run thin.",
    tags: ["medical", "essentials", "logistics"],
    volumeRange: [18, 34],
    unitValueRange: [16, 24],
    routePreference: "safer"
  },
  {
    id: "industrial-parts",
    weight: 3,
    cargoType: "industrial-parts",
    label: "industrial parts",
    titleNouns: ["Machine Chain", "Tooling Run", "Parts Relay"],
    description: "Keep yards and refinery crews supplied with replacement assemblies.",
    tags: ["industrial", "materials", "logistics"],
    volumeRange: [24, 52],
    unitValueRange: [12, 18],
    routePreference: "shortest"
  },
  {
    id: "archive-move",
    weight: 2,
    cargoType: "archive-shards",
    label: "sealed archives",
    titleNouns: ["Archive Lift", "Ledger Relay", "Data Charter"],
    description: "Move sealed records and survey packets between route offices.",
    tags: ["research", "high-tech", "trade"],
    volumeRange: [12, 26],
    unitValueRange: [20, 28],
    routePreference: "safer"
  },
  {
    id: "frontier-rigs",
    weight: 2,
    cargoType: "drone-parts",
    label: "field rigs",
    titleNouns: ["Prospector Feed", "Rig Chain", "Frontier Refit"],
    description: "Push ruggedized gear and drones into stations that cannot wait for a clean convoy window.",
    tags: ["frontier", "salvage", "mining"],
    volumeRange: [28, 48],
    unitValueRange: [18, 26],
    routePreference: "safer"
  },
  {
    id: "escort-vaults",
    weight: 2,
    cargoType: "escort-vaults",
    label: "escort vaults",
    titleNouns: ["Escort Screen", "Convoy Guard", "Shield Run"],
    description: "Move sealed convoy crates that are only valuable if the lane survives the trip intact.",
    tags: ["combat", "escort", "logistics"],
    volumeRange: [18, 34],
    unitValueRange: [22, 30],
    routePreference: "safer"
  },
  {
    id: "black-market-caches",
    weight: 1,
    cargoType: "unmarked-caches",
    label: "unmarked caches",
    titleNouns: ["Quiet Drop", "Shadow Lift", "Fence Relay"],
    description: "Slip deniable cargo through a narrow window before the market shutters again.",
    tags: ["salvage", "frontier", "trade"],
    volumeRange: [14, 28],
    unitValueRange: [26, 38],
    routePreference: "shortest"
  }
];

export const miningContractTemplates: MiningContractTemplate[] = [
  {
    id: "ferrite-pull",
    weight: 3,
    resource: "ferrite",
    titleVerb: "Ore Pull",
    description: "Fill a local fabrication order with quick-turn ore before the berth window closes.",
    tags: ["mining", "materials", "industrial"],
    countRange: [10, 18]
  },
  {
    id: "ember-sweep",
    weight: 2,
    resource: "ember-crystal",
    titleVerb: "Crystal Sweep",
    description: "Recover hot crystal loads while escorts are already in sector.",
    tags: ["mining", "frontier", "combat"],
    countRange: [8, 14]
  },
  {
    id: "ghost-salvage",
    weight: 2,
    resource: "ghost-alloy",
    titleVerb: "Ghost Pull",
    description: "Bring back rare alloy while the local buyers are still paying frontier rates.",
    tags: ["salvage", "frontier", "mining"],
    countRange: [6, 10]
  },
  {
    id: "relay-shard",
    weight: 1,
    resource: "local",
    titleVerb: "Relay Harvest",
    description: "Recover signal-dense debris from a field that only pays out if the scan survives the pass.",
    tags: ["research", "navigation", "frontier"],
    countRange: [8, 13]
  }
];

export const bountyContractTemplates: BountyContractTemplate[] = [
  {
    id: "lane-sweep",
    weight: 3,
    titlePrefix: "Lane Sweep",
    description: "Break local raiders before they turn a route choice into a shutdown.",
    tags: ["combat", "logistics", "patrol"],
    countRange: [2, 4]
  },
  {
    id: "belt-picket",
    weight: 2,
    titlePrefix: "Belt Picket",
    description: "Clear a mining lane so extraction crews can work without burning another convoy slot on escorts.",
    tags: ["combat", "mining", "industrial"],
    countRange: [2, 5]
  },
  {
    id: "frontier-pressure",
    weight: 2,
    titlePrefix: "Pressure Cut",
    description: "Hit the raider wing controlling today's most profitable frontier approach.",
    tags: ["combat", "frontier", "salvage"],
    countRange: [3, 5]
  },
  {
    id: "escort-screen",
    weight: 2,
    titlePrefix: "Escort Screen",
    description: "Keep a civilian convoy alive through a lane that always seems to attract trouble at the worst time.",
    tags: ["combat", "escort", "patrol"],
    countRange: [2, 4]
  },
  {
    id: "patrol-sweep",
    weight: 2,
    titlePrefix: "Patrol Sweep",
    description: "Clear a marked corridor and keep it quiet long enough for the route desks to reopen traffic.",
    tags: ["combat", "patrol", "frontier"],
    countRange: [3, 6]
  }
];
