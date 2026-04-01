import { RegionDefinition, SolarSystemDefinition, SystemDestination } from "../../../types/game";

function station(
  id: string,
  name: string,
  x: number,
  y: number,
  description: string,
  tags: string[] = []
): SystemDestination {
  return { id, name, kind: "station", position: { x, y }, warpable: true, dockable: true, description, tags };
}

function gate(
  id: string,
  name: string,
  x: number,
  y: number,
  connectedSystemId: string,
  arrivalGateId: string,
  description: string,
  unlockMissionId?: string
): SystemDestination {
  return {
    id,
    name,
    kind: "gate",
    position: { x, y },
    warpable: true,
    connectedSystemId,
    arrivalGateId,
    unlockMissionId,
    description,
    tags: ["transit"]
  };
}

function belt(
  id: string,
  name: string,
  x: number,
  y: number,
  resource: SystemDestination["resource"],
  description: string
): SystemDestination {
  return {
    id,
    name,
    kind: "belt",
    position: { x, y },
    warpable: true,
    hostileActivity: true,
    resource,
    description,
    tags: ["mining"]
  };
}

function beacon(
  id: string,
  name: string,
  x: number,
  y: number,
  description: string,
  tags: string[] = []
): SystemDestination {
  return {
    id,
    name,
    kind: "beacon",
    position: { x, y },
    warpable: true,
    description,
    tags
  };
}

function anomaly(
  id: string,
  name: string,
  x: number,
  y: number,
  description: string
): SystemDestination {
  return {
    id,
    name,
    kind: "anomaly",
    position: { x, y },
    warpable: true,
    hostileActivity: true,
    description,
    tags: ["combat"]
  };
}

function outpost(
  id: string,
  name: string,
  x: number,
  y: number,
  description: string
): SystemDestination {
  return {
    id,
    name,
    kind: "outpost",
    position: { x, y },
    warpable: true,
    dockable: false,
    description,
    tags: ["frontier"]
  };
}

function wreck(
  id: string,
  name: string,
  x: number,
  y: number,
  description: string
): SystemDestination {
  return {
    id,
    name,
    kind: "wreck",
    position: { x, y },
    warpable: true,
    hostileActivity: true,
    description,
    tags: ["salvage"]
  };
}

export const regionCatalog: RegionDefinition[] = [
  {
    id: "aurelian-core",
    name: "Aurelian Core",
    description: "Secure trade arteries, rookie contracts, and the densest station network in the cluster.",
    security: "high",
    dominantFaction: "aurelian-league",
    resourceProfile: ["ferrite"],
    gameplayRole: "Starter hauling, repairs, basic combat, and safe route planning.",
    color: "#7fc0ff"
  },
  {
    id: "industrial-fringe",
    name: "Industrial Fringe",
    description: "Burning refineries, convoy lanes, and mixed-security extraction systems under Union pressure.",
    security: "medium",
    dominantFaction: "cinder-union",
    resourceProfile: ["ferrite", "ember-crystal"],
    gameplayRole: "Mining, hauling, upgraded fitting markets, and mixed-risk travel.",
    color: "#ffb36e"
  },
  {
    id: "frontier-march",
    name: "Frontier March",
    description: "Sparse stations, pirate anomalies, and rare salvage routes where geography decides survival.",
    security: "frontier",
    dominantFaction: "veilborn",
    resourceProfile: ["ember-crystal", "ghost-alloy"],
    gameplayRole: "Hard combat, rare resources, lucrative dead ends, and campaign tension.",
    color: "#c89bff"
  }
];

