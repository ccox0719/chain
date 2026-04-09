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
  description: string,
  anomalyField?: SystemDestination["anomalyField"]
): SystemDestination {
  return {
    id,
    name,
    kind: "anomaly",
    position: { x, y },
    warpable: true,
    hostileActivity: true,
    description,
    tags: ["combat"],
    anomalyField
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
    secondaryFactions: ["helion-cabal"],
    shipAccessPolicy: "mixed",
    resourceProfile: ["ferrite"],
    gameplayRole: "Starter hauling, repairs, basic combat, and safe route planning.",
    identitySummary: "Stable core territory built around polished trade lanes, civic security, and forgiving route structure.",
    prepAdvice: "Bring balanced fits, expect shield fleets and cleaner mid-range fights, and use it to learn routes and markets.",
    color: "#7fc0ff",
    threatSummary: "EM/Thermal shield patrols, precision security, and disciplined trade defense.",
    marketIdentity: ["trade", "repair", "logistics", "research"],
    missionIdentity: ["delivery", "escort", "patrol", "survey"],
    enemyIdentity: ["raiders", "scrap", "smugglers"],
    stationIdentity: ["clean", "formal", "supervised"],
    localShipFamilies: ["civic", "escort", "shield", "sensor"],
    wartimeRole: "rear-core",
    frontlineStatus: "rear",
    mobilizationPriority: "high",
    occupationRisk: "low"
  },
  {
    id: "industrial-fringe",
    name: "Industrial Fringe",
    description: "Burning refineries, convoy lanes, and mixed-security extraction systems under Union pressure.",
    security: "medium",
    dominantFaction: "cinder-union",
    secondaryFactions: ["ironbound-syndicate"],
    shipAccessPolicy: "restricted",
    resourceProfile: ["ferrite", "ember-crystal"],
    gameplayRole: "Mining, hauling, upgraded fitting markets, and mixed-risk travel.",
    identitySummary: "Working industrial border space where ore, convoys, and armor-heavy enforcement define the tempo.",
    prepAdvice: "Prep for armor fleets, freight ambushes, and the tradeoff between safer long routes and hotter shortcuts.",
    color: "#ffb36e",
    threatSummary: "Kinetic/Thermal armor fleets, rail pressure, and convoy warfare.",
    marketIdentity: ["industrial", "mining", "logistics", "materials"],
    missionIdentity: ["hauling", "mining", "escort", "salvage"],
    enemyIdentity: ["convoy raiders", "armor crews", "mercenaries"],
    stationIdentity: ["foundry", "customs", "freight"],
    localShipFamilies: ["armor", "mining", "convoy", "brick"],
    wartimeRole: "staging",
    frontlineStatus: "staging",
    mobilizationPriority: "high",
    occupationRisk: "medium"
  },
  {
    id: "frontier-march",
    name: "Frontier March",
    description: "Sparse stations, pirate anomalies, and rare salvage routes where geography decides survival.",
    security: "frontier",
    dominantFaction: "veilborn",
    secondaryFactions: ["blackwake-clans"],
    shipAccessPolicy: "smuggler-friendly",
    resourceProfile: ["ember-crystal", "ghost-alloy"],
    gameplayRole: "Hard combat, rare resources, lucrative dead ends, and campaign tension.",
    identitySummary: "Sparse frontier space where map position, hazard pockets, and hostile doctrine matter more than raw hull value.",
    prepAdvice: "Expect control pressure, mixed pirate damage, and fewer safe resets. Bring a build that can commit or escape cleanly.",
    color: "#c89bff",
    threatSummary: "Mixed pirate doctrine, control warfare, and fast skirmish raids.",
    marketIdentity: ["frontier", "salvage", "smuggling", "black-market"],
    missionIdentity: ["smuggle", "probe", "hunt", "recon"],
    enemyIdentity: ["pirates", "hunters", "control ships", "swarm"],
    stationIdentity: ["hidden", "rough", "survival"],
    localShipFamilies: ["skirmish", "control", "salvage", "raider"],
    wartimeRole: "frontline",
    frontlineStatus: "frontline",
    mobilizationPriority: "medium",
    occupationRisk: "high"
  }
];

type BaseSystemDefinition = Omit<SolarSystemDefinition, "identityLabel" | "gameplayPurpose" | "prepAdvice">;

