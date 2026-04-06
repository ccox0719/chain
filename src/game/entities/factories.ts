import {
  AsteroidState,
  BuildSwapState,
  DeathSummary,
  EnemyState,
  GameWorld,
  MissionState,
  TransportMissionState,
  ModuleRuntimeState,
  NavigationState,
  PlayerState,
  ProjectileState,
  SectorRuntime,
  Vec2,
  DifficultyId
} from "../../types/game";
import { missionCatalog } from "../data/missions";
import { getEnemyArchetypeDefinition } from "../data/enemyArchetypes";
import { transportMissionCatalog } from "../missions/data/transportMissions";
import { moduleById } from "../data/modules";
import { enemyVariantById, playerShipById } from "../data/ships";
import { defaultStarterShipConfigId, starterShipConfigById } from "../data/starterShips";
import { getSystemStation, sectorCatalog, sectorById } from "../data/sectors";
import { createInitialProcgenState, ensureProcgenState } from "../procgen/runtime";
import { normalizePilotLicense } from "../utils/pilotLicense";
import { createLocalSiteFromDestination, createTransitLocalSite } from "../world/sites";
import { COMBAT_BALANCE } from "../config/balance";

let nextId = 0;

function uid(prefix: string) {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function scatter(center: Vec2, radius: number, index: number, total: number) {
  const angle = (Math.PI * 2 * index) / total + index * 0.44;
  const distance = radius * (0.35 + (index % 5) * 0.14);
  return {
    x: center.x + Math.cos(angle) * distance,
    y: center.y + Math.sin(angle) * distance
  };
}

function idleNav(): NavigationState {
  return {
    mode: "idle",
    target: null,
    desiredRange: 0,
    destination: null,
    warpFrom: null,
    warpProgress: 0,
    postWarpDock: false
  };
}

function createRuntimeSlots(ids: Array<string | null>): ModuleRuntimeState[] {
  return ids.map((moduleId) => ({
    moduleId,
    active: false,
    cycleRemaining: 0,
    autoRepeat: true
  }));
}

function neutralEffects() {
  return {
    speedMultiplier: 1,
    signatureMultiplier: 1,
    turretTrackingMultiplier: 1,
    lockRangeMultiplier: 1,
    capacitorRegenMultiplier: 1
  };
}

function tacticalSlowState() {
  return {
    activeRemaining: 0,
    cooldownRemaining: 0,
    capPenaltyRemaining: 0,
    speedPenaltyRemaining: 0
  };
}

function createBoundaryState() {
  return {
    profile: {
      id: "transit-bootstrap",
      type: "transit" as const,
      center: { x: 0, y: 0 },
      activeRadius: 0,
      bufferRadius: 0,
      containmentRadius: 0,
      recoveryReleaseRadius: 0,
      pullStrength: 0,
      dampingStrength: 0,
      turnAssistStrength: 0,
      zoneType: "transit" as const,
      visualLabel: "Local navigation grid",
      title: "Local navigation grid",
      detail: "You are operating inside a local pocket of system space."
    },
    warningLevel: 0,
    correctionLevel: 0,
    active: false,
    zone: "active" as const,
    title: null,
    detail: null,
    tone: "transit" as const,
    forcedFacing: null,
    forcedTurnRate: 0,
    returnState: {
      active: false,
      releaseRadius: 0,
      suspendedNav: null,
      recoveryPoint: null,
      pocketId: null,
      reason: null
    }
  };
}

function emptyDeathSummary(): DeathSummary | null {
  return null;
}

function cloneLoadout(loadout: PlayerState["equipped"]): PlayerState["equipped"] {
  return {
    weapon: [...loadout.weapon],
    utility: [...loadout.utility],
    defense: [...loadout.defense]
  };
}

function createEmptyBuildSwap(): BuildSwapState {
  return {
    active: false,
    targetBuildId: null,
    targetBuildName: null,
    targetShipId: null,
    targetEquipped: null,
    duration: 0,
    remaining: 0,
    changedModuleCount: 0
  };
}

function createStarterInventory(starterFit: PlayerState["equipped"]) {
  void starterFit;
  return {};
}

function createStartingFactionStandings(): PlayerState["factionStandings"] {
  return {
    "aurelian-league": 1,
    "cinder-union": 0.2,
    veilborn: 0,
    "helion-cabal": 0.4,
    "ironbound-syndicate": 0.2,
    "blackwake-clans": 0
  };
}

export function rebuildPlayerRuntime(player: PlayerState) {
  player.modules = {
    weapon: createRuntimeSlots(player.equipped.weapon),
    utility: createRuntimeSlots(player.equipped.utility),
    defense: createRuntimeSlots(player.equipped.defense)
  };
}

export function createPlayer(starterConfigId = defaultStarterShipConfigId): PlayerState {
  const starterConfig = starterShipConfigById[starterConfigId] ?? starterShipConfigById[defaultStarterShipConfigId];
  const hull = playerShipById[starterConfig.shipId];
  const starterFit = cloneLoadout(starterConfig.equipped);
  const player: PlayerState = {
    starterConfigId: starterConfig.id,
    pilotLicense: normalizePilotLicense({ progress: 0 }),
    factionStandings: createStartingFactionStandings(),
    hullId: hull.id,
    ownedShips: [hull.id],
    position: { x: 1140, y: 1180 },
    velocity: { x: 0, y: 0 },
    rotation: -Math.PI / 2,
    shield: hull.baseShield,
    armor: hull.baseArmor,
    hull: hull.baseHull,
    capacitor: hull.baseCapacitor,
    cargo: { ferrite: 0, "ember-crystal": 0, "ghost-alloy": 0 },
    commodities: {
      "food-supplies": 0,
      "industrial-parts": 0,
      "fuel-cells": 0,
      "medical-supplies": 0,
      electronics: 0,
      "weapons-components": 0,
      "refined-alloys": 0,
      "frontier-survival-kits": 0,
      "luxury-goods": 0,
      "salvage-scrap": 0,
      "coolant-gel": 0,
      "reactor-coils": 0,
      "drone-parts": 0,
      "archive-shards": 0,
      "siege-stims": 0
    },
    missionCargo: [],
    credits: 950,
    inventory: {
      modules: createStarterInventory(starterFit)
    },
    equipped: cloneLoadout(starterFit),
    modules: {
      weapon: [],
      utility: [],
      defense: []
    },
    weaponHoldFire: false,
    navigation: idleNav(),
    pendingLocks: [],
    queuedUndockActions: [],
    effects: neutralEffects(),
    tacticalSlow: tacticalSlowState(),
    deathSummary: emptyDeathSummary(),
    savedBuilds: [
      { id: "build-1", name: "Build 1", shipId: hull.id, equipped: cloneLoadout(starterFit), savedAt: Date.now() },
      { id: "build-2", name: "Build 2", shipId: hull.id, equipped: cloneLoadout(starterFit), savedAt: null },
      { id: "build-3", name: "Build 3", shipId: hull.id, equipped: cloneLoadout(starterFit), savedAt: null }
    ],
    buildSwap: createEmptyBuildSwap(),
    recentDamageTimer: 0
  };

  rebuildPlayerRuntime(player);
  return player;
}

export function createStarterPlayerState(starterConfigId = defaultStarterShipConfigId) {
  return createPlayer(starterConfigId);
}

function enemyModuleRuntime(moduleIds: string[]): ModuleRuntimeState[] {
  return moduleIds.map((moduleId, index) => ({
    moduleId,
    active: true,
    cycleRemaining: (moduleById[moduleId]?.cycleTime ?? 0) * (0.25 + index * 0.2),
    autoRepeat: true
  }));
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function clampPointToSector(point: Vec2, width: number, height: number): Vec2 {
  return {
    x: Math.max(80, Math.min(width - 80, point.x)),
    y: Math.max(80, Math.min(height - 80, point.y))
  };
}

function pickEnemyPatrolBehavior() {
  const roll = Math.random();
  if (roll < 0.24) return "stationary" as const;
  if (roll < 0.66) return "anchor-patrol" as const;
  return "roaming" as const;
}

function createEnemyPatrolTarget(
  behavior: "stationary" | "anchor-patrol" | "roaming",
  anchor: Vec2,
  sectorWidth: number,
  sectorHeight: number
) {
  if (behavior === "stationary") return null;
  if (behavior === "anchor-patrol") {
    return clampPointToSector(
      {
        x: anchor.x + (Math.random() - 0.5) * 320,
        y: anchor.y + (Math.random() - 0.5) * 320
      },
      sectorWidth,
      sectorHeight
    );
  }
  return {
    x: 120 + Math.random() * Math.max(240, sectorWidth - 240),
    y: 120 + Math.random() * Math.max(240, sectorHeight - 240)
  };
}

function getEnemyDurabilityMultiplier(difficulty: DifficultyId) {
  if (difficulty === "easy") return COMBAT_BALANCE.difficulty.easy.enemyDurabilityMultiplier ?? 1;
  if (difficulty === "hard") return COMBAT_BALANCE.difficulty.hard.enemyDurabilityMultiplier ?? 1;
  return COMBAT_BALANCE.difficulty.normal.enemyDurabilityMultiplier ?? 1;
}

export function createRuntimeSector(sectorId: string, difficulty: DifficultyId = "normal"): SectorRuntime {
  const sector = sectorById[sectorId];
  const enemyDurabilityMultiplier = getEnemyDurabilityMultiplier(difficulty);
  const asteroids: AsteroidState[] = [];
  sector.asteroidFields.forEach((field) => {
    for (let index = 0; index < field.count; index += 1) {
      asteroids.push({
        id: uid("asteroid"),
        beltId: field.beltId,
        position: scatter(field.center, field.spread, index, field.count),
        radius: 22 + (index % 4) * 5,
        resource: field.resource,
        oreRemaining: field.richness + (index % 3) * 3
      });
    }
  });

  const enemies: EnemyState[] = [];
  sector.enemySpawns.forEach((spawn) => {
    const variant = enemyVariantById[spawn.variantId];
    for (let index = 0; index < spawn.count; index += 1) {
      const position = scatter(spawn.center, spawn.radius, index, spawn.count);
      const archetype = getEnemyArchetypeDefinition(variant.archetype);
      const patrolBehavior = variant.boss ? "stationary" : archetype?.patrolBehavior ?? pickEnemyPatrolBehavior();
      enemies.push({
        id: uid("enemy"),
        variantId: variant.id,
        boss: variant.boss,
        position,
        velocity: { x: 0, y: 0 },
        rotation: 0,
        shield: Math.max(1, Math.round(variant.shield * enemyDurabilityMultiplier)),
        armor: Math.max(1, Math.round(variant.armor * enemyDurabilityMultiplier)),
        hull: Math.max(1, Math.round(variant.hull * enemyDurabilityMultiplier)),
        capacitor: variant.capacitor,
        patrolBehavior,
        patrolAnchor: position,
        patrolTarget: createEnemyPatrolTarget(patrolBehavior, position, sector.width, sector.height),
        navigation: idleNav(),
        lockedTargets: [],
        activeTarget: null,
        modules: enemyModuleRuntime(variant.fittedModules),
        effects: neutralEffects(),
        recentDamageTimer: 0,
        pursuitTimer: 0
      });
    }
  });

  return {
    enemies,
    asteroids,
    projectiles: [],
    loot: [],
    wrecks: [],
    floatingText: [],
    particles: [],
    beltSpawnCooldowns: {},
    challengePressure: 0,
    reinforcementTimer: 0
  };
}

export function createInitialWorld(
  difficulty: DifficultyId = "normal",
  starterConfigId = defaultStarterShipConfigId
): GameWorld {
  const startSystemId = "lumen-rest";
  const startStation = getSystemStation(startSystemId);
  const missions: Record<string, MissionState> = Object.fromEntries(
    missionCatalog.map((mission) => [
      mission.id,
      {
        missionId: mission.id,
        status: mission.requiredMissionId ? "locked" : "available",
        progress: 0,
        bossSpawned: false,
        bossDefeated: false
      }
    ])
  );
  const transportMissions: Record<string, TransportMissionState> = Object.fromEntries(
    transportMissionCatalog.map((mission) => [
      mission.id,
      {
        missionId: mission.id,
        status: mission.requiredMissionId ? "locked" : "available",
        pickedUp: false,
        delivered: false,
        rewardClaimed: false,
        acceptedAt: null,
        dueAt: null,
        rewardEstimate: mission.baseReward + mission.cargoVolume * (mission.cargoUnitValue ?? 0)
      }
    ])
  );

  const world: GameWorld = {
    player: createPlayer(starterConfigId),
    difficulty,
    currentSectorId: startSystemId,
    localSite: startStation
      ? createLocalSiteFromDestination(startSystemId, startStation)
      : createTransitLocalSite(startSystemId, { x: 0, y: 0 }),
    unlockedSectorIds: [startSystemId],
    sectors: Object.fromEntries(sectorCatalog.map((sector) => [sector.id, createRuntimeSector(sector.id, difficulty)])),
    missions,
    transportMissions,
    dockedStationId: startStation?.id ?? null,
    selectedObject: null,
    lockedTargets: [],
    activeTarget: null,
    routePlan: null,
    elapsedTime: 0,
    timeScale: 0.75,
    boundary: createBoundaryState(),
    procgen: createInitialProcgenState(),
    storyLog: [
      "You inherited a damaged courier and a stack of unpaid station fees.",
      "Lumen Station cleared you for local contracts if you can keep the hull flying.",
      "Out here, route choice matters as much as gunnery."
    ]
  };
  ensureProcgenState(world);
  return world;
}

export function createProjectile(
  owner: ProjectileState["owner"],
  moduleId: string,
  position: Vec2,
  velocity: Vec2,
  damage: number,
  target?: ProjectileState["target"],
  impactPosition?: Vec2 | null,
  qualityLabel?: ProjectileState["qualityLabel"]
): ProjectileState {
  return {
    id: uid("projectile"),
    owner,
    moduleId,
    position: { ...position },
    velocity,
    radius: moduleId.includes("missile") ? 6 : 4,
    damage,
    ttl: moduleId.includes("missile") ? 3.6 : 1.6,
    target,
    impactPosition: impactPosition ? { ...impactPosition } : null,
    qualityLabel
  };
}
