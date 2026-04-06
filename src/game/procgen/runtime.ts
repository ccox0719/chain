import {
  GameWorld,
  ProceduralContractDefinition,
  ProceduralContractState,
  ProcgenState,
  RegionalEventState,
  SolarSystemDefinition,
  SystemDestination
} from "../../types/game";
import { regionById, sectorById } from "../data/sectors";
import { factionData } from "../data/factions";
import { getContractStandingRequirement } from "../utils/factionStanding";
import { commodityById } from "../economy/data/commodities";
import { enemyVariantById, enemyVariants } from "../data/ships";
import { estimateRouteRisk, planRoute } from "../universe/routePlanning";
import { encounterPackTemplates, lootBonusTemplates } from "./data/encounters";
import {
  bountyContractTemplates,
  miningContractTemplates,
  proceduralTypeWeights,
  transportCargoTemplates
} from "./data/contracts";
import { regionalEventTemplates } from "./data/events";
import { siteHotspotTemplates } from "./data/sites";
import { clamp, createSeededRandom, pickOne, randomInt, weightedPick, weightedShuffle } from "./utils";
import { SPAWN_BALANCE } from "../config/balance";

export const PROCGEN_EVENT_CYCLE_SEC = 720;
export const PROCGEN_BOARD_SIZE = 4;

const FACTION_CONTRACT_STYLE: Record<
  keyof typeof factionData,
  { titlePrefix: string; transportVoice: string; miningVoice: string; bountyVoice: string }
> = {
  "aurelian-league": {
    titlePrefix: "League",
    transportVoice: "Civic logistics needs this lane kept on schedule.",
    miningVoice: "League procurement wants the berth filled before the window closes.",
    bountyVoice: "League patrol command wants the route cleared without delay."
  },
  "cinder-union": {
    titlePrefix: "Union",
    transportVoice: "Foundry dispatch is moving industrial freight under pressure.",
    miningVoice: "Union extraction wants tonnage on the dock before the shift rotates.",
    bountyVoice: "Union route control wants the attackers broken before the convoy slips."
  },
  veilborn: {
    titlePrefix: "Veil",
    transportVoice: "A quiet crew is moving deniable cargo along a live lane.",
    miningVoice: "A Veil broker wants the pull made before anyone else reads the rock.",
    bountyVoice: "A Veil handler wants local pressure cut before the lane collapses."
  },
  "helion-cabal": {
    titlePrefix: "Cabal",
    transportVoice: "Telemetry and sealed optics cargo need controlled handling.",
    miningVoice: "Cabal survey teams need calibrated extraction samples from this site.",
    bountyVoice: "Cabal overseers want the firing lane sanitized for precision work."
  },
  "ironbound-syndicate": {
    titlePrefix: "Ironbound",
    transportVoice: "Contract freight needs a secured handoff under customs discipline.",
    miningVoice: "Ironbound procurement wants the feedstock chain kept intact.",
    bountyVoice: "Ironbound security wants the lane held and the threat billed in wreckage."
  },
  "blackwake-clans": {
    titlePrefix: "Blackwake",
    transportVoice: "A clan broker is moving rough cargo through a dangerous cut.",
    miningVoice: "A clan yard wants the haul stripped out before a cleaner crew arrives.",
    bountyVoice: "A clan captain wants local rivals cut out of the route."
  }
};

function getFactionContractStyle(factionId: keyof typeof factionData) {
  return FACTION_CONTRACT_STYLE[factionId];
}

function stationTagSet(station: SystemDestination | null, system: SolarSystemDefinition) {
  return new Set([...(station?.tags ?? []), ...(system.economyTags ?? []), ...(system.missionTags ?? [])]);
}

function stationContractBias(station: SystemDestination, type: ProceduralContractDefinition["type"]) {
  const tags = new Set(station.tags ?? []);
  let bias = 1;
  if (type === "transport" && (tags.has("market") || tags.has("logistics"))) bias += 0.18;
  if (type === "mining" && (tags.has("mining") || tags.has("industrial"))) bias += 0.2;
  if (type === "bounty" && (tags.has("repair") || tags.has("frontier") || tags.has("military"))) bias += 0.16;
  return bias;
}