const baseSectorCatalog: BaseSystemDefinition[] = [
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
      { variantId: "scrap-drone", count: 3, center: { x: 2080, y: 700 }, radius: 180 },
      { variantId: "dust-raider", count: 1, center: { x: 2240, y: 1500 }, radius: 150 }
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
      { variantId: "ironbound-bruiser", count: 1, center: { x: 1980, y: 1520 }, radius: 230 },
      { variantId: "ironbound-artillery", count: 1, center: { x: 1760, y: 1600 }, radius: 190 },
      { variantId: "ironbound-bastion", count: 1, center: { x: 1840, y: 1400 }, radius: 210 }
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
      anomaly("ember-anomaly", "Melt Rift", 2180, 1280, "A pirate ambush pocket forming inside the heat wake.", {
        effect: "drag",
        radius: 260,
        strength: 180,
        debrisCount: 10,
        tint: "#ff9f6d"
      }),
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
        hostileSpawnVariantIds: ["cinder-pike", "blackwake-interceptor", "blackwake-swarm"]
      },
      { beltId: "ember-belt-beta", center: { x: 980, y: 1640 }, count: 6, resource: "ferrite", spread: 210, richness: 11 }
    ],
    enemySpawns: [
      { variantId: "cinder-pike", count: 2, center: { x: 2000, y: 1240 }, radius: 260 },
      { variantId: "blackwake-swarm", count: 2, center: { x: 2280, y: 1360 }, radius: 220 },
      { variantId: "blackwake-interceptor", count: 1, center: { x: 2180, y: 1580 }, radius: 210 }
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
        hostileSpawnVariantIds: ["ironbound-bruiser", "ironbound-artillery", "cinder-command-artillery", "cinder-pike"]
      }
    ],
    enemySpawns: [
      { variantId: "ironbound-bruiser", count: 1, center: { x: 2180, y: 1560 }, radius: 220 },
      { variantId: "ironbound-artillery", count: 1, center: { x: 1980, y: 1380 }, radius: 180 },
      { variantId: "cinder-pike", count: 1, center: { x: 2360, y: 1680 }, radius: 190 }
    ]
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
        hostileSpawnVariantIds: ["ironbound-bruiser", "cinder-pike", "dust-raider"]
      }
    ],
    enemySpawns: [
      { variantId: "ironbound-bruiser", count: 1, center: { x: 1860, y: 1840 }, radius: 180 },
      { variantId: "cinder-pike", count: 2, center: { x: 2040, y: 1680 }, radius: 200 },
      { variantId: "dust-raider", count: 1, center: { x: 1720, y: 1620 }, radius: 170 }
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
    factionInfluence: 60,
    contestedFactionIds: ["blackwake-clans", "ironbound-syndicate"],
    threatSummary: "Frontier border space with pirate spillover and industrial mercenary pressure.",
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
      anomaly("verge-anomaly", "Silent Cut", 2140, 1380, "Combat anomaly where scouts keep disappearing.", {
        effect: "drag",
        radius: 280,
        strength: 210,
        debrisCount: 12,
        tint: "#b48dff"
      }),
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
        hostileSpawnVariantIds: ["veilborn-hunter", "veilborn-support", "blackwake-interceptor"]
      }
    ],
    enemySpawns: [
      { variantId: "veilborn-hunter", count: 2, center: { x: 2140, y: 1380 }, radius: 260 },
      { variantId: "veilborn-support", count: 1, center: { x: 2280, y: 1640 }, radius: 220 },
      { variantId: "blackwake-interceptor", count: 2, center: { x: 1960, y: 1640 }, radius: 200 }
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
    controllingFaction: "blackwake-clans",
    factionInfluence: 92,
    threatSummary: "Pirate mixed doctrine, explosive burst, and disruption-heavy raiding.",
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
      anomaly("blackwake-rift", "Wake Rift", 1780, 1420, "Large pirate anomaly with disciplined raider wings.", {
        effect: "slipstream",
        radius: 320,
        strength: 245,
        debrisCount: 14,
        tint: "#ff7b7b"
      }),
      wreck("blackwake-wrecks", "Convoy Tomb", 1280, 1040, "A graveyard of shortcut freighters."),
      beacon("blackwake-beacon", "Smuggler Marker", 2120, 940, "An encoded navigation marker used in covert runs.", ["mission"])
    ],
    asteroidFields: [],
    enemySpawns: [
      { variantId: "blackwake-swarm", count: 5, center: { x: 1760, y: 1420 }, radius: 260 },
      { variantId: "blackwake-interceptor", count: 3, center: { x: 1440, y: 1120 }, radius: 220 },
      { variantId: "blackwake-reaver", count: 2, center: { x: 2140, y: 1580 }, radius: 240 },
      { variantId: "blackwake-reaver-captain", count: 1, center: { x: 1960, y: 1260 }, radius: 200 }
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
      anomaly("vanta-echo", "Echo Hollow", 2320, 1980, "A quiet anomaly that never stays quiet for long.", {
        effect: "ion",
        radius: 300,
        strength: 170,
        debrisCount: 11,
        tint: "#8e7ef5"
      }),
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
        hostileSpawnVariantIds: ["veilborn-hunter", "veilborn-support", "reaver-gunship"]
      }
    ],
    enemySpawns: [
      { variantId: "veilborn-hunter", count: 3, center: { x: 2280, y: 2020 }, radius: 240 },
      { variantId: "veilborn-support", count: 2, center: { x: 1960, y: 1540 }, radius: 210 }
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
      anomaly("ghostlight-core", "Ghostlight Core", 2260, 1840, "A lucrative anomaly defended by heavy raider hulls.", {
        effect: "slipstream",
        radius: 360,
        strength: 260,
        debrisCount: 16,
        tint: "#d7bbff"
      }),
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
        hostileSpawnVariantIds: ["reaver-gunship", "veilborn-hunter", "veilborn-support"]
      }
    ],
    enemySpawns: [
      { variantId: "reaver-gunship", count: 3, center: { x: 2280, y: 1840 }, radius: 240 },
      { variantId: "veilborn-hunter", count: 3, center: { x: 1400, y: 1180 }, radius: 220 },
      { variantId: "veilborn-support", count: 2, center: { x: 1720, y: 1520 }, radius: 220 }
    ]
  }
];

