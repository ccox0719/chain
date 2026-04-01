import {
  AsteroidState,
  BuildSwapState,
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
import { transportMissionCatalog } from "../missions/data/transportMissions";
import { moduleById } from "../data/modules";
import { enemyVariantById, playerShipById } from "../data/ships";
import { defaultStarterShipConfigId, starterShipConfigById } from "../data/starterShips";
import { getSystemStation, sectorCatalog, sectorById } from "../data/sectors";
import { normalizePilotLicense } from "../utils/pilotLicense";

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
    warpProgress: 0
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
    lockRangeMultiplier: 1
  };
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
      "salvage-scrap": 0
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
    navigation: idleNav(),
    queuedUndockActions: [],
    effects: neutralEffects(),
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

export function createRuntimeSector(sectorId: string): SectorRuntime {
  const sector = sectorById[sectorId];
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
  sector.asteroidFields.forEach((field, fieldIndex) => {
    const chance = field.hostileSpawnChance ?? 0;
    if (chance <= 0 || Math.random() > chance) return;
    const variantIds = field.hostileSpawnVariantIds?.length
      ? field.hostileSpawnVariantIds
      : ["dust-raider", "scrap-drone", "veil-stalker"];
    const count = field.hostileSpawnCount ?? 1;
    for (let index = 0; index < count; index += 1) {
      const variant = enemyVariantById[pickRandom(variantIds)] ?? enemyVariantById["dust-raider"];
      const position = scatter(
        field.center,
        Math.max(70, field.spread * 0.55),
        fieldIndex * 7 + index,
        Math.max(count, 1)
      );
      const patrolBehavior = pickEnemyPatrolBehavior();
      enemies.push({
        id: uid("enemy"),
        variantId: variant.id,
        position,
        velocity: { x: 0, y: 0 },
        rotation: 0,
        shield: variant.shield,
        armor: variant.armor,
        hull: variant.hull,
        capacitor: variant.capacitor,
        patrolBehavior,
        patrolAnchor: position,
        patrolTarget: createEnemyPatrolTarget(patrolBehavior, position, sector.width, sector.height),
        navigation: idleNav(),
        lockedTargets: [],
        activeTarget: null,
        modules: enemyModuleRuntime(variant.fittedModules),
        effects: neutralEffects(),
        recentDamageTimer: 0
      });
    }
  });

  sector.enemySpawns.forEach((spawn) => {
    const variant = enemyVariantById[spawn.variantId];
    for (let index = 0; index < spawn.count; index += 1) {
      const position = scatter(spawn.center, spawn.radius, index, spawn.count);
      const patrolBehavior = pickEnemyPatrolBehavior();
      enemies.push({
        id: uid("enemy"),
        variantId: variant.id,
        position,
        velocity: { x: 0, y: 0 },
        rotation: 0,
        shield: variant.shield,
        armor: variant.armor,
        hull: variant.hull,
        capacitor: variant.capacitor,
        patrolBehavior,
        patrolAnchor: position,
        patrolTarget: createEnemyPatrolTarget(patrolBehavior, position, sector.width, sector.height),
        navigation: idleNav(),
        lockedTargets: [],
        activeTarget: null,
        modules: enemyModuleRuntime(variant.fittedModules),
        effects: neutralEffects(),
        recentDamageTimer: 0
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
    particles: []
  };
}

export function createInitialWorld(
  difficulty: DifficultyId = "normal",
  starterConfigId = defaultStarterShipConfigId
): GameWorld {
  const missions: Record<string, MissionState> = Object.fromEntries(
    missionCatalog.map((mission) => [
      mission.id,
      {
        missionId: mission.id,
        status: mission.requiredMissionId ? "locked" : "available",
        progress: 0
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

  return {
    player: createPlayer(starterConfigId),
    difficulty,
    currentSectorId: "lumen-rest",
    unlockedSectorIds: ["lumen-rest"],
    sectors: Object.fromEntries(sectorCatalog.map((sector) => [sector.id, createRuntimeSector(sector.id)])),
    missions,
    transportMissions,
    dockedStationId: getSystemStation("lumen-rest")?.id ?? null,
    selectedObject: null,
    lockedTargets: [],
    activeTarget: null,
    routePlan: null,
    elapsedTime: 0,
    storyLog: [
      "You inherited a damaged courier and a stack of unpaid station fees.",
      "Lumen Station cleared you for local contracts if you can keep the hull flying.",
      "Out here, route choice matters as much as gunnery."
    ]
  };
}

export function createProjectile(
  owner: ProjectileState["owner"],
  moduleId: string,
  position: Vec2,
  velocity: Vec2,
  damage: number,
  target?: ProjectileState["target"],
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
    qualityLabel
  };
}