function riskScore(risk: "low" | "medium" | "high" | "extreme") {
  if (risk === "low") return 1;
  if (risk === "medium") return 2;
  if (risk === "high") return 3;
  return 4;
}

type EncounterRole = (typeof encounterPackTemplates)[number]["roles"][number];

function getEncounterRoleWeight(role: EncounterRole, sector: SolarSystemDefinition) {
  const region = regionById[sector.regionId];
  const regionBias = SPAWN_BALANCE.regionRoleBias[region?.id ?? sector.regionId]?.[role] ?? 1;
  const factionBias = SPAWN_BALANCE.factionRoleBias[sector.controllingFaction]?.[role] ?? 1;
  const securityBias = SPAWN_BALANCE.securityRoleBias[sector.security]?.[role] ?? 1;
  return regionBias * factionBias * securityBias;
}

function getEncounterTemplateWeight(template: (typeof encounterPackTemplates)[number], sector: SolarSystemDefinition) {
  const roleBias =
    template.roles.reduce((sum, role) => sum + getEncounterRoleWeight(role, sector), 0) / Math.max(1, template.roles.length);
  let weight = template.weight * roleBias;
  if (sector.danger >= 4 && template.roles.some((role) => role === "sniper" || role === "artillery")) {
    weight *= SPAWN_BALANCE.triggerWeights.dangerSniperBonus;
  }
  if (sector.security === "high" && template.roles.some((role) => role === "swarm" || role === "tackle")) {
    weight *= SPAWN_BALANCE.triggerWeights.highSecuritySwarmPenalty;
  }
  if (sector.security === "frontier" && template.roles.some((role) => role === "swarm" || role === "tackle" || role === "hunter")) {
    weight *= SPAWN_BALANCE.triggerWeights.frontierRoleBoost;
  }
  return weight;
}

export function getProcgenCycle(world: GameWorld) {
  return Math.floor(world.elapsedTime / PROCGEN_EVENT_CYCLE_SEC);
}

export function createInitialProcgenState(seed = Math.floor(Math.random() * 0x7fffffff)): ProcgenState {
  return {
    seed,
    eventCycle: -1,
    regionalEvents: {},
    siteHotspots: {},
    activeContract: null,
    activeContractState: null
  };
}

export function ensureProcgenState(world: GameWorld) {
  const cycle = getProcgenCycle(world);
  if (world.procgen.eventCycle === cycle && Object.keys(world.procgen.regionalEvents).length > 0) return;

  const regionalEvents: Record<string, RegionalEventState> = {};
  const siteHotspots: ProcgenState["siteHotspots"] = {};
  const regionIds = Array.from(new Set(Object.values(sectorById).map((sector) => sector.regionId)));
  regionIds.forEach((regionId) => {
    const templates = regionalEventTemplates
      .filter((template) => template.regions.includes(regionId))
      .map((template) => ({ ...template, weight: template.weight }));
    const random = createSeededRandom(`${world.procgen.seed}:${regionId}:event:${cycle}`);
    const picked = weightedPick(templates, random) ?? templates[0];
    if (!picked) return;
    regionalEvents[regionId] = {
      id: picked.id,
      regionId,
      cycle,
      name: picked.name,
      description: picked.description,
      affectedTags: picked.affectedTags,
      serviceOffer: picked.serviceOffer,
      hostileActivityMultiplier: picked.hostileActivityMultiplier,
      rewardMultiplier: picked.rewardMultiplier,
      missionTypeWeights: picked.missionTypeWeights,
      stockBiasTags: picked.stockBiasTags,
      priceAdjustments: picked.priceAdjustments
    };
  });

  world.procgen.eventCycle = cycle;
  world.procgen.regionalEvents = regionalEvents;
  Object.values(sectorById).forEach((system) => {
    const candidates = system.destinations.filter(
      (entry): entry is typeof entry & { kind: "anomaly" | "wreck" | "beacon" } =>
        entry.kind === "anomaly" || entry.kind === "wreck" || entry.kind === "beacon"
    );
    if (candidates.length === 0) return;
    const random = createSeededRandom(`${world.procgen.seed}:${system.id}:site:${cycle}`);
    const destination = pickOne(candidates, random);
    const template = weightedPick(
      siteHotspotTemplates
        .filter((entry) => entry.destinationKinds.includes(destination.kind))
        .map((entry) => ({ ...entry, weight: entry.weight + (system.danger >= 4 ? 0.6 : 0) })),
      random
    );
    if (!template) return;
    siteHotspots[system.id] = {
      id: template.id,
      systemId: system.id,
      destinationId: destination.id,
      cycle,
      title: `${destination.name} ${template.title}`,
      description: template.description,
      encounterWeight: template.encounterWeight,
      rewardMultiplier: template.rewardMultiplier,
      tags: template.tags
    };
  });
  world.procgen.siteHotspots = siteHotspots;
}