const expansionSectorCatalog: BaseSystemDefinition[] = [
  {
    id: "glass-harbor",
    name: "Glass Harbor",
    regionId: "aurelian-core",
    security: "high",
    danger: 2,
    description: "A polished trade harbor where refinement yards meet quieter prospecting contracts.",
    flavorText: "Freighters idle here longer than usual because every dockmaster thinks the prices turn tomorrow.",
    controllingFaction: "helion-cabal",
    factionInfluence: 84,
    threatSummary: "EM/Thermal shield doctrine, precision lasers, and hard sensor discipline.",
    visualTheme: "Cold blue docks, mirrored solar sheets, and disciplined civilian traffic.",
    economyTags: ["trade", "research", "mining"],
    missionTags: ["delivery", "survey", "acquisition"],
    traffic: "medium",
    population: "Harbor ring",
    width: 3000,
    height: 2800,
    backdrop: { nebula: "#274866", dust: "#9ad8ff" },
    mapPosition: { x: 180, y: 340 },
    neighbors: ["farpoint-market", "auric-loop"],
    destinations: [
      station("glass-quay", "Glass Quay", 1280, 1520, "Refinement harbor known for clean civilian contracts.", ["market", "research"]),
      gate("gate-glass-farpoint", "Farpoint Gate", 420, 620, "farpoint-market", "gate-farpoint-glass", "Core gate back toward the market spine."),
      gate("gate-glass-auric", "Auric Gate", 2460, 620, "auric-loop", "gate-auric-glass", "Inner loop gate toward civilian mining lanes."),
      belt("glass-belt-alpha", "Glass Belt Alpha", 1760, 1120, "ferrite", "A bright ferrite belt with relatively safe extraction windows."),
      beacon("glass-survey", "Survey Prism", 960, 920, "League cartography beacon used in route survey contracts.", ["mission"]),
      outpost("glass-shed", "Harbor Tool Shed", 2100, 1840, "A quiet service outpost handling mining fit swaps.")
    ],
    asteroidFields: [{ beltId: "glass-belt-alpha", center: { x: 1760, y: 1120 }, count: 8, resource: "ferrite", spread: 220, richness: 12 }],
    enemySpawns: [
      { variantId: "helion-warden", count: 2, center: { x: 1880, y: 1580 }, radius: 180 },
      { variantId: "helion-prism-sniper", count: 1, center: { x: 2200, y: 1240 }, radius: 160 },
      { variantId: "helion-prism-lance", count: 1, center: { x: 2060, y: 1360 }, radius: 180 },
      { variantId: "scrap-drone", count: 1, center: { x: 2140, y: 1320 }, radius: 180 }
    ]
  },
  {
    id: "crown-exchange",
    name: "Crown Exchange",
    regionId: "aurelian-core",
    security: "high",
    danger: 2,
    description: "A premium brokerage system built around route arbitrage, finance traffic, and high-value cargo tenders.",
    flavorText: "Everyone sounds calm in Crown Exchange, which is how you know the margins are vicious.",
    controllingFaction: "aurelian-league",
    factionInfluence: 62,
    contestedFactionIds: ["helion-cabal"],
    threatSummary: "League commerce security with Cabal influence in premium convoy lanes.",
    visualTheme: "Gold-white relay towers and tidy orbital commerce lanes.",
    economyTags: ["trade", "logistics", "market"],
    missionTags: ["delivery", "escort", "route-choice"],
    traffic: "high",
    population: "Financial hub",
    width: 3100,
    height: 2700,
    backdrop: { nebula: "#384869", dust: "#f0d08d" },
    mapPosition: { x: 210, y: 50 },
    neighbors: ["sunward-span", "farpoint-market"],
    destinations: [
      station("crown-dais", "Crown Dais", 1380, 1480, "Broker ring handling expensive bulk orders and convoy schedules.", ["market", "logistics"]),
      gate("gate-crown-sunward", "Sunward Gate", 500, 520, "sunward-span", "gate-sunward-crown", "Northbound gate back to the safe corridor."),
      gate("gate-crown-farpoint", "Farpoint Gate", 2480, 620, "farpoint-market", "gate-farpoint-crown", "Market-side gate toward regional trade traffic."),
      belt("crown-belt-alpha", "Crown Belt Alpha", 980, 960, "ferrite", "Modest extraction belt worked by contract haulers."),
      beacon("crown-ledger", "Ledger Relay", 2060, 960, "Finance relay used in premium courier work.", ["mission"])
    ],
    asteroidFields: [{ beltId: "crown-belt-alpha", center: { x: 980, y: 960 }, count: 6, resource: "ferrite", spread: 180, richness: 10 }],
    enemySpawns: [
      { variantId: "helion-warden", count: 1, center: { x: 2140, y: 1180 }, radius: 140 },
      { variantId: "helion-prism-sniper", count: 1, center: { x: 1880, y: 1380 }, radius: 150 },
      { variantId: "helion-prism-lance", count: 1, center: { x: 2020, y: 1260 }, radius: 150 }
    ]
  },
  {
    id: "slag-arc",
    name: "Slag Arc",
    regionId: "industrial-fringe",
    security: "low",
    danger: 3,
    description: "A furnace route where half-processed ore, coolant runs, and raider ambushes overlap.",
    flavorText: "Nobody stays in Slag Arc unless they are getting paid twice or hiding from someone expensive.",
    controllingFaction: "ironbound-syndicate",
    factionInfluence: 80,
    threatSummary: "Kinetic/Explosive armor brawlers, hard hulls, and forge-line intimidation.",
    visualTheme: "Orange refinery haze and debris-lit convoy arcs.",
    economyTags: ["industry", "mining", "trade"],
    missionTags: ["hauling", "combat", "escort"],
    traffic: "medium",
    population: "Smelter lane",
    width: 3200,
    height: 3000,
    backdrop: { nebula: "#4e2417", dust: "#ff9b6e" },
    mapPosition: { x: 380, y: 430 },
    neighbors: ["ironway", "ember-reach"],
    destinations: [
      station("slag-yard", "Slag Yard", 760, 2280, "A refinery yard known for armor fittings and ugly but profitable contracts.", ["industrial", "repair"]),
      gate("gate-slag-ironway", "Ironway Gate", 440, 520, "ironway", "gate-ironway-slag", "Convoy gate back toward the main spine."),
      gate("gate-slag-ember", "Ember Gate", 2580, 620, "ember-reach", "gate-ember-slag", "Refinery shortcut gate into the crystal basin."),
      belt("slag-belt-alpha", "Slag Belt Alpha", 1600, 1380, "ember-crystal", "Hot crystal field wrapped in industrial debris."),
      wreck("slag-break", "Breaker Wrecks", 2100, 1760, "The remains of refinery escorts that lost the timetable war."),
      beacon("slag-marker", "Arc Marker", 1260, 900, "Union route marker used by freight dispatch.", ["patrol"])
    ],
    asteroidFields: [
      {
        beltId: "slag-belt-alpha",
        center: { x: 1600, y: 1380 },
        count: 8,
        resource: "ember-crystal",
        spread: 250,
        richness: 15,
        hostileSpawnChance: 0.38,
        hostileSpawnCount: 2,
        hostileSpawnVariantIds: ["ironbound-bruiser", "ironbound-artillery", "cinder-pike"]
      }
    ],
    enemySpawns: [
      { variantId: "ironbound-bruiser", count: 2, center: { x: 2060, y: 1500 }, radius: 200 },
      { variantId: "ironbound-artillery", count: 1, center: { x: 2260, y: 1260 }, radius: 180 },
      { variantId: "cinder-command-artillery", count: 1, center: { x: 1980, y: 1320 }, radius: 190 },
      { variantId: "cinder-pike", count: 1, center: { x: 1880, y: 1680 }, radius: 180 }
    ]
  },
  {
    id: "brass-strait",
    name: "Brass Strait",
    regionId: "industrial-fringe",
    security: "medium",
    danger: 3,
    description: "A guarded freight strait that rewards slower routes with steadier contracts and fewer surprises.",
    flavorText: "Every captain in Brass Strait claims to prefer safety right up until the margins get thin.",
    controllingFaction: "cinder-union",
    factionInfluence: 58,
    contestedFactionIds: ["ironbound-syndicate"],
    threatSummary: "Union freight security under pressure from Ironbound armor raiders.",
    visualTheme: "Amber convoy rails crossing muted industrial void.",
    economyTags: ["logistics", "trade", "industry"],
    missionTags: ["delivery", "hauling", "border"],
    traffic: "high",
    population: "Freight crossing",
    width: 3200,
    height: 2900,
    backdrop: { nebula: "#413034", dust: "#dca87d" },
    mapPosition: { x: 610, y: 200 },
    neighbors: ["forge-plains", "sable-haul"],
    destinations: [
      station("brass-quay", "Brass Quay", 980, 2140, "A dependable freight quay built around route planners and repair crews.", ["logistics", "repair"]),
      gate("gate-brass-forge", "Forge Gate", 420, 540, "forge-plains", "gate-forge-brass", "Checkpoint gate back toward Forge Bastion."),
      gate("gate-brass-sable", "Sable Gate", 2540, 620, "sable-haul", "gate-sable-brass", "Freight gate toward the outer haul loop."),
      belt("brass-belt-alpha", "Brass Belt Alpha", 1660, 1280, "ferrite", "A broad ore belt worked by insured strip crews."),
      beacon("brass-ops", "Transit Ops Beacon", 2060, 960, "Operations relay for long-haul convoy routing.", ["navigation"])
    ],
    asteroidFields: [{ beltId: "brass-belt-alpha", center: { x: 1660, y: 1280 }, count: 7, resource: "ferrite", spread: 220, richness: 12 }],
    enemySpawns: [
      { variantId: "ironbound-bruiser", count: 1, center: { x: 2140, y: 1520 }, radius: 180 },
      { variantId: "ironbound-artillery", count: 1, center: { x: 1880, y: 1380 }, radius: 160 }
    ]
  },
  {
    id: "ashen-deep",
    name: "Ashen Deep",
    regionId: "frontier-march",
    security: "frontier",
    danger: 5,
    description: "A dim frontier trough where raiders cut across border routes under minimal sensor cover.",
    flavorText: "Pilots enter Ashen Deep talking about courage and leave talking about reaction time.",
    controllingFaction: "veilborn",
    factionInfluence: 60,
    contestedFactionIds: ["blackwake-clans", "ironbound-syndicate"],
    threatSummary: "Frontier border space with pirate spillover and industrial mercenary pressure.",
    visualTheme: "Ash-violet fog, broken horizon arcs, and violent sensor bloom.",
    economyTags: ["frontier", "combat", "salvage"],
    missionTags: ["combat", "travel", "risk"],
    traffic: "medium",
    population: "Raider corridor",
    width: 3500,
    height: 3200,
    backdrop: { nebula: "#22172f", dust: "#bc8fff" },
    mapPosition: { x: 760, y: 150 },
    neighbors: ["outer-verge", "blackwake", "revenant-crossing"],
    destinations: [
      station("ashen-anchor", "Ashen Anchor", 940, 2360, "A rough salvage dock where frontier hulls buy time and cheap repairs.", ["frontier", "repair", "market"]),
      gate("gate-ashen-verge", "Verge Gate", 420, 620, "outer-verge", "gate-verge-ashen", "Border gate back toward the Verge."),
      gate("gate-ashen-blackwake", "Blackwake Gate", 2440, 520, "blackwake", "gate-blackwake-ashen", "Shortcut gate into pirate-heavy space."),
      gate("gate-ashen-revenant", "Revenant Gate", 2700, 2240, "revenant-crossing", "gate-revenant-ashen", "Deep frontier gate toward unstable salvage lanes."),
      belt("ashen-belt-alpha", "Ashen Belt Alpha", 1540, 1300, "ghost-alloy", "A rare alloy field with poor rescue odds and good payouts."),
      anomaly("ashen-breach", "Ashen Breach", 2100, 1580, "A violent frontier rupture favored by raider wings.", {
        effect: "drag",
        radius: 300,
        strength: 220,
        debrisCount: 12,
        tint: "#b58eff"
      })
    ],
    asteroidFields: [
      {
        beltId: "ashen-belt-alpha",
        center: { x: 1540, y: 1300 },
        count: 9,
        resource: "ghost-alloy",
        spread: 280,
        richness: 17,
        hostileSpawnChance: 0.68,
        hostileSpawnCount: 2,
        hostileSpawnVariantIds: ["veilborn-hunter", "veilborn-support", "blackwake-interceptor"]
      }
    ],
    enemySpawns: [
      { variantId: "veilborn-hunter", count: 3, center: { x: 2100, y: 1560 }, radius: 250 },
      { variantId: "veilborn-support", count: 1, center: { x: 2360, y: 1780 }, radius: 210 },
      { variantId: "blackwake-interceptor", count: 2, center: { x: 2260, y: 1320 }, radius: 220 }
    ]
  },
  {
    id: "hush-atlas",
    name: "Hush Atlas",
    regionId: "frontier-march",
    security: "frontier",
    danger: 5,
    description: "A quiet frontier charting system used by prospectors who trust their route data more than local law.",
    flavorText: "The silence in Hush Atlas feels earned, which is rarely the same as safe.",
    controllingFaction: "veilborn",
    visualTheme: "Black-violet deadspace with soft ghostlight chart markers.",
    economyTags: ["frontier", "research", "mining"],
    missionTags: ["exploration", "survey", "combat"],
    traffic: "low",
    population: "Sparse survey lane",
    width: 3600,
    height: 3300,
    backdrop: { nebula: "#160d26", dust: "#9c87ff" },
    mapPosition: { x: 1120, y: 420 },
    neighbors: ["vanta-expanse", "ghostlight-pocket", "revenant-crossing"],
    destinations: [
      station("hush-hold", "Hush Hold", 1040, 2460, "A hidden survey dock selling data, repairs, and quiet fuel.", ["frontier", "repair"]),
      gate("gate-hush-vanta", "Vanta Gate", 420, 620, "vanta-expanse", "gate-vanta-hush", "Deep route gate back toward Vanta."),
      gate("gate-hush-ghostlight", "Ghostlight Gate", 2560, 640, "ghostlight-pocket", "gate-ghostlight-hush", "Risky gate into the lucrative pocket."),
      gate("gate-hush-revenant", "Revenant Gate", 2680, 2260, "revenant-crossing", "gate-revenant-hush", "Salvage route toward a darker frontier branch."),
      belt("hush-belt-alpha", "Hush Belt Alpha", 1780, 1460, "ghost-alloy", "Thin alloy field charted by stubborn long-range miners."),
      beacon("hush-chart", "Chart Beacon", 1440, 880, "A survey marker carrying route overlays and old distress data.", ["mission"])
    ],
    asteroidFields: [
      {
        beltId: "hush-belt-alpha",
        center: { x: 1780, y: 1460 },
        count: 9,
        resource: "ghost-alloy",
        spread: 260,
        richness: 18,
        hostileSpawnChance: 0.62,
        hostileSpawnCount: 2,
        hostileSpawnVariantIds: ["veilborn-hunter", "veilborn-support", "reaver-gunship"]
      }
    ],
    enemySpawns: [
      { variantId: "veilborn-hunter", count: 3, center: { x: 2220, y: 1780 }, radius: 230 },
      { variantId: "veilborn-support", count: 2, center: { x: 2020, y: 1540 }, radius: 200 }
    ]
  },
  {
    id: "revenant-crossing",
    name: "Revenant Crossing",
    regionId: "frontier-march",
    security: "frontier",
    danger: 6,
    description: "A harsh deadspace crossing packed with salvage lanes, deep anomalies, and organized hostile patrols.",
    flavorText: "The wrecks in Revenant Crossing look recent because many of them are.",
    controllingFaction: "veilborn",
    visualTheme: "Pale ghostlight fractures and heavy debris halos around unstable gravity folds.",
    economyTags: ["frontier", "salvage", "combat"],
    missionTags: ["endgame", "combat", "salvage"],
    traffic: "low",
    population: "Deadspace crossing",
    width: 3800,
    height: 3400,
    backdrop: { nebula: "#221138", dust: "#d0b2ff" },
    mapPosition: { x: 940, y: 170 },
    neighbors: ["ashen-deep", "hush-atlas"],
    destinations: [
      station("revenant-haven", "Revenant Haven", 1180, 2560, "A dangerous frontier dock where salvage buyers pay without many questions.", ["frontier", "market", "repair"]),
      gate("gate-revenant-ashen", "Ashen Gate", 420, 620, "ashen-deep", "gate-ashen-revenant", "Gate back toward the safer of two bad choices."),
      gate("gate-revenant-hush", "Hush Gate", 2820, 760, "hush-atlas", "gate-hush-revenant", "Charted gate into quieter but still hostile space."),
      belt("revenant-belt-alpha", "Revenant Belt Alpha", 1820, 1380, "ghost-alloy", "Rich alloy seam wrapped in fresh wreck signatures."),
      wreck("revenant-vault", "Vault Scatter", 1340, 1180, "A field of torn cargo vaults and stripped escort hulls."),
      anomaly("revenant-rift", "Revenant Rift", 2360, 1760, "A violent anomaly that drags fights into ugly ranges.", {
        effect: "ion",
        radius: 340,
        strength: 250,
        debrisCount: 15,
        tint: "#d5b9ff"
      })
    ],
    asteroidFields: [
      {
        beltId: "revenant-belt-alpha",
        center: { x: 1820, y: 1380 },
        count: 10,
        resource: "ghost-alloy",
        spread: 320,
        richness: 20,
        hostileSpawnChance: 0.8,
        hostileSpawnCount: 3,
        hostileSpawnVariantIds: ["reaver-gunship", "veilborn-hunter", "veilborn-support"]
      }
    ],
    enemySpawns: [
      { variantId: "reaver-gunship", count: 3, center: { x: 2320, y: 1820 }, radius: 240 },
      { variantId: "veilborn-hunter", count: 3, center: { x: 1500, y: 1320 }, radius: 220 },
      { variantId: "veilborn-support", count: 2, center: { x: 1820, y: 1520 }, radius: 220 }
    ]
  }
];