export const sectorCatalog: SolarSystemDefinition[] = [
  {
    id: "lumen-rest",
    name: "Lumen Rest",
    regionId: "aurelian-core",
    security: "high",
    danger: 1,
    description: "Homewater starter system with the densest civilian patrol coverage in the cluster.",
    flavorText: "Cargo skiffs, academy couriers, and station debt officers all converge here.",
    controllingFaction: "aurelian-league",
    visualTheme: "Blue-white civic lanes and bright station beacons.",
    economyTags: ["trade", "logistics", "repair"],
    missionTags: ["starter", "delivery", "tutorial"],
    traffic: "high",
    population: "Hub",
    width: 2600,
    height: 2600,
    backdrop: { nebula: "#12375d", dust: "#6cb8ff" },
    mapPosition: { x: 140, y: 160 },
    neighbors: ["sunward-span", "farpoint-market"],
    destinations: [
      station("lumen-station", "Lumen Station", 1180, 1310, "League starter port and debt office.", ["market", "repair"]),
      gate("gate-lumen-sunward", "Sunward Gate", 2240, 520, "sunward-span", "gate-sunward-lumen", "Northern trade gate toward the safer corridor."),
      gate("gate-lumen-farpoint", "Farpoint Gate", 420, 520, "farpoint-market", "gate-farpoint-lumen", "Western gate into the central market spine."),
      belt("lumen-belt-alpha", "Lumen Belt Alpha", 740, 900, "ferrite", "Civilian ferrite belt with light pirate scavenging."),
      beacon("lumen-relay", "Academy Relay", 1810, 860, "League survey relay used in early courier contracts.", ["mission"]),
      outpost("lumen-yard", "Dockyard Spur", 1540, 1680, "A maintenance spur handling cheap hull patch jobs.")
    ],
    asteroidFields: [{ beltId: "lumen-belt-alpha", center: { x: 740, y: 900 }, count: 8, resource: "ferrite", spread: 230, richness: 12 }],
    enemySpawns: [
      { variantId: "scrap-drone", count: 3, center: { x: 1660, y: 960 }, radius: 230 },
      { variantId: "dust-raider", count: 1, center: { x: 1910, y: 1360 }, radius: 180 }
    ]
  },
  {
    id: "sunward-span",
    name: "Sunward Span",
    regionId: "aurelian-core",
    security: "high",
    danger: 1,
    description: "Patrolled lane junction that anchors the long safe route eastward.",
    flavorText: "The Span feels calm until convoy delays start clogging every gate.",
    controllingFaction: "aurelian-league",
    visualTheme: "Open gold-blue lanes with clean beacon geometry.",
    economyTags: ["trade", "logistics"],
    missionTags: ["delivery", "escort"],
    traffic: "high",
    population: "Transit",
    width: 2800,
    height: 2500,
    backdrop: { nebula: "#203f64", dust: "#94d1ff" },
    mapPosition: { x: 250, y: 110 },
    neighbors: ["lumen-rest", "auric-loop", "ironway"],
    destinations: [
      station("span-quay", "Span Quay", 860, 1740, "Courier stop and route office on the safe corridor.", ["logistics"]),
      gate("gate-sunward-lumen", "Lumen Gate", 360, 520, "lumen-rest", "gate-lumen-sunward", "Gate back to the starter hub."),
      gate("gate-sunward-auric", "Auric Gate", 2380, 540, "auric-loop", "gate-auric-sunward", "Eastern loop gate toward League markets."),
      gate("gate-sunward-ironway", "Ironway Gate", 2140, 2050, "ironway", "gate-ironway-sunward", "Southern industrial corridor gate."),
      belt("span-belt-west", "Span Belt West", 1260, 980, "ferrite", "Dense but low-value ferrite rubble."),
      beacon("span-patrol", "Patrol Marker", 1840, 1240, "Patrol staging beacon along the convoy lane.", ["patrol"])
    ],
    asteroidFields: [{ beltId: "span-belt-west", center: { x: 1260, y: 980 }, count: 7, resource: "ferrite", spread: 210, richness: 11 }],
    enemySpawns: [{ variantId: "scrap-drone", count: 2, center: { x: 1730, y: 930 }, radius: 170 }]
  },
  {
    id: "farpoint-market",
    name: "Farpoint Market",
    regionId: "aurelian-core",
    security: "medium",
    danger: 2,
    description: "Regional trade hub where safe lanes meet the faster fringe shortcut.",
    flavorText: "Every bargain in Farpoint hides a convoy timetable and a security compromise.",
    controllingFaction: "aurelian-league",
    visualTheme: "Dense traffic halos and amber docking lanes.",
    economyTags: ["trade", "research", "market"],
    missionTags: ["delivery", "acquisition", "route-choice"],
    traffic: "high",
    population: "Market hub",
    width: 2900,
    height: 2700,
    backdrop: { nebula: "#4b2b38", dust: "#f0b580" },
    mapPosition: { x: 90, y: 260 },
    neighbors: ["lumen-rest", "auric-loop", "ember-reach"],
    destinations: [
      station("farpoint-exchange", "Farpoint Exchange", 1380, 1360, "Broker ring for regional modules and cargo contracts.", ["market", "research"]),
      gate("gate-farpoint-lumen", "Lumen Gate", 2320, 420, "lumen-rest", "gate-lumen-farpoint", "Core gate to Lumen Rest."),
      gate("gate-farpoint-auric", "Auric Gate", 2400, 2190, "auric-loop", "gate-auric-farpoint", "Loop gate through the inner market ring."),
      gate("gate-farpoint-ember", "Ember Gate", 420, 620, "ember-reach", "gate-ember-farpoint", "Fast fringe gate with a reputation for pirate tailing."),
      belt("farpoint-salvage", "Salvage Drift", 940, 780, "ferrite", "Wreck-laced debris band with easy salvage."),
      wreck("farpoint-wrecks", "Broker Graveyard", 1880, 820, "Old convoy wreckage orbiting beyond customs scans."),
      beacon("farpoint-grid", "Market Nav Grid", 1140, 2050, "Navigation beacon used for route planning classes.", ["navigation"])
    ],
    asteroidFields: [{ beltId: "farpoint-salvage", center: { x: 940, y: 780 }, count: 6, resource: "ferrite", spread: 190, richness: 10 }],
    enemySpawns: [
      { variantId: "dust-raider", count: 2, center: { x: 760, y: 980 }, radius: 160 },
      { variantId: "scrap-drone", count: 2, center: { x: 1770, y: 860 }, radius: 170 }
    ]
  },
  {
    id: "auric-loop",
    name: "Auric Loop",
    regionId: "aurelian-core",
    security: "medium",
    danger: 2,
    description: "An outer civic loop where prospectors pivot between core contracts and fringe bulk orders.",
    flavorText: "Loop pilots talk like merchants and fit like smugglers.",
    controllingFaction: "aurelian-league",
    visualTheme: "Soft gold starshine and wide orbital rings.",
    economyTags: ["trade", "mining", "logistics"],
    missionTags: ["mining", "delivery"],
    traffic: "medium",
    population: "Civilian",
    width: 3000,
    height: 2800,
    backdrop: { nebula: "#5a4320", dust: "#f4d384" },
    mapPosition: { x: 300, y: 250 },
    neighbors: ["sunward-span", "farpoint-market", "forge-plains"],
    destinations: [
      station("auric-yard", "Auric Yard", 780, 2140, "Prospector services and civilian hull swaps.", ["mining", "repair"]),
      gate("gate-auric-sunward", "Sunward Gate", 540, 420, "sunward-span", "gate-sunward-auric", "Northern gate to the safe corridor."),
      gate("gate-auric-farpoint", "Farpoint Gate", 2450, 720, "farpoint-market", "gate-farpoint-auric", "Market-side gate to Farpoint."),
      gate("gate-auric-forge", "Forge Gate", 2480, 2240, "forge-plains", "gate-forge-auric", "Industrial gate toward heavier Union traffic."),
      belt("auric-belt-alpha", "Auric Belt Alpha", 1620, 1180, "ferrite", "Strip-mined ferrite ring with civilian traffic."),
      outpost("auric-array", "Loop Listening Array", 1450, 620, "A quiet navigation array used by survey dispatch.")
    ],
    asteroidFields: [{ beltId: "auric-belt-alpha", center: { x: 1620, y: 1180 }, count: 8, resource: "ferrite", spread: 230, richness: 12 }],
    enemySpawns: [{ variantId: "dust-raider", count: 2, center: { x: 2140, y: 1380 }, radius: 200 }]
  },
  {
    id: "ironway",
    name: "Ironway",
    regionId: "industrial-fringe",
    security: "medium",
    danger: 2,
    description: "Barge-heavy logistics spine feeding ore and machine parts into the fringe.",
    flavorText: "If you want steady work, Ironway has it. If you want quiet work, it does not.",
    controllingFaction: "cinder-union",
    visualTheme: "Soot-orange traffic and heavy convoy silhouettes.",
    economyTags: ["logistics", "trade", "mining"],
    missionTags: ["hauling", "escort", "delivery"],
    traffic: "high",
    population: "Convoy lane",
    width: 3000,
    height: 2800,
    backdrop: { nebula: "#4d2513", dust: "#ff9e72" },
    mapPosition: { x: 420, y: 140 },
    neighbors: ["sunward-span", "forge-plains", "sable-haul"],
    destinations: [
      station("ironway-depot", "Ironway Depot", 620, 2200, "Convoy staging and fuel services.", ["logistics", "repair"]),
      gate("gate-ironway-sunward", "Sunward Gate", 480, 420, "sunward-span", "gate-sunward-ironway", "Northern safe-route gate."),
      gate("gate-ironway-forge", "Forge Gate", 2500, 620, "forge-plains", "gate-forge-ironway", "Gate toward Union smelter lanes."),
      gate("gate-ironway-sable", "Sable Gate", 2400, 2140, "sable-haul", "gate-sable-ironway", "Bulk gate to the outer freight loop."),
      belt("ironway-belt-alpha", "Ironway Belt Alpha", 1420, 1140, "ferrite", "Broad ferrite belt feeding the depot."),
      wreck("ironway-spill", "Freighter Spill", 1850, 1460, "A cargo spill that keeps drawing scavengers.")
    ],
    asteroidFields: [{ beltId: "ironway-belt-alpha", center: { x: 1420, y: 1140 }, count: 9, resource: "ferrite", spread: 260, richness: 13 }],
    enemySpawns: [
      { variantId: "cinder-pike", count: 2, center: { x: 1980, y: 1520 }, radius: 230 },
      { variantId: "dust-raider", count: 2, center: { x: 1760, y: 1600 }, radius: 190 }
    ]
  },
  {
    id: "ember-reach",
    name: "Ember Reach",
    regionId: "industrial-fringe",
    security: "low",
    danger: 3,
    description: "A hot extraction basin and the obvious risky shortcut toward the frontier.",
    flavorText: "Every crystal convoy in Ember Reach is a target with a schedule.",
    controllingFaction: "cinder-union",
    visualTheme: "Molten plumes, shard belts, and flare-lit warp lines.",
    economyTags: ["mining", "frontier", "trade"],
    missionTags: ["mining", "combat", "shortcut"],
    traffic: "medium",
    population: "Extraction hub",
    width: 3200,
    height: 3000,
    backdrop: { nebula: "#571f12", dust: "#ff9966" },
    mapPosition: { x: 290, y: 330 },
    neighbors: ["farpoint-market", "sable-haul", "blackwake"],
    destinations: [
      station("forge-anchor", "Forge Anchor", 620, 2360, "A hot-running Union refinery station.", ["mining", "repair"]),
      gate("gate-ember-farpoint", "Farpoint Gate", 360, 480, "farpoint-market", "gate-farpoint-ember", "Risky shortcut gate back toward the market."),
      gate("gate-ember-sable", "Sable Gate", 2560, 540, "sable-haul", "gate-sable-ember", "Long freight gate along the outer industrial loop."),
      gate("gate-ember-blackwake", "Blackwake Gate", 2540, 2360, "blackwake", "gate-blackwake-ember", "Fast but dangerous gate into raider country."),
      belt("ember-belt-alpha", "Reach Belt Alpha", 1480, 1220, "ember-crystal", "Dense ember crystal field with pirate pickets."),
      belt("ember-belt-beta", "Reach Belt Beta", 980, 1640, "ferrite", "Secondary ore field used by refinery crews."),
      anomaly("ember-anomaly", "Melt Rift", 2180, 1280, "A pirate ambush pocket forming inside the heat wake."),
      beacon("reach-beacon", "Reach Survey Beacon", 1820, 720, "Survey beacon used to chart the fringe lanes.", ["mission"])
    ],
    asteroidFields: [
      {
        beltId: "ember-belt-alpha",
        center: { x: 1480, y: 1220 },
        count: 9,
        resource: "ember-crystal",
        spread: 280,
        richness: 16,
        hostileSpawnChance: 0.45,
        hostileSpawnCount: 2,
        hostileSpawnVariantIds: ["cinder-pike", "veil-stalker"]
      },
      { beltId: "ember-belt-beta", center: { x: 980, y: 1640 }, count: 6, resource: "ferrite", spread: 210, richness: 11 }
    ],
    enemySpawns: [
      { variantId: "cinder-pike", count: 3, center: { x: 2000, y: 1240 }, radius: 260 },
      { variantId: "veil-stalker", count: 2, center: { x: 2280, y: 1360 }, radius: 220 }
    ]
  },
  {
    id: "forge-plains",
    name: "Forge Plains",
    regionId: "industrial-fringe",
    security: "medium",
    danger: 3,
    description: "Smelter system and border checkpoint guarding the safer road toward frontier space.",
    flavorText: "The Plains feel orderly until the customs guns swivel toward your hull.",
    controllingFaction: "cinder-union",
    visualTheme: "Industrial orange glare and broad refinery silhouettes.",
    economyTags: ["military", "industry", "logistics"],
    missionTags: ["border", "escort", "combat"],
    traffic: "high",
    population: "Checkpoint",
    width: 3200,
    height: 2800,
    backdrop: { nebula: "#5a2610", dust: "#ffaf75" },
    mapPosition: { x: 470, y: 270 },
    neighbors: ["auric-loop", "ironway", "outer-verge"],
    destinations: [
      station("forge-bastion", "Forge Bastion", 900, 2120, "Militia customs station and repair dock.", ["military", "repair"]),
      gate("gate-forge-auric", "Auric Gate", 360, 500, "auric-loop", "gate-auric-forge", "Coreward gate toward League civilian space."),
      gate("gate-forge-ironway", "Ironway Gate", 1280, 400, "ironway", "gate-ironway-forge", "Convoy gate to Ironway."),
      gate("gate-forge-verge", "Outer Verge Gate", 2640, 1120, "outer-verge", "gate-verge-forge", "Customs gate into the frontier approach."),
      belt("forge-belt-alpha", "Forge Belt Alpha", 1560, 1480, "ember-crystal", "Refinery feed belt under militia watch."),
      outpost("forge-customs", "Customs Spindle", 2240, 1680, "Border scan platform watching the Verge gate."),
      beacon("forge-ops", "Operations Beacon", 2040, 820, "Patrol marker for border sweep contracts.", ["patrol"])
    ],
    asteroidFields: [
      {
        beltId: "forge-belt-alpha",
        center: { x: 1560, y: 1480 },
        count: 7,
        resource: "ember-crystal",
        spread: 220,
        richness: 14,
        hostileSpawnChance: 0.3,
        hostileSpawnCount: 1,
        hostileSpawnVariantIds: ["cinder-pike"]
      }
    ],
    enemySpawns: [{ variantId: "cinder-pike", count: 3, center: { x: 2180, y: 1560 }, radius: 220 }]
  },
  {
    id: "sable-haul",
    name: "Sable Haul",
    regionId: "industrial-fringe",
    security: "medium",
    danger: 3,
    description: "Outer freight loop with bulky ore convoys and long approach vectors.",
    flavorText: "The route is safer than Ember Reach, but never cheap and never quick.",
    controllingFaction: "cinder-union",
    visualTheme: "Muted charcoal skies with orange convoy lanes.",
    economyTags: ["logistics", "trade", "mining"],
    missionTags: ["delivery", "hauling", "route-choice"],
    traffic: "medium",
    population: "Freight lane",
    width: 3200,
    height: 3000,
    backdrop: { nebula: "#35262b", dust: "#d8a17c" },
    mapPosition: { x: 530, y: 380 },
    neighbors: ["ironway", "ember-reach", "outer-verge"],
    destinations: [
      station("sable-port", "Sable Port", 760, 2260, "Bulk-haul station servicing long-loop freighters.", ["logistics", "market"]),
      gate("gate-sable-ironway", "Ironway Gate", 420, 520, "ironway", "gate-ironway-sable", "Freight gate back to the industrial spine."),
      gate("gate-sable-ember", "Ember Gate", 2540, 540, "ember-reach", "gate-ember-sable", "Shorter but hotter route through Ember Reach."),
      gate("gate-sable-verge", "Outer Verge Gate", 2520, 2240, "outer-verge", "gate-verge-sable", "Safer border gate toward the frontier."),
      belt("sable-belt-alpha", "Sable Belt Alpha", 1480, 1380, "ember-crystal", "Mixed ore lane with convoy cover."),
      wreck("sable-yard", "Jettison Yard", 1940, 1840, "Abandoned freight containers drifting off the haul lane.")
    ],
    asteroidFields: [
      {
        beltId: "sable-belt-alpha",
        center: { x: 1480, y: 1380 },
        count: 8,
        resource: "ember-crystal",
        spread: 240,
        richness: 15,
        hostileSpawnChance: 0.35,
        hostileSpawnCount: 2,
        hostileSpawnVariantIds: ["dust-raider", "cinder-pike"]
      }
    ],
    enemySpawns: [
      { variantId: "dust-raider", count: 2, center: { x: 1860, y: 1840 }, radius: 180 },
      { variantId: "cinder-pike", count: 2, center: { x: 2040, y: 1680 }, radius: 200 }
    ]
  },
  {
    id: "outer-verge",
    name: "Outer Verge",
    regionId: "frontier-march",
    security: "low",
    danger: 4,
    description: "Border chokepoint where safer industrial traffic meets frontier raider hunts.",
    flavorText: "Everyone passes through the Verge eventually, and almost everyone leaves something behind.",
    controllingFaction: "veilborn",
    visualTheme: "Cold purple haze and fractured horizon arcs.",
    economyTags: ["frontier", "combat", "logistics"],
    missionTags: ["border", "combat", "travel"],
    traffic: "high",
    population: "Border hub",
    width: 3400,
    height: 3200,
    backdrop: { nebula: "#25163f", dust: "#b48dff" },
    mapPosition: { x: 700, y: 330 },
    neighbors: ["forge-plains", "sable-haul", "blackwake", "vanta-expanse"],
    destinations: [
      station("shade-hub", "Shade Hub", 1440, 2520, "Hard-bitten border station with expensive repairs and good salvage buyers.", ["frontier", "repair", "market"]),
      gate("gate-verge-forge", "Forge Gate", 360, 520, "forge-plains", "gate-forge-verge", "Customs route back toward the safer border lane."),
      gate("gate-verge-sable", "Sable Gate", 700, 400, "sable-haul", "gate-sable-verge", "Loop gate toward the long industrial route."),
      gate("gate-verge-blackwake", "Blackwake Gate", 2860, 680, "blackwake", "gate-blackwake-verge", "Raider-laced gate into the shortcut corridor."),
      gate("gate-verge-vanta", "Vanta Gate", 2840, 2440, "vanta-expanse", "gate-vanta-verge", "Eastern gate into deeper frontier space."),
      belt("verge-belt-alpha", "Verge Belt Alpha", 1220, 1180, "ghost-alloy", "Rare alloy band under pirate pressure."),
      anomaly("verge-anomaly", "Silent Cut", 2140, 1380, "Combat anomaly where scouts keep disappearing."),
      beacon("verge-beacon", "Frontier Signal Beacon", 2080, 760, "Beacon used for border patrol and survey jobs.", ["mission"])
    ],
    asteroidFields: [
      {
        beltId: "verge-belt-alpha",
        center: { x: 1220, y: 1180 },
        count: 8,
        resource: "ghost-alloy",
        spread: 260,
        richness: 16,
        hostileSpawnChance: 0.6,
        hostileSpawnCount: 2,
        hostileSpawnVariantIds: ["veil-stalker", "reaver-gunship"]
      }
    ],
    enemySpawns: [
      { variantId: "veil-stalker", count: 4, center: { x: 2140, y: 1380 }, radius: 260 },
      { variantId: "reaver-gunship", count: 2, center: { x: 2280, y: 1640 }, radius: 220 }
    ]
  },
  {
    id: "blackwake",
    name: "Blackwake",
    regionId: "frontier-march",
    security: "frontier",
    danger: 5,
    description: "Dangerous shortcut system where aggressive raiders cut between fringe and frontier.",
    flavorText: "Blackwake is the route pilots take when they think time is worth more than armor.",
    controllingFaction: "veilborn",
    visualTheme: "Dark violet wakes and harsh weapons flashes.",
    economyTags: ["frontier", "pirate-infested", "combat"],
    missionTags: ["combat", "risk", "shortcut"],
    traffic: "medium",
    population: "Raider lane",
    width: 3600,
    height: 3200,
    backdrop: { nebula: "#1a1030", dust: "#9b79ff" },
    mapPosition: { x: 830, y: 250 },
    neighbors: ["ember-reach", "outer-verge", "ghostlight-pocket"],
    destinations: [
      station("blackwake-den", "Wake Den", 840, 2300, "Illicit dock where raiders barter salvage.", ["frontier", "market"]),
      gate("gate-blackwake-ember", "Ember Gate", 420, 620, "ember-reach", "gate-ember-blackwake", "The fast return route to the industrial fringe."),
      gate("gate-blackwake-verge", "Outer Verge Gate", 2460, 520, "outer-verge", "gate-verge-blackwake", "Border gate back toward Shade Hub."),
      gate("gate-blackwake-ghostlight", "Ghostlight Gate", 2760, 2320, "ghostlight-pocket", "gate-ghostlight-blackwake", "Unstable gate into the lucrative pocket.", "ghostlight-charter"),
      anomaly("blackwake-rift", "Wake Rift", 1780, 1420, "Large pirate anomaly with disciplined raider wings."),
      wreck("blackwake-wrecks", "Convoy Tomb", 1280, 1040, "A graveyard of shortcut freighters."),
      beacon("blackwake-beacon", "Smuggler Marker", 2120, 940, "An encoded navigation marker used in covert runs.", ["mission"])
    ],
    asteroidFields: [],
    enemySpawns: [
      { variantId: "veil-stalker", count: 5, center: { x: 1760, y: 1420 }, radius: 260 },
      { variantId: "reaver-gunship", count: 3, center: { x: 1440, y: 1120 }, radius: 220 }
    ]
  },
  {
    id: "vanta-expanse",
    name: "Vanta Expanse",
    regionId: "frontier-march",
    security: "frontier",
    danger: 5,
    description: "Wide frontier deadspace with rare ore, sparse traffic, and long response times.",
    flavorText: "Pilots come here for silence, ore, or trouble, often collecting all three.",
    controllingFaction: "veilborn",
    visualTheme: "Black-violet emptiness and cold star punctures.",
    economyTags: ["frontier", "mining", "research"],
    missionTags: ["exploration", "mining", "combat"],
    traffic: "low",
    population: "Sparse",
    width: 3600,
    height: 3400,
    backdrop: { nebula: "#12091d", dust: "#8e7ef5" },
    mapPosition: { x: 900, y: 390 },
    neighbors: ["outer-verge", "ghostlight-pocket"],
    destinations: [
      station("vanta-shelter", "Vanta Shelter", 980, 2520, "A hidden service dock for long-haul prospectors.", ["frontier", "repair"]),
      gate("gate-vanta-verge", "Outer Verge Gate", 420, 580, "outer-verge", "gate-verge-vanta", "Gate back toward the border hub."),
      gate("gate-vanta-ghostlight", "Ghostlight Gate", 2860, 960, "ghostlight-pocket", "gate-ghostlight-vanta", "Deep gate toward the lucrative pocket."),
      belt("vanta-belt-alpha", "Vanta Belt Alpha", 1820, 1420, "ghost-alloy", "Rare alloy field with poor rescue odds."),
      anomaly("vanta-echo", "Echo Hollow", 2320, 1980, "A quiet anomaly that never stays quiet for long."),
      beacon("vanta-marker", "Expanse Marker", 1460, 860, "Survey marker used to map the rare-ore loop.", ["mission"])
    ],
    asteroidFields: [
      {
        beltId: "vanta-belt-alpha",
        center: { x: 1820, y: 1420 },
        count: 10,
        resource: "ghost-alloy",
        spread: 300,
        richness: 18,
        hostileSpawnChance: 0.7,
        hostileSpawnCount: 2,
        hostileSpawnVariantIds: ["veil-stalker", "reaver-gunship"]
      }
    ],
    enemySpawns: [
      { variantId: "veil-stalker", count: 4, center: { x: 2280, y: 2020 }, radius: 240 },
      { variantId: "reaver-gunship", count: 2, center: { x: 1960, y: 1540 }, radius: 210 }
    ]
  },
  {
    id: "ghostlight-pocket",
    name: "Ghostlight Pocket",
    regionId: "frontier-march",
    security: "frontier",
    danger: 6,
    description: "Dead-end high-value pocket packed with rare salvage and hard frontier resistance.",
    flavorText: "Anyone who reaches Ghostlight comes for profit, vengeance, or both.",
    controllingFaction: "veilborn",
    visualTheme: "Pale violet ghostlight and stark debris silhouettes.",
    economyTags: ["frontier", "salvage", "rare-resource"],
    missionTags: ["endgame", "salvage", "combat"],
    traffic: "low",
    population: "Hidden pocket",
    width: 3800,
    height: 3400,
    backdrop: { nebula: "#23123e", dust: "#d7bbff" },
    mapPosition: { x: 1040, y: 310 },
    neighbors: ["blackwake", "vanta-expanse"],
    destinations: [
      station("ghostlight-haven", "Ghostlight Haven", 980, 2680, "A hard-to-find dock where frontier brokers pay premium rates.", ["frontier", "market"]),
      gate("gate-ghostlight-blackwake", "Blackwake Gate", 420, 620, "blackwake", "gate-blackwake-ghostlight", "Shortcut gate back toward Blackwake."),
      gate("gate-ghostlight-vanta", "Vanta Gate", 2860, 940, "vanta-expanse", "gate-vanta-ghostlight", "Deep loop gate into the Expanse."),
      belt("ghostlight-belt-alpha", "Ghostlight Belt Alpha", 1760, 1380, "ghost-alloy", "Rich ghost-alloy field near a debris halo."),
      anomaly("ghostlight-core", "Ghostlight Core", 2260, 1840, "A lucrative anomaly defended by heavy raider hulls."),
      wreck("ghostlight-yard", "Vault Debris Field", 1320, 1180, "High-value wreck field from a lost convoy."),
      beacon("ghostlight-vault", "Vault Marker", 2080, 900, "Encrypted marker tied to deeper frontier contracts.", ["mission"])
    ],
    asteroidFields: [
      {
        beltId: "ghostlight-belt-alpha",
        center: { x: 1760, y: 1380 },
        count: 10,
        resource: "ghost-alloy",
        spread: 320,
        richness: 20,
        hostileSpawnChance: 0.85,
        hostileSpawnCount: 3,
        hostileSpawnVariantIds: ["reaver-gunship", "veil-stalker"]
      }
    ],
    enemySpawns: [
      { variantId: "reaver-gunship", count: 4, center: { x: 2280, y: 1840 }, radius: 240 },
      { variantId: "veil-stalker", count: 4, center: { x: 1400, y: 1180 }, radius: 220 }
    ]
  }
];

export const regionById = Object.fromEntries(regionCatalog.map((region) => [region.id, region]));
export const sectorById = Object.fromEntries(sectorCatalog.map((sector) => [sector.id, sector]));

export function getSystemDestinations(systemId: string) {
  return sectorById[systemId]?.destinations ?? [];
}

export function getSystemDestination(systemId: string, destinationId: string) {
  return getSystemDestinations(systemId).find((entry) => entry.id === destinationId) ?? null;
}

export function getSystemStation(systemId: string) {
  return getSystemDestinations(systemId).find((entry) => entry.kind === "station") ?? null;
}

export function getSystemGates(systemId: string) {
  return getSystemDestinations(systemId).filter((entry) => entry.kind === "gate");
}

export function getSystemBelts(systemId: string) {
  return getSystemDestinations(systemId).filter((entry) => entry.kind === "belt");
}

export function getSystemBeacons(systemId: string) {
  return getSystemDestinations(systemId).filter((entry) => entry.kind === "beacon");
}