export function getRegionalEventForSystem(world: GameWorld, systemId: string) {
  ensureProcgenState(world);
  const regionId = sectorById[systemId]?.regionId;
  return regionId ? world.procgen.regionalEvents[regionId] ?? null : null;
}

export function getSiteHotspotForSystem(world: GameWorld, systemId: string) {
  ensureProcgenState(world);
  return world.procgen.siteHotspots[systemId] ?? null;
}

function getStationEntries() {
  return Object.values(sectorById)
    .map((system) => ({
      system,
      station: system.destinations.find((entry) => entry.kind === "station") ?? null
    }))
    .filter((entry): entry is { system: SolarSystemDefinition; station: SystemDestination } => Boolean(entry.station));
}

function buildTransportContract(
  world: GameWorld,
  station: SystemDestination,
  system: SolarSystemDefinition,
  event: RegionalEventState | null,
  random: () => number,
  slot: number
) {
  const destinationPool = getStationEntries()
    .filter((entry) => entry.station.id !== station.id)
    .map((entry) => {
      const routePreference = pickOne(["shortest", "safer"] as const, random);
      const route = planRoute(world, system.id, entry.system.id, routePreference, false);
      if (!route || route.steps.length <= 0 || route.steps.length > 4) return null;
      let weight = 2.8 - route.steps.length * 0.35;
      if (entry.system.regionId !== system.regionId) weight += 0.25;
      if (entry.system.economyTags.some((tag) => event?.affectedTags.includes(tag))) weight += 0.35;
      return { ...entry, route, routePreference, weight };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const destination = weightedPick(destinationPool, random);
  if (!destination) return null;

  const cargoTemplatePool = transportCargoTemplates.map((template) => {
    const tags = new Set([...(destination.station.tags ?? []), ...destination.system.economyTags]);
    const matches = template.tags.filter((tag) => tags.has(tag)).length;
    let weight = template.weight + matches * 0.8;
    if (event && template.tags.some((tag) => event.affectedTags.includes(tag))) weight += 1;
    return { ...template, weight };
  });
  const cargoTemplate = weightedPick(cargoTemplatePool, random);
  if (!cargoTemplate) return null;

  const routeRisk = estimateRouteRisk(destination.route.steps);
  const jumps = destination.route.steps.length;
  const volume = randomInt(cargoTemplate.volumeRange[0], cargoTemplate.volumeRange[1], random);
  const unitValue = randomInt(cargoTemplate.unitValueRange[0], cargoTemplate.unitValueRange[1], random);
  const style = getFactionContractStyle(system.controllingFaction);
  const rewardCredits = Math.round(
    volume * unitValue +
      jumps * 180 +
      riskScore(routeRisk) * 150 +
      (station.tags?.includes("market") ? 60 : 0) +
      (station.tags?.includes("logistics") ? 80 : 0) +
      ((event?.rewardMultiplier ?? 1) - 1) * 280
  ) * stationContractBias(station, "transport");

  return {
    id: `proc:${system.id}:${getProcgenCycle(world)}:${slot}:transport`,
    templateId: cargoTemplate.id,
    type: "transport" as const,
    title: `${style.titlePrefix} ${pickOne(cargoTemplate.titleNouns, random)}`,
    briefing: `${style.transportVoice} ${cargoTemplate.description} Deliver ${volume}u ${cargoTemplate.label} to ${destination.station.name} in ${destination.system.name}.`,
    issuerStationId: station.id,
    issuerSystemId: system.id,
    issuerRegionId: system.regionId,
    issuerFaction: system.controllingFaction,
    requiredStanding: getContractStandingRequirement(routeRisk),
    riskLevel: routeRisk,
    rewardCredits,
    bonusReward: routeRisk === "high" || routeRisk === "extreme" ? 260 + jumps * 70 : undefined,
    bonusTimeLimitSec: jumps >= 2 ? 620 + jumps * 80 : undefined,
    routePreference: cargoTemplate.routePreference,
    targetSystemId: destination.system.id,
    targetStationId: destination.station.id,
    cargoType: cargoTemplate.cargoType,
    cargoVolume: volume,
    cargoUnitValue: unitValue
  } satisfies ProceduralContractDefinition;
}

function buildMiningContract(
  world: GameWorld,
  station: SystemDestination,
  system: SolarSystemDefinition,
  event: RegionalEventState | null,
  random: () => number,
  slot: number
) {
  const field = pickOne(system.asteroidFields, random);
  const belt = system.destinations.find((entry) => entry.id === field?.beltId);
  if (!field || !belt?.resource) return null;

  const templatePool = miningContractTemplates.map((template) => {
    let weight = template.weight;
    if (template.resource === "local" || template.resource === belt.resource) weight += 2.2;
    if (event && template.tags.some((tag) => event.affectedTags.includes(tag))) weight += 0.9;
    return { ...template, weight };
  });
  const template = weightedPick(templatePool, random);
  if (!template) return null;

  const count = randomInt(template.countRange[0], template.countRange[1], random) + Math.max(0, system.danger - 2);
  const riskLevel = system.security === "frontier" ? "high" : system.security === "low" ? "medium" : "low";
  const style = getFactionContractStyle(system.controllingFaction);
  const rewardCredits = Math.round(
    count *
      (belt.resource === "ghost-alloy" ? 126 : belt.resource === "ember-crystal" ? 92 : 64) *
      (event?.rewardMultiplier ?? 1) *
      stationContractBias(station, "mining")
  );

  return {
    id: `proc:${system.id}:${getProcgenCycle(world)}:${slot}:mining`,
    templateId: template.id,
    type: "mining" as const,
    title: `${style.titlePrefix} ${template.titleVerb}`,
    briefing: `${style.miningVoice} ${template.description} Recover ${count} ${belt.resource} from ${belt.name} and return it to ${station.name}.`,
    issuerStationId: station.id,
    issuerSystemId: system.id,
    issuerRegionId: system.regionId,
    issuerFaction: system.controllingFaction,
    requiredStanding: getContractStandingRequirement(riskLevel),
    riskLevel,
    rewardCredits,
    targetSystemId: system.id,
    targetDestinationId: belt.id,
    targetCount: count,
    targetResource: belt.resource
  } satisfies ProceduralContractDefinition;
}

function buildBountyContract(
  world: GameWorld,
  station: SystemDestination,
  system: SolarSystemDefinition,
  event: RegionalEventState | null,
  random: () => number,
  slot: number
) {
  const targetSystemPool = [system, ...system.neighbors.map((neighborId) => sectorById[neighborId]).filter(Boolean)]
    .map((candidate) => {
      let weight = 1 + candidate.danger * 0.5;
      if (candidate.missionTags.includes("combat")) weight += 1;
      if (event && candidate.missionTags.some((tag) => event.affectedTags.includes(tag))) weight += 0.7;
      return { candidate, weight };
    });
  const targetSystem = weightedPick(targetSystemPool, random)?.candidate;
  if (!targetSystem) return null;

  const templatePool = bountyContractTemplates.map((template) => {
    let weight = template.weight;
    if (event && template.tags.some((tag) => event.affectedTags.includes(tag))) weight += 1;
    if (targetSystem.missionTags.some((tag) => template.tags.includes(tag))) weight += 0.8;
    return { ...template, weight };
  });
  const template = weightedPick(templatePool, random);
  if (!template) return null;

  const variants = Array.from(new Set(targetSystem.enemySpawns.map((spawn) => spawn.variantId)));
  const preferredVariants = variants.length > 0
    ? variants
    : enemyVariants
        .filter((variant) => targetSystem.security === "frontier" ? variant.faction !== "aurelian-league" : true)
        .map((variant) => variant.id)
        .slice(0, 2);
  const targetDestination =
    targetSystem.destinations.find((entry) => entry.kind === "anomaly" || entry.kind === "wreck" || entry.kind === "beacon") ??
    targetSystem.destinations.find((entry) => entry.kind === "station") ??
    null;
  const count = randomInt(template.countRange[0], template.countRange[1], random) + Math.max(0, targetSystem.danger - 3);
  const riskLevel = targetSystem.security === "frontier" ? "extreme" : targetSystem.security === "low" ? "high" : "medium";
  const style = getFactionContractStyle(system.controllingFaction);
  const rewardCredits = Math.round(
    (560 + count * 190 + targetSystem.danger * 150) *
      (event?.rewardMultiplier ?? 1) *
      stationContractBias(station, "bounty")
  );

  return {
    id: `proc:${system.id}:${getProcgenCycle(world)}:${slot}:bounty`,
    templateId: template.id,
    type: "bounty" as const,
    title: `${style.titlePrefix} ${template.titlePrefix}`,
    briefing: `${style.bountyVoice} ${template.description} Destroy ${count} hostile hulls in ${targetSystem.name}${targetDestination ? ` near ${targetDestination.name}` : ""} and report back to ${station.name}.`,
    issuerStationId: station.id,
    issuerSystemId: system.id,
    issuerRegionId: system.regionId,
    issuerFaction: system.controllingFaction,
    requiredStanding: getContractStandingRequirement(riskLevel),
    riskLevel,
    rewardCredits,
    targetSystemId: targetSystem.id,
    targetDestinationId: targetDestination?.id,
    targetCount: count,
    enemyVariantIds: preferredVariants.slice(0, 3)
  } satisfies ProceduralContractDefinition;
}

export function generateContractsForStation(world: GameWorld, station: SystemDestination | null, systemId: string) {
  if (!station) return [];
  ensureProcgenState(world);
  const system = sectorById[systemId];
  if (!system) return [];
  const event = getRegionalEventForSystem(world, systemId);
  const hotspot = getSiteHotspotForSystem(world, systemId);
  const tags = stationTagSet(station, system);
  const random = createSeededRandom(`${world.procgen.seed}:${station.id}:board:${getProcgenCycle(world)}`);
  const typePool = weightedShuffle(
    proceduralTypeWeights.map((entry) => {
      let weight = entry.weight;
      if (entry.stationTags?.some((tag) => tags.has(tag))) weight += 1.2;
      if (entry.systemTags?.some((tag) => tags.has(tag))) weight += 0.8;
      if (entry.regionIds?.includes(system.regionId)) weight += 0.8;
      if (event?.missionTypeWeights?.[entry.type]) weight *= event.missionTypeWeights[entry.type] ?? 1;
      if (hotspot?.tags.some((tag) => tags.has(tag) || system.missionTags.includes(tag) || system.economyTags.includes(tag))) weight += 0.5;
      return { ...entry, weight };
    }),
    random
  );

  const contracts: ProceduralContractDefinition[] = [];
  for (let index = 0; index < PROCGEN_BOARD_SIZE; index += 1) {
    const typeEntry = typePool[index % Math.max(1, typePool.length)] ?? typePool[0];
    if (!typeEntry) break;
    const contract =
      typeEntry.type === "transport"
        ? buildTransportContract(world, station, system, event, random, index)
        : typeEntry.type === "mining"
          ? buildMiningContract(world, station, system, event, random, index)
          : buildBountyContract(world, station, system, event, random, index);
    if (contract && !contracts.some((entry) => entry.id === contract.id || (entry.type === contract.type && entry.templateId === contract.templateId && entry.targetSystemId === contract.targetSystemId))) {
      contracts.push(contract);
    }
  }
  return contracts;
}

export function getBoardContractById(world: GameWorld, contractId: string) {
  const station = sectorById[world.currentSectorId]?.destinations.find((entry) => entry.id === world.dockedStationId) ?? null;
  return generateContractsForStation(world, station, world.currentSectorId).find((entry) => entry.id === contractId) ?? null;
}

export function createContractState(world: GameWorld, contract: ProceduralContractDefinition): ProceduralContractState {
  return {
    contractId: contract.id,
    status: "active",
    progress: 0,
    acceptedAt: world.elapsedTime,
    dueAt: contract.bonusReward && contract.bonusTimeLimitSec ? world.elapsedTime + contract.bonusTimeLimitSec : null,
    rewardClaimed: false,
    pickedUp: contract.type === "transport",
    delivered: false
  };
}

export function getContractPayout(world: GameWorld, contract: ProceduralContractDefinition, state: ProceduralContractState) {
  const bonusPaid = state.dueAt !== null && world.elapsedTime <= state.dueAt ? contract.bonusReward ?? 0 : 0;
  const cargoReimbursement = contract.cargoVolume && contract.cargoUnitValue ? contract.cargoVolume * contract.cargoUnitValue : 0;
  const hotspotMultiplier = getSiteHotspotForSystem(world, contract.targetSystemId)?.rewardMultiplier ?? 1;
  return Math.round((contract.rewardCredits + bonusPaid + cargoReimbursement) * hotspotMultiplier);
}

export function getEncounterTemplateOptions(context: "belt" | "gate", systemId: string) {
  const sector = sectorById[systemId];
  if (!sector) return [];
  return encounterPackTemplates.filter((template) => {
    if (template.context !== context) return false;
    if (sector.danger < template.minDanger || sector.danger > template.maxDanger) return false;
    if (template.security && !template.security.includes(sector.security)) return false;
    return true;
  }).map((template) => ({
    ...template,
    weight: getEncounterTemplateWeight(template, sector)
  }));
}

export function getHostileActivityMultiplier(world: GameWorld, systemId: string) {
  const eventMultiplier = getRegionalEventForSystem(world, systemId)?.hostileActivityMultiplier ?? 1;
  const hotspotMultiplier = getSiteHotspotForSystem(world, systemId)?.encounterWeight ?? 1;
  return eventMultiplier * hotspotMultiplier;
}

export function getCommodityPriceModifier(world: GameWorld, systemId: string, commodityId: string) {
  const event = getRegionalEventForSystem(world, systemId);
  const commodity = commodityById[commodityId];
  if (!event || !commodity) return { buy: 1, sell: 1 };
  return event.priceAdjustments?.reduce(
    (total, adjustment) => {
      if (!commodity.tags.includes(adjustment.tag) && commodity.category !== adjustment.tag) return total;
      return { buy: total.buy * adjustment.buyMultiplier, sell: total.sell * adjustment.sellMultiplier };
    },
    { buy: 1, sell: 1 }
  ) ?? { buy: 1, sell: 1 };
}

export function getCommodityStockBias(world: GameWorld, systemId: string, commodityTags: string[]) {
  const event = getRegionalEventForSystem(world, systemId);
  if (!event?.stockBiasTags?.length) return 0;
  return commodityTags.some((tag) => event.stockBiasTags?.includes(tag)) ? 0.12 : 0;
}

export function rollProceduralLoot(world: GameWorld, variantId: string) {
  const variant = enemyVariantById[variantId];
  if (!variant) return {};
  const random = createSeededRandom(`${world.procgen.seed}:${variantId}:${Math.floor(world.elapsedTime * 10)}`);
  const template = weightedPick(
    lootBonusTemplates.map((entry) => {
      let weight = entry.weight;
      if (entry.factions?.includes(variant.faction)) weight += 1;
      if (entry.combatStyles?.includes(variant.combatStyle)) weight += 0.8;
      return { ...entry, weight };
    }),
    random
  );
  if (!template) return {};
  return Object.fromEntries(
    template.commodities
      .filter((entry) => random() <= entry.chance)
      .map((entry) => [entry.commodityId, randomInt(entry.amountRange[0], entry.amountRange[1], random)])
      .filter(([, amount]) => Number(amount) > 0)
  );
}

export function contractProgressFraction(contract: ProceduralContractDefinition, state: ProceduralContractState | null) {
  if (!state) return 0;
  if (contract.type === "transport") return state.delivered ? 1 : state.pickedUp ? 0.5 : 0;
  return clamp(state.progress / Math.max(1, contract.targetCount ?? 1), 0, 1);
}