const neighborAdditions: Partial<Record<string, string[]>> = {
  "farpoint-market": ["glass-harbor", "crown-exchange"],
  "auric-loop": ["glass-harbor"],
  "sunward-span": ["crown-exchange"],
  ironway: ["slag-arc"],
  "ember-reach": ["slag-arc"],
  "forge-plains": ["brass-strait"],
  "sable-haul": ["brass-strait"],
  "outer-verge": ["ashen-deep"],
  blackwake: ["ashen-deep"],
  "vanta-expanse": ["hush-atlas"],
  "ghostlight-pocket": ["hush-atlas"]
};

const destinationAdditions: Partial<Record<string, SystemDestination[]>> = {
  "farpoint-market": [
    gate("gate-farpoint-glass", "Glass Gate", 680, 2360, "glass-harbor", "gate-glass-farpoint", "Trade gate toward the Harbor's refinement yards."),
    gate("gate-farpoint-crown", "Crown Gate", 1520, 2440, "crown-exchange", "gate-crown-farpoint", "Premium market gate into the Exchange ring.")
  ],
  "auric-loop": [
    gate("gate-auric-glass", "Glass Gate", 860, 2460, "glass-harbor", "gate-glass-auric", "Civilian route toward Glass Harbor.")
  ],
  "sunward-span": [
    gate("gate-sunward-crown", "Crown Gate", 1120, 2200, "crown-exchange", "gate-crown-sunward", "Exchange lane gate for premium convoy routing.")
  ],
  ironway: [
    gate("gate-ironway-slag", "Slag Gate", 1160, 2440, "slag-arc", "gate-slag-ironway", "Refinery lane gate into Slag Arc.")
  ],
  "ember-reach": [
    gate("gate-ember-slag", "Slag Gate", 980, 2560, "slag-arc", "gate-slag-ember", "Back-channel refinery gate toward Slag Arc.")
  ],
  "forge-plains": [
    gate("gate-forge-brass", "Brass Gate", 700, 2460, "brass-strait", "gate-brass-forge", "Freight route gate into Brass Strait.")
  ],
  "sable-haul": [
    gate("gate-sable-brass", "Brass Gate", 980, 2480, "brass-strait", "gate-brass-sable", "Quieter freight gate toward Brass Strait.")
  ],
  "outer-verge": [
    gate("gate-verge-ashen", "Ashen Gate", 1160, 2720, "ashen-deep", "gate-ashen-verge", "Frontier gate descending into Ashen Deep.")
  ],
  blackwake: [
    gate("gate-blackwake-ashen", "Ashen Gate", 960, 2660, "ashen-deep", "gate-ashen-blackwake", "Secondary raider gate toward Ashen Deep.")
  ],
  "vanta-expanse": [
    gate("gate-vanta-hush", "Hush Gate", 1160, 2840, "hush-atlas", "gate-hush-vanta", "Survey route gate toward Hush Atlas.")
  ],
  "ghostlight-pocket": [
    gate("gate-ghostlight-hush", "Hush Gate", 980, 2900, "hush-atlas", "gate-hush-ghostlight", "Deep salvage gate toward Hush Atlas.")
  ]
};

const systemIdentityById: Record<
  string,
  Pick<SolarSystemDefinition, "identityLabel" | "gameplayPurpose" | "prepAdvice"> &
    Partial<Pick<SolarSystemDefinition, "theaterTag" | "frontlinePressure" | "supplyLineImportance" | "chartStatus">>
> = {
  "lumen-rest": {
    identityLabel: "Safe core system",
    gameplayPurpose: "Starter dock, training routes, first mining, and low-stress fitting changes.",
    prepAdvice: "Good place to learn the dock-plan-launch loop before taking riskier routes.",
    theaterTag: "rear",
    frontlinePressure: "low",
    supplyLineImportance: "high",
    chartStatus: "charted"
  },
  "sunward-span": {
    identityLabel: "Trade corridor junction",
    gameplayPurpose: "Reliable route planning, safer hauling, and escort-style travel decisions.",
    prepAdvice: "Expect clean lanes and logistics traffic more than serious chaos.",
    theaterTag: "rear",
    frontlinePressure: "low",
    supplyLineImportance: "high",
    chartStatus: "charted"
  },
  "farpoint-market": {
    identityLabel: "Regional trade hub",
    gameplayPurpose: "Best place to compare prices, set routes, and pivot between core and fringe economies.",
    prepAdvice: "Use it as a planning stop. It rewards map awareness and route choice.",
    theaterTag: "staging",
    frontlinePressure: "low",
    supplyLineImportance: "high",
    chartStatus: "charted"
  },
  "auric-loop": {
    identityLabel: "Civilian mining loop",
    gameplayPurpose: "Early mining, hull progression, and short-haul route practice.",
    prepAdvice: "Bring practical mining or light-haul fits and expect occasional opportunists.",
    theaterTag: "rear",
    frontlinePressure: "low",
    supplyLineImportance: "medium",
    chartStatus: "charted"
  },
  ironway: {
    identityLabel: "Convoy spine",
    gameplayPurpose: "Freight contracts, ore movement, and industrial traffic pressure.",
    prepAdvice: "Prep for armor-heavy lane fighting and busy logistics traffic.",
    theaterTag: "staging",
    frontlinePressure: "medium",
    supplyLineImportance: "high",
    chartStatus: "charted"
  },
  "ember-reach": {
    identityLabel: "Risky shortcut basin",
    gameplayPurpose: "Hot extraction, shortcut routing, and higher-risk crystal runs.",
    prepAdvice: "Use it when speed matters enough to justify pirate contact and heavier pressure.",
    theaterTag: "border",
    frontlinePressure: "high",
    supplyLineImportance: "medium",
    chartStatus: "charted"
  },
  "forge-plains": {
    identityLabel: "Border checkpoint",
    gameplayPurpose: "Militia contracts, checkpoint combat, and industrial border prep.",
    prepAdvice: "Expect tougher armor fleets and more deliberate, committed engagements.",
    theaterTag: "border",
    frontlinePressure: "high",
    supplyLineImportance: "high",
    chartStatus: "charted"
  },
  "sable-haul": {
    identityLabel: "Long freight loop",
    gameplayPurpose: "Safer hauling, bulk cargo routes, and endurance-minded travel.",
    prepAdvice: "Less explosive than Ember Reach, but routes are longer and mistakes still compound.",
    theaterTag: "staging",
    frontlinePressure: "medium",
    supplyLineImportance: "high",
    chartStatus: "charted"
  },
  "outer-verge": {
    identityLabel: "Frontier border hub",
    gameplayPurpose: "Transition point from structured industry into unstable frontier space.",
    prepAdvice: "Build for control pressure, mixed hostiles, and fights that punish lazy positioning.",
    theaterTag: "frontline",
    frontlinePressure: "high",
    supplyLineImportance: "medium",
    chartStatus: "charted"
  },
  blackwake: {
    identityLabel: "Pirate pipe",
    gameplayPurpose: "Fast dangerous transit, ambush fights, and pirate doctrine exposure.",
    prepAdvice: "Kill tackle fast and assume any shortcut here is paying with safety.",
    theaterTag: "raid",
    frontlinePressure: "extreme",
    supplyLineImportance: "low",
    chartStatus: "restricted"
  },
  "vanta-expanse": {
    identityLabel: "Frontier dead-end",
    gameplayPurpose: "Rare resource runs, sparse-traffic exploration, and quiet high-risk mining.",
    prepAdvice: "Bring a self-sufficient fit. Help is far away and the ore is worth fighting over.",
    theaterTag: "deep-wild",
    frontlinePressure: "extreme",
    supplyLineImportance: "low",
    chartStatus: "partial"
  },
  "ghostlight-pocket": {
    identityLabel: "Hidden salvage pocket",
    gameplayPurpose: "High-end frontier profit, endgame salvage, and curated danger.",
    prepAdvice: "Treat every undock as a committed operation. This is a profit pocket, not a casual stop.",
    theaterTag: "relic",
    frontlinePressure: "extreme",
    supplyLineImportance: "low",
    chartStatus: "rumored"
  },
  "glass-harbor": {
    identityLabel: "Research harbor",
    gameplayPurpose: "Tech-linked trade, cleaner mining support, and refined core logistics.",
    prepAdvice: "Useful for precision fits and stable trade without leaving the core.",
    theaterTag: "rear",
    frontlinePressure: "low",
    supplyLineImportance: "high",
    chartStatus: "charted"
  },
  "crown-exchange": {
    identityLabel: "Financial market node",
    gameplayPurpose: "Premium hauling, broker-heavy route planning, and high-value cargo choices.",
    prepAdvice: "Come here to read margins and reroute profit, not to grind raw volume.",
    theaterTag: "rear",
    frontlinePressure: "low",
    supplyLineImportance: "high",
    chartStatus: "charted"
  },
  "slag-arc": {
    identityLabel: "Smelter war lane",
    gameplayPurpose: "Industrial combat, ore turnover, and rougher refinery contracts.",
    prepAdvice: "Armor prep matters here. Expect hard ships, hard routes, and ugly follow-up pressure.",
    theaterTag: "border",
    frontlinePressure: "high",
    supplyLineImportance: "high",
    chartStatus: "charted"
  },
  "brass-strait": {
    identityLabel: "Guarded freight crossing",
    gameplayPurpose: "Reliable hauling and border transit with steadier but still meaningful risk.",
    prepAdvice: "A good lane for cautious trade players who still want industrial-region profit.",
    theaterTag: "staging",
    frontlinePressure: "medium",
    supplyLineImportance: "high",
    chartStatus: "charted"
  },
  "ashen-deep": {
    identityLabel: "Raider corridor",
    gameplayPurpose: "Frontier combat runs, salvage tension, and dangerous transit choices.",
    prepAdvice: "Bring control resistance and a plan for pirate pressure before you undock.",
    theaterTag: "raid",
    frontlinePressure: "high",
    supplyLineImportance: "low",
    chartStatus: "partial"
  },
  "hush-atlas": {
    identityLabel: "Survey frontier",
    gameplayPurpose: "Exploration-minded mining, route scouting, and quieter frontier operations.",
    prepAdvice: "Looks calmer than it is. Build for long-range situational awareness and self-reliance.",
    theaterTag: "deep-wild",
    frontlinePressure: "medium",
    supplyLineImportance: "low",
    chartStatus: "partial"
  },
  "revenant-crossing": {
    identityLabel: "Deadspace crossing",
    gameplayPurpose: "Endgame salvage, heavy combat pockets, and hostile anomaly pressure.",
    prepAdvice: "Expect the hardest local fights, unstable geometry, and enemies that punish indecision.",
    theaterTag: "relic",
    frontlinePressure: "extreme",
    supplyLineImportance: "low",
    chartStatus: "rumored"
  }
};

export const sectorCatalog: SolarSystemDefinition[] = [...baseSectorCatalog, ...expansionSectorCatalog].map((sector) => ({
  ...sector,
  ...systemIdentityById[sector.id],
  neighbors: Array.from(new Set([...sector.neighbors, ...(neighborAdditions[sector.id] ?? [])])),
  destinations: [...sector.destinations, ...(destinationAdditions[sector.id] ?? [])]
}));

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
