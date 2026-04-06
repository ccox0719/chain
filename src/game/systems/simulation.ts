import {
  BuildSlotId,
  BoundaryState,
  BoundaryProfile,
  CommandAction,
  CommodityId,
  DamageProfile,
  EnemyState,
  EnemyVariant,
  EquippedLoadout,
  EconomySnapshot,
  GameSnapshot,
  GameWorld,
  MissionDefinition,
  HostilePackRole,
  ModuleSlot,
  NavigationState,
  ObjectInfo,
  ParticleShape,
  ParticleState,
  CombatObjective,
  ResistProfile,
  ResourceId,
  FactionId,
  SelectableRef,
  SystemDestination,
  SpaceObjectType,
  TransportMissionDefinition,
  TransportTracker,
  TransportRisk,
  Vec2
} from "../../types/game";
import { bossByMissionId } from "../data/bosses";
import { factionData } from "../data/factions";
import { getEnemyArchetypeDefinition } from "../data/enemyArchetypes";
import { missionById, missionCatalog } from "../data/missions";
import { moduleById } from "../data/modules";
import { enemyVariantById, enemyVariants, playerShipById } from "../data/ships";
import { getSystemBeacons, getSystemDestination, getSystemDestinations, getSystemGates, getSystemStation, regionById, sectorById } from "../data/sectors";
import { defaultStarterShipConfigId } from "../data/starterShips";
import { createProjectile, createStarterPlayerState, rebuildPlayerRuntime } from "../entities/factories";
import {
  getPilotLicenseLevelForProgress,
  getPilotLicenseProgressRange,
  getRequiredPilotLicenseLevel,
  hasPilotLicenseForModule,
  normalizePilotLicense
} from "../utils/pilotLicense";
import { advanceRouteAfterJump, estimateRouteRisk, getNextRouteStep, planRoute } from "../universe/routePlanning";
import { getCargoUsed, getCachedDerivedStats, getStationaryCapacitorRegenMultiplier } from "../utils/stats";
import { transportMissionById, transportMissionCatalog } from "../missions/data/transportMissions";
import { commodityById, commodityCatalog } from "../economy/data/commodities";
import { isCommodityStockedAtStation } from "../economy/commodityAvailability";
import { isModuleAvailableAtStation } from "../economy/moduleAvailability";
import {
  getCommodityBuyPrice,
  getCommoditySellPrice,
  getModuleBuyPrice,
  getModuleSellPrice,
  getResourceSellPrice,
  getShipBuyPrice,
  getShipSellPrice
} from "../economy/pricing";
import {
  contractProgressFraction,
  createContractState,
  ensureProcgenState,
  generateContractsForStation,
  getBoardContractById,
  getCommodityPriceModifier,
  getContractPayout,
  getEncounterTemplateOptions,
  getHostileActivityMultiplier,
  getRegionalEventForSystem,
  getSiteHotspotForSystem,
  rollProceduralLoot
} from "../procgen/runtime";
import {
  add,
  angleTo,
  clamp,
  clampMagnitude,
  distance,
  fromAngle,
  length,
  lerpAngle,
  normalize,
  scale,
  subtract
} from "../utils/vector";
import { canMineResource, getMiningYieldMultiplier } from "../utils/mining";
import { findObjectAtPoint, getObjectInfo, getObjectPosition, getOverviewEntries } from "../world/spaceObjects";
import { createTransitLocalSite, enterDestinationSite, isDestinationLocal, isPositionInLocalSite, syncLocalSite } from "../world/sites";
import {
  CAPACITOR_BALANCE,
  COMBAT_BALANCE,
  MOVEMENT_BALANCE,
  MISSION_BALANCE,
  PROGRESSION_BALANCE,
  SPAWN_BALANCE
} from "../config/balance";

function addFloatingText(world: GameWorld, position: Vec2, text: string, color: string) {
  world.sectors[world.currentSectorId].floatingText.push({
    id: `${text}-${Date.now()}-${Math.random()}`,
    position: { ...position },
    text,
    color,
    ttl: 1
  });
}

let particleCounter = 0;

function spawnParticle(
  world: GameWorld,
  position: Vec2,
  velocity: Vec2,
  color: string,
  size: number,
  lifetime: number,
  shape: ParticleShape,
  glow: number
): ParticleState {
  return {
    id: `pt-${++particleCounter}`,
    position: { ...position },
    velocity: { ...velocity },
    lifetime,
    ttl: lifetime,
    color,
    size,
    shape,
    glow
  };
}

function emitBurst(
  world: GameWorld,
  position: Vec2,
  color: string,
  count: number,
  minSpeed: number,
  maxSpeed: number,
  lifetime: number,
  size: number,
  shape: ParticleShape,
  glow: number
) {
  const sector = world.sectors[world.currentSectorId];
  if (!sector.particles) sector.particles = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const spd = minSpeed + Math.random() * (maxSpeed - minSpeed);
    sector.particles.push(
      spawnParticle(world, position, { x: Math.cos(angle) * spd, y: Math.sin(angle) * spd }, color, size, lifetime, shape, glow)
    );
  }
}

function emitImpact(world: GameWorld, position: Vec2, color: string, moduleId?: string) {
  if (moduleId?.includes("missile")) {
    // Missile: big expanding fireball with shockwave and slow ember debris
    emitBurst(world, position, "#ffffff", 1, 0, 0, 0.16, 44, "dot", 58);
    emitBurst(world, position, "#ffb265", 1, 0, 0, 0.30, 30, "dot", 44);
    emitBurst(world, position, "#ffb265", 28, 90, 400, 0.65, 6.5, "spark", 24);
    emitBurst(world, position, "#ffffff", 12, 70, 240, 0.38, 4, "spark", 18);
    emitBurst(world, position, "#ff8830", 16, 20, 120, 1.4, 6.5, "dot", 22);
    emitBurst(world, position, "#ff4400", 8, 5, 45, 2.0, 8, "dot", 20);
  } else if (moduleId?.includes("rail")) {
    // Railgun: blinding kinetic punch + blue-white sparks spraying back
    emitBurst(world, position, "#ffffff", 1, 0, 0, 0.14, 36, "dot", 65);
    emitBurst(world, position, "#b8e8ff", 24, 150, 500, 0.45, 5, "spark", 22);
    emitBurst(world, position, "#ffffff", 10, 90, 280, 0.30, 3.5, "spark", 26);
    emitBurst(world, position, "#88ccff", 12, 10, 80, 0.9, 5.5, "dot", 18);
    emitBurst(world, position, "#ddf6ff", 6, 5, 30, 1.2, 6, "dot", 22);
  } else {
    // Laser: sharp flash + crackling sparks
    emitBurst(world, position, color, 1, 0, 0, 0.13, 22, "dot", 36);
    emitBurst(world, position, color, 20, 70, 300, 0.36, 4, "spark", 20);
    emitBurst(world, position, "#ffffff", 8, 30, 100, 0.24, 3, "dot", 18);
    emitBurst(world, position, color, 10, 10, 55, 0.65, 4.5, "dot", 14);
  }
}

function emitShieldHit(world: GameWorld, position: Vec2) {
  // Ripple of blue/cyan dots — shield absorbing energy
  emitBurst(world, position, "#5ae0ff", 12, 30, 130, 0.35, 3.5, "dot", 18);
  emitBurst(world, position, "#ffffff", 4, 20, 70, 0.18, 2.5, "dot", 14);
  emitBurst(world, position, "#a0eeff", 8, 50, 160, 0.26, 2, "spark", 10);
}

function emitArmorHit(world: GameWorld, position: Vec2) {
  // Chunky orange/gold sparks — plating taking damage
  emitBurst(world, position, "#ffdd80", 1, 0, 0, 0.12, 14, "dot", 32);
  emitBurst(world, position, "#ffaa44", 14, 60, 220, 0.42, 4, "spark", 16);
  emitBurst(world, position, "#ffffff", 5, 40, 130, 0.22, 2.5, "spark", 12);
  emitBurst(world, position, "#ff8820", 8, 10, 55, 0.7, 5, "dot", 18);
}

function emitHullHit(world: GameWorld, position: Vec2) {
  // Red/white intense burst — structural damage
  emitBurst(world, position, "#ffffff", 1, 0, 0, 0.14, 22, "dot", 50);
  emitBurst(world, position, "#ff3030", 18, 80, 290, 0.5, 4.5, "spark", 22);
  emitBurst(world, position, "#ffffff", 8, 60, 200, 0.28, 3, "spark", 16);
  emitBurst(world, position, "#ff6040", 10, 20, 80, 1.0, 5, "dot", 18);
  emitBurst(world, position, "#ff2020", 5, 5, 35, 1.4, 6, "dot", 22);
}

function emitRepairPulse(world: GameWorld, position: Vec2, kind: "shield" | "armor") {
  if (kind === "shield") {
    emitBurst(world, position, "#5ae0ff", 10, 20, 90, 0.55, 3.5, "dot", 18);
    emitBurst(world, position, "#ffffff", 4, 10, 45, 0.35, 2, "dot", 12);
  } else {
    emitBurst(world, position, "#ffaa44", 10, 20, 90, 0.55, 3.5, "dot", 18);
    emitBurst(world, position, "#ffdd80", 4, 10, 45, 0.35, 2, "dot", 12);
  }
}

function emitExplosion(world: GameWorld, position: Vec2, color: string) {
  // Blinding layered core flash
  emitBurst(world, position, "#ffffff", 1, 0, 0, 0.24, 80, "dot", 65);
  emitBurst(world, position, color, 1, 0, 0, 0.20, 58, "dot", 55);
  emitBurst(world, position, "#ffffff", 1, 0, 0, 0.42, 44, "dot", 45);
  // Outer shockwave fast sparks — dense and wide
  emitBurst(world, position, color, 56, 240, 700, 0.58, 6, "spark", 24);
  emitBurst(world, position, "#ffffff", 24, 160, 480, 0.44, 4, "spark", 20);
  // Secondary ring of hot sparks
  emitBurst(world, position, "#ffffff", 14, 100, 260, 0.32, 3, "spark", 16);
  // Mid-speed diamond shards tumbling out
  emitBurst(world, position, color, 18, 80, 280, 1.2, 8, "diamond", 28);
  emitBurst(world, position, "#ffffff", 8, 50, 160, 0.9, 5, "diamond", 20);
  // Slower glowing debris cloud — drifts and lingers
  emitBurst(world, position, color, 32, 30, 150, 1.8, 7, "dot", 26);
  emitBurst(world, position, "#ff9040", 14, 15, 80, 2.2, 8, "dot", 24);
  // Ember core — almost stationary, long glow
  emitBurst(world, position, "#ffffff", 16, 5, 32, 2.8, 9, "dot", 32);
  const sector = world.sectors[world.currentSectorId];
  sector.cameraShake = Math.min(14, (sector.cameraShake ?? 0) + 6);
}

function emitMiningYield(world: GameWorld, position: Vec2, resource: ResourceId) {
  const color =
    resource === "ferrite" ? "#86e0ff" : resource === "ember-crystal" ? "#ff9f6d" : "#bc99ff";
  const bright =
    resource === "ferrite" ? "#ccf4ff" : resource === "ember-crystal" ? "#ffd4a8" : "#e0ccff";
  // Sharp crack flash
  emitBurst(world, position, bright, 1, 0, 0, 0.14, 22, "dot", 35);
  // Crystal shards blasting outward
  emitBurst(world, position, color, 14, 80, 260, 0.45, 3.5, "spark", 14);
  emitBurst(world, position, bright, 6, 60, 180, 0.3, 2.5, "spark", 10);
  // Ore chunk diamonds tumbling out
  emitBurst(world, position, color, 8, 25, 100, 1.0, 5, "diamond", 18);
  // Glowing dust cloud settling
  emitBurst(world, position, color, 10, 10, 55, 1.1, 4, "dot", 14);
}

function emitWarpActivate(world: GameWorld, position: Vec2, rotation: number) {
  const sector = world.sectors[world.currentSectorId];
  if (!sector.particles) sector.particles = [];
  const backAngle = rotation + Math.PI;
  // Heavy directional engine jets
  for (let i = 0; i < 44; i++) {
    const spread = (Math.random() - 0.5) * 0.85;
    const spd = 200 + Math.random() * 520;
    const angle = backAngle + spread;
    sector.particles.push(
      spawnParticle(world, position, { x: Math.cos(angle) * spd, y: Math.sin(angle) * spd }, "#7ae0ff", 3 + Math.random() * 2, 0.65, "spark", 14)
    );
  }
  // Blinding core flash
  emitBurst(world, position, "#ffffff", 1, 0, 0, 0.22, 40, "dot", 58);
  emitBurst(world, position, "#a0f0ff", 1, 0, 0, 0.32, 26, "dot", 42);
  // Omnidirectional shockwave ring
  emitBurst(world, position, "#7ae0ff", 20, 80, 200, 0.5, 3.5, "dot", 18);
  emitBurst(world, position, "#ffffff", 10, 40, 100, 0.4, 4, "dot", 22);
}

function emitWarpSpool(world: GameWorld, position: Vec2, rotation: number, progress: number) {
  // Progressive engine spool — particles grow denser as warpProgress climbs
  const sector = world.sectors[world.currentSectorId];
  if (!sector.particles) sector.particles = [];
  const backAngle = rotation + Math.PI;
  const count = Math.ceil(3 + progress * 10);
  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * (0.5 + progress * 0.35);
    const spd = 50 + Math.random() * (80 + progress * 220);
    const angle = backAngle + spread;
    sector.particles.push(
      spawnParticle(world, position, { x: Math.cos(angle) * spd, y: Math.sin(angle) * spd }, "#7ae0ff", 1.8 + Math.random() * 1.5, 0.25 + progress * 0.2, "spark", 8 + progress * 8)
    );
  }
}

function emitWarpArrive(world: GameWorld, position: Vec2) {
  // Deceleration wash
  emitBurst(world, position, "#ffffff", 1, 0, 0, 0.18, 32, "dot", 50);
  emitBurst(world, position, "#a0f0ff", 1, 0, 0, 0.28, 20, "dot", 36);
  emitBurst(world, position, "#7ae0ff", 22, 80, 220, 0.55, 3.5, "spark", 14);
  emitBurst(world, position, "#ffffff", 10, 30, 80, 0.6, 5, "dot", 20);
  emitBurst(world, position, "#a0f0ff", 6, 8, 30, 0.9, 7, "diamond", 22);
}

function emitGateJump(world: GameWorld, position: Vec2) {
  // Gate activation ring — bright orange/white burst
  emitBurst(world, position, "#ffffff", 1, 0, 0, 0.25, 48, "dot", 64);
  emitBurst(world, position, "#ff9d6a", 1, 0, 0, 0.36, 32, "dot", 48);
  emitBurst(world, position, "#ff9d6a", 36, 130, 520, 0.55, 4.5, "spark", 22);
  emitBurst(world, position, "#ffffff", 18, 90, 340, 0.38, 3, "spark", 18);
  emitBurst(world, position, "#ffcc88", 14, 30, 130, 1.2, 6, "dot", 24);
  emitBurst(world, position, "#ffffff", 8, 5, 40, 1.8, 7, "dot", 28);
  const sector = world.sectors[world.currentSectorId];
  sector.cameraShake = Math.min(12, (sector.cameraShake ?? 0) + 8);
}

function emitDockPulse(world: GameWorld, position: Vec2) {
  emitBurst(world, position, "#84e8ff", 14, 25, 110, 0.65, 3.5, "dot", 16);
  emitBurst(world, position, "#ffffff", 6, 15, 55, 0.45, 2.5, "dot", 12);
  emitBurst(world, position, "#cefbff", 8, 40, 140, 0.4, 2, "spark", 10);
}

function updateParticles(world: GameWorld, dt: number) {
  const sector = world.sectors[world.currentSectorId];
  if (!sector.particles) { sector.particles = []; return; }
  if (sector.cameraShake) sector.cameraShake = Math.max(0, sector.cameraShake - dt * 24);
  if (sector.playerHitFlash) sector.playerHitFlash = Math.max(0, sector.playerHitFlash - dt * 5);
  for (const p of sector.particles) {
    p.position = add(p.position, scale(p.velocity, dt));
    // Sparks decelerate fast; dots and diamonds drift longer
    const drag = p.shape === "spark" ? 2.2 : 1.4;
    p.velocity = scale(p.velocity, 1 - dt * drag);
    p.ttl -= dt;
  }
  sector.particles = sector.particles.filter((p) => p.ttl > 0);
  if (sector.particles.length > 1400) sector.particles = sector.particles.slice(-1400);
}

function pushStory(world: GameWorld, message: string) {
  world.storyLog = [message, ...world.storyLog].slice(0, 7);
}

export function addCredits(world: GameWorld, amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return;
  world.player.credits = Math.max(0, world.player.credits + Math.round(amount));
  pushStory(world, `DEV: added ${Math.round(amount)} credits.`);
}

function adjustFactionStanding(world: GameWorld, factionId: FactionId, amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return;
  const current = world.player.factionStandings[factionId] ?? 0;
  world.player.factionStandings[factionId] = Number(clamp(current + amount, 0, 3).toFixed(2));
}

function ensurePilotLicense(world: GameWorld) {
  world.player.pilotLicense = normalizePilotLicense(world.player.pilotLicense);
}

function awardPilotLicenseProgress(world: GameWorld, amount: number) {
  if (amount <= 0) return;
  ensurePilotLicense(world);
  const previousLevel = world.player.pilotLicense.level;
  const nextProgress = world.player.pilotLicense.progress + Math.max(
    1,
    Math.round(amount * PROGRESSION_BALANCE.pilotLicense.awardMultiplier)
  );
  world.player.pilotLicense.progress = nextProgress;
  world.player.pilotLicense.level = getPilotLicenseLevelForProgress(nextProgress);
  if (world.player.pilotLicense.level > previousLevel) {
    pushStory(world, `Pilot license advanced to L${world.player.pilotLicense.level}.`);
  }
}

function reducePilotLicenseProgress(world: GameWorld, amount: number) {
  if (amount <= 0) return 0;
  ensurePilotLicense(world);
  const currentLevel = world.player.pilotLicense.level;
  const currentProgress = world.player.pilotLicense.progress;
  const { start } = getPilotLicenseProgressRange(currentLevel);
  const nextProgress = Math.max(start, currentProgress - Math.max(1, Math.round(amount)));
  world.player.pilotLicense.progress = nextProgress;
  world.player.pilotLicense.level = currentLevel;
  return currentProgress - nextProgress;
}

function getCurrentSector(world: GameWorld) {
  return world.sectors[world.currentSectorId];
}

function getCurrentSectorDef(world: GameWorld) {
  return sectorById[world.currentSectorId];
}

function getCurrentStation(world: GameWorld) {
  return getSystemStation(world.currentSectorId);
}

const TERRAIN = MOVEMENT_BALANCE.terrain;

function applySalvageBoundaryPull(world: GameWorld, dt: number) {
  void world;
  void dt;
}

function applyEnemyBoundaryContainment(
  world: GameWorld,
  position: Vec2,
  velocity: Vec2,
  dt: number
) {
  const sectorDef = getCurrentSectorDef(world);
  const margin = 42;
  const minX = margin;
  const maxX = Math.max(minX + 1, sectorDef.width - margin);
  const minY = margin;
  const maxY = Math.max(minY + 1, sectorDef.height - margin);
  const nextPosition = { ...position };
  const nextVelocity = { ...velocity };
  let corrected = false;

  if (nextPosition.x < minX) {
    nextPosition.x = minX;
    if (nextVelocity.x < 0) nextVelocity.x = Math.max(0, -nextVelocity.x * 0.18);
    corrected = true;
  } else if (nextPosition.x > maxX) {
    nextPosition.x = maxX;
    if (nextVelocity.x > 0) nextVelocity.x = Math.min(0, -nextVelocity.x * 0.18);
    corrected = true;
  }

  if (nextPosition.y < minY) {
    nextPosition.y = minY;
    if (nextVelocity.y < 0) nextVelocity.y = Math.max(0, -nextVelocity.y * 0.18);
    corrected = true;
  } else if (nextPosition.y > maxY) {
    nextPosition.y = maxY;
    if (nextVelocity.y > 0) nextVelocity.y = Math.min(0, -nextVelocity.y * 0.18);
    corrected = true;
  }

  if (!corrected) return { position, velocity };

  const edgeDamping = Math.max(0.55, 1 - dt * 1.4);
  return {
    position: nextPosition,
    velocity: scale(nextVelocity, edgeDamping)
  };
}

function applyPlayerBoundaryBehavior(world: GameWorld, dt: number) {
  syncLocalSite(world);
  const boundary = world.boundary;
  boundary.profile.center = { ...world.localSite.center };
  boundary.profile.activeRadius = world.localSite.activeRadius;
  boundary.profile.bufferRadius = world.localSite.activeRadius * 1.15;
  boundary.profile.containmentRadius = world.localSite.activeRadius * 1.28;
  boundary.profile.recoveryReleaseRadius = world.localSite.activeRadius * 0.82;
  boundary.profile.visualLabel = world.localSite.label;
  boundary.profile.title = world.localSite.label;
  boundary.profile.detail = world.localSite.subtitle;
  boundary.tone =
    world.localSite.type === "anomaly"
      ? "anomaly"
      : world.localSite.type === "belt"
        ? "belt"
        : world.localSite.type === "mission"
          ? "mission"
          : world.localSite.type === "gate"
            ? "gate"
            : world.localSite.type === "station" || world.localSite.type === "outpost"
              ? "station"
              : "transit";
  boundary.title = null;
  boundary.detail = null;
  boundary.warningLevel = 0;
  boundary.correctionLevel = 0;
  boundary.active = false;
  boundary.zone = "active";
  boundary.forcedFacing = null;
  boundary.forcedTurnRate = 0;
  if (boundary.returnState.active || world.player.navigation.mode === "boundary_return") {
    const resume = boundary.returnState.suspendedNav;
    boundary.returnState.active = false;
    boundary.returnState.reason = null;
    boundary.returnState.suspendedNav = null;
    boundary.returnState.recoveryPoint = null;
    boundary.returnState.pocketId = null;
    boundary.returnState.releaseRadius = 0;
    if (resume) {
      world.player.navigation.mode = resume.mode;
      world.player.navigation.target = resume.target;
      world.player.navigation.desiredRange = resume.desiredRange;
      world.player.navigation.destination = resume.destination;
      world.player.navigation.warpFrom = resume.warpFrom;
      world.player.navigation.warpProgress = resume.warpProgress;
    } else if (world.player.navigation.mode === "boundary_return") {
      setIdle(world.player.navigation);
    }
  }
  void dt;
}

function getDifficultyModifiers(world: GameWorld) {
  if (world.difficulty === "easy") {
    return COMBAT_BALANCE.difficulty.easy;
  }
  if (world.difficulty === "hard") {
    return COMBAT_BALANCE.difficulty.hard;
  }
  return COMBAT_BALANCE.difficulty.normal;
}

function getCombatPressureModifiers() {
  const dial = clamp(COMBAT_BALANCE.pressure.dial ?? 1, 0.6, 1.4);
  const offset = dial - 1;
  return {
    dial,
    playerDamageMultiplier: clamp(1 - offset * 0.35, 0.75, 1.2),
    enemyDamageMultiplier: clamp(1 + offset * 0.42, 0.78, 1.3),
    playerTrackingMultiplier: clamp(1 - offset * 0.28, 0.8, 1.2),
    enemyTrackingMultiplier: clamp(1 + offset * 0.24, 0.82, 1.22),
    enemyDetectionMultiplier: clamp(1 + offset * 0.18, 0.88, 1.18)
  };
}

function getTacticalSlowState(world: GameWorld) {
  return world.player.tacticalSlow;
}

function getWorldTimeScale(world: GameWorld) {
  const baseScale = Math.max(0.25, Math.min(3, world.timeScale || 1));
  const tacticalScale = getTacticalSlowState(world).activeRemaining > 0 ? CAPACITOR_BALANCE.tacticalSlow.timeScale : 1;
  return baseScale * tacticalScale;
}

function getShipPowerTier(shipId: string) {
  const ship = playerShipById[shipId];
  if (!ship) return 1;
  return PROGRESSION_BALANCE.shipPowerTierByClass[ship.shipClass];
}

function getPlayerPowerTier(world: GameWorld) {
  const shipTier = getShipPowerTier(world.player.hullId);
  const equippedModuleIds = [
    ...world.player.equipped.weapon,
    ...world.player.equipped.utility,
    ...world.player.equipped.defense
  ].filter((moduleId): moduleId is string => Boolean(moduleId));
  if (equippedModuleIds.length === 0) return shipTier;
  const moduleTechValues = equippedModuleIds.map((moduleId) => moduleById[moduleId]?.techLevel ?? 1);
  const averageTech = moduleTechValues.reduce((sum, value) => sum + value, 0) / moduleTechValues.length;
  const highWater = Math.max(...moduleTechValues);
  let tier = shipTier;
  if (averageTech >= PROGRESSION_BALANCE.playerPowerTier.averageTechTierThreshold) tier += 1;
  if (averageTech >= PROGRESSION_BALANCE.playerPowerTier.advancedTechTierThreshold || highWater >= PROGRESSION_BALANCE.playerPowerTier.highWaterThreshold) tier += 1;
  if (shipTier >= PROGRESSION_BALANCE.playerPowerTier.cruiserFloorTier && highWater >= 3) tier = Math.max(tier, 3);
  return Math.max(PROGRESSION_BALANCE.playerPowerTier.minTier, Math.min(PROGRESSION_BALANCE.playerPowerTier.maxTier, tier));
}

function cloneLoadout(loadout: EquippedLoadout): EquippedLoadout {
  return {
    weapon: [...loadout.weapon],
    utility: [...loadout.utility],
    defense: [...loadout.defense]
  };
}

function createEmptyProfile(): DamageProfile {
  return { em: 0, thermal: 0, kinetic: 0, explosive: 0 };
}

function createDamagePacket(profile: DamageProfile | undefined, baseDamage: number) {
  const normalizedProfile = profile ?? { em: 0.25, thermal: 0.25, kinetic: 0.25, explosive: 0.25 };
  return {
    em: normalizedProfile.em * baseDamage,
    thermal: normalizedProfile.thermal * baseDamage,
    kinetic: normalizedProfile.kinetic * baseDamage,
    explosive: normalizedProfile.explosive * baseDamage
  };
}

function scaleDamagePacket(packet: DamageProfile, scaleFactor: number) {
  return {
    em: packet.em * scaleFactor,
    thermal: packet.thermal * scaleFactor,
    kinetic: packet.kinetic * scaleFactor,
    explosive: packet.explosive * scaleFactor
  };
}

function clampResists(resists: ResistProfile, bonus = 0): ResistProfile {
  return {
    em: clamp(resists.em + bonus, 0, COMBAT_BALANCE.damage.resistClamp),
    thermal: clamp(resists.thermal + bonus, 0, COMBAT_BALANCE.damage.resistClamp),
    kinetic: clamp(resists.kinetic + bonus, 0, COMBAT_BALANCE.damage.resistClamp),
    explosive: clamp(resists.explosive + bonus, 0, COMBAT_BALANCE.damage.resistClamp)
  };
}

function getActiveHardenerBonus(modules: Array<{ active: boolean; moduleId: string | null }>) {
  return modules.reduce((best, runtime) => {
    if (!runtime.active || !runtime.moduleId) return best;
    const module = moduleById[runtime.moduleId];
    if (module?.kind !== "hardener") return best;
    return Math.max(best, module.resistBonus ?? 0);
  }, 0);
}

function getPlayerLayerResists(world: GameWorld) {
  const derived = getCachedDerivedStats(world.player);
  const bonus = getActiveHardenerBonus(world.player.modules.defense);
  return {
    shield: clampResists(derived.shieldResists, bonus),
    armor: clampResists(derived.armorResists, bonus),
    hull: clampResists(derived.hullResists, bonus)
  };
}

function resetCombatEffects(world: GameWorld) {
  world.player.effects = {
    speedMultiplier: 1,
    signatureMultiplier: 1,
    turretTrackingMultiplier: 1,
    lockRangeMultiplier: 1,
    capacitorRegenMultiplier: 1
  };
  getCurrentSector(world).enemies.forEach((enemy) => {
    enemy.effects = {
      speedMultiplier: 1,
      signatureMultiplier: 1,
      turretTrackingMultiplier: 1,
      lockRangeMultiplier: 1,
      capacitorRegenMultiplier: 1
    };
  });
}

function applyTacticalSlowEffects(world: GameWorld) {
  const tacticalSlow = getTacticalSlowState(world);
  if (tacticalSlow.speedPenaltyRemaining > 0) {
    world.player.effects.speedMultiplier = Math.min(
      world.player.effects.speedMultiplier,
      CAPACITOR_BALANCE.tacticalSlow.speedPenaltyMultiplier
    );
  }
  if (tacticalSlow.capPenaltyRemaining > 0) {
    world.player.effects.capacitorRegenMultiplier = Math.min(
      world.player.effects.capacitorRegenMultiplier,
      CAPACITOR_BALANCE.tacticalSlow.capacitorRegenPenaltyMultiplier
    );
  }
}

function applyPlayerControlEffects(world: GameWorld) {
  const player = world.player;
  const sector = getCurrentSector(world);
  player.modules.utility.forEach((runtime) => {
    if (!runtime.active || !runtime.moduleId) return;
    const module = moduleById[runtime.moduleId];
    if (!module) return;
    if (
      module.kind !== "webifier" &&
      module.kind !== "warp_disruptor" &&
      module.kind !== "target_painter" &&
      module.kind !== "tracking_disruptor" &&
      module.kind !== "sensor_dampener"
    ) {
      return;
    }
    const target = resolveModuleTarget(world, module.requiresTarget);
    if (!target || target.type !== "enemy") return;
    const targetEnemy = sector.enemies.find((enemy) => enemy.id === target.id);
    const targetPosition = targetEnemy?.position;
    if (!targetEnemy || !targetPosition) return;
    if (module.range && distance(player.position, targetPosition) > module.range) return;

    if (module.kind === "webifier") {
      targetEnemy.effects.speedMultiplier = Math.min(
        targetEnemy.effects.speedMultiplier,
        1 - (module.speedPenalty ?? 0)
      );
    }
    if (module.kind === "target_painter") {
      targetEnemy.effects.signatureMultiplier = Math.max(
        targetEnemy.effects.signatureMultiplier,
        1 + (module.signatureBonus ?? 0)
      );
    }
    if (module.kind === "tracking_disruptor") {
      targetEnemy.effects.turretTrackingMultiplier = Math.min(
        targetEnemy.effects.turretTrackingMultiplier,
        1 - (module.trackingPenalty ?? 0)
      );
    }
    if (module.kind === "sensor_dampener") {
      targetEnemy.effects.lockRangeMultiplier = Math.min(
        targetEnemy.effects.lockRangeMultiplier,
        1 - (module.lockRangePenalty ?? 0)
      );
    }
  });
}

function applyEnemyControlEffects(world: GameWorld) {
  const player = world.player;
  const sector = getCurrentSector(world);
  sector.enemies.forEach((enemy) => {
    const variant = enemyVariantById[enemy.variantId];
    if (!variant) return;
    const playerDistance = distance(enemy.position, player.position);
    const seesPlayer = playerDistance <= variant.lockRange * enemy.effects.lockRangeMultiplier;
    if (!seesPlayer) return;

    enemy.modules.forEach((runtime) => {
      if (!runtime.active || !runtime.moduleId) return;
      const module = moduleById[runtime.moduleId];
      if (!module) return;
      if (
        module.kind !== "webifier" &&
        module.kind !== "warp_disruptor" &&
        module.kind !== "target_painter" &&
        module.kind !== "tracking_disruptor" &&
        module.kind !== "sensor_dampener"
      ) {
        return;
      }
      if (module.range && playerDistance > module.range) return;

      if (module.kind === "webifier") {
        player.effects.speedMultiplier = Math.min(player.effects.speedMultiplier, 1 - (module.speedPenalty ?? 0));
      }
      if (module.kind === "target_painter") {
        player.effects.signatureMultiplier = Math.max(
          player.effects.signatureMultiplier,
          1 + (module.signatureBonus ?? 0)
        );
      }
      if (module.kind === "tracking_disruptor") {
        player.effects.turretTrackingMultiplier = Math.min(
          player.effects.turretTrackingMultiplier,
          1 - (module.trackingPenalty ?? 0)
        );
      }
      if (module.kind === "sensor_dampener") {
        player.effects.lockRangeMultiplier = Math.min(
          player.effects.lockRangeMultiplier,
          1 - (module.lockRangePenalty ?? 0)
        );
      }
    });
  });
}

function getHostileWarpDisruptor(world: GameWorld) {
  const player = world.player;
  const sector = getCurrentSector(world);
  return sector.enemies.find((enemy) => {
    const variant = enemyVariantById[enemy.variantId];
    if (!variant || enemy.hull <= 0) return false;
    const playerDistance = distance(enemy.position, player.position);
    const seesPlayer = playerDistance <= variant.lockRange * enemy.effects.lockRangeMultiplier;
    if (!seesPlayer) return false;
    return enemy.modules.some((runtime) => {
      if (!runtime.active || !runtime.moduleId) return false;
      const module = moduleById[runtime.moduleId];
      if (!module || module.kind !== "warp_disruptor") return false;
      return !module.range || playerDistance <= module.range;
    });
  });
}

function getWeaponDamageMultiplier(
  kind: string | undefined,
  derived: ReturnType<typeof getCachedDerivedStats>
) {
  if (kind === "laser") return derived.laserDamageMultiplier;
  if (kind === "railgun") return derived.railgunDamageMultiplier;
  if (kind === "missile") return derived.missileDamageMultiplier;
  return 1;
}

function getWeaponCycleMultiplier(
  kind: string | undefined,
  derived: ReturnType<typeof getCachedDerivedStats>
) {
  if (kind === "laser") return derived.laserCycleMultiplier;
  if (kind === "railgun") return derived.railgunCycleMultiplier;
  if (kind === "missile") return derived.missileCycleMultiplier;
  return 1;
}

function getEnemyLayerResists(enemyId: string, world: GameWorld) {
  const enemy = getCurrentSector(world).enemies.find((entry) => entry.id === enemyId);
  if (!enemy) {
    return {
      shield: clampResists({ em: 0, thermal: 0, kinetic: 0, explosive: 0 }),
      armor: clampResists({ em: 0, thermal: 0, kinetic: 0, explosive: 0 }),
      hull: clampResists({ em: 0, thermal: 0, kinetic: 0, explosive: 0 })
    };
  }
  const variant = enemyVariantById[enemy.variantId];
  const bonus = getActiveHardenerBonus(enemy.modules);
  return {
    shield: clampResists(variant.shieldResists, bonus),
    armor: clampResists(variant.armorResists, bonus),
    hull: clampResists(variant.hullResists, bonus)
  };
}

function applyPacketToLayer(packet: DamageProfile, hitPoints: number, resists: ResistProfile) {
  const effectiveDamage =
    packet.em * (1 - resists.em) +
    packet.thermal * (1 - resists.thermal) +
    packet.kinetic * (1 - resists.kinetic) +
    packet.explosive * (1 - resists.explosive);

  if (effectiveDamage <= 0) {
    return {
      remainingHitPoints: hitPoints,
      overflowPacket: createEmptyProfile(),
      dealt: 0
    };
  }

  if (effectiveDamage <= hitPoints) {
    return {
      remainingHitPoints: hitPoints - effectiveDamage,
      overflowPacket: createEmptyProfile(),
      dealt: effectiveDamage
    };
  }

  const overflowFactor = clamp((effectiveDamage - hitPoints) / effectiveDamage, 0, 1);
  return {
    remainingHitPoints: 0,
    overflowPacket: scaleDamagePacket(packet, overflowFactor),
    dealt: hitPoints
  };
}

function applyDamageToTarget(
  target: { shield: number; armor: number; hull: number; recentDamageTimer: number },
  packet: DamageProfile,
  resists: { shield: ResistProfile; armor: ResistProfile; hull: ResistProfile }
) {
  const shieldResult = applyPacketToLayer(packet, target.shield, resists.shield);
  target.shield = shieldResult.remainingHitPoints;
  const armorResult = applyPacketToLayer(shieldResult.overflowPacket, target.armor, resists.armor);
  target.armor = armorResult.remainingHitPoints;
  const hullResult = applyPacketToLayer(armorResult.overflowPacket, target.hull, resists.hull);
  target.hull = hullResult.remainingHitPoints;
  const totalDamage = shieldResult.dealt + armorResult.dealt + hullResult.dealt;
  if (totalDamage > 0.01) {
    target.recentDamageTimer = 8;
  }
  return totalDamage;
}

function countChangedModules(current: EquippedLoadout, target: EquippedLoadout) {
  return (["weapon", "utility", "defense"] as ModuleSlot[]).reduce((total, slotType) => {
    const slotCount = Math.max(current[slotType].length, target[slotType].length);
    let slotChanges = 0;
    for (let index = 0; index < slotCount; index += 1) {
      if ((current[slotType][index] ?? null) !== (target[slotType][index] ?? null)) {
        slotChanges += 1;
      }
    }
    return total + slotChanges;
  }, 0);
}

function trimCargoToCapacity(world: GameWorld, cargoCapacity: number) {
  let overflow = getCargoUsed(world.player) - cargoCapacity;
  if (overflow <= 0) return;

  const droppedResources: Partial<Record<ResourceId, number>> = {};
  const droppedCommodities: Partial<Record<CommodityId, number>> = {};

  (["ghost-alloy", "ember-crystal", "ferrite"] as ResourceId[]).forEach((resource) => {
    if (overflow <= 0) return;
    const available = world.player.cargo[resource] ?? 0;
    if (available <= 0) return;
    const removed = Math.min(available, overflow);
    world.player.cargo[resource] = available - removed;
    droppedResources[resource] = removed;
    overflow -= removed;
  });

  (Object.keys(world.player.commodities) as CommodityId[]).forEach((commodityId) => {
    if (overflow <= 0) return;
    const available = world.player.commodities[commodityId] ?? 0;
    if (available <= 0) return;
    const volume = commodityById[commodityId]?.volume ?? 1;
    const removed = Math.min(available, Math.ceil(overflow / Math.max(1, volume)));
    if (removed <= 0) return;
    world.player.commodities[commodityId] = available - removed;
    droppedCommodities[commodityId] = removed;
    overflow -= removed * volume;
  });

  const parts: string[] = [];
  (Object.entries(droppedResources) as Array<[ResourceId, number]>).forEach(([resource, removed]) => {
    parts.push(`${removed}u ${resource}`);
  });
  (Object.entries(droppedCommodities) as Array<[CommodityId, number]>).forEach(([commodityId, removed]) => {
    parts.push(`${removed}x ${commodityById[commodityId]?.name ?? commodityId}`);
  });

  if (parts.length > 0) {
    pushStory(world, `Cargo jettisoned to fit the new loadout: ${parts.join(", ")}.`);
  }

  if (overflow > 0) {
    pushStory(world, "Cargo hold is still over capacity because mission cargo cannot be auto-dropped.");
  }
}

function getSavedBuild(world: GameWorld, buildId: BuildSlotId) {
  return world.player.savedBuilds.find((entry) => entry.id === buildId) ?? null;
}

function setInventoryModuleCount(world: GameWorld, moduleId: string, count: number) {
  if (count > 0) {
    world.player.inventory.modules[moduleId] = count;
    return;
  }
  delete world.player.inventory.modules[moduleId];
}

function findMatchingBuild(world: GameWorld): BuildSlotId | null {
  const match = world.player.savedBuilds.find(
    (entry) =>
      entry.shipId === world.player.hullId &&
      countChangedModules(world.player.equipped, entry.equipped) === 0
  );
  return match?.id ?? null;
}

function applyBuildLoadout(world: GameWorld, loadout: EquippedLoadout) {
  const hull = playerShipById[world.player.hullId];
  const inventory = { ...world.player.inventory.modules };
  const currentLoadout = cloneLoadout(world.player.equipped);

  (["weapon", "utility", "defense"] as ModuleSlot[]).forEach((slotType) => {
    currentLoadout[slotType].forEach((moduleId) => {
      if (!moduleId) return;
      inventory[moduleId] = (inventory[moduleId] ?? 0) + 1;
    });
  });

  const nextLoadout: EquippedLoadout = {
    weapon: Array.from({ length: hull.slots.weapon }, (_, index) => loadout.weapon[index] ?? null),
    utility: Array.from({ length: hull.slots.utility }, (_, index) => loadout.utility[index] ?? null),
    defense: Array.from({ length: hull.slots.defense }, (_, index) => loadout.defense[index] ?? null)
  };
  ensurePilotLicense(world);
  let blockedByLicense = 0;
  (["weapon", "utility", "defense"] as ModuleSlot[]).forEach((slotType) => {
    nextLoadout[slotType] = nextLoadout[slotType].map((moduleId) => {
      if (!moduleId) return null;
      const module = moduleById[moduleId];
      if (module && hasPilotLicenseForModule(world.player.pilotLicense, module)) {
        return moduleId;
      }
      blockedByLicense += 1;
      return null;
    });
  });

  (["weapon", "utility", "defense"] as ModuleSlot[]).forEach((slotType) => {
    nextLoadout[slotType].forEach((moduleId) => {
      if (!moduleId) return;
      const count = inventory[moduleId] ?? 0;
      if (count <= 0) {
        inventory[moduleId] = 0;
        return;
      }
      inventory[moduleId] = count - 1;
    });
  });

  world.player.inventory.modules = inventory;
  world.player.equipped = {
    weapon: nextLoadout.weapon,
    utility: nextLoadout.utility,
    defense: nextLoadout.defense
  };
  rebuildPlayerRuntime(world.player);
  const derived = getCachedDerivedStats(world.player);
  world.player.hull = clamp(world.player.hull, 0, derived.maxHull);
  world.player.armor = clamp(world.player.armor, 0, derived.maxArmor);
  world.player.shield = clamp(world.player.shield, 0, derived.maxShield);
  world.player.capacitor = clamp(world.player.capacitor, 0, derived.capacitorCapacity);
  trimCargoToCapacity(world, derived.cargoCapacity);
  if (blockedByLicense > 0) {
    pushStory(world, `${blockedByLicense} build module${blockedByLicense === 1 ? "" : "s"} skipped due to pilot license.`);
  }
}

function updateBuildSwap(world: GameWorld, dt: number) {
  const swap = world.player.buildSwap;
  if (!swap.active) return;
  swap.remaining = Math.max(0, swap.remaining - dt);
  if (swap.remaining > 0) return;
  if (swap.targetEquipped) {
    applyBuildLoadout(world, swap.targetEquipped);
    ensureMissionUnlocks(world);
    pushStory(
      world,
      `Reconfiguration complete: ${swap.targetBuildName ?? swap.targetBuildId ?? "saved build"}.`
    );
  }
  world.player.buildSwap = {
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

function updateTacticalSlowTimers(world: GameWorld, dt: number) {
  const tacticalSlow = getTacticalSlowState(world);
  tacticalSlow.activeRemaining = Math.max(0, tacticalSlow.activeRemaining - dt);
  tacticalSlow.cooldownRemaining = Math.max(0, tacticalSlow.cooldownRemaining - dt);
  tacticalSlow.capPenaltyRemaining = Math.max(0, tacticalSlow.capPenaltyRemaining - dt);
  tacticalSlow.speedPenaltyRemaining = Math.max(0, tacticalSlow.speedPenaltyRemaining - dt);
}

function showHitText(
  world: GameWorld,
  position: Vec2,
  damage: number,
  qualityLabel: "miss" | "grazing" | "solid" | "excellent" | undefined,
  palette: "player" | "enemy"
) {
  addFloatingText(
    world,
    position,
    damage < 1 ? "miss" : `${qualityLabel ?? "hit"} ${Math.round(damage)}`,
    damage < 1 ? "#c4d1e8" : palette === "player" ? qualityLabel === "excellent" ? "#ffe08a" : "#ffd078" : "#ff7d7d"
  );
}

function getActiveMission(world: GameWorld): MissionDefinition | null {
  const active = missionCatalog.find((mission) => world.missions[mission.id]?.status === "active");
  return active ?? null;
}

function getActiveProceduralContract(world: GameWorld) {
  return world.procgen.activeContract;
}

function getActiveProceduralState(world: GameWorld) {
  return world.procgen.activeContractState;
}

function getActiveTransportMissionDefinition(world: GameWorld): TransportMissionDefinition | null {
  const missionState = Object.values(world.transportMissions).find((entry) => entry.status === "active");
  if (!missionState) return null;
  return transportMissionById[missionState.missionId] ?? null;
}

function getTransportState(world: GameWorld, missionId: string) {
  return world.transportMissions[missionId] ?? null;
}

function getMissionCargoOnboard(world: GameWorld, missionId: string) {
  return world.player.missionCargo
    .filter((entry) => entry.missionId === missionId)
    .reduce((total, entry) => total + entry.volume, 0);
}

function getTransportCargoReimbursement(mission: TransportMissionDefinition) {
  return Math.max(0, Math.round(mission.cargoVolume * (mission.cargoUnitValue ?? 0)));
}

function getTransportMissionPayout(world: GameWorld, mission: TransportMissionDefinition) {
  const state = getTransportState(world, mission.id);
  const bonusPaid = state?.dueAt !== null && world.elapsedTime <= state.dueAt ? mission.bonusReward ?? 0 : 0;
  return mission.baseReward + bonusPaid + getTransportCargoReimbursement(mission);
}

function getProceduralContractPayout(world: GameWorld) {
  const contract = getActiveProceduralContract(world);
  const state = getActiveProceduralState(world);
  if (!contract || !state) return 0;
  return getContractPayout(world, contract, state);
}

function getLocalEconomySnapshot(world: GameWorld): EconomySnapshot {
  const station = world.dockedStationId ? getCurrentStation(world) : getCurrentStation(world);
  const system = getCurrentSectorDef(world);
  const security = system.security;
  const derived = getCachedDerivedStats(world.player);
  const scalePrice = (value: number, multiplier: number) => Math.max(1, Math.round(value * multiplier));
  const commodityBuyPrices = Object.fromEntries(
    commodityCatalog.map((commodity) => [
      commodity.id,
      scalePrice(
        getCommodityBuyPrice(commodity, security, station, system) * getCommodityPriceModifier(world, system.id, commodity.id).buy,
        derived.commodityBuyMultiplier
      )
    ])
  ) as Record<CommodityId, number>;
  const commoditySellPrices = Object.fromEntries(
    commodityCatalog.map((commodity) => [
      commodity.id,
      scalePrice(
        getCommoditySellPrice(commodity, security, station, system) * getCommodityPriceModifier(world, system.id, commodity.id).sell,
        derived.commoditySellMultiplier
      )
    ])
  ) as Record<CommodityId, number>;
  const moduleBuyPrices = Object.fromEntries(
    Object.values(moduleById).map((module) => [module.id, scalePrice(getModuleBuyPrice(module, security, station), derived.moduleBuyMultiplier)])
  ) as Record<string, number>;
  const moduleSellPrices = Object.fromEntries(
    Object.values(moduleById).map((module) => [module.id, scalePrice(getModuleSellPrice(module, security, station), derived.moduleSellMultiplier)])
  ) as Record<string, number>;
  const shipBuyPrices = Object.fromEntries(
    Object.values(playerShipById).map((ship) => [ship.id, scalePrice(getShipBuyPrice(ship, security, station), derived.shipBuyMultiplier)])
  ) as Record<string, number>;
  const shipSellPrices = Object.fromEntries(
    Object.values(playerShipById).map((ship) => [ship.id, scalePrice(getShipSellPrice(ship, security, station), derived.shipSellMultiplier)])
  ) as Record<string, number>;
  return {
    resourceSellPrices: {
      ferrite: scalePrice(getResourceSellPrice("ferrite", security, station), derived.resourceSellMultiplier),
      "ember-crystal": scalePrice(getResourceSellPrice("ember-crystal", security, station), derived.resourceSellMultiplier),
      "ghost-alloy": scalePrice(getResourceSellPrice("ghost-alloy", security, station), derived.resourceSellMultiplier)
    },
    commodityBuyPrices,
    commoditySellPrices,
    moduleBuyPrices,
    moduleSellPrices,
    shipBuyPrices,
    shipSellPrices
  };
}

function getTransportObjectiveTargetSystem(world: GameWorld, mission: TransportMissionDefinition) {
  const state = getTransportState(world, mission.id);
  if (!state) return mission.destinationSystemId;
  return state.pickedUp ? mission.destinationSystemId : mission.pickupSystemId;
}

function updateTransportRoute(world: GameWorld) {
  const mission = getActiveTransportMissionDefinition(world);
  if (!mission) return;
  const targetSystem = getTransportObjectiveTargetSystem(world, mission);
  const existing = world.routePlan;
  const needsRefresh =
    !existing ||
    existing.destinationSystemId !== targetSystem ||
    (world.currentSectorId !== targetSystem && !existing.steps.some((step) => step.fromSystemId === world.currentSectorId));
  if (!needsRefresh) return;
  const planned = planRoute(world, world.currentSectorId, targetSystem, mission.routePreference, false);
  if (planned) {
    world.routePlan = planned;
  }
}

function normalizeTransportMissionStates(world: GameWorld) {
  transportMissionCatalog.forEach((mission) => {
    const state = world.transportMissions[mission.id];
    if (!state) return;

    const onboard = getMissionCargoOnboard(world, mission.id);
    if (onboard >= mission.cargoVolume && state.status !== "completed") {
      state.status = "active";
      state.pickedUp = true;
      state.delivered = false;
      if (state.acceptedAt === null) {
        state.acceptedAt = world.elapsedTime;
      }
      if (state.dueAt === null && mission.bonusReward && mission.bonusTimeLimitSec) {
        state.dueAt = world.elapsedTime + mission.bonusTimeLimitSec;
      }
      state.rewardEstimate = getTransportMissionPayout(world, mission);
      return;
    }

    if (state.status === "completed" && !state.rewardClaimed) {
      state.rewardEstimate = getTransportMissionPayout(world, mission);
      if (state.pickedUp) {
        state.status = "active";
      }
      if (onboard >= mission.cargoVolume) {
        state.status = "active";
      }
    }
  });
}

function normalizeProceduralContractState(world: GameWorld) {
  const contract = getActiveProceduralContract(world);
  const state = getActiveProceduralState(world);
  if (!contract || !state || state.status === "completed") return;

  if (contract.type === "mining" && contract.targetResource && contract.targetCount) {
    state.progress = Math.min(state.progress, contract.targetCount);
    if (state.progress >= contract.targetCount) {
      state.status = "readyToTurnIn";
    }
    return;
  }

  if (contract.type === "bounty" && contract.targetCount) {
    state.progress = Math.min(state.progress, contract.targetCount);
    if (state.progress >= contract.targetCount) {
      state.status = "readyToTurnIn";
    }
    return;
  }

  if (contract.type === "transport" && state.delivered) {
    state.status = "readyToTurnIn";
  }
}

function normalizeDeliveryMissionStates(world: GameWorld) {
  const station = world.dockedStationId ? getCurrentStation(world) : null;
  missionCatalog.forEach((mission) => {
    if (mission.type !== "deliver") return;
    const state = world.missions[mission.id];
    if (!state || state.status !== "active") return;
    if (!station || mission.targetStationId !== station.id) return;
    if (!mission.targetResource || !mission.targetCount) return;
    if (world.player.cargo[mission.targetResource] >= mission.targetCount) {
      state.status = "readyToTurnIn";
    }
  });
}

function resolveTransportMissionDeliveries(world: GameWorld) {
  const station = world.dockedStationId ? getCurrentStation(world) : null;
  if (!station) return;
  transportMissionCatalog.forEach((mission) => {
    if (mission.destinationStationId !== station.id) return;
    const state = world.transportMissions[mission.id];
    if (!state || state.status !== "active" || !state.pickedUp) return;
    completeTransportMission(world, mission);
  });
}

function resolveProceduralContractDeliveries(world: GameWorld) {
  const contract = getActiveProceduralContract(world);
  const state = getActiveProceduralState(world);
  const station = world.dockedStationId ? getCurrentStation(world) : null;
  if (!contract || !state || !station || state.status === "completed") return;
  if (contract.type !== "transport" || !state.pickedUp || state.delivered) return;
  if (station.id !== contract.targetStationId) return;
  world.player.missionCargo = world.player.missionCargo.filter((entry) => entry.missionId !== contract.id);
  state.delivered = true;
  state.status = "readyToTurnIn";
  pushStory(world, `${contract.title} cargo delivered. Return to ${getSystemDestination(contract.issuerSystemId, contract.issuerStationId)?.name ?? contract.issuerStationId} for payment.`);
}

function evaluateTransportRisk(steps: Array<{ security: TransportRisk | "high" | "medium" | "low" | "frontier" }>): TransportRisk {
  return estimateRouteRisk(steps as any);
}

function completeTransportMission(world: GameWorld, mission: TransportMissionDefinition) {
  const state = getTransportState(world, mission.id);
  if (!state) return false;
  const onboard = getMissionCargoOnboard(world, mission.id);
  const station = world.dockedStationId ? getCurrentStation(world) : null;
  const atDestination = station?.id === mission.destinationStationId;
  if (onboard < mission.cargoVolume && !(state.pickedUp && atDestination)) return false;
  world.player.missionCargo = world.player.missionCargo.filter((entry) => entry.missionId !== mission.id);
  state.delivered = true;
  state.status = "completed";
  if (!state.rewardClaimed) {
    const cargoReimbursement = getTransportCargoReimbursement(mission);
    const payout = getTransportMissionPayout(world, mission);
    world.player.credits += payout;
    awardPilotLicenseProgress(world, payout / 16);
    adjustFactionStanding(world, mission.clientFaction, 0.14);
    state.rewardClaimed = true;
    pushStory(
      world,
      `Transport complete: ${mission.title} (+${payout} credits${cargoReimbursement ? `, including ${cargoReimbursement} credits cargo reimbursement` : ""}).`
    );
  }
  return true;
}

function ensureMissionUnlocks(world: GameWorld) {
  const playerPowerTier = getPlayerPowerTier(world);
  missionCatalog.forEach((mission) => {
    const missionState = world.missions[mission.id];
    if (missionState.status !== "locked") return;
    if (
      mission.requiredMissionId &&
      world.missions[mission.requiredMissionId]?.status !== "completed"
    ) {
      return;
    }
    if (mission.minPowerTier && playerPowerTier < mission.minPowerTier - 1) {
      return;
    }
    missionState.status = "available";
  });
  transportMissionCatalog.forEach((mission) => {
    const missionState = world.transportMissions[mission.id];
    if (!missionState || missionState.status !== "locked") return;
    if (mission.requiredMissionId && world.missions[mission.requiredMissionId]?.status !== "completed") {
      return;
    }
    missionState.status = "available";
  });
}

function advanceMission(world: GameWorld, missionId: string, amount = 1) {
  const mission = missionById[missionId];
  const state = world.missions[missionId];
  if (!mission || !state || state.status !== "active") return;
  state.progress += amount;
  if (mission.targetCount && state.progress >= mission.targetCount) {
    state.status = "readyToTurnIn";
    pushStory(world, `${mission.title} is ready to turn in.`);
  }
}

function completeTravelMission(world: GameWorld, missionId: string) {
  const state = world.missions[missionId];
  if (!state || state.status !== "active") return;
  state.progress = 1;
  state.status = "readyToTurnIn";
  pushStory(world, `${missionById[missionId].title} objective reached.`);
}

function claimMissionRewards(world: GameWorld, missionId: string) {
  const activeProcedural = getActiveProceduralContract(world);
  const activeProceduralState = getActiveProceduralState(world);
  if (activeProcedural?.id === missionId && activeProceduralState?.status === "readyToTurnIn") {
    const station = world.dockedStationId ? getCurrentStation(world) : null;
    if (!station || station.id !== activeProcedural.issuerStationId) return false;
    const payout = getProceduralContractPayout(world);
    if (activeProcedural.type === "mining" && activeProcedural.targetResource && activeProcedural.targetCount) {
      if (world.player.cargo[activeProcedural.targetResource] < activeProcedural.targetCount) return false;
      world.player.cargo[activeProcedural.targetResource] -= activeProcedural.targetCount;
    }
    world.player.credits += payout;
    awardPilotLicenseProgress(world, payout / 10);
    adjustFactionStanding(
      world,
      sectorById[activeProcedural.issuerSystemId]?.controllingFaction ?? getCurrentSectorDef(world).controllingFaction,
      0.12
    );
    activeProceduralState.status = "completed";
    activeProceduralState.rewardClaimed = true;
    world.procgen.activeContract = null;
    world.procgen.activeContractState = null;
    pushStory(world, `Contract complete: ${activeProcedural.title} (+${payout} credits)`);
    return true;
  }

  const mission = missionById[missionId];
  const state = world.missions[missionId];
  if (!mission || !state || state.status !== "readyToTurnIn") return false;

  if (mission.type === "deliver" && mission.targetResource && mission.targetCount) {
    if (world.player.cargo[mission.targetResource] < mission.targetCount) {
      return false;
    }
    world.player.cargo[mission.targetResource] -= mission.targetCount;
  }

  const rewardCredits = mission.rewardCredits + (mission.bossEncounter?.rewardCreditsBonus ?? 0);
  world.player.credits += rewardCredits;
  awardPilotLicenseProgress(world, rewardCredits / 8);
  adjustFactionStanding(world, mission.issuerFaction ?? getCurrentSectorDef(world).controllingFaction, 0.16);
  state.status = "completed";
  if (mission.unlockSystemId && !world.unlockedSectorIds.includes(mission.unlockSystemId)) {
    world.unlockedSectorIds.push(mission.unlockSystemId);
    pushStory(world, `Jump access granted: ${sectorById[mission.unlockSystemId].name}`);
  }
  pushStory(world, `Mission complete: ${mission.title} (+${rewardCredits} credits)`);
  ensureMissionUnlocks(world);
  return true;
}

export function acceptMission(world: GameWorld, missionId: string) {
  if (missionId.startsWith("proc:")) {
    const contract = getBoardContractById(world, missionId);
    if (!contract) return false;
    const contractStanding = world.player.factionStandings[contract.issuerFaction] ?? 0;
    if (contract.requiredStanding !== undefined && contractStanding < contract.requiredStanding) {
      pushStory(world, `${contract.title} requires ${factionData[contract.issuerFaction].name} standing ${contract.requiredStanding.toFixed(2)}.`);
      return false;
    }
    const hasActiveClassic = missionCatalog.some((entry) => world.missions[entry.id]?.status === "active");
    const hasActiveTransport = Object.values(world.transportMissions).some((entry) => entry.status === "active");
    if (hasActiveClassic || hasActiveTransport || world.procgen.activeContractState?.status === "active") {
      return false;
    }
    if (contract.type === "transport") {
      const cargoCapacity = getCachedDerivedStats(world.player).cargoCapacity;
      if ((contract.cargoVolume ?? 0) > cargoCapacity) {
        pushStory(world, `${contract.title} needs a larger cargo hold.`);
        return false;
      }
      world.player.missionCargo = world.player.missionCargo.filter((entry) => entry.missionId !== contract.id);
      world.player.missionCargo.push({
        missionId: contract.id,
        cargoType: contract.cargoType ?? "contract-cargo",
        volume: contract.cargoVolume ?? 0
      });
    }
    world.procgen.activeContract = contract;
    world.procgen.activeContractState = createContractState(world, contract);
    pushStory(world, `Contract accepted: ${contract.title}`);
    if (contract.type === "transport" && contract.targetSystemId !== world.currentSectorId) {
      const route = planRoute(world, world.currentSectorId, contract.targetSystemId, contract.routePreference ?? "safer", false);
      if (route) world.routePlan = route;
    }
    return true;
  }

  const mission = missionById[missionId];
  const state = world.missions[missionId];
  if (mission && state) {
    const missionFaction = mission.issuerFaction ?? getCurrentSectorDef(world).controllingFaction;
    const missionStanding = world.player.factionStandings[missionFaction] ?? 0;
    if (mission.requiredStanding !== undefined && missionStanding < mission.requiredStanding) {
      pushStory(world, `${mission.title} requires ${factionData[missionFaction].name} standing ${mission.requiredStanding.toFixed(2)}.`);
      return false;
    }
    const hasActiveClassic = missionCatalog.some((entry) => world.missions[entry.id]?.status === "active");
    const hasActiveTransport = Object.values(world.transportMissions).some((entry) => entry.status === "active");
    if (hasActiveClassic || hasActiveTransport) {
      return false;
    }
    if (state.status === "completed" || state.status === "active" || state.status === "locked") {
      return false;
    }
    state.status = "active";
    state.progress = 0;
    state.bossSpawned = false;
    state.bossDefeated = false;
    state.objectiveTimer = mission.objectiveDurationSec ?? 0;
    state.reinforcementTimer = mission.reinforcementIntervalSec ?? 0;
    state.challengePressure = 0;
    pushStory(world, `Mission accepted: ${mission.title}`);
    if (mission.bossEncounter && !world.dockedStationId && world.currentSectorId === mission.targetSystemId) {
      spawnMissionBossEncounter(world, mission);
    }
    return true;
  }

  const transport = transportMissionById[missionId];
  const transportState = world.transportMissions[missionId];
  if (!transport || !transportState) return false;
  const transportStanding = world.player.factionStandings[transport.clientFaction] ?? 0;
  if (transport.requiredStanding !== undefined && transportStanding < transport.requiredStanding) {
    pushStory(world, `${transport.title} requires ${factionData[transport.clientFaction].name} standing ${transport.requiredStanding.toFixed(2)}.`);
    return false;
  }
  if (
    transportState.status === "completed" ||
    transportState.status === "active" ||
    transportState.status === "locked"
  ) {
    return false;
  }
  const cargoCapacity = getCachedDerivedStats(world.player).cargoCapacity;
  if (transport.cargoVolume > cargoCapacity) {
    pushStory(world, `${transport.title} needs a larger cargo hold.`);
    return false;
  }

  const activeTransport = Object.values(world.transportMissions).find(
    (entry) => entry.status === "active" && entry.missionId !== missionId
  );
  if (activeTransport) {
    activeTransport.status = "available";
    activeTransport.pickedUp = false;
    activeTransport.delivered = false;
    activeTransport.acceptedAt = null;
    activeTransport.dueAt = null;
    const activeMission = transportMissionById[activeTransport.missionId];
    activeTransport.rewardEstimate = activeMission ? getTransportMissionPayout(world, activeMission) : activeTransport.rewardEstimate;
    world.player.missionCargo = world.player.missionCargo.filter((entry) => entry.missionId !== activeTransport.missionId);
  }

  transportState.status = "active";
  transportState.acceptedAt = world.elapsedTime;
  transportState.dueAt =
    transport.bonusReward && transport.bonusTimeLimitSec
      ? world.elapsedTime + transport.bonusTimeLimitSec
      : null;
  transportState.delivered = false;
  transportState.pickedUp = true;
  transportState.rewardClaimed = false;
  transportState.rewardEstimate = getTransportMissionPayout(world, transport);

  world.player.missionCargo = world.player.missionCargo.filter((entry) => entry.missionId !== transport.id);
  world.player.missionCargo.push({
    missionId: transport.id,
    cargoType: transport.cargoType,
    volume: transport.cargoVolume
  });
  pushStory(world, `Mission accepted: ${transport.cargoVolume}u ${transport.cargoType} loaded for delivery to ${getSystemDestination(transport.destinationSystemId, transport.destinationStationId)?.name ?? transport.destinationStationId}.`);

  if (world.dockedStationId === transport.destinationStationId) {
    completeTransportMission(world, transport);
  }

  updateTransportRoute(world);
  return true;
}

export function turnInMission(world: GameWorld, missionId: string) {
  return claimMissionRewards(world, missionId);
}

function setIdle(nav: NavigationState) {
  nav.mode = "idle";
  nav.target = null;
  nav.destination = null;
  nav.desiredRange = 0;
  nav.warpFrom = null;
  nav.warpProgress = 0;
  nav.postWarpDock = false;
}

function shortestAngleDiff(from: number, to: number) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function desiredVelocityControl(
  currentVelocity: Vec2,
  desiredVelocity: Vec2,
  acceleration: number,
  dt: number
) {
  const delta = subtract(desiredVelocity, currentVelocity);
  return add(currentVelocity, clampMagnitude(delta, acceleration * dt));
}

function applyTerrainNavigationInfluence(
  world: GameWorld,
  position: Vec2,
  desiredVelocity: Vec2,
  maxSpeed: number,
  bodyRadius: number,
  dt: number,
  terrainBias = 1
) {
  const sector = getCurrentSector(world);
  let nextVelocity = desiredVelocity;
  let speedScale = 1;

  sector.asteroids.forEach((asteroid) => {
    const offset = subtract(position, asteroid.position);
    const dist = length(offset);
    const clearance = bodyRadius + asteroid.radius + TERRAIN.asteroidRepelPadding;
    if (dist <= 4 || dist >= clearance) return;
    const falloff = 1 - dist / clearance;
    const push = scale(
      normalize(offset),
      falloff * (TERRAIN.asteroidPushStrength + asteroid.radius * TERRAIN.asteroidRadiusScale) * dt * terrainBias
    );
    nextVelocity = add(nextVelocity, push);
  });

  getSystemDestinations(world.currentSectorId)
    .filter((entry): entry is SystemDestination & { anomalyField: NonNullable<SystemDestination["anomalyField"]> } =>
      entry.kind === "anomaly" && Boolean(entry.anomalyField)
    )
    .forEach((entry) => {
      const field = entry.anomalyField;
      const offset = subtract(position, entry.position);
      const dist = length(offset);
      if (dist <= 4 || dist > field.radius) return;
      const falloff = 1 - dist / field.radius;
      const dir = normalize(offset);
      if (field.effect === "pull") {
        nextVelocity = add(nextVelocity, scale(dir, -falloff * field.strength * TERRAIN.anomalyPullScale * dt * terrainBias));
        nextVelocity = add(nextVelocity, scale({ x: -dir.y, y: dir.x }, falloff * field.strength * TERRAIN.anomalySpinScale * dt));
      } else if (field.effect === "push") {
        nextVelocity = add(nextVelocity, scale(dir, falloff * field.strength * TERRAIN.anomalyPushScale * dt * terrainBias));
      } else if (field.effect === "drag") {
        speedScale *= 1 - Math.min(0.42, falloff * TERRAIN.dragSlowScale * terrainBias);
      } else if (field.effect === "ion") {
        speedScale *= 1 - Math.min(0.22, falloff * TERRAIN.ionSlowScale * terrainBias);
      } else if (field.effect === "slipstream") {
        nextVelocity = add(nextVelocity, scale(normalize(nextVelocity), falloff * field.strength * TERRAIN.slipstreamScale * dt));
      }
    });

  return clampMagnitude(nextVelocity, maxSpeed * speedScale);
}

function resolveAsteroidCollisions(world: GameWorld, position: Vec2, velocity: Vec2, bodyRadius: number) {
  const sector = getCurrentSector(world);
  let nextPosition = { ...position };
  let nextVelocity = { ...velocity };

  sector.asteroids.forEach((asteroid) => {
    const offset = subtract(nextPosition, asteroid.position);
    const dist = length(offset);
    const minDist = bodyRadius + asteroid.radius + TERRAIN.collisionPadding;
    if (dist <= 0 || dist >= minDist) return;
    const normal = normalize(offset);
    const overlap = minDist - dist;
    nextPosition = add(nextPosition, scale(normal, overlap + 0.5));
    const radial = nextVelocity.x * normal.x + nextVelocity.y * normal.y;
    if (radial < 0) {
      nextVelocity = subtract(nextVelocity, scale(normal, radial * 1.1));
    }
    nextVelocity = scale(nextVelocity, TERRAIN.collisionDamping - Math.min(0.12, overlap * TERRAIN.collisionOverlapScale));
  });

  return { position: nextPosition, velocity: nextVelocity };
}

function objectInRange(world: GameWorld, ref: SelectableRef, range: number) {
  const position = getObjectPosition(world, ref);
  return position ? distance(world.player.position, position) <= range : false;
}

function canDock(world: GameWorld) {
  const station = getCurrentStation(world);
  if (!station) return false;
  const stationRef: SelectableRef = { id: station.id, type: "station" };
  return objectInRange(world, stationRef, getCachedDerivedStats(world.player).interactionRange);
}

export function dock(world: GameWorld) {
  const station = getCurrentStation(world);
  if (!station) return false;
  if (!canDock(world)) return false;
  const derived = getCachedDerivedStats(world.player);
  world.dockedStationId = station.id;
  enterDestinationSite(world, station.id);
  world.player.velocity = { x: 0, y: 0 };
  world.player.shield = derived.maxShield;
  world.player.capacitor = derived.capacitorCapacity;
  setIdle(world.player.navigation);
  world.player.pendingLocks = [];
  pushStory(world, `Docked at ${station.name}.`);
  normalizeTransportMissionStates(world);
  normalizeDeliveryMissionStates(world);
  resolveTransportMissionDeliveries(world);

  missionCatalog.forEach((mission) => {
    const state = world.missions[mission.id];
    if (
      mission.type === "deliver" &&
      mission.targetStationId === station.id &&
      state?.status === "active" &&
      mission.targetResource &&
      mission.targetCount &&
      world.player.cargo[mission.targetResource] >= mission.targetCount
    ) {
      state.status = "readyToTurnIn";
    }
  });

  transportMissionCatalog.forEach((mission) => {
    const state = world.transportMissions[mission.id];
    if (!state || state.status !== "active") return;

    if (!state.pickedUp && station.id === mission.pickupStationId) {
      const derived = getCachedDerivedStats(world.player);
      if (getCargoUsed(world.player) + mission.cargoVolume <= derived.cargoCapacity) {
        world.player.missionCargo.push({
          missionId: mission.id,
          cargoType: mission.cargoType,
          volume: mission.cargoVolume
        });
        state.pickedUp = true;
        pushStory(world, `Pickup complete: ${mission.cargoVolume}u ${mission.cargoType} loaded.`);
      } else {
        pushStory(world, `Pickup blocked: not enough cargo room for ${mission.cargoVolume}u.`);
      }
    }

    if (state.pickedUp && station.id === mission.destinationStationId) {
      const completed = completeTransportMission(world, mission);
      if (!completed) {
        pushStory(world, `Delivery failed: mission cargo missing for ${mission.title}.`);
      }
    }
  });

  updateTransportRoute(world);

  return true;
}

export function undock(world: GameWorld) {
  const station = getCurrentStation(world);
  if (!station) return;
  world.dockedStationId = null;
  enterDestinationSite(world, station.id);
  world.player.position = { x: station.position.x + 120, y: station.position.y + 24 };
  world.player.rotation = 0;
  world.player.velocity = { x: 0, y: 0 };
  setIdle(world.player.navigation);
  world.player.pendingLocks = [];
  pushStory(world, `Undocked from ${station.name}.`);
  const queued = [...world.player.queuedUndockActions];
  world.player.queuedUndockActions = [];
  queued.forEach((action) => {
    tryExecuteCommand(world, action, true);
  });
}

export function repairShip(world: GameWorld) {
  const derived = getCachedDerivedStats(world.player);
  const cost = Math.ceil(
    (derived.maxHull - world.player.hull) * 2 +
      (derived.maxArmor - world.player.armor) * 1.7 +
      (derived.maxShield - world.player.shield) * 1.5
  );
  if (cost <= 0 || world.player.credits < cost) return false;
  world.player.credits -= cost;
  world.player.hull = derived.maxHull;
  world.player.armor = derived.maxArmor;
  world.player.shield = derived.maxShield;
  world.player.capacitor = derived.capacitorCapacity;
  pushStory(world, `Hull crews patched the ship for ${cost} credits.`);
  return true;
}

export function sellCargo(world: GameWorld) {
  const economy = getLocalEconomySnapshot(world);
  let soldValue = 0;
  (Object.keys(world.player.cargo) as ResourceId[]).forEach((resource) => {
    soldValue += world.player.cargo[resource] * economy.resourceSellPrices[resource];
    world.player.cargo[resource] = 0;
  });
  (Object.keys(world.player.commodities) as CommodityId[]).forEach((commodityId) => {
    const amount = world.player.commodities[commodityId] ?? 0;
    if (amount <= 0) return;
    const unitPrice = economy.commoditySellPrices[commodityId] ?? commodityById[commodityId]?.basePrice ?? 0;
    soldValue += amount * unitPrice;
    world.player.commodities[commodityId] = 0;
  });
  world.player.credits += soldValue;
  if (soldValue > 0) {
    awardPilotLicenseProgress(world, soldValue / 120);
    pushStory(world, `Cargo sold for ${soldValue} credits.`);
  }
  return soldValue;
}

export function buyCommodity(world: GameWorld, commodityId: CommodityId, quantity: number) {
  if (!world.dockedStationId || quantity <= 0) return false;
  const commodity = commodityById[commodityId];
  if (!commodity) return false;
  const station = getCurrentStation(world);
  if (!isCommodityStockedAtStation(commodity, getCurrentSectorDef(world).security, station)) {
    pushStory(world, `${commodity.name} is not stocked here.`);
    return false;
  }
  const economy = getLocalEconomySnapshot(world);
  const unitPrice = economy.commodityBuyPrices[commodityId] ?? commodity.basePrice;
  const totalCost = unitPrice * quantity;
  if (world.player.credits < totalCost) {
    pushStory(world, `Not enough credits for ${quantity}x ${commodity.name}.`);
    return false;
  }

  const freeCargo = getCachedDerivedStats(world.player).cargoCapacity - getCargoUsed(world.player);
  const requiredVolume = commodity.volume * quantity;
  if (requiredVolume > freeCargo) {
    const missionCargoUsed = world.player.missionCargo.reduce((total, entry) => total + entry.volume, 0);
    pushStory(
      world,
      `Not enough cargo space for ${quantity}x ${commodity.name}. Need ${requiredVolume}u, free ${Math.max(0, freeCargo)}u${
        missionCargoUsed > 0 ? ` (${missionCargoUsed}u locked by mission cargo)` : ""
      }.`
    );
    return false;
  }

  world.player.credits -= totalCost;
  world.player.commodities[commodityId] = (world.player.commodities[commodityId] ?? 0) + quantity;
  pushStory(world, `Purchased ${quantity}x ${commodity.name} for ${totalCost} credits.`);
  return true;
}

export function sellCommodity(world: GameWorld, commodityId: CommodityId, quantity: number) {
  if (!world.dockedStationId || quantity <= 0) return false;
  const commodity = commodityById[commodityId];
  if (!commodity) return false;
  const station = getCurrentStation(world);
  if (!isCommodityStockedAtStation(commodity, getCurrentSectorDef(world).security, station)) {
    pushStory(world, `${commodity.name} is not traded here.`);
    return false;
  }
  const owned = world.player.commodities[commodityId] ?? 0;
  if (owned < quantity) {
    pushStory(world, `Not enough ${commodity.name} to sell.`);
    return false;
  }
  const economy = getLocalEconomySnapshot(world);
  const unitPrice = economy.commoditySellPrices[commodityId] ?? commodity.basePrice;
  const totalValue = unitPrice * quantity;
  world.player.commodities[commodityId] = owned - quantity;
  world.player.credits += totalValue;
  awardPilotLicenseProgress(world, totalValue / 110);
  pushStory(world, `Sold ${quantity}x ${commodity.name} for ${totalValue} credits.`);
  return true;
}

export function buyModule(world: GameWorld, moduleId: string, priceOverride?: number) {
  if (!world.dockedStationId) return false;
  const module = moduleById[moduleId];
  if (!module) return false;
  ensurePilotLicense(world);
  const station = getCurrentStation(world);
  if (!isModuleAvailableAtStation(module, getCurrentSectorDef(world).security, station)) {
    pushStory(world, `${module.name} is not stocked here.`);
    return false;
  }
  if (!hasPilotLicenseForModule(world.player.pilotLicense, module)) {
    pushStory(world, `${module.name} requires pilot license L${getRequiredPilotLicenseLevel(module)}.`);
    return false;
  }
  const price = priceOverride ?? getLocalEconomySnapshot(world).moduleBuyPrices[moduleId] ?? module.price;
  if (world.player.credits < price) {
    pushStory(world, `Not enough credits for ${module.name}.`);
    return false;
  }
  world.player.credits -= price;
  setInventoryModuleCount(world, moduleId, (world.player.inventory.modules[moduleId] ?? 0) + 1);
  pushStory(world, `Purchased ${module.name} (${price}cr).`);
  return true;
}

export function sellModule(world: GameWorld, moduleId: string, priceOverride?: number) {
  const module = moduleById[moduleId];
  if (!module) return false;
  const owned = world.player.inventory.modules[moduleId] ?? 0;
  if (owned <= 0) return false;
  const saleValue = priceOverride ?? getLocalEconomySnapshot(world).moduleSellPrices[moduleId] ?? Math.max(1, Math.floor(module.price * 0.55));
  setInventoryModuleCount(world, moduleId, owned - 1);
  world.player.credits += saleValue;
  pushStory(world, `Sold ${module.name} for ${saleValue} credits.`);
  return true;
}

export function buyShip(world: GameWorld, shipId: string, priceOverride?: number) {
  const ship = playerShipById[shipId];
  if (!ship) return false;
  const price = priceOverride ?? getLocalEconomySnapshot(world).shipBuyPrices[shipId] ?? ship.price;
  if (world.player.ownedShips.includes(shipId)) {
    pushStory(world, `${ship.name} is already owned.`);
    return false;
  }
  if (world.player.credits < price) {
    pushStory(world, `Not enough credits for ${ship.name}.`);
    return false;
  }
  world.player.credits -= price;
  world.player.ownedShips.push(shipId);
  ensureMissionUnlocks(world);
  pushStory(world, `Ship acquired: ${ship.name} (${price}cr).`);
  return true;
}

export function sellShip(world: GameWorld, shipId: string, priceOverride?: number) {
  const ship = playerShipById[shipId];
  if (!ship) return false;
  if (!world.player.ownedShips.includes(shipId)) {
    pushStory(world, `${ship.name} is not owned.`);
    return false;
  }
  if (world.player.ownedShips.length <= 1) {
    pushStory(world, `You must keep at least one ship.`);
    return false;
  }

  const saleValue = priceOverride ?? getLocalEconomySnapshot(world).shipSellPrices[shipId] ?? Math.max(1, Math.floor(ship.price * 0.56));
  const fallbackShipId = world.player.ownedShips.find((ownedShipId) => ownedShipId !== shipId) ?? null;

  if (world.player.hullId === shipId) {
    if (!fallbackShipId) {
      pushStory(world, `You need another owned ship before selling ${ship.name}.`);
      return false;
    }
    switchShip(world, fallbackShipId);
  }

  world.player.ownedShips = world.player.ownedShips.filter((ownedShipId) => ownedShipId !== shipId);

  world.player.savedBuilds = world.player.savedBuilds.map((build) =>
    build.shipId === shipId
      ? {
          ...build,
          shipId: fallbackShipId ?? build.shipId
        }
      : build
  );

  world.player.credits += saleValue;
  ensureMissionUnlocks(world);
  pushStory(world, `Sold ${ship.name} for ${saleValue} credits.`);
  return true;
}

export function switchShip(world: GameWorld, shipId: string) {
  if (!world.player.ownedShips.includes(shipId)) return false;
  world.player.hullId = shipId;
  const hull = playerShipById[shipId];
  applyBuildLoadout(world, {
    weapon: Array.from({ length: hull.slots.weapon }, (_, index) => world.player.equipped.weapon[index] ?? null),
    utility: Array.from({ length: hull.slots.utility }, (_, index) => world.player.equipped.utility[index] ?? null),
    defense: Array.from({ length: hull.slots.defense }, (_, index) => world.player.equipped.defense[index] ?? null)
  });
  ensureMissionUnlocks(world);
  pushStory(world, `Active ship switched to ${hull.name}.`);
  return true;
}

export function saveBuildSlot(world: GameWorld, buildId: BuildSlotId) {
  if (!world.dockedStationId) {
    pushStory(world, "Builds can only be saved while docked.");
    return false;
  }
  const build = getSavedBuild(world, buildId);
  if (!build) return false;
  build.shipId = world.player.hullId;
  build.equipped = cloneLoadout(world.player.equipped);
  build.savedAt = Date.now();
  pushStory(world, `Saved current fit to ${build.name}.`);
  return true;
}

export function loadBuildSlot(world: GameWorld, buildId: BuildSlotId) {
  if (!world.dockedStationId) {
    pushStory(world, "Builds can only be loaded while docked.");
    return false;
  }
  const build = getSavedBuild(world, buildId);
  if (!build) return false;
  if (!world.player.ownedShips.includes(build.shipId)) {
    pushStory(world, `${build.name} requires a ship you do not own.`);
    return false;
  }
  if (world.player.hullId !== build.shipId) {
    switchShip(world, build.shipId);
  }
  applyBuildLoadout(world, cloneLoadout(build.equipped));
  ensureMissionUnlocks(world);
  pushStory(world, `Loaded build ${build.name}.`);
  return true;
}

export function startBuildSwap(world: GameWorld, buildId: BuildSlotId) {
  const build = getSavedBuild(world, buildId);
  if (!build) return false;
  if (world.dockedStationId) {
    pushStory(world, "Undock before starting a live reconfiguration.");
    return false;
  }
  if (build.shipId !== world.player.hullId) {
    pushStory(world, `${build.name} is saved for another hull.`);
    return false;
  }
  const changedModuleCount = countChangedModules(world.player.equipped, build.equipped);
  if (changedModuleCount === 0) {
    pushStory(world, `${build.name} already matches the current fit.`);
    return false;
  }
  if (world.player.buildSwap.active) {
    pushStory(world, "Reconfiguration already in progress.");
    return false;
  }
  const duration = 1 + changedModuleCount * 0.95;
  world.player.buildSwap = {
    active: true,
    targetBuildId: build.id,
    targetBuildName: build.name,
    targetShipId: build.shipId,
    targetEquipped: cloneLoadout(build.equipped),
    duration,
    remaining: duration,
    changedModuleCount
  };
  (["weapon", "utility", "defense"] as ModuleSlot[]).forEach((slotType) => {
    world.player.modules[slotType].forEach((runtime) => {
      runtime.active = false;
      runtime.cycleRemaining = 0;
    });
  });
  pushStory(world, `Swapping to ${build.name}. ${changedModuleCount} modules changing.`);
  return true;
}

export function equipModuleToSlot(
  world: GameWorld,
  slotType: ModuleSlot,
  slotIndex: number,
  moduleId: string | null
) {
  ensurePilotLicense(world);
  const slots = world.player.equipped[slotType];
  const currentId = slots[slotIndex];
  if (moduleId) {
    const module = moduleById[moduleId];
    if (!module) {
      return false;
    }
    if (!hasPilotLicenseForModule(world.player.pilotLicense, module)) {
      pushStory(world, `${module.name} requires pilot license L${getRequiredPilotLicenseLevel(module)}.`);
      return false;
    }
    const count = world.player.inventory.modules[moduleId] ?? 0;
    if (count <= 0) {
      return false;
    }
  }
  if (currentId) {
    setInventoryModuleCount(world, currentId, (world.player.inventory.modules[currentId] ?? 0) + 1);
  }
  if (moduleId) {
    const count = world.player.inventory.modules[moduleId] ?? 0;
    setInventoryModuleCount(world, moduleId, count - 1);
  }
  slots[slotIndex] = moduleId;
  rebuildPlayerRuntime(world.player);
  const derived = getCachedDerivedStats(world.player);
  world.player.hull = Math.min(world.player.hull, derived.maxHull);
  world.player.armor = Math.min(world.player.armor, derived.maxArmor);
  world.player.shield = Math.min(world.player.shield, derived.maxShield);
  world.player.capacitor = Math.min(world.player.capacitor, derived.capacitorCapacity);
  ensureMissionUnlocks(world);
  return true;
}

function queueUndockAction(world: GameWorld, command: CommandAction) {
  world.player.queuedUndockActions = [...world.player.queuedUndockActions, command].slice(-4);
  pushStory(world, `Queued on undock: ${command.type.replace("_", " ")}`);
}

function updatePendingLocks(world: GameWorld, dt: number) {
  if (world.player.pendingLocks.length > 0) {
    world.player.pendingLocks = [];
  }
}

export function selectObject(world: GameWorld, ref: SelectableRef | null) {
  world.selectedObject = ref;
}

export function lockTarget(world: GameWorld, ref: SelectableRef) {
  const info = getObjectInfo(world, ref);
  if (!info) return false;
  if (!world.lockedTargets.find((entry) => entry.id === ref.id && entry.type === ref.type)) {
    world.lockedTargets.push(ref);
  }
  world.activeTarget = ref;
  return true;
}

export function unlockTarget(world: GameWorld, ref: SelectableRef) {
  world.player.pendingLocks = world.player.pendingLocks.filter(
    (entry) => !(entry.ref.id === ref.id && entry.ref.type === ref.type)
  );
  world.lockedTargets = world.lockedTargets.filter(
    (entry) => !(entry.id === ref.id && entry.type === ref.type)
  );
  if (world.activeTarget?.id === ref.id && world.activeTarget.type === ref.type) {
    world.activeTarget = world.lockedTargets[0] ?? null;
  }
}

export function setActiveTarget(world: GameWorld, ref: SelectableRef | null) {
  if (!ref) {
    world.activeTarget = null;
    return;
  }
  const info = getObjectInfo(world, ref);
  if (!info) return;
  world.activeTarget = ref;
}

export function activateTacticalSlow(world: GameWorld) {
  const tacticalSlow = getTacticalSlowState(world);
  if (world.dockedStationId) {
    pushStory(world, "Tactical slow cannot be activated while docked.");
    return false;
  }
  if (world.player.buildSwap.active) {
    pushStory(world, "Tactical slow cannot be activated during reconfiguration.");
    return false;
  }
  if (tacticalSlow.activeRemaining > 0 || tacticalSlow.cooldownRemaining > 0) {
    pushStory(
      world,
      tacticalSlow.activeRemaining > 0
        ? "Tactical slow is already active."
        : `Tactical slow recharging (${Math.ceil(tacticalSlow.cooldownRemaining)}s).`
    );
    return false;
  }
  tacticalSlow.activeRemaining = CAPACITOR_BALANCE.tacticalSlow.durationSec;
  tacticalSlow.cooldownRemaining = CAPACITOR_BALANCE.tacticalSlow.cooldownSec;
  tacticalSlow.capPenaltyRemaining = CAPACITOR_BALANCE.tacticalSlow.capPenaltySec;
  tacticalSlow.speedPenaltyRemaining = CAPACITOR_BALANCE.tacticalSlow.speedPenaltySec;
  pushStory(world, "Tactical slow engaged.");
  return true;
}

export function clearDeathSummary(world: GameWorld) {
  world.player.deathSummary = null;
}

function issueNav(world: GameWorld, mode: NavigationState["mode"], target: SelectableRef | null, desiredRange = 0) {
  world.player.navigation.mode = mode;
  world.player.navigation.target = target;
  world.player.navigation.desiredRange = desiredRange;
  world.player.navigation.destination = target ? getObjectPosition(world, target) : null;
  world.player.navigation.warpFrom = null;
  world.player.navigation.warpProgress = 0;
  world.player.navigation.postWarpDock = false;
}

function issuePointNav(world: GameWorld, destination: Vec2) {
  world.player.navigation.mode = "approach";
  world.player.navigation.target = null;
  world.player.navigation.desiredRange = 0;
  world.player.navigation.destination = { ...destination };
  world.player.navigation.warpFrom = null;
  world.player.navigation.warpProgress = 0;
  world.player.navigation.postWarpDock = false;
}

function getDestinationIfSameSystem(world: GameWorld, ref: SelectableRef | null) {
  if (!ref) return null;
  if (
    ref.type !== "station" &&
    ref.type !== "gate" &&
    ref.type !== "belt" &&
    ref.type !== "anomaly" &&
    ref.type !== "outpost" &&
    ref.type !== "wreck" &&
    ref.type !== "beacon"
  ) {
    return null;
  }
  return getSystemDestination(world.currentSectorId, ref.id);
}

function isRemoteWarpableDestination(world: GameWorld, ref: SelectableRef | null) {
  const destination = getDestinationIfSameSystem(world, ref);
  if (!destination || !destination.warpable) return false;
  return !isDestinationLocal(world, destination.id);
}

function activateAllWeapons(world: GameWorld) {
  if (world.player.weaponHoldFire) return;
  world.player.modules.weapon.forEach((runtime) => {
    if (!runtime.moduleId) return;
    runtime.active = true;
  });
}

export function setWeaponHoldFire(world: GameWorld, holdFire: boolean) {
  world.player.weaponHoldFire = holdFire;
  if (holdFire) {
    world.player.modules.weapon.forEach((runtime) => {
      runtime.active = false;
      runtime.cycleRemaining = 0;
    });
    pushStory(world, "Weapons set to hold fire.");
    return;
  }
  pushStory(world, "Weapons released to auto-engage.");
}

function disableAutopilot(world: GameWorld) {
  if (!world.routePlan?.autoFollow) return;
  world.routePlan.autoFollow = false;
}

function getAutopilotObjective(world: GameWorld) {
  const transport = buildTransportTracker(world);
  if (transport) {
    return {
      systemId: transport.objectiveSystemId,
      destinationId: transport.objectiveStationId,
      label: transport.objectiveText
    };
  }
  const mission = getActiveMission(world);
  if (mission?.targetSystemId) {
    return {
      systemId: mission.targetSystemId,
      destinationId: mission.targetDestinationId,
      label: mission.title
    };
  }
  return null;
}

function setAutopilotEnabled(world: GameWorld, enabled: boolean) {
  if (!enabled) {
    if (world.routePlan?.autoFollow) {
      world.routePlan.autoFollow = false;
      pushStory(world, "Autopilot disengaged.");
    }
    return false;
  }

  const objective = getAutopilotObjective(world);
  if (!world.routePlan && objective) {
    setRouteDestination(world, objective.systemId, "safer", true, objective.destinationId);
    pushStory(world, `Autopilot engaged to ${objective.label}.`);
    return true;
  }

  if (world.routePlan) {
    world.routePlan.autoFollow = true;
    pushStory(world, `Autopilot engaged to ${sectorById[world.routePlan.destinationSystemId].name}.`);
    return true;
  }

  pushStory(world, "Set a route or activate a mission before engaging autopilot.");
  return false;
}

function getMaxEngagementRange(world: GameWorld) {
  const derived = getCachedDerivedStats(world.player);
  const weaponRanges = world.player.equipped.weapon
    .filter((moduleId): moduleId is string => Boolean(moduleId))
    .map((moduleId) => {
      const module = getTurretAdjustedModule(moduleById[moduleId], derived);
      return module.range ?? module.optimal ?? 0;
    })
    .filter((value) => value > 0);

  if (weaponRanges.length === 0) {
    return 0;
  }

  return Math.min(derived.lockRange, Math.max(...weaponRanges));
}

function autoEngageNearbyHostile(world: GameWorld) {
  if (world.dockedStationId || world.player.buildSwap.active) return;
  const sector = getCurrentSector(world);
  const engagementRange = getMaxEngagementRange(world);
  if (engagementRange <= 0) return;

  const currentActive =
    world.activeTarget?.type === "enemy"
      ? sector.enemies.find((enemy) => enemy.id === world.activeTarget?.id)
      : null;
  if (currentActive && distance(world.player.position, currentActive.position) <= engagementRange) {
    activateAllWeapons(world);
    return;
  }

  const nearestEnemy = [...sector.enemies]
    .filter((enemy) => distance(world.player.position, enemy.position) <= engagementRange)
    .sort(
      (left, right) =>
        distance(world.player.position, left.position) - distance(world.player.position, right.position)
    )[0];

  if (!nearestEnemy) return;
  const targetRef: SelectableRef = { id: nearestEnemy.id, type: "enemy" };
  lockTarget(world, targetRef);
  setActiveTarget(world, targetRef);
  activateAllWeapons(world);
}

function maintainEnemyLockIntent(world: GameWorld) {
  if (world.dockedStationId || world.player.buildSwap.active) return;
  const candidate = world.selectedObject?.type === "enemy"
    ? world.selectedObject
    : world.activeTarget?.type === "enemy"
      ? world.activeTarget
      : null;
  if (!candidate) return;

  const alreadyLocked = world.lockedTargets.some((entry) => entry.id === candidate.id && entry.type === candidate.type);
  if (alreadyLocked) return;

  lockTarget(world, candidate);
}

function tryExecuteCommand(world: GameWorld, command: CommandAction, skipDockedCheck = false): boolean {
  if (world.dockedStationId && !skipDockedCheck && command.type !== "show_info") {
    if ("target" in command) {
      world.selectedObject = command.target;
    }
    queueUndockAction(world, command);
    return false;
  }

  if (command.type === "stop") {
    disableAutopilot(world);
    setIdle(world.player.navigation);
    world.player.velocity = scale(world.player.velocity, 0.35);
    return true;
  }
  if (command.type === "lock") {
    lockTarget(world, command.target);
    world.selectedObject = command.target;
    return true;
  }
  if (command.type === "attack") {
    world.selectedObject = command.target;
    lockTarget(world, command.target);
    setActiveTarget(world, command.target);
    world.player.weaponHoldFire = false;
    activateAllWeapons(world);
    return true;
  }
  if (command.type === "show_info") {
    world.selectedObject = command.target;
    return true;
  }
  if (command.type === "mine") {
    disableAutopilot(world);
    world.selectedObject = command.target;
    lockTarget(world, command.target);
    setActiveTarget(world, command.target);
    const miningIndex = world.player.modules.utility.findIndex((runtime) => {
      if (!runtime.moduleId) return false;
      return moduleById[runtime.moduleId]?.kind === "mining_laser";
    });
    if (miningIndex >= 0) {
      world.player.modules.utility[miningIndex].active = true;
    }
    issueNav(world, "orbit", command.target, 120);
    return true;
  }
  if (command.type === "salvage") {
    disableAutopilot(world);
    world.selectedObject = command.target;
    lockTarget(world, command.target);
    setActiveTarget(world, command.target);
    const salvagerIndex = world.player.modules.utility.findIndex((runtime) => {
      if (!runtime.moduleId) return false;
      return moduleById[runtime.moduleId]?.kind === "salvager";
    });
    if (salvagerIndex >= 0) {
      world.player.modules.utility[salvagerIndex].active = true;
    }
    issueNav(world, "approach", command.target, 70);
    return true;
  }
  if (command.type === "approach") {
    if (isRemoteWarpableDestination(world, command.target)) {
      return tryExecuteCommand(world, { type: "warp", target: command.target, range: Math.max(80, command.range ?? 120) }, skipDockedCheck);
    }
    disableAutopilot(world);
    issueNav(world, "approach", command.target, command.range ?? 0);
    return true;
  }
  if (command.type === "travel") {
    disableAutopilot(world);
    issuePointNav(world, command.destination);
    world.selectedObject = null;
    return true;
  }
  if (command.type === "keep_range") {
    if (isRemoteWarpableDestination(world, command.target)) {
      return tryExecuteCommand(world, { type: "warp", target: command.target, range: Math.max(80, command.range) }, skipDockedCheck);
    }
    disableAutopilot(world);
    issueNav(world, "keep_range", command.target, command.range);
    return true;
  }
  if (command.type === "orbit") {
    if (isRemoteWarpableDestination(world, command.target)) {
      return tryExecuteCommand(world, { type: "warp", target: command.target, range: Math.max(80, command.range) }, skipDockedCheck);
    }
    disableAutopilot(world);
    issueNav(world, "orbit", command.target, command.range);
    return true;
  }
  if (command.type === "align") {
    disableAutopilot(world);
    issueNav(world, "align", command.target, -1);
    return true;
  }
  if (command.type === "warp") {
    const warpDisruptor = getHostileWarpDisruptor(world);
    if (warpDisruptor) {
      const hostile = enemyVariantById[warpDisruptor.variantId];
      pushStory(world, `Warp drive pinned by ${hostile?.name ?? "hostile disruptor"}. Break tackle first.`);
      return false;
    }
    disableAutopilot(world);
    if (isRemoteWarpableDestination(world, command.target)) {
      world.localSite = createTransitLocalSite(world.currentSectorId, world.player.position);
    }
    issueNav(world, "align", command.target, command.range ?? 120);
    world.player.navigation.mode = "align";
    world.player.navigation.desiredRange = command.range ?? 120;
    return true;
  }
  if (command.type === "dock") {
    if (isRemoteWarpableDestination(world, command.target)) {
      const destination = getDestinationIfSameSystem(world, command.target);
      const warped = tryExecuteCommand(world, { type: "warp", target: command.target, range: 130 }, skipDockedCheck);
      if (warped && destination?.kind === "station") {
        world.player.navigation.postWarpDock = true;
      }
      return warped;
    }
    disableAutopilot(world);
    issueNav(world, "docking", command.target, 0);
    return true;
  }
  if (command.type === "jump") {
    if (isRemoteWarpableDestination(world, command.target)) {
      return tryExecuteCommand(world, { type: "warp", target: command.target, range: 120 }, skipDockedCheck);
    }
    disableAutopilot(world);
    issueNav(world, "jumping", command.target, 0);
    return true;
  }
  return false;
}

export function issueCommand(world: GameWorld, command: CommandAction) {
  tryExecuteCommand(world, command);
}

export function clearQueuedUndockActions(world: GameWorld) {
  world.player.queuedUndockActions = [];
}

export function setDifficulty(world: GameWorld, difficulty: GameWorld["difficulty"]) {
  world.difficulty = difficulty;
}

export function setRouteDestination(
  world: GameWorld,
  destinationSystemId: string,
  preference: "shortest" | "safer",
  autoFollow = false,
  destinationDestinationId?: string
) {
  world.routePlan = planRoute(world, world.currentSectorId, destinationSystemId, preference, autoFollow);
  if (world.routePlan) {
    world.routePlan.destinationDestinationId = destinationDestinationId;
    pushStory(
      world,
      `Route set to ${sectorById[destinationSystemId].name} via ${world.routePlan.steps.length} jump${world.routePlan.steps.length === 1 ? "" : "s"}.`
    );
  }
  return world.routePlan;
}

export function clearRouteDestination(world: GameWorld) {
  world.routePlan = null;
}

export function setRouteAutoFollow(world: GameWorld, autoFollow: boolean) {
  setAutopilotEnabled(world, autoFollow);
}

export function toggleModule(
  world: GameWorld,
  slotType: ModuleSlot,
  slotIndex: number
) {
  if (world.player.buildSwap.active) return false;
  const runtime = world.player.modules[slotType][slotIndex];
  const moduleId = runtime?.moduleId;
  if (!runtime || !moduleId) return false;
  const module = moduleById[moduleId];
  if (!module || module.activation === "passive") return false;
  if (slotType === "weapon" && !runtime.active) {
    world.player.weaponHoldFire = false;
  }
  runtime.active = !runtime.active;
  if (!runtime.active) {
    runtime.cycleRemaining = 0;
  }
  return true;
}

function getRangePenalty(distanceToTarget: number, optimal = 200, falloff = 120) {
  const resolvedOptimal = optimal ?? COMBAT_BALANCE.turret.defaultOptimalRange;
  const resolvedFalloff = falloff ?? COMBAT_BALANCE.turret.defaultFalloff;
  if (distanceToTarget <= resolvedOptimal) return 1;
  const over = Math.max(0, distanceToTarget - resolvedOptimal);
  return 1 / (1 + (over / Math.max(resolvedFalloff, 1)) ** 2);
}

function hasCapacitor(player: GameWorld["player"], amount: number) {
  return player.capacitor >= amount;
}

function spendCapacitor(player: GameWorld["player"], amount: number) {
  player.capacitor = Math.max(0, player.capacitor - amount);
}

function computeTurretApplication(
  attackerPosition: Vec2,
  attackerVelocity: Vec2,
  targetPosition: Vec2,
  targetVelocity: Vec2,
  weapon: {
    damage?: number;
    optimal?: number;
    falloff?: number;
    tracking?: number;
    signatureResolution?: number;
  },
  targetSignatureRadius: number
) {
  const rangeToTarget = Math.max(distance(attackerPosition, targetPosition), 1);
  const rangeFactor = getRangePenalty(rangeToTarget, weapon.optimal, weapon.falloff);
  const relPos = subtract(targetPosition, attackerPosition);
  const relVel = subtract(targetVelocity, attackerVelocity);
  const angularVelocity = Math.abs(
    (relPos.x * relVel.y - relPos.y * relVel.x) / (rangeToTarget * rangeToTarget)
  );
  const signatureScale = clamp(
    Math.pow(
      Math.max(targetSignatureRadius, 1) /
        Math.max(weapon.signatureResolution ?? COMBAT_BALANCE.turret.defaultSignatureResolution, 1),
      0.55
    ),
    0.7,
    1.65
  );
  const effectiveTracking = Math.max(
    COMBAT_BALANCE.turret.minimumTracking,
    (weapon.tracking ?? 0.06) * signatureScale * COMBAT_BALANCE.turret.trackingScalar
  );
  const relSpeed = Math.max(length(relVel), 0.0001);
  const lineOfFire = normalize(relPos);
  const radialAlignment = Math.abs((relVel.x * lineOfFire.x + relVel.y * lineOfFire.y) / relSpeed);
  const lateralAlignment = clamp(1 - radialAlignment, 0, 1);
  const trajectoryFactor = clamp(
    1 +
      radialAlignment * COMBAT_BALANCE.turret.trajectoryRadialBonus -
      lateralAlignment * COMBAT_BALANCE.turret.trajectoryLateralPenalty,
    0.6,
    1.18
  );
  const angularPressure = angularVelocity * 0.32;
  const trackingRatio = angularPressure / effectiveTracking;
  const rawTrackingFactor = 1 / (1 + Math.pow(trackingRatio, COMBAT_BALANCE.turret.trackingExponent));
  const trackingFactor = clamp(0.18 + rawTrackingFactor * 0.82, 0, 1);
  const damage = (weapon.damage ?? 0) * rangeFactor * trackingFactor * trajectoryFactor;

  let quality: "miss" | "grazing" | "solid" | "excellent" = "miss";
  if (damage > (weapon.damage ?? 0) * COMBAT_BALANCE.turret.qualityExcellent) quality = "excellent";
  else if (damage > (weapon.damage ?? 0) * COMBAT_BALANCE.turret.qualitySolid) quality = "solid";
  else if (damage > (weapon.damage ?? 0) * COMBAT_BALANCE.turret.qualityGrazing) quality = "grazing";

  return { damage, quality };
}

function getClosestPointOnSegment(point: Vec2, start: Vec2, end: Vec2) {
  const segment = subtract(end, start);
  const lengthSquared = segment.x * segment.x + segment.y * segment.y;
  if (lengthSquared <= 0.0001) {
    return { point: { ...start }, t: 0, distance: distance(point, start) };
  }
  const t = clamp(
    ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) / lengthSquared,
    0,
    1
  );
  const closestPoint = add(start, scale(segment, t));
  return {
    point: closestPoint,
    t,
    distance: distance(point, closestPoint)
  };
}

function getTurretAdjustedModule(
  module: {
    damage?: number;
    range?: number;
    optimal?: number;
    falloff?: number;
    tracking?: number;
    signatureResolution?: number;
    kind?: string;
  },
  derived?: ReturnType<typeof getCachedDerivedStats>,
  trackingEffectMultiplier = 1
) {
  if (!derived || (module.kind !== "laser" && module.kind !== "railgun")) {
    return module;
  }
  return {
    ...module,
    optimal: (module.optimal ?? 0) * derived.turretOptimalMultiplier,
    falloff: (module.falloff ?? 0) * derived.turretFalloffMultiplier,
    tracking: (module.tracking ?? 0) * derived.turretTrackingMultiplier * trackingEffectMultiplier
  };
}

function findAutoMiningTarget(
  world: GameWorld,
  module: { range?: number; miningTargets?: ResourceId[]; minesAllInRange?: boolean; autoMine?: boolean }
) {
  const sector = getCurrentSector(world);
  const range = module.range ?? 0;
  const eligible = sector.asteroids.filter(
    (entry) =>
      entry.oreRemaining > 0 &&
      distance(world.player.position, entry.position) <= range &&
      canMineResource(module, entry.resource)
  );
  if (eligible.length === 0) return null;
  if (module.minesAllInRange || module.autoMine) {
    return eligible.sort((left, right) => distance(world.player.position, left.position) - distance(world.player.position, right.position))[0];
  }
  return eligible.sort((left, right) => distance(world.player.position, left.position) - distance(world.player.position, right.position))[0];
}

function findAutoSalvageTarget(world: GameWorld, range?: number) {
  const sector = getCurrentSector(world);
  const resolvedRange = range ?? 0;
  const wrecks = sector.wrecks.filter((entry) => distance(world.player.position, entry.position) <= resolvedRange);
  if (wrecks.length === 0) return null;
  return wrecks.sort((left, right) => distance(world.player.position, left.position) - distance(world.player.position, right.position))[0];
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function getEnemyOrbitDirection(seed: string) {
  return hashString(seed) % 2 === 0 ? 1 : -1;
}

function getEnemyManeuverBias(seed: string) {
  return 0.82 + (hashString(`${seed}:bias`) % 28) / 100;
}

function getEnemyPreferredRange(enemyVariantId: string) {
  const variant = enemyVariantById[enemyVariantId];
  if (!variant) return 220;
  const archetype = getEnemyArchetypeDefinition(variant.archetype);
  if (archetype) return archetype.preferredRange;
  if (variant.combatStyle === "speed") return Math.round(variant.preferredRange * 1.18);
  if (variant.combatStyle === "armor") return Math.round(Math.max(120, variant.preferredRange * 0.88));
  if (variant.combatStyle === "shield") return Math.round(Math.max(140, variant.preferredRange * 0.94));
  return variant.preferredRange;
}

function getEnemyCombatMode(enemyVariantId: string) {
  const variant = enemyVariantById[enemyVariantId];
  if (!variant) return "orbit" as const;
  const archetype = getEnemyArchetypeDefinition(variant.archetype);
  if (archetype) return archetype.preferredMode;
  const modules = variant.fittedModules.map((moduleId) => moduleById[moduleId]).filter(Boolean);
  if (variant.combatStyle === "speed") {
    return modules.some((module) =>
      module.kind === "missile" ||
      module.kind === "railgun" ||
      module.kind === "warp_disruptor" ||
      module.kind === "target_painter" ||
      module.kind === "tracking_disruptor" ||
      module.kind === "sensor_dampener"
    )
      ? "keep_range"
      : "orbit";
  }
  if (variant.combatStyle === "armor") {
    return modules.some((module) => module.kind === "laser") ? "orbit" : "approach";
  }
  if (variant.combatStyle === "shield") {
    return modules.some((module) => module.kind === "missile") ? "keep_range" : "orbit";
  }
  if (modules.some((module) => module.kind === "missile" || module.kind === "railgun")) {
    return "keep_range" as const;
  }
  return "orbit" as const;
}

function createEnemyFromVariant(
  variantId: string,
  position: Vec2,
  patrolAnchor = position,
  bossMissionId?: string
) {
  const variant = enemyVariantById[variantId] ?? enemyVariantById["dust-raider"];
  const archetype = getEnemyArchetypeDefinition(variant.archetype);
  const patrolBehavior = variant.boss ? "stationary" : archetype?.patrolBehavior ?? ("anchor-patrol" as const);
  return {
    id: `enemy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    variantId: variant.id,
    boss: variant.boss,
    bossMissionId,
    position: { ...position },
    velocity: { x: 0, y: 0 },
    rotation: 0,
    shield: variant.shield,
    armor: variant.armor,
    hull: variant.hull,
    capacitor: variant.capacitor,
    patrolBehavior,
    patrolAnchor: { ...patrolAnchor },
    patrolTarget: {
      x: patrolAnchor.x + (Math.random() - 0.5) * 220,
      y: patrolAnchor.y + (Math.random() - 0.5) * 220
    },
    navigation: {
      mode: "idle" as const,
      target: null,
      desiredRange: 0,
      destination: null,
      warpFrom: null,
      warpProgress: 0,
      postWarpDock: false
    },
    lockedTargets: [],
    activeTarget: null,
    modules: variant.fittedModules.map((moduleId, index) => ({
      moduleId,
      active: true,
      cycleRemaining: (moduleById[moduleId]?.cycleTime ?? 0) * (0.25 + index * 0.2),
      autoRepeat: true
    })),
    effects: {
      speedMultiplier: 1,
      signatureMultiplier: 1,
      turretTrackingMultiplier: 1,
      lockRangeMultiplier: 1,
      capacitorRegenMultiplier: 1
    },
    recentDamageTimer: 0,
    pursuitTimer: 0
  };
}

function getHostileTriggerProfile(sectorId: string) {
  const sectorDef = sectorById[sectorId];
  if (sectorDef.danger >= 5) return SPAWN_BALANCE.triggerProfiles.high;
  if (sectorDef.danger >= 3) return SPAWN_BALANCE.triggerProfiles.mid;
  return SPAWN_BALANCE.triggerProfiles.low;
}

function getSectorResponseVariants(sectorId: string, preferredVariantIds?: string[]) {
  if (preferredVariantIds?.length) return preferredVariantIds;
  const sectorDef = sectorById[sectorId];
  const variantIds = [
    ...sectorDef.asteroidFields.flatMap((field) => field.hostileSpawnVariantIds ?? []),
    ...sectorDef.enemySpawns.map((spawn) => spawn.variantId)
  ].filter((variantId, index, all) => Boolean(variantId) && all.indexOf(variantId) === index);
  return variantIds.length ? variantIds : ["dust-raider"];
}

function getSectorChallengePressure(world: GameWorld, sectorId: string) {
  return world.sectors[sectorId]?.challengePressure ?? 0;
}

function raiseSectorChallenge(world: GameWorld, sectorId: string, amount: number, source: string) {
  const sector = world.sectors[sectorId];
  if (!sector || amount <= 0) return;
  const before = sector.challengePressure ?? 0;
  sector.challengePressure = clamp(before + amount, 0, 10);
  sector.reinforcementTimer = Math.max(0, (sector.reinforcementTimer ?? 0) - amount * 2.5);
  if (sector.challengePressure >= 5 && before < 5) {
    pushStory(world, `${sectorById[sectorId].name}: local threat response escalating${source ? ` after ${source}` : ""}.`);
  }
}

function refreshSectorChallenge(world: GameWorld, sectorId: string, dt: number) {
  const sector = world.sectors[sectorId];
  const sectorDef = sectorById[sectorId];
  if (!sector || !sectorDef) return;
  const playerPowerTier = getPlayerPowerTier(world);
  const hostilePresence = sector.enemies.some((enemy) => enemy.hull > 0);
  const combatNearby = sector.enemies.some((enemy) => enemy.hull > 0 && distance(enemy.position, world.player.position) <= 760);
  const hostileSitePressure =
    sectorDef.danger >= 4
      ? SPAWN_BALANCE.sectorChallenge.hostileSiteDanger4
      : sectorDef.danger >= 3
        ? SPAWN_BALANCE.sectorChallenge.hostileSiteDanger3
        : SPAWN_BALANCE.sectorChallenge.hostileSiteDefault;
  const presencePressure =
    hostilePresence
      ? SPAWN_BALANCE.sectorChallenge.presenceBase + sectorDef.danger * SPAWN_BALANCE.sectorChallenge.presenceDangerScale
      : 0;
  const proximityPressure = combatNearby ? SPAWN_BALANCE.sectorChallenge.proximity : 0;
  const miningPressure =
    sectorDef.asteroidFields.length > 0 && distance(world.player.position, sectorDef.asteroidFields[0].center) <= 620
      ? SPAWN_BALANCE.sectorChallenge.mining
      : 0;
  const missionPressure =
    (getActiveMission(world)?.targetSystemId === sectorId ? SPAWN_BALANCE.sectorChallenge.mission : 0) +
    (getActiveProceduralContract(world)?.targetSystemId === sectorId ? SPAWN_BALANCE.sectorChallenge.contract : 0);
  const decay =
    sectorDef.security === "high"
      ? SPAWN_BALANCE.sectorChallenge.decay.high
      : sectorDef.security === "medium"
        ? SPAWN_BALANCE.sectorChallenge.decay.medium
        : sectorDef.security === "low"
          ? SPAWN_BALANCE.sectorChallenge.decay.low
          : SPAWN_BALANCE.sectorChallenge.decay.frontier;
  const nextPressure = (sector.challengePressure ?? 0) + dt * (hostileSitePressure + presencePressure + proximityPressure + miningPressure + missionPressure);
  sector.challengePressure = clamp(
    nextPressure - dt * decay + Math.max(0, playerPowerTier - 1) * dt * SPAWN_BALANCE.sectorChallenge.playerPowerTierScale,
    0,
    10
  );
  sector.reinforcementTimer = Math.max(0, (sector.reinforcementTimer ?? 0) - dt);
}

function maybeSpawnSectorReinforcement(world: GameWorld, sectorId: string) {
  const sector = world.sectors[sectorId];
  const sectorDef = sectorById[sectorId];
  if (!sector || !sectorDef) return;
  const pressure = sector.challengePressure ?? 0;
  if (pressure < SPAWN_BALANCE.pressure.localReinforcementThreshold || sector.reinforcementTimer > 0) return;

  const playerPowerTier = getPlayerPowerTier(world);
  const preferredVariantIds = getSectorResponseVariants(sectorId);
  const roles: HostilePackRole[] =
    pressure >= 7 ? ["tackle", "sniper", "support"] : pressure >= 5 ? ["tackle", "support"] : ["tackle"];
  if (sectorDef.security === "frontier" && pressure >= SPAWN_BALANCE.pressure.frontierSwarmThreshold) roles.unshift("swarm");
  if (playerPowerTier >= 4 && pressure >= SPAWN_BALANCE.pressure.highTierEscortThreshold) {
    roles.push(sectorDef.security === "high" ? "sniper" : "hunter");
  }

  const pack = roles.map((role) => ({
    role,
    variantId: pickEnemyVariantForHostileRole(sectorId, role, preferredVariantIds, new Set<string>(), playerPowerTier)
  }));
  spawnTriggeredHostiles(world, sectorId, { ...world.player.position }, pack);
  sector.reinforcementTimer = clamp(
    SPAWN_BALANCE.reinforcement.sectorBaseTimerSec -
      Math.min(12, pressure * SPAWN_BALANCE.reinforcement.sectorPressureScale) +
      Math.max(0, 4 - playerPowerTier) * SPAWN_BALANCE.reinforcement.sectorPlayerTierPenalty,
    SPAWN_BALANCE.reinforcement.sectorMinimumTimerSec,
    SPAWN_BALANCE.reinforcement.sectorMaximumTimerSec
  );
}

type TriggerContext = "belt" | "gate";

interface HostilePackTemplate {
  roles: HostilePackRole[];
  weight: number;
}

interface TriggeredHostileSpawn {
  role: HostilePackRole;
  variantId: string;
}

function getEnemyVariantModuleKinds(variantId: string) {
  const variant = enemyVariantById[variantId];
  return new Set(
    (variant?.fittedModules ?? [])
      .map((moduleId) => moduleById[moduleId]?.kind)
      .filter((kind): kind is NonNullable<typeof kind> => Boolean(kind))
  );
}

function scoreEnemyVariantForHostileRole(
  sectorId: string,
  variantId: string,
  role: HostilePackRole,
  preferredVariantIds: string[] | undefined,
  playerPowerTier: number
) {
  const variant = enemyVariantById[variantId];
  if (!variant) return Number.NEGATIVE_INFINITY;
  const sectorDef = sectorById[sectorId];
  if (!sectorDef) return Number.NEGATIVE_INFINITY;
  const archetype = getEnemyArchetypeDefinition(variant.archetype);
  const moduleKinds = getEnemyVariantModuleKinds(variantId);
  const totalBulk = variant.shield + variant.armor + variant.hull;
  const localFactions = new Set<FactionId>([sectorDef.controllingFaction, ...(sectorDef.contestedFactionIds ?? [])]);
  const threatCap = Math.max(1, Math.min(6, sectorDef.danger + 1 + Math.floor(playerPowerTier / 2)));
  if (!localFactions.has(variant.faction)) return Number.NEGATIVE_INFINITY;
  if (variant.threatLevel > threatCap) return Number.NEGATIVE_INFINITY;
  let score = preferredVariantIds?.includes(variantId) ? 2.5 : 0;
  const techPressure = Math.max(0, playerPowerTier - 1);
  if (variant.elite) {
    score += playerPowerTier >= 3 ? 1.8 + techPressure * 0.35 : 0.5;
  }

  if (role === "swarm") {
    if (archetype?.id === "swarm") score += 4.5;
    if (variant.combatStyle === "speed") score += 2.5;
    if (variant.speed >= 118) score += 1.4;
    if (variant.preferredRange <= 180) score += 1.1;
    if (moduleKinds.has("missile") || moduleKinds.has("laser") || moduleKinds.has("webifier")) score += 0.5;
  } else if (role === "tackle") {
    if (archetype?.id === "interceptor" || archetype?.id === "hunter") score += 4.2;
    if (variant.combatStyle === "speed") score += 2.8;
    if (variant.speed >= 108) score += 1.6;
    if (variant.preferredRange <= 220) score += 1.0;
    if (moduleKinds.has("warp_disruptor")) score += 4.4;
    if (moduleKinds.has("webifier")) score += 2.9;
    if (moduleKinds.has("missile") || moduleKinds.has("railgun")) score += 0.5;
  } else if (role === "sniper") {
    if (archetype?.id === "siege_sniper" || archetype?.id === "artillery") score += 4.0;
    if (variant.preferredRange >= 260) score += 2.6;
    if (variant.lockRange >= 600) score += 1.0;
    if (variant.combatStyle === "armor") score += 1.3;
    if (moduleKinds.has("railgun")) score += 2.2;
    if (moduleKinds.has("missile")) score += 0.7;
  } else if (role === "brawler") {
    if (archetype?.id === "heavy_bruiser" || archetype?.id === "hunter") score += 4.0;
    if (variant.combatStyle === "shield" || variant.combatStyle === "armor") score += 2.4;
    if (variant.preferredRange <= 240) score += 2.0;
    if (totalBulk >= 260) score += 1.0;
    if (moduleKinds.has("laser")) score += 0.6;
  } else if (role === "support") {
    if (archetype?.id === "support_frigate") score += 4.2;
    if (moduleKinds.has("webifier")) score += 3.0;
    if (moduleKinds.has("warp_disruptor")) score += 3.1;
    if (moduleKinds.has("target_painter")) score += 3.0;
    if (moduleKinds.has("tracking_disruptor")) score += 2.4;
    if (moduleKinds.has("sensor_dampener")) score += 2.4;
    if (moduleKinds.has("energy_neutralizer")) score += 3.4;
    if (moduleKinds.has("shield_booster")) score += 1.3;
    if (moduleKinds.has("armor_repairer")) score += 1.3;
    if (variant.combatStyle === "speed") score += 0.5;
    score += techPressure * 0.35;
  } else if (role === "skirmisher") {
    if (archetype?.id === "missile_skirmisher" || archetype?.id === "hunter" || archetype?.id === "interceptor") score += 3.6;
    if (variant.combatStyle === "speed") score += 2.8;
    if (variant.speed >= 110) score += 1.5;
    if (variant.preferredRange >= 190 && variant.preferredRange <= 340) score += 1.5;
    if (moduleKinds.has("missile") || moduleKinds.has("railgun") || moduleKinds.has("laser")) score += 0.5;
    score += techPressure * 0.2;
  } else if (role === "anchor") {
    if (archetype?.id === "heavy_bruiser" || archetype?.id === "siege_sniper" || archetype?.id === "artillery") score += 3.8;
    if (totalBulk >= 280) score += 3.2;
    if (variant.speed <= 100) score += 1.5;
    if (variant.combatStyle === "shield" || variant.combatStyle === "armor") score += 1.5;
    if (moduleKinds.has("shield_booster") || moduleKinds.has("armor_repairer")) score += 1.0;
    score += techPressure * 0.25;
  } else if (role === "escort") {
    if (archetype?.id === "interceptor" || archetype?.id === "hunter") score += 3.0;
    if (variant.combatStyle === "speed") score += 2.0;
    if (variant.speed >= 112) score += 1.2;
    if (moduleKinds.has("missile")) score += 1.8;
    if (moduleKinds.has("railgun")) score += 1.4;
    if (moduleKinds.has("laser")) score += 0.8;
    if (totalBulk <= 250) score += 1.2;
    score += techPressure * 0.3;
  } else if (role === "artillery") {
    if (archetype?.id === "artillery" || archetype?.id === "siege_sniper") score += 4.4;
    if (variant.preferredRange >= 420) score += 2.2;
    if (variant.lockRange >= 620) score += 1.4;
    if (moduleKinds.has("missile") || moduleKinds.has("railgun")) score += 1.4;
  } else if (role === "hunter") {
    if (archetype?.id === "hunter" || archetype?.id === "interceptor") score += 4.0;
    if (variant.combatStyle === "speed") score += 2.4;
    if (variant.speed >= 112) score += 1.6;
    if (variant.preferredRange <= 260) score += 1.2;
    if (moduleKinds.has("warp_disruptor") || moduleKinds.has("webifier")) score += 1.2;
  }

  if (playerPowerTier >= 3) {
    if (moduleKinds.has("warp_disruptor")) score += 0.8;
    if (moduleKinds.has("tracking_disruptor")) score += 0.7;
    if (moduleKinds.has("sensor_dampener")) score += 0.7;
    if (moduleKinds.has("energy_neutralizer")) score += 0.8;
  }

  return score;
}

function pickEnemyVariantForHostileRole(
  sectorId: string,
  role: HostilePackRole,
  preferredVariantIds: string[] | undefined,
  usedVariantIds: Set<string>,
  playerPowerTier: number
) {
  const sectorDef = sectorById[sectorId];
  const preferredPool =
    preferredVariantIds?.length
      ? preferredVariantIds
      : enemyVariants
          .filter((variant) => variant.faction === sectorDef?.controllingFaction || sectorDef?.contestedFactionIds?.includes(variant.faction))
          .map((variant) => variant.id);
  const scored = enemyVariants
    .filter((variant) => !variant.boss)
    .filter((variant) => preferredPool.length === 0 || preferredPool.includes(variant.id))
    .map((variant) => ({
      variant,
      score:
        scoreEnemyVariantForHostileRole(sectorId, variant.id, role, preferredPool, playerPowerTier) -
        (usedVariantIds.has(variant.id) ? 0.4 : 0)
    }))
    .sort((left, right) => right.score - left.score);
  const topScore = scored[0]?.score ?? Number.NEGATIVE_INFINITY;
  const shortlist = scored.filter((entry) => entry.score >= topScore - 0.75).slice(0, 4);
  const pickPool = shortlist.length ? shortlist : scored.slice(0, 1);
  return pickPool[Math.floor(Math.random() * pickPool.length)]?.variant.id ?? "dust-raider";
}

function chooseHostilePackTemplate(context: TriggerContext, sectorId: string, playerPowerTier: number) {
  const templates = getEncounterTemplateOptions(context, sectorId).map((template) => ({
    roles: template.roles as HostilePackRole[],
    weight: template.weight + Math.max(0, playerPowerTier - 2) * 0.25
  }));
  const totalWeight = templates.reduce((sum, template) => sum + template.weight, 0);
  let roll = Math.random() * Math.max(totalWeight, 1);
  for (const template of templates) {
    roll -= template.weight;
    if (roll <= 0) return template;
  }
  return templates[0] ?? { roles: ["tackle", "sniper"], weight: 1 };
}

function buildTriggeredHostilePack(
  world: GameWorld,
  context: TriggerContext,
  sectorId: string,
  playerPowerTier: number,
  preferredVariantIds?: string[]
): TriggeredHostileSpawn[] {
  const template = chooseHostilePackTemplate(context, sectorId, playerPowerTier);
  const usedVariantIds = new Set<string>();
  const roles = [...template.roles];
  const pressure = getSectorChallengePressure(world, sectorId);
  if (playerPowerTier >= 4 && sectorById[sectorId]?.danger >= 5 && Math.random() < 0.2) {
    roles.push(context === "belt" ? "support" : "escort");
  }
  if ((playerPowerTier >= 4 || pressure >= 4) && sectorById[sectorId]?.security === "frontier" && Math.random() < 0.2) {
    roles.push(context === "belt" ? "support" : "escort");
  }
  if ((playerPowerTier >= 4 || pressure >= 4) && sectorById[sectorId]?.security === "frontier" && Math.random() < 0.2) {
    roles.push("support");
  }
  if (pressure >= SPAWN_BALANCE.pressure.pressurePackThreshold && Math.random() < 0.25) {
    roles.unshift(context === "gate" ? "tackle" : "swarm");
  }
  return roles.map((role) => {
    const variantId = pickEnemyVariantForHostileRole(sectorId, role, preferredVariantIds, usedVariantIds, playerPowerTier);
    usedVariantIds.add(variantId);
    return { role, variantId };
  });
}

function getTriggerSpawnRadius(role: HostilePackRole) {
  const radiusTable = SPAWN_BALANCE.triggeredSpawnRadius ?? {};
  const [min, spread] = radiusTable[role] ?? radiusTable.default ?? [220, 80];
  return min + Math.random() * spread;
}

function updateBeltSpawnCooldowns(world: GameWorld, dt: number) {
  Object.values(world.sectors).forEach((sector) => {
    Object.keys(sector.beltSpawnCooldowns).forEach((beltId) => {
      const remaining = Math.max(0, sector.beltSpawnCooldowns[beltId] - dt);
      if (remaining > 0) {
        sector.beltSpawnCooldowns[beltId] = remaining;
      } else {
        delete sector.beltSpawnCooldowns[beltId];
      }
    });
  });
}

function aggroEnemyToPlayer(world: GameWorld, enemyId: string) {
  const enemy = getCurrentSector(world).enemies.find((entry) => entry.id === enemyId);
  if (!enemy || enemy.hull <= 0) return;
  const playerRef: SelectableRef = { id: "player", type: "enemy" };
  enemy.activeTarget = playerRef;
  enemy.navigation.target = playerRef;
  enemy.navigation.mode = "approach";
  enemy.navigation.desiredRange = getEnemyPreferredRange(enemy.variantId);
  enemy.pursuitTimer = Math.max(enemy.pursuitTimer, 8);
}

function getEnemyHealthFraction(enemy: EnemyState, variant: EnemyVariant) {
  const totalMax = Math.max(variant.shield + variant.armor + variant.hull, 1);
  return (enemy.shield + enemy.armor + enemy.hull) / totalMax;
}

function getEnemyRetreatThreshold(enemyVariantId: string) {
  const variant = enemyVariantById[enemyVariantId];
  if (!variant) return 0.52;
  const archetype = getEnemyArchetypeDefinition(variant.archetype);
  if (archetype?.id === "swarm") return 0.18;
  if (archetype?.id === "siege_sniper" || archetype?.id === "artillery") return 0.36;
  if (archetype?.id === "support_frigate") return 0.42;
  if (archetype?.id === "heavy_bruiser") return 0.48;
  if (variant.combatStyle === "speed") return 0.72;
  if (variant.combatStyle === "shield") return 0.58;
  if (variant.combatStyle === "armor") return 0.42;
  return 0.52;
}

function shouldEnemyRetreat(
  enemy: EnemyState,
  variant: EnemyVariant,
  playerDistance: number
) {
  const preferredRange = getEnemyPreferredRange(enemy.variantId);
  const healthFraction = getEnemyHealthFraction(enemy, variant);
  const lowCapacitor = enemy.capacitor < variant.capacitor * 0.16;
  const takingLosses = enemy.recentDamageTimer > 0;
  const archetype = getEnemyArchetypeDefinition(variant.archetype);
  const pursuitScale =
    archetype?.id === "swarm" ? 1.18 :
    archetype?.id === "siege_sniper" || archetype?.id === "artillery" ? 1.88 :
    archetype?.id === "heavy_bruiser" ? 1.42 :
    archetype?.id === "support_frigate" ? 1.6 :
    1.7;
  const failingPursuit = playerDistance > preferredRange * pursuitScale;
  return (
    (takingLosses && healthFraction <= getEnemyRetreatThreshold(enemy.variantId)) ||
    (takingLosses && failingPursuit && healthFraction < 0.82) ||
    (takingLosses && lowCapacitor && healthFraction < 0.9)
  );
}

function pickNextEnemyPatrolTarget(world: GameWorld, enemy: EnemyState) {
  const sectorDef = getCurrentSectorDef(world);
  if (enemy.patrolBehavior === "stationary") {
    enemy.patrolTarget = null;
    return;
  }
  if (enemy.patrolBehavior === "anchor-patrol") {
    enemy.patrolTarget = {
      x: clamp(enemy.patrolAnchor.x + (Math.random() - 0.5) * 320, 80, sectorDef.width - 80),
      y: clamp(enemy.patrolAnchor.y + (Math.random() - 0.5) * 320, 80, sectorDef.height - 80)
    };
    return;
  }
  enemy.patrolTarget = {
    x: 120 + Math.random() * Math.max(240, sectorDef.width - 240),
    y: 120 + Math.random() * Math.max(240, sectorDef.height - 240)
  };
}

function spawnTriggeredHostiles(
  world: GameWorld,
  sectorId: string,
  anchorPosition: Vec2,
  pack: TriggeredHostileSpawn[]
) {
  const sector = world.sectors[sectorId];
  const sectorDef = sectorById[sectorId];
  const nearbyHostiles = sector.enemies.filter(
    (enemy) => enemy.hull > 0 && distance(enemy.position, world.player.position) <= SPAWN_BALANCE.triggeredHostileSearchRadius
  ).length;
  if (nearbyHostiles >= SPAWN_BALANCE.maxTriggeredHostilesNearPlayer) return;

  const actualPack = pack.slice(0, Math.max(1, SPAWN_BALANCE.maxTriggeredHostilesNearPlayer - nearbyHostiles));
  const spawnedNames: string[] = [];

  for (let index = 0; index < actualPack.length; index += 1) {
    const entry = actualPack[index];
    const angle = Math.random() * Math.PI * 2;
    const radius = getTriggerSpawnRadius(entry.role) + index * 18;
    const spawnPosition = {
      x: clamp(anchorPosition.x + Math.cos(angle) * radius, 80, sectorDef.width - 80),
      y: clamp(anchorPosition.y + Math.sin(angle) * radius, 80, sectorDef.height - 80)
    };
    const enemy = createEnemyFromVariant(entry.variantId, spawnPosition, anchorPosition);
    sector.enemies.push(enemy);
    aggroEnemyToPlayer(world, enemy.id);
    spawnedNames.push(`${entry.role}: ${enemyVariantById[enemy.variantId]?.name ?? "hostile"}`);
  }

  const originalSectorId = world.currentSectorId;
  world.currentSectorId = sectorId;
  addFloatingText(world, anchorPosition, "Hostiles inbound", "#ff8b7a");
  world.currentSectorId = originalSectorId;
  pushStory(world, `${spawnedNames.join(", ")} warped toward your position.`);
}

function getMissionBossSpawnPoint(world: GameWorld, mission: MissionDefinition) {
  const targetSystemId = mission.targetSystemId;
  if (!targetSystemId) return null;
  const sectorDef = sectorById[targetSystemId];
  if (!sectorDef) return null;
  if (mission.targetDestinationId) {
    const destination = getSystemDestination(targetSystemId, mission.targetDestinationId);
    if (destination) return { ...destination.position };
  }
  return {
    x: sectorDef.width * 0.5,
    y: sectorDef.height * 0.5
  };
}

function spawnMissionBossEncounter(world: GameWorld, mission: MissionDefinition) {
  const state = world.missions[mission.id];
  const bossEncounter = mission.bossEncounter ?? bossByMissionId[mission.id];
  if (!state || state.status !== "active" || state.bossSpawned || !bossEncounter) return;
  if (world.currentSectorId !== mission.targetSystemId) return;
  const sector = getCurrentSector(world);
  if (!enemyVariantById[bossEncounter.bossVariantId]) return;

  const anchor = getMissionBossSpawnPoint(world, mission) ?? { ...world.player.position };
  const escorts = bossEncounter.escortVariantIds ?? [];
  const escortCount = Math.max(escorts.length, 1);
  const spawnPack: Array<{ variantId: string; offset: Vec2; bossMissionId?: string }> = [
    {
      variantId: bossEncounter.bossVariantId,
      offset: { x: 0, y: 0 },
      bossMissionId: mission.id
    },
    ...escorts.map((variantId, index) => ({
      variantId,
      offset: {
        x: Math.cos((Math.PI * 2 * index) / escortCount) * (170 + index * 20),
        y: Math.sin((Math.PI * 2 * index) / escortCount) * (170 + index * 20)
      }
    }))
  ];

  const sectorDef = sectorById[world.currentSectorId];
  spawnPack.forEach((entry, index) => {
    const variantId = entry.variantId;
    if (!variantId) return;
    const variant = enemyVariantById[variantId];
    if (!variant) return;
    const position = {
      x: clamp(anchor.x + entry.offset.x + (index === 0 ? 0 : (Math.random() - 0.5) * 40), 80, sectorDef.width - 80),
      y: clamp(anchor.y + entry.offset.y + (index === 0 ? 0 : (Math.random() - 0.5) * 40), 80, sectorDef.height - 80)
    };
    const enemy = createEnemyFromVariant(variantId, position, anchor, entry.bossMissionId ?? mission.id);
    sector.enemies.push(enemy);
    aggroEnemyToPlayer(world, enemy.id);
  });

  state.bossSpawned = true;
  pushStory(
    world,
    `${mission.title}: ${bossEncounter.bossTitle} sighted${bossEncounter.threatSummary ? ` - ${bossEncounter.threatSummary}` : ""}.`
  );
}

function updateMissionBossEncounters(world: GameWorld) {
  missionCatalog.forEach((mission) => {
    const state = world.missions[mission.id];
    if (!state || state.status !== "active" || state.bossSpawned || !mission.bossEncounter) return;
    if (world.currentSectorId !== mission.targetSystemId) return;
    spawnMissionBossEncounter(world, mission);
  });
}

function updateCombatMissionPressure(world: GameWorld, dt: number) {
  const activeMission = getActiveMission(world);
  if (!activeMission || !activeMission.combatObjective || activeMission.targetSystemId !== world.currentSectorId) return;
  const state = world.missions[activeMission.id];
  if (!state || state.status !== "active") return;

  state.objectiveTimer ??= activeMission.objectiveDurationSec ?? 0;
  state.reinforcementTimer ??= activeMission.reinforcementIntervalSec ?? 0;
  state.challengePressure ??= 0;

  if (activeMission.combatObjective === "survive") {
    state.objectiveTimer = Math.max(0, state.objectiveTimer - dt);
    state.challengePressure = Math.min(10, state.challengePressure + dt * 0.012);
    state.reinforcementTimer = Math.max(0, state.reinforcementTimer - dt);
    if (state.reinforcementTimer <= 0) {
      const roles = (activeMission.reinforcementRoles?.length
        ? activeMission.reinforcementRoles
        : ["tackle", "support"]) as HostilePackRole[];
      const pack: TriggeredHostileSpawn[] = roles.map((role) => ({
        role,
        variantId: pickEnemyVariantForHostileRole(
          world.currentSectorId,
          role,
          activeMission.reinforcementVariantIds,
          new Set<string>(),
          getPlayerPowerTier(world)
        )
      }));
      spawnTriggeredHostiles(world, world.currentSectorId, { ...world.player.position }, pack);
      state.reinforcementTimer = activeMission.reinforcementIntervalSec ?? MISSION_BALANCE.survive.defaultReinforcementIntervalSec;
      pushStory(world, `${activeMission.title}: another wave is inbound.`);
    }
    if (state.objectiveTimer <= 0) {
      state.progress = 1;
      state.status = "readyToTurnIn";
      pushStory(world, `${activeMission.title} survived.`);
    }
    return;
  }

  if (activeMission.combatObjective === "clear") {
    state.reinforcementTimer = Math.max(0, state.reinforcementTimer - dt);
    if (state.reinforcementTimer <= 0) {
      const roles = (activeMission.reinforcementRoles?.length
        ? activeMission.reinforcementRoles
        : ["brawler", "support"]) as HostilePackRole[];
      const pack: TriggeredHostileSpawn[] = roles.map((role) => ({
        role,
        variantId: pickEnemyVariantForHostileRole(
          world.currentSectorId,
          role,
          activeMission.reinforcementVariantIds,
          new Set<string>(),
          getPlayerPowerTier(world)
        )
      }));
      spawnTriggeredHostiles(world, world.currentSectorId, { ...world.player.position }, pack);
      state.reinforcementTimer = activeMission.reinforcementIntervalSec ?? MISSION_BALANCE.clear.defaultReinforcementIntervalSec;
      state.challengePressure = Math.min(10, (state.challengePressure ?? 0) + MISSION_BALANCE.clear.pressurePerWave);
      pushStory(world, `${activeMission.title}: reinforcements are joining the pocket.`);
    }
  }
}

function maybeTriggerMiningSpawn(
  world: GameWorld,
  beltId: string,
  anchorPosition: Vec2,
  preferredVariantIds?: string[]
) {
  const sector = getCurrentSector(world);
  if (sector.beltSpawnCooldowns[beltId] && sector.beltSpawnCooldowns[beltId] > 0) return;
  const profile = getHostileTriggerProfile(world.currentSectorId);
  const playerPowerTier = getPlayerPowerTier(world);
  const frontierBoost =
    getCurrentSectorDef(world).security === "frontier"
      ? Math.max(0, playerPowerTier - 1) * SPAWN_BALANCE.triggerChance.miningFrontierPerTier
      : 0;
  const triggerChance = Math.min(
    SPAWN_BALANCE.triggerChance.miningMax,
    (profile.chance + SPAWN_BALANCE.triggerChance.miningBase + frontierBoost) *
      getHostileActivityMultiplier(world, world.currentSectorId)
  );
  if (Math.random() > triggerChance) return;
  spawnTriggeredHostiles(
    world,
    world.currentSectorId,
    anchorPosition,
    buildTriggeredHostilePack(
      world,
      "belt",
      world.currentSectorId,
      playerPowerTier,
      getSectorResponseVariants(world.currentSectorId, preferredVariantIds)
    )
  );
  sector.beltSpawnCooldowns[beltId] = SPAWN_BALANCE.hostileTriggerCooldownSec;
}

function maybeTriggerPortalSpawn(world: GameWorld, destinationSectorId: string, anchorPosition: Vec2) {
  const profile = getHostileTriggerProfile(destinationSectorId);
  const destinationDef = sectorById[destinationSectorId];
  const playerPowerTier = getPlayerPowerTier(world);
  const frontierBoost =
    destinationDef?.security === "frontier"
      ? Math.max(0, playerPowerTier - 1) * SPAWN_BALANCE.triggerChance.portalFrontierPerTier
      : 0;
  const triggerChance = Math.min(
    SPAWN_BALANCE.triggerChance.portalMax,
    (profile.chance + SPAWN_BALANCE.triggerChance.portalBase + frontierBoost) *
      getHostileActivityMultiplier(world, destinationSectorId)
  );
  if (Math.random() > triggerChance) return;
  spawnTriggeredHostiles(
    world,
    destinationSectorId,
    anchorPosition,
    buildTriggeredHostilePack(world, "gate", destinationSectorId, playerPowerTier, getSectorResponseVariants(destinationSectorId))
  );
}

function updateRouteAutopilot(world: GameWorld) {
  if (!world.routePlan?.autoFollow || world.dockedStationId) return;
  const interactionRange = getCachedDerivedStats(world.player).interactionRange;
  if (world.currentSectorId === world.routePlan.destinationSystemId && world.routePlan.destinationDestinationId) {
    const destination = getSystemDestination(world.currentSectorId, world.routePlan.destinationDestinationId);
    if (!destination) return;
    const targetRef: SelectableRef = { id: destination.id, type: destination.kind as SelectableRef["type"] };
    const targetPosition = getObjectPosition(world, targetRef);
    if (!targetPosition) return;
    const targetDistance = distance(world.player.position, targetPosition);

    if (destination.kind === "station" || destination.kind === "outpost") {
      if (targetDistance <= interactionRange) {
        issueNav(world, "docking", targetRef, 0);
        return;
      }
      if (world.player.navigation.mode === "idle") {
        if (destination.warpable && targetDistance > 190) {
          issueNav(world, "align", targetRef, 130);
        } else {
          issueNav(world, "docking", targetRef, 0);
        }
      }
      return;
    }

    if (world.player.navigation.mode === "idle") {
      if (destination.warpable && targetDistance > 190) {
        issueNav(world, "align", targetRef, destination.kind === "gate" ? 120 : 130);
      } else if (destination.kind === "gate") {
        issueNav(world, "jumping", targetRef, 0);
      } else {
        issueNav(world, "approach", targetRef, 0);
      }
    }
    return;
  }

  const nextStep = getNextRouteStep(world);
  if (!nextStep) return;
  const gateRef: SelectableRef = { id: nextStep.gateId, type: "gate" };
  const gatePosition = getObjectPosition(world, gateRef);
  if (!gatePosition) return;
  const gateDistance = distance(world.player.position, gatePosition);
  if (gateDistance <= interactionRange) {
    issueNav(world, "jumping", gateRef, 0);
    return;
  }
  if (world.player.navigation.mode === "idle") {
    issueNav(world, "align", gateRef, 120);
    world.player.navigation.desiredRange = 120;
  }
}

function updatePlayerNavigation(world: GameWorld, dt: number) {
  const player = world.player;
  const sectorDef = getCurrentSectorDef(world);
  const derived = getCachedDerivedStats(player);
  const playerShip = playerShipById[player.hullId];
  const bodyRadius = Math.max(14, playerShip.signatureRadius * player.effects.signatureMultiplier * 0.46);
  const terrainBias = playerShip.shipClass === "industrial" ? 1.08 : 0.92;

  player.recentDamageTimer = Math.max(0, player.recentDamageTimer - dt);
  const passiveShieldFactor = player.recentDamageTimer > 0 ? 0.02 : 0.18;
  player.shield = clamp(player.shield + derived.shieldRegen * passiveShieldFactor * dt, 0, derived.maxShield);
  const stationaryCapacitorBonus = getStationaryCapacitorRegenMultiplier(player, derived);
  player.capacitor = clamp(
    player.capacitor + derived.capacitorRegen * stationaryCapacitorBonus * player.effects.capacitorRegenMultiplier * dt,
    0,
    derived.capacitorCapacity
  );

  const nav = player.navigation;
  const currentTargetPosition = nav.target ? getObjectPosition(world, nav.target) : null;
  if (nav.target && !currentTargetPosition && nav.mode !== "warping") {
    setIdle(nav);
  }

  let targetPosition = currentTargetPosition ?? nav.destination;
  let maxSpeed = derived.maxSpeedWithAfterburner;
  maxSpeed *= player.effects.speedMultiplier;
  if (player.buildSwap.active) {
    maxSpeed *= 0.58;
  }
  let desiredVelocity = { x: 0, y: 0 };
  let desiredFacing = player.rotation;

  if (nav.mode === "jumping" && nav.target) {
    targetPosition = getObjectPosition(world, nav.target);
    if (targetPosition && distance(player.position, targetPosition) <= derived.interactionRange) {
      const gate = getSystemDestination(world.currentSectorId, nav.target.id);
      if (
        gate &&
        gate.kind === "gate" &&
        gate.connectedSystemId &&
        (!gate.unlockMissionId ||
          world.missions[gate.unlockMissionId]?.status === "completed" ||
          world.unlockedSectorIds.includes(gate.connectedSystemId))
      ) {
        emitGateJump(world, world.player.position);
        world.currentSectorId = gate.connectedSystemId;
        const arrival = gate.arrivalGateId ? getSystemDestination(gate.connectedSystemId, gate.arrivalGateId) : null;
        if (arrival) {
          enterDestinationSite(world, arrival.id);
          world.player.position = { x: arrival.position.x + 100, y: arrival.position.y + 20 };
          world.player.velocity = { x: 0, y: 0 };
          maybeTriggerPortalSpawn(world, gate.connectedSystemId, arrival.position);
        } else {
          world.localSite = createTransitLocalSite(world.currentSectorId, world.player.position);
        }
        advanceRouteAfterJump(world, gate.connectedSystemId);
        setIdle(world.player.navigation);
        world.player.pendingLocks = [];
        world.selectedObject = null;
        world.lockedTargets = [];
        world.activeTarget = null;
        pushStory(world, `Jump complete: ${sectorById[gate.connectedSystemId].name}`);
        return;
      }
      pushStory(world, "Gate lock active. Clear the survey contract first.");
      setIdle(nav);
    } else if (targetPosition) {
      const dirToTarget = normalize(subtract(targetPosition, player.position));
      desiredFacing = Math.atan2(dirToTarget.y, dirToTarget.x);
      desiredVelocity = scale(dirToTarget, Math.min(maxSpeed * 0.68, 110));
    }
  }

  if (nav.mode === "docking" && nav.target) {
    targetPosition = getObjectPosition(world, nav.target);
    if (targetPosition && distance(player.position, targetPosition) <= derived.interactionRange) {
      emitDockPulse(world, player.position);
      dock(world);
      return;
    }
    if (targetPosition) {
      const dirToTarget = normalize(subtract(targetPosition, player.position));
      desiredFacing = Math.atan2(dirToTarget.y, dirToTarget.x);
      const dockingDistance = distance(player.position, targetPosition);
      const dockingSpeed = clamp((dockingDistance - derived.interactionRange) * 0.6, 24, maxSpeed * 0.45);
      desiredVelocity = scale(dirToTarget, dockingSpeed);
    }
  }

  if (nav.mode === "align" && targetPosition) {
    const desiredAngle = angleTo(player.position, targetPosition);
    desiredFacing = desiredAngle;
    desiredVelocity = scale(fromAngle(desiredAngle), maxSpeed * 0.82);
    const alignment = Math.abs(shortestAngleDiff(player.rotation, desiredAngle));
    if (nav.desiredRange >= 0) {
      if (getHostileWarpDisruptor(world)) {
        nav.warpProgress = 0;
      } else {
      const aligned = alignment < 0.08 && length(player.velocity) >= derived.maxSpeed * 0.74;
      const prevProgress = nav.warpProgress;
      nav.warpProgress = aligned ? clamp(nav.warpProgress + dt * 1.6, 0, 1) : 0;
      // Emit spool thrust at 4 thresholds as progress builds
      if (aligned && nav.warpProgress > 0) {
        const spoolInterval = 0.22;
        if (Math.floor(nav.warpProgress / spoolInterval) > Math.floor(prevProgress / spoolInterval)) {
          emitWarpSpool(world, player.position, player.rotation, nav.warpProgress);
        }
      }
      if (nav.warpProgress >= 1) {
        nav.mode = "warping";
        nav.warpFrom = { ...player.position };
        nav.warpProgress = 0;
        player.velocity = { x: 0, y: 0 };
        emitWarpActivate(world, player.position, player.rotation);
      }
      }
    } else {
      nav.warpProgress = 0;
    }
  } else if (nav.mode === "warping" && targetPosition && nav.warpFrom) {
    const previousPosition = { ...player.position };
    const targetRef = nav.target;
    const shouldDockAfterWarp = nav.postWarpDock;
    nav.warpProgress = clamp(nav.warpProgress + dt * 0.9, 0, 1);
    const direction = normalize(subtract(targetPosition, nav.warpFrom));
    const totalDistance = Math.max(distance(nav.warpFrom, targetPosition) - nav.desiredRange, 1);
    const travelled = totalDistance * nav.warpProgress;
    player.position = add(nav.warpFrom, scale(direction, travelled));
    player.rotation = angleTo(nav.warpFrom, targetPosition);
    const warpInterdictor = getCurrentSector(world).enemies
      .filter((enemy) => enemy.hull > 0)
      .map((enemy) => {
        const variant = enemyVariantById[enemy.variantId];
        const interdictionRange = Math.max(150, variant.lockRange * enemy.effects.lockRangeMultiplier * 0.82);
        const closest = getClosestPointOnSegment(enemy.position, previousPosition, player.position);
        return { enemy, variant, interdictionRange, closest };
      })
      .filter(({ closest, interdictionRange }) => closest.distance <= interdictionRange)
      .sort((left, right) => left.closest.t - right.closest.t)[0];
    if (warpInterdictor) {
      player.position = { ...warpInterdictor.closest.point };
      player.velocity = { x: 0, y: 0 };
      nav.warpFrom = null;
      nav.warpProgress = 0;
      nav.postWarpDock = false;
      setIdle(nav);
      aggroEnemyToPlayer(world, warpInterdictor.enemy.id);
      pushStory(world, `Warp interrupted by ${warpInterdictor.variant.name}.`);
      return;
    }
    if (nav.warpProgress >= 1 || distance(player.position, targetPosition) <= nav.desiredRange + 20) {
      const destination = targetRef ? getDestinationIfSameSystem(world, targetRef) : null;
      if (destination) {
        enterDestinationSite(world, destination.id);
      } else {
        world.localSite = createTransitLocalSite(world.currentSectorId, targetPosition);
      }
      player.position = add(targetPosition, scale(direction, -nav.desiredRange));
      emitWarpArrive(world, player.position);
      setIdle(nav);
      if (shouldDockAfterWarp && targetRef) {
        issueNav(world, "docking", targetRef, 0);
      }
    }
    return;
  } else if (
    (nav.mode === "approach" || nav.mode === "keep_range" || nav.mode === "orbit") &&
    targetPosition
  ) {
    const toTarget = subtract(targetPosition, player.position);
    const currentDistance = length(toTarget);
    const dirToTarget = currentDistance > 0 ? normalize(toTarget) : { x: 1, y: 0 };
    const tangent = { x: -dirToTarget.y, y: dirToTarget.x };
    const radialError = currentDistance - nav.desiredRange;
    const radialVelocity =
      player.velocity.x * dirToTarget.x + player.velocity.y * dirToTarget.y;

    if (nav.mode === "approach") {
      const stopBand = Math.max(18, nav.desiredRange + 14);
      if (currentDistance <= stopBand) {
        desiredVelocity = scale(player.velocity, 0.86);
        if (currentDistance <= Math.max(10, nav.desiredRange + 6) && length(player.velocity) < 18) {
          setIdle(nav);
        }
      } else {
        const desiredSpeed = clamp((currentDistance - nav.desiredRange) * 0.72, 36, maxSpeed * 0.88);
        desiredVelocity = scale(dirToTarget, desiredSpeed);
      }
      desiredFacing = Math.atan2(dirToTarget.y, dirToTarget.x);
    } else if (nav.mode === "keep_range") {
      const band = Math.max(28, nav.desiredRange * 0.08);
      if (currentDistance > nav.desiredRange + band) {
        const desiredSpeed = clamp((currentDistance - nav.desiredRange) * 0.55, 28, maxSpeed * 0.62);
        desiredVelocity = scale(dirToTarget, desiredSpeed);
        desiredFacing = Math.atan2(dirToTarget.y, dirToTarget.x);
      } else if (currentDistance < nav.desiredRange - band) {
        const desiredSpeed = clamp((nav.desiredRange - currentDistance) * 0.65, 28, maxSpeed * 0.54);
        desiredVelocity = scale(dirToTarget, -desiredSpeed);
        desiredFacing = Math.atan2(-dirToTarget.y, -dirToTarget.x);
      } else {
        const tangentBias = radialError * 0.02 - radialVelocity * 0.015;
        const motion = normalize(add(tangent, scale(dirToTarget, tangentBias)));
        desiredVelocity = scale(motion, clamp(maxSpeed * 0.42, 40, maxSpeed * 0.52));
        desiredFacing = Math.atan2(motion.y, motion.x);
      }
    } else if (nav.mode === "orbit") {
      const orbitBand = Math.max(18, nav.desiredRange * 0.06);
      const correction = clamp(radialError * 0.018 - radialVelocity * 0.012, -0.55, 0.55);
      const orbitDirection =
        Math.abs(radialError) > orbitBand * 2
          ? normalize(add(tangent, scale(dirToTarget, correction * 1.3)))
          : normalize(add(tangent, scale(dirToTarget, correction)));
      const pursuitBoost = Math.abs(radialError) > orbitBand * 2 ? 0.88 : Math.abs(radialError) > orbitBand ? 0.78 : 0.68;
      const orbitSpeed = clamp(maxSpeed * pursuitBoost, 72, maxSpeed * 0.9);
      desiredVelocity = scale(orbitDirection, orbitSpeed);
      desiredFacing = Math.atan2(orbitDirection.y, orbitDirection.x);
    }
  }

  desiredVelocity = applyTerrainNavigationInfluence(
    world,
    player.position,
    desiredVelocity,
    maxSpeed,
    bodyRadius,
    dt,
    terrainBias
  );

  if (length(desiredVelocity) > 1) {
    const angleStep = Math.min(1, derived.turnSpeed * dt * 0.9);
    player.rotation = lerpAngle(player.rotation, desiredFacing, angleStep);
    const alignmentFactor = Math.max(
      0.3,
      1 - Math.abs(shortestAngleDiff(player.rotation, desiredFacing)) / Math.PI
    );
    player.velocity = desiredVelocityControl(
      player.velocity,
      desiredVelocity,
      derived.acceleration * alignmentFactor,
      dt
    );
  } else {
    player.velocity = desiredVelocityControl(player.velocity, { x: 0, y: 0 }, derived.acceleration * 0.75, dt);
  }

  if (world.boundary.forcedFacing !== null) {
    const forcedAngleStep = Math.min(1, dt * world.boundary.forcedTurnRate);
    player.rotation = lerpAngle(player.rotation, world.boundary.forcedFacing, forcedAngleStep);
  }

  const navDamping = nav.mode === "orbit" ? 0.18 : nav.mode === "keep_range" ? 0.22 : 0.28;
  player.velocity = scale(player.velocity, 1 - Math.min(0.45, dt * navDamping));
  player.velocity = clampMagnitude(player.velocity, nav.mode === "align" ? maxSpeed * 0.9 : maxSpeed);
  player.position = add(player.position, scale(player.velocity, dt));
  {
    const collision = resolveAsteroidCollisions(world, player.position, player.velocity, bodyRadius);
    player.position = collision.position;
    player.velocity = collision.velocity;
  }
  applyPlayerBoundaryBehavior(world, dt);

  if (nav.mode === "idle") {
    player.velocity = scale(player.velocity, 1 - Math.min(0.65, dt * 1.25));
  }
}

function resolveModuleTarget(world: GameWorld, requiresTarget: SpaceObjectType[] | undefined) {
  if (!requiresTarget) return null;
  const target = world.activeTarget;
  if (target && requiresTarget.includes(target.type)) {
    const info = getObjectInfo(world, target);
    if (info) return target;
  }
  if (requiresTarget.includes("enemy")) {
    const lockedEnemy = world.lockedTargets.find((entry) => entry.type === "enemy" && Boolean(getObjectInfo(world, entry)));
    if (lockedEnemy) return lockedEnemy;
  }
  return null;
}

function runPlayerModules(world: GameWorld, dt: number) {
  const sector = getCurrentSector(world);
  const player = world.player;
  const derived = getCachedDerivedStats(player);
  const difficulty = getDifficultyModifiers(world);
  const combatPressure = getCombatPressureModifiers();

  if (player.buildSwap.active) {
    (["weapon", "utility", "defense"] as ModuleSlot[]).forEach((slotType) => {
      player.modules[slotType].forEach((runtime) => {
        runtime.active = false;
        runtime.cycleRemaining = 0;
      });
    });
    return;
  }

  (["weapon", "utility", "defense"] as ModuleSlot[]).forEach((slotType) => {
    player.modules[slotType].forEach((runtime) => {
      if (!runtime.moduleId) return;
      const module = moduleById[runtime.moduleId];
      if (!module || module.activation === "passive") return;

      if (runtime.cycleRemaining > 0) {
        runtime.cycleRemaining = Math.max(0, runtime.cycleRemaining - dt);
      }

      if (!runtime.active) return;

      if (module.capacitorDrain && hasCapacitor(player, module.capacitorDrain * dt)) {
        spendCapacitor(player, module.capacitorDrain * dt);
      } else if (module.capacitorDrain) {
        runtime.active = false;
        return;
      }

      let target = resolveModuleTarget(world, module.requiresTarget);
      if ((!target || target.type !== "asteroid") && module.kind === "mining_laser" && module.autoMine) {
        const autoTarget = findAutoMiningTarget(world, module);
        if (autoTarget) target = { id: autoTarget.id, type: "asteroid" };
      }
      if ((!target || target.type !== "wreck") && module.kind === "salvager" && module.autoSalvage) {
        const autoTarget = findAutoSalvageTarget(world, module.range);
        if (autoTarget) target = { id: autoTarget.id, type: "wreck" };
      }
      const targetPosition = target ? getObjectPosition(world, target) : null;
      const targetDistance = targetPosition ? distance(player.position, targetPosition) : 0;
      const inRange = !module.range || (targetPosition && targetDistance <= module.range);

      if (module.kind === "mining_laser" && !target) {
        runtime.active = false;
        runtime.cycleRemaining = 0;
        return;
      }
      if (module.kind === "mining_laser" && !inRange) {
        return;
      }
      if (module.kind === "salvager" && (!target || !inRange)) {
        return;
      }
      if ((module.kind === "laser" || module.kind === "railgun" || module.kind === "missile") && (!target || !inRange)) {
        return;
      }

      if (runtime.cycleRemaining > 0) return;
      const capUse = module.capacitorUse ?? 0;
      if (capUse > 0 && !hasCapacitor(player, capUse)) {
        runtime.active = false;
        return;
      }

      if (capUse > 0) {
        spendCapacitor(player, capUse);
      }

      if (module.kind === "laser" || module.kind === "railgun" || module.kind === "missile") {
        const direction = targetPosition ? normalize(subtract(targetPosition, player.position)) : fromAngle(player.rotation);
        let appliedDamage = (module.damage ?? 0) * getWeaponDamageMultiplier(module.kind, derived);
        let quality: "miss" | "grazing" | "solid" | "excellent" | undefined;
        if (target?.type === "enemy") {
          const enemy = sector.enemies.find((entry) => entry.id === target.id);
          if (enemy && module.kind !== "missile") {
            const adjustedModule = getTurretAdjustedModule(
              module,
              derived,
              player.effects.turretTrackingMultiplier * combatPressure.playerTrackingMultiplier
            );
            const application = computeTurretApplication(
              player.position,
              player.velocity,
              enemy.position,
              enemy.velocity,
              adjustedModule,
              enemyVariantById[enemy.variantId].signatureRadius * enemy.effects.signatureMultiplier
            );
            appliedDamage = application.damage * difficulty.playerDamageMultiplier * combatPressure.playerDamageMultiplier;
            quality = application.quality;
          } else if (module.kind === "missile") {
            appliedDamage =
              (module.damage ?? 0) *
              getRangePenalty(targetDistance, module.optimal, module.falloff) *
              difficulty.playerDamageMultiplier *
              combatPressure.playerDamageMultiplier;
            quality = appliedDamage > (module.damage ?? 0) * 0.8 ? "solid" : "grazing";
          }
          if (enemy) {
            const appliedTotal = applyDamageToTarget(
              enemy,
              createDamagePacket(module.damageProfile, appliedDamage),
              getEnemyLayerResists(enemy.id, world)
            );
            if (appliedTotal > 0.01) {
              aggroEnemyToPlayer(world, enemy.id);
              enemy.pursuitTimer = Math.max(enemy.pursuitTimer, 8);
            }
            showHitText(world, enemy.position, appliedTotal, quality, "player");
          }
        }
        sector.projectiles.push(
          createProjectile(
            "player",
            module.id,
            add(player.position, scale(direction, 18)),
            scale(direction, module.kind === "missile" ? 280 : 420),
            0,
            target,
            targetPosition ? { ...targetPosition } : null,
            quality
          )
        );
      } else if (module.kind === "mining_laser" && target?.type === "asteroid") {
        const asteroid = sector.asteroids.find((entry) => entry.id === target.id);
        if (!asteroid) return;
        const freeSpace = derived.cargoCapacity - getCargoUsed(player);
        if (freeSpace > 0 && asteroid.oreRemaining > 0) {
          const sectorDef = getCurrentSectorDef(world);
          const sourceField =
            sectorDef.asteroidFields.find((field) => field.beltId === asteroid.beltId) ??
            sectorDef.asteroidFields.find(
              (field) => distance(field.center, asteroid.position) <= Math.max(field.spread + 80, 180)
            );
          const miningRange = module.range ?? 0;
          const eligibleAsteroids = module.minesAllInRange
            ? sector.asteroids
                .filter(
                  (entry) =>
                    distance(player.position, entry.position) <= miningRange &&
                    entry.oreRemaining > 0 &&
                    canMineResource(module, entry.resource)
                )
                .sort((a, b) => distance(player.position, a.position) - distance(player.position, b.position))
            : canMineResource(module, asteroid.resource)
              ? [asteroid]
              : [];

          let remainingSpace = freeSpace;
          let totalMined = 0;
          eligibleAsteroids.forEach((entry) => {
            if (remainingSpace <= 0 || entry.oreRemaining <= 0) return;
            const tierBonus = getMiningYieldMultiplier(module, entry.resource);
            const mined = Math.min(
              Math.max(
                1,
                Math.round(
                  (module.miningAmount ?? 0) *
                    derived.miningYieldMultiplier *
                    (module.miningYieldMultiplier ?? 1) *
                    tierBonus
                )
              ),
              entry.oreRemaining,
              remainingSpace
            );
            if (mined <= 0) return;
            entry.oreRemaining -= mined;
            player.cargo[entry.resource] += mined;
            remainingSpace -= mined;
            totalMined += mined;
            addFloatingText(world, entry.position, `+${mined} ${entry.resource}`, "#9fe3b6");
            emitMiningYield(world, entry.position, entry.resource);
            missionCatalog
              .filter((mission) => mission.type === "mining" && mission.targetResource === entry.resource)
              .forEach((mission) => advanceMission(world, mission.id, mined));
            const activeProcedural = getActiveProceduralContract(world);
            const activeProceduralState = getActiveProceduralState(world);
            if (
              activeProcedural?.type === "mining" &&
              activeProceduralState?.status === "active" &&
              activeProcedural.targetResource === entry.resource &&
              activeProcedural.targetSystemId === world.currentSectorId
            ) {
              activeProceduralState.progress += mined;
              if ((activeProcedural.targetCount ?? 0) > 0 && activeProceduralState.progress >= (activeProcedural.targetCount ?? 0)) {
                activeProceduralState.status = "readyToTurnIn";
                pushStory(world, `${activeProcedural.title} is ready to turn in.`);
              }
            }
          });
          if (totalMined === 0) return;
          maybeTriggerMiningSpawn(
            world,
            asteroid.beltId,
            asteroid.position,
            sourceField?.hostileSpawnVariantIds
          );
          awardPilotLicenseProgress(world, totalMined * 0.35);
        }
      } else if (module.kind === "salvager" && target?.type === "wreck") {
        const wreck = sector.wrecks.find((entry) => entry.id === target.id);
        if (!wreck) return;
        const freeSpace = derived.cargoCapacity - getCargoUsed(player);
        const resourceEntries = Object.entries(wreck.resources).filter(([, amount]) => (amount ?? 0) > 0) as Array<
          [keyof typeof wreck.resources, number]
        >;
        if (!wreck.commodities) {
          wreck.commodities = {};
        }
        const commodityEntries = Object.entries(wreck.commodities).filter(([, amount]) => (amount ?? 0) > 0) as Array<
          [CommodityId, number]
        >;
        if (wreck.credits <= 0 && resourceEntries.length === 0 && commodityEntries.length === 0 && !wreck.shipId) {
          sector.wrecks = sector.wrecks.filter((entry) => entry.id !== wreck.id);
          return;
        }
        const salvageScore =
          (wreck.shipId ? 3 : 0) +
          wreck.modules.length * 1.5 +
          Math.max(0, Math.round(wreck.credits / 120)) +
          resourceEntries.reduce((total, [, amount]) => total + Math.max(0, amount), 0) +
          commodityEntries.reduce((total, [, amount]) => total + Math.max(0, amount), 0);
        let transferredAny = false;
        if (wreck.shipId) {
          if (!player.ownedShips.includes(wreck.shipId)) {
            player.ownedShips.push(wreck.shipId);
            const recoveredShip = playerShipById[wreck.shipId];
            addFloatingText(world, wreck.position, `+${recoveredShip?.name ?? "ship"} recovered`, "#9fe3b6");
            pushStory(world, `Recovered lost hull: ${recoveredShip?.name ?? wreck.shipId}.`);
            transferredAny = true;
          }
          wreck.shipId = undefined;
        }
        if (wreck.credits > 0) {
          player.credits += wreck.credits;
          addFloatingText(world, wreck.position, `+${wreck.credits}cr`, "#9fe3b6");
          wreck.credits = 0;
          transferredAny = true;
        }
        if (wreck.modules.length > 0) {
          wreck.modules.forEach((moduleId) => {
            player.inventory.modules[moduleId] = (player.inventory.modules[moduleId] ?? 0) + 1;
          });
          addFloatingText(world, wreck.position, `+${wreck.modules.length} modules`, "#9fe3b6");
          wreck.modules = [];
          transferredAny = true;
        }
        if (freeSpace > 0) {
          let remainingSpace = freeSpace;
          resourceEntries.forEach(([resource, amount]) => {
            if (remainingSpace <= 0 || amount <= 0) return;
            const moved = Math.min(amount, remainingSpace);
            if (moved <= 0) return;
            player.cargo[resource] += moved;
            wreck.resources[resource] = amount - moved;
            remainingSpace -= moved;
            transferredAny = true;
            addFloatingText(world, wreck.position, `+${moved} ${resource}`, "#9fe3b6");
          });
          commodityEntries.forEach(([commodityId, amount]) => {
            if (remainingSpace <= 0 || amount <= 0) return;
            const commodity = commodityById[commodityId];
            if (!commodity) return;
            const maxMove = Math.floor(remainingSpace / commodity.volume);
            const moved = Math.min(amount, maxMove);
            if (moved <= 0) return;
            player.commodities[commodityId] = (player.commodities[commodityId] ?? 0) + moved;
            wreck.commodities[commodityId] = amount - moved;
            remainingSpace -= moved * commodity.volume;
            transferredAny = true;
            addFloatingText(world, wreck.position, `+${moved} ${commodity.name}`, "#9fe3b6");
          });
        }
        if (!transferredAny) {
          addFloatingText(world, wreck.position, "cargo full", "#ffd078");
        }
        if (
          wreck.credits <= 0 &&
          wreck.modules.length === 0 &&
          !wreck.shipId &&
          Object.values(wreck.resources).every((amount) => (amount ?? 0) <= 0) &&
          Object.values(wreck.commodities ?? {}).every((amount) => (amount ?? 0) <= 0)
        ) {
          sector.wrecks = sector.wrecks.filter((entry) => entry.id !== wreck.id);
        }
        if (transferredAny && (module.salvageYieldMultiplier ?? 1) > 1) {
          const salvageBonus = Math.max(1, Math.round(salvageScore * ((module.salvageYieldMultiplier ?? 1) - 1)));
          player.commodities["salvage-scrap"] = (player.commodities["salvage-scrap"] ?? 0) + salvageBonus;
          addFloatingText(world, wreck.position, `+${salvageBonus} salvage`, "#9fe3b6");
          transferredAny = true;
        }
      } else if (module.kind === "shield_booster") {
        player.shield = clamp(
          player.shield + Math.round((module.repairAmount ?? 0) * derived.shieldRepairAmountMultiplier),
          0,
          derived.maxShield
        );
        emitRepairPulse(world, player.position, "shield");
      } else if (module.kind === "armor_repairer") {
        player.armor = clamp(
          player.armor + Math.round((module.repairAmount ?? 0) * derived.armorRepairAmountMultiplier),
          0,
          derived.maxArmor
        );
        emitRepairPulse(world, player.position, "armor");
      } else if (module.kind === "energy_neutralizer" && target?.type === "enemy") {
        const enemy = sector.enemies.find((entry) => entry.id === target.id);
        if (!enemy) return;
        const drained = Math.min(enemy.capacitor, module.capacitorNeutralizeAmount ?? 0);
        if (drained > 0) {
          enemy.capacitor = Math.max(0, enemy.capacitor - drained);
          addFloatingText(world, enemy.position, `-${Math.round(drained)} cap`, "#8fe7ff");
        }
      }

      runtime.cycleRemaining = (module.cycleTime ?? 0) * getWeaponCycleMultiplier(module.kind, derived);
    });
  });
}

function updateEnemyNavigation(world: GameWorld, enemyId: string, dt: number) {
  const sector = getCurrentSector(world);
  const enemy = sector.enemies.find((item) => item.id === enemyId);
  if (!enemy) return;
  const variant = enemyVariantById[enemy.variantId];
  const archetype = getEnemyArchetypeDefinition(variant.archetype);
  const nav = enemy.navigation;
  if (!nav.target) {
    if (enemy.patrolBehavior === "stationary") {
      enemy.velocity = desiredVelocityControl(enemy.velocity, { x: 0, y: 0 }, variant.speed * 0.5, dt);
      enemy.position.x = clamp(enemy.position.x, 30, getCurrentSectorDef(world).width - 30);
      enemy.position.y = clamp(enemy.position.y, 30, getCurrentSectorDef(world).height - 30);
      return;
    }
    if (!enemy.patrolTarget || distance(enemy.position, enemy.patrolTarget) <= 60) {
      pickNextEnemyPatrolTarget(world, enemy);
    }
  }
  const targetPosition = nav.target ? getObjectPosition(world, nav.target) : enemy.patrolTarget ?? enemy.patrolAnchor;
  if (!targetPosition) return;
  const effectiveSpeed = variant.speed * enemy.effects.speedMultiplier * (archetype?.speedMultiplier ?? 1);
  const toTarget = subtract(targetPosition, enemy.position);
  const currentDistance = length(toTarget);
  const dirToTarget = currentDistance > 0 ? normalize(toTarget) : { x: 1, y: 0 };
  const tangent = { x: -dirToTarget.y, y: dirToTarget.x };
  const orbitDirection = getEnemyOrbitDirection(enemy.id);
  const orbitBias = getEnemyManeuverBias(enemy.id);
  const desiredRange = nav.desiredRange > 0 ? nav.desiredRange : getEnemyPreferredRange(enemy.variantId);
  let desiredVelocity = { x: 0, y: 0 };
  let desiredFacing = enemy.rotation;

  if (!nav.target) {
    desiredVelocity = scale(dirToTarget, clamp(currentDistance * 0.36, 20, effectiveSpeed * 0.42));
    desiredFacing = Math.atan2(dirToTarget.y, dirToTarget.x);
  } else if (nav.mode === "approach") {
    const stopBand = Math.max(18, desiredRange + 14);
    if (currentDistance <= stopBand) {
      desiredVelocity = scale(enemy.velocity, 0.9);
    } else {
      const desiredSpeed = clamp((currentDistance - desiredRange) * 0.68, 28, effectiveSpeed * 0.88);
      desiredVelocity = scale(dirToTarget, desiredSpeed);
    }
    desiredFacing = Math.atan2(dirToTarget.y, dirToTarget.x);
  } else if (nav.mode === "keep_range") {
    const band = Math.max(26, desiredRange * 0.08);
    if (currentDistance > desiredRange + band) {
      const desiredSpeed = clamp((currentDistance - desiredRange) * 0.58, 26, effectiveSpeed * 0.66);
      desiredVelocity = scale(dirToTarget, desiredSpeed);
      desiredFacing = Math.atan2(dirToTarget.y, dirToTarget.x);
    } else if (currentDistance < desiredRange - band) {
      const desiredSpeed = clamp((desiredRange - currentDistance) * 0.64, 26, effectiveSpeed * 0.56);
      desiredVelocity = scale(dirToTarget, -desiredSpeed);
      desiredFacing = Math.atan2(-dirToTarget.y, -dirToTarget.x);
    } else {
      const drift = normalize(add(scale(tangent, orbitDirection * orbitBias), scale(dirToTarget, 0.08)));
      desiredVelocity = scale(drift, clamp(effectiveSpeed * 0.42, 36, effectiveSpeed * 0.54));
      desiredFacing = Math.atan2(drift.y, drift.x);
    }
  } else if (nav.mode === "retreat") {
    const withdrawal = normalize(add(scale(dirToTarget, -1), scale(tangent, orbitDirection * 0.24 * orbitBias)));
    desiredVelocity = scale(withdrawal, clamp(effectiveSpeed * 0.72, 56, effectiveSpeed * 0.96));
    desiredFacing = Math.atan2(withdrawal.y, withdrawal.x);
  } else if (nav.mode === "orbit") {
    const orbitBand = Math.max(18, desiredRange * 0.06);
    const correction = clamp((currentDistance - desiredRange) * 0.018, -0.5, 0.5);
    const orbitVector =
      Math.abs(currentDistance - desiredRange) > orbitBand * 2
        ? normalize(add(scale(tangent, orbitDirection * orbitBias), scale(dirToTarget, correction * 1.4)))
        : normalize(add(scale(tangent, orbitDirection * orbitBias), scale(dirToTarget, correction)));
    const orbitSpeedScale = archetype?.id === "swarm" ? 0.68 : archetype?.id === "hunter" ? 0.54 : 0.4;
    desiredVelocity = scale(orbitVector, clamp(effectiveSpeed * orbitSpeedScale, 40, effectiveSpeed * 0.66));
    desiredFacing = Math.atan2(orbitVector.y, orbitVector.x);
  } else {
    desiredVelocity = scale(dirToTarget, clamp(currentDistance * 0.3, 18, effectiveSpeed * 0.36));
    desiredFacing = Math.atan2(dirToTarget.y, dirToTarget.x);
  }

  const terrainBias =
    archetype?.id === "swarm" ? 1.12 :
    archetype?.id === "interceptor" || archetype?.id === "hunter" ? 1.04 :
    archetype?.id === "siege_sniper" || archetype?.id === "artillery" ? 0.82 :
    archetype?.id === "heavy_bruiser" ? 0.92 :
    archetype?.id === "support_frigate" ? 0.96 :
    1;
  desiredVelocity = applyTerrainNavigationInfluence(
    world,
    enemy.position,
    desiredVelocity,
    effectiveSpeed,
    Math.max(12, variant.signatureRadius * 0.42),
    dt,
    terrainBias
  );

  if (length(desiredVelocity) > 1) {
    const angleStep = Math.min(1, variant.turnSpeed * dt * 0.95);
    enemy.rotation = lerpAngle(enemy.rotation, desiredFacing, angleStep);
    const alignmentFactor = Math.max(0.32, 1 - Math.abs(shortestAngleDiff(enemy.rotation, desiredFacing)) / Math.PI);
    enemy.velocity = desiredVelocityControl(enemy.velocity, desiredVelocity, effectiveSpeed * alignmentFactor, dt);
  } else {
    enemy.velocity = desiredVelocityControl(enemy.velocity, { x: 0, y: 0 }, effectiveSpeed * 0.72, dt);
  }
  enemy.velocity = clampMagnitude(enemy.velocity, effectiveSpeed);
  enemy.position = add(enemy.position, scale(enemy.velocity, dt));
  {
    const collision = resolveAsteroidCollisions(world, enemy.position, enemy.velocity, Math.max(12, variant.signatureRadius * 0.42));
    enemy.position = collision.position;
    enemy.velocity = collision.velocity;
  }
  const boundary = applyEnemyBoundaryContainment(world, enemy.position, enemy.velocity, dt);
  enemy.position = boundary.position;
  enemy.velocity = boundary.velocity;
}

function runEnemyModules(world: GameWorld, dt: number) {
  const sector = getCurrentSector(world);
  const difficulty = getDifficultyModifiers(world);
  const combatPressure = getCombatPressureModifiers();
  sector.enemies.forEach((enemy) => {
    const variant = enemyVariantById[enemy.variantId];
    enemy.recentDamageTimer = Math.max(0, enemy.recentDamageTimer - dt);
    enemy.pursuitTimer = Math.max(0, enemy.pursuitTimer - dt);
    enemy.shield = clamp(enemy.shield + 2.5 * (enemy.recentDamageTimer > 0 ? 0.03 : 0.18) * dt, 0, variant.shield);
    enemy.capacitor = clamp(enemy.capacitor + variant.capacitorRegen * 0.6 * dt, 0, variant.capacitor);

    const playerRef: SelectableRef = { id: "player", type: "enemy" };
    const playerDistance = distance(enemy.position, world.player.position);
    const detectionRange = variant.lockRange * enemy.effects.lockRangeMultiplier * combatPressure.enemyDetectionMultiplier;
    const pursuitRange = Math.max(
      detectionRange * 1.95,
      getEnemyPreferredRange(enemy.variantId) * 2.2 * combatPressure.enemyDetectionMultiplier
    );
    const seesPlayer = playerDistance <= detectionRange || (enemy.pursuitTimer > 0 && playerDistance <= pursuitRange);
    const retreating = seesPlayer && shouldEnemyRetreat(enemy, variant, playerDistance);
    if (seesPlayer) {
      enemy.activeTarget = playerRef;
      enemy.navigation.target = playerRef;
      enemy.pursuitTimer = Math.max(enemy.pursuitTimer, 3.5);
    } else if (enemy.pursuitTimer <= 0) {
      enemy.activeTarget = null;
      enemy.navigation.target = null;
    }
    enemy.navigation.mode = seesPlayer
      ? retreating
        ? "retreat"
        : playerDistance > getEnemyPreferredRange(enemy.variantId)
          ? "approach"
          : getEnemyCombatMode(enemy.variantId)
      : "approach";
    enemy.navigation.desiredRange = seesPlayer
      ? retreating
        ? Math.min(variant.lockRange * 0.9, Math.max(getEnemyPreferredRange(enemy.variantId) * 2.1, getEnemyPreferredRange(enemy.variantId) + 180))
        : getEnemyPreferredRange(enemy.variantId)
      : 0;
    updateEnemyNavigation(world, enemy.id, dt);

    enemy.modules.forEach((runtime) => {
      if (!runtime.moduleId) return;
      const module = moduleById[runtime.moduleId];
      if (!module) return;
      if (runtime.cycleRemaining > 0) {
        runtime.cycleRemaining = Math.max(0, runtime.cycleRemaining - dt);
      }
      if (!runtime.active || !seesPlayer) return;
      if (module.capacitorDrain) {
        const drainAmount = module.capacitorDrain * dt;
        if (enemy.capacitor < drainAmount) return;
        enemy.capacitor -= drainAmount;
      }
      if (runtime.cycleRemaining > 0) return;
      if ((module.capacitorUse ?? 0) > enemy.capacitor) return;
      if (module.range && playerDistance > module.range) return;

      enemy.capacitor -= module.capacitorUse ?? 0;

      if (module.kind === "laser" || module.kind === "railgun" || module.kind === "missile") {
        const direction = normalize(subtract(world.player.position, enemy.position));
        let appliedDamage = module.damage ?? 0;
        let quality: "miss" | "grazing" | "solid" | "excellent" | undefined;
        if (module.kind !== "missile") {
          const application = computeTurretApplication(
            enemy.position,
            enemy.velocity,
            world.player.position,
            world.player.velocity,
            {
              ...module,
              tracking: (module.tracking ?? 0) * enemy.effects.turretTrackingMultiplier * combatPressure.enemyTrackingMultiplier
            },
            playerShipById[world.player.hullId].signatureRadius * world.player.effects.signatureMultiplier
          );
          appliedDamage = application.damage * difficulty.enemyDamageMultiplier * combatPressure.enemyDamageMultiplier;
          quality = application.quality;
        } else {
          appliedDamage =
            (module.damage ?? 0) *
            getRangePenalty(playerDistance, module.optimal, module.falloff) *
            difficulty.enemyDamageMultiplier *
            combatPressure.enemyDamageMultiplier;
          quality = appliedDamage > (module.damage ?? 0) * 0.8 ? "solid" : "grazing";
        }
        const appliedTotal = applyDamageToTarget(
          world.player,
          createDamagePacket(module.damageProfile, appliedDamage),
          getPlayerLayerResists(world)
        );
        showHitText(world, world.player.position, appliedTotal, quality, "enemy");
        sector.projectiles.push(
          createProjectile(
            "enemy",
            module.id,
            add(enemy.position, scale(direction, 14)),
            scale(direction, module.kind === "missile" ? 260 : 360),
            0,
            { id: "player", type: "enemy" },
            { ...world.player.position },
            quality
          )
        );
      } else if (module.kind === "shield_booster") {
        enemy.shield = clamp(enemy.shield + (module.repairAmount ?? 0), 0, variant.shield);
      } else if (module.kind === "armor_repairer") {
        enemy.armor = clamp(enemy.armor + (module.repairAmount ?? 0), 0, variant.armor);
      } else if (module.kind === "energy_neutralizer") {
        const drained = Math.min(world.player.capacitor, module.capacitorNeutralizeAmount ?? 0);
        if (drained > 0) {
          world.player.capacitor = Math.max(0, world.player.capacitor - drained);
          addFloatingText(world, world.player.position, `-${Math.round(drained)} cap`, "#8fe7ff");
        }
      }

      runtime.cycleRemaining = module.cycleTime ?? 0;
    });
  });
}

function updateProjectiles(world: GameWorld, dt: number) {
  const sector = getCurrentSector(world);
  const nextProjectiles: typeof sector.projectiles = [];

  sector.projectiles.forEach((projectile) => {
    projectile.ttl -= dt;
    if (projectile.target) {
      const targetPos = getObjectPosition(world, projectile.target);
      if (targetPos && projectile.moduleId.includes("missile")) {
        const desired = scale(normalize(subtract(targetPos, projectile.position)), 300);
        projectile.velocity.x += (desired.x - projectile.velocity.x) * dt * 1.5;
        projectile.velocity.y += (desired.y - projectile.velocity.y) * dt * 1.5;
      }
      if (targetPos) {
        projectile.impactPosition = { ...targetPos };
      }
    }
    projectile.position = add(projectile.position, scale(projectile.velocity, dt));

    if (projectile.damage <= 0 && projectile.impactPosition) {
      const impactDistance = distance(projectile.position, projectile.impactPosition);
      if (impactDistance <= Math.max(10, projectile.radius + 10) || projectile.ttl <= 0) {
        const impactColor =
          projectile.moduleId.includes("missile")
            ? "#ffb265"
            : projectile.owner === "player"
              ? "#6feeff"
              : "#ff846f";
        emitImpact(world, projectile.impactPosition, impactColor, projectile.moduleId);
        return;
      }
    }

    const asteroidHit = sector.asteroids.find(
      (asteroid) => distance(projectile.position, asteroid.position) <= projectile.radius + asteroid.radius
    );
    if (asteroidHit) {
      emitImpact(world, projectile.position, "#b7b0a6", projectile.moduleId);
      return;
    }

    if (projectile.damage <= 0) {
      if (projectile.ttl > 0) {
        nextProjectiles.push(projectile);
      }
      return;
    }

    let consumed = false;
    if (projectile.owner === "player") {
      for (const enemy of sector.enemies) {
        if (distance(projectile.position, enemy.position) <= projectile.radius + 18) {
          const module = moduleById[projectile.moduleId];
          const shieldBefore = enemy.shield;
          const armorBefore = enemy.armor;
          const hullBefore = enemy.hull;
          const appliedTotal = applyDamageToTarget(
            enemy,
            createDamagePacket(module?.damageProfile, projectile.damage),
            getEnemyLayerResists(enemy.id, world)
          );
          if (appliedTotal > 0.01) {
            aggroEnemyToPlayer(world, enemy.id);
            enemy.pursuitTimer = Math.max(enemy.pursuitTimer, 8);
          }
          addFloatingText(
            world,
            enemy.position,
            projectile.damage < 1
              ? "miss"
              : `${projectile.qualityLabel ?? "hit"} ${Math.round(projectile.damage)}`,
            projectile.damage < 1 ? "#c4d1e8" : projectile.qualityLabel === "excellent" ? "#ffe08a" : "#ffd078"
          );
          if (projectile.damage >= 1) {
            // Snap impact to enemy center so it clearly lands on the ship
            const impactPos = enemy.position;
            const impactColor = projectile.moduleId.includes("missile") ? "#ffb265" : "#6feeff";
            emitImpact(world, impactPos, impactColor, projectile.moduleId);
            // Layer-specific hit sparks (mirrors player hit feedback)
            const hullDamaged = hullBefore > enemy.hull;
            const armorDamaged = armorBefore > enemy.armor;
            const shieldDamaged = shieldBefore > enemy.shield;
            if (hullDamaged) {
              emitHullHit(world, impactPos);
              sector.cameraShake = Math.min(8, (sector.cameraShake ?? 0) + 2.5 + projectile.damage * 0.03);
            } else if (armorDamaged) {
              emitArmorHit(world, impactPos);
              sector.cameraShake = Math.min(5, (sector.cameraShake ?? 0) + 1.2 + projectile.damage * 0.015);
            } else if (shieldDamaged) {
              emitShieldHit(world, impactPos);
              sector.cameraShake = Math.min(2.5, (sector.cameraShake ?? 0) + 0.5 + projectile.damage * 0.008);
            }
          }
          consumed = true;
          break;
        }
      }
    } else if (distance(projectile.position, world.player.position) <= projectile.radius + 18) {
      const module = moduleById[projectile.moduleId];
      const shieldBefore = world.player.shield;
      const armorBefore = world.player.armor;
      const hullBefore = world.player.hull;
      applyDamageToTarget(
        world.player,
        createDamagePacket(module?.damageProfile, projectile.damage),
        getPlayerLayerResists(world)
      );
      const enemySource = projectile.target?.type === "enemy"
        ? sector.enemies.find((entry) => entry.id === projectile.target?.id)
        : null;
      if (enemySource) {
        enemySource.pursuitTimer = Math.max(enemySource.pursuitTimer, 6);
      }
      addFloatingText(
        world,
        world.player.position,
        projectile.damage < 1 ? "miss" : `${projectile.qualityLabel ?? "hit"} ${Math.round(projectile.damage)}`,
        projectile.damage < 1 ? "#c4d1e8" : "#ff7d7d"
      );
      if (projectile.damage >= 1) {
        const hullDamaged = hullBefore > world.player.hull;
        const armorDamaged = armorBefore > world.player.armor;
        const shieldDamaged = shieldBefore > world.player.shield;
        const sector = world.sectors[world.currentSectorId];
        if (hullDamaged) {
          emitHullHit(world, projectile.position);
          sector.cameraShake = Math.min(10, (sector.cameraShake ?? 0) + 4 + projectile.damage * 0.04);
          sector.playerHitFlash = Math.max(sector.playerHitFlash ?? 0, 0.22);
        } else if (armorDamaged) {
          emitArmorHit(world, projectile.position);
          sector.cameraShake = Math.min(7, (sector.cameraShake ?? 0) + 2 + projectile.damage * 0.02);
          sector.playerHitFlash = Math.max(sector.playerHitFlash ?? 0, 0.14);
        } else if (shieldDamaged) {
          emitShieldHit(world, projectile.position);
          sector.cameraShake = Math.min(3.5, (sector.cameraShake ?? 0) + 0.8 + projectile.damage * 0.01);
          sector.playerHitFlash = Math.max(sector.playerHitFlash ?? 0, 0.06);
        }
      }
      consumed = true;
    }

    if (!consumed && projectile.ttl > 0) {
      nextProjectiles.push(projectile);
    }
  });

  sector.projectiles = nextProjectiles;
}

function applyAnomalyFields(world: GameWorld, dt: number) {
  const anomalies = getSystemDestinations(world.currentSectorId).filter(
    (entry) => entry.kind === "anomaly" && entry.anomalyField
  );
  if (anomalies.length === 0) return;
  const sector = getCurrentSector(world);
  const sectorDef = getCurrentSectorDef(world);

  const applyForce = (
    position: Vec2,
    velocity: Vec2,
    maxVelocity: number,
    bodyScale: number,
    canBeAffected = true
  ) => {
    if (!canBeAffected) return velocity;
    let nextVelocity = velocity;
    anomalies.forEach((anomaly) => {
      const field = anomaly.anomalyField;
      if (!field) return;
      const offset = subtract(position, anomaly.position);
      const dist = length(offset);
      if (dist <= 6 || dist > field.radius) return;
      const falloff = 1 - dist / field.radius;
      const dir = normalize(offset);
      const radial =
        field.effect === "push"
          ? dir
          : scale(dir, -1);
      const tangent =
        field.effect === "push"
          ? { x: -dir.y, y: dir.x }
          : { x: dir.y, y: -dir.x };
      const force = field.strength * falloff * dt * bodyScale;
      if (field.effect === "pull") {
        nextVelocity = add(nextVelocity, scale(radial, force));
        nextVelocity = add(nextVelocity, scale(tangent, force * 0.24));
      } else if (field.effect === "push") {
        nextVelocity = add(nextVelocity, scale(radial, force));
        nextVelocity = add(nextVelocity, scale(tangent, force * 0.16));
      } else if (field.effect === "drag") {
        nextVelocity = scale(nextVelocity, 1 - Math.min(0.32, falloff * 0.28 * bodyScale));
      } else if (field.effect === "ion") {
        nextVelocity = scale(nextVelocity, 1 - Math.min(0.2, falloff * 0.16 * bodyScale));
      } else if (field.effect === "slipstream") {
        nextVelocity = add(nextVelocity, scale(tangent, force * 0.22));
        nextVelocity = add(nextVelocity, scale(radial, force * 0.04));
      }
    });
    return clampMagnitude(nextVelocity, maxVelocity);
  };

  if (world.player.navigation.mode !== "warping" && world.player.navigation.mode !== "jumping") {
    const derived = getCachedDerivedStats(world.player);
    world.player.velocity = applyForce(world.player.position, world.player.velocity, derived.maxSpeed * 1.22, 0.42);
  }

  sector.enemies.forEach((enemy) => {
    if (enemy.navigation.mode === "warping" || enemy.navigation.mode === "jumping") return;
    const variant = enemyVariantById[enemy.variantId];
    enemy.velocity = applyForce(enemy.position, enemy.velocity, variant.speed * 1.2, 0.5);
    enemy.position.x = clamp(enemy.position.x, 30, sectorDef.width - 30);
    enemy.position.y = clamp(enemy.position.y, 30, sectorDef.height - 30);
  });

  sector.loot.forEach((drop) => {
    drop.velocity = applyForce(drop.position, drop.velocity, 160, 0.95);
  });
}

function cleanupWorld(world: GameWorld) {
  const sector = getCurrentSector(world);
  const survivors: typeof sector.enemies = [];

  sector.enemies.forEach((enemy) => {
    if (enemy.hull > 0) {
      survivors.push(enemy);
      return;
    }
    const variant = enemyVariantById[enemy.variantId];
    const bounty = Math.max(12, Math.round(variant.lootCredits * (0.55 + getCurrentSectorDef(world).danger * 0.12)));
    world.player.credits += bounty;
    awardPilotLicenseProgress(world, bounty / 55);
    addFloatingText(world, enemy.position, `+${bounty}cr bounty`, "#9fe3b6");
    emitExplosion(world, enemy.position, variant.color);
    const distToPlayer = distance(enemy.position, world.player.position);
    if (distToPlayer < 320) {
      const shakeStrength = 5 * Math.max(0, 1 - distToPlayer / 320);
      sector.cameraShake = Math.min(10, (sector.cameraShake ?? 0) + shakeStrength);
    }
    raiseSectorChallenge(
      world,
      world.currentSectorId,
      0.12 +
        variant.threatLevel * 0.035 +
        (variant.elite ? 0.22 : 0) +
        (enemy.boss ? 0.36 : 0),
      variant.name
    );
    sector.wrecks.push({
      id: `wreck-${Date.now()}-${enemy.id}`,
      position: { ...enemy.position },
      credits: Math.max(0, Math.round(variant.lootCredits * 0.35)),
      resources: { ...variant.lootTable },
      commodities: {
        "salvage-scrap": 1 + Math.floor(Math.random() * 3),
        "weapons-components": Math.random() > 0.72 ? 1 : 0,
        ...rollProceduralLoot(world, variant.id)
      },
      sourceName: variant.name,
      modules: []
    });
    if (enemy.boss && enemy.bossMissionId) {
      const mission = missionById[enemy.bossMissionId];
      const state = world.missions[enemy.bossMissionId];
      if (mission && state && state.status === "active") {
        state.bossDefeated = true;
        state.progress = Math.max(state.progress, mission.targetCount ?? 1);
        state.status = "readyToTurnIn";
        pushStory(world, `${mission.title}: ${variant.name} has been destroyed.`);
      }
    }
    missionCatalog
      .filter(
        (mission) =>
          mission.type === "bounty" &&
          (!mission.enemyVariantIds || mission.enemyVariantIds.includes(variant.id)) &&
          (!mission.targetSystemId || mission.targetSystemId === world.currentSectorId)
      )
      .forEach((mission) => advanceMission(world, mission.id, 1));
    const activeProcedural = getActiveProceduralContract(world);
    const activeProceduralState = getActiveProceduralState(world);
    if (
      activeProcedural?.type === "bounty" &&
      activeProceduralState?.status === "active" &&
      activeProcedural.targetSystemId === world.currentSectorId &&
      (!activeProcedural.enemyVariantIds?.length || activeProcedural.enemyVariantIds.includes(variant.id))
    ) {
      activeProceduralState.progress += 1;
      if ((activeProcedural.targetCount ?? 0) > 0 && activeProceduralState.progress >= (activeProcedural.targetCount ?? 0)) {
        activeProceduralState.status = "readyToTurnIn";
        pushStory(world, `${activeProcedural.title} is ready to turn in.`);
      }
    }
    unlockTarget(world, { id: enemy.id, type: "enemy" });
  });
  sector.enemies = survivors;
  sector.asteroids = sector.asteroids.filter((asteroid) => asteroid.oreRemaining > 0);

  sector.loot = sector.loot.filter((drop) => {
    if (distance(drop.position, world.player.position) <= 40) {
      world.player.credits += drop.credits;
      (Object.keys(drop.resources) as Array<keyof typeof drop.resources>).forEach((resource) => {
        const amount = drop.resources[resource] ?? 0;
        world.player.cargo[resource] += amount;
      });
      if (drop.commodities) {
        (Object.keys(drop.commodities) as CommodityId[]).forEach((commodityId) => {
          const amount = drop.commodities?.[commodityId] ?? 0;
          world.player.commodities[commodityId] = (world.player.commodities[commodityId] ?? 0) + amount;
        });
      }
      addFloatingText(world, drop.position, `+${drop.credits}cr`, "#9fe3b6");
      return false;
    }
    return true;
  });

  sector.floatingText = sector.floatingText
    .map((entry) => ({
      ...entry,
      position: add(entry.position, { x: 0, y: -0.4 }),
      ttl: entry.ttl - 0.016
    }))
    .filter((entry) => entry.ttl > 0);

  if (world.player.hull <= 0) {
    const PLAYER_DEATH_CREDIT_DROP_FRACTION = 0.7;
    const PLAYER_DEATH_FLAT_CREDIT_FEE = 200;
    const PLAYER_DEATH_LICENSE_PROGRESS_LOSS = 180;
    const deathPosition = { ...world.player.position };
    const playerHull = playerShipById[world.player.hullId];
    emitExplosion(world, deathPosition, playerHull?.color ?? "#d8ff9b");
    sector.cameraShake = 12;
    const droppedModules = [
      ...world.player.equipped.weapon,
      ...world.player.equipped.utility,
      ...world.player.equipped.defense
    ].filter((moduleId): moduleId is string => Boolean(moduleId));
    const droppedResources = { ...world.player.cargo };
    const droppedCommodities = { ...world.player.commodities };
    const droppedCredits = Math.floor(world.player.credits * PLAYER_DEATH_CREDIT_DROP_FRACTION);
    const lostLicenseProgress = reducePilotLicenseProgress(world, PLAYER_DEATH_LICENSE_PROGRESS_LOSS);
    sector.wrecks.push({
      id: `wreck-player-${Date.now()}`,
      position: deathPosition,
      credits: droppedCredits,
      resources: droppedResources,
      commodities: droppedCommodities,
      sourceName: "Player",
      shipId: world.player.hullId,
      modules: droppedModules
    });

    const starter = createStarterPlayerState(world.player.starterConfigId ?? defaultStarterShipConfigId);
    const preservedCredits = Math.max(0, world.player.credits - droppedCredits - PLAYER_DEATH_FLAT_CREDIT_FEE);
    const lostCredits = world.player.credits - preservedCredits;
    const preservedShips = world.player.hullId === starter.hullId
      ? Array.from(new Set([...world.player.ownedShips, starter.hullId]))
      : Array.from(new Set([...world.player.ownedShips.filter((shipId) => shipId !== world.player.hullId), starter.hullId]));
    const preservedInventory = { ...world.player.inventory.modules };
    const startSystemId = "lumen-rest";
    const startStation = getSystemStation(startSystemId);
    if (!startStation) return;
    const wreckSystemId = world.currentSectorId;
    const wreckSystem = sectorById[wreckSystemId];

    world.player.hullId = starter.hullId;
    world.player.ownedShips = preservedShips;
    world.player.position = { x: startStation.position.x + 140, y: startStation.position.y + 24 };
    world.player.velocity = { x: 0, y: 0 };
    world.player.rotation = starter.rotation;
    world.player.shield = starter.shield;
    world.player.armor = starter.armor;
    world.player.hull = starter.hull;
    world.player.capacitor = starter.capacitor;
    world.player.cargo = { ferrite: 0, "ember-crystal": 0, "ghost-alloy": 0 };
    world.player.commodities = {
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
    };
    world.player.credits = preservedCredits;
    world.player.missionCargo = [];
    world.player.inventory.modules = preservedInventory;
    world.player.equipped = starter.equipped;
    world.player.navigation = starter.navigation;
    world.player.queuedUndockActions = [];
    world.player.buildSwap = starter.buildSwap;
    world.player.recentDamageTimer = 0;
    world.player.deathSummary = {
      id: `death-${Date.now()}`,
      shipId: playerHull?.id ?? world.player.hullId,
      shipName: playerHull?.name ?? world.player.hullId,
      respawnStationId: startStation.id,
      respawnStationName: startStation.name,
      respawnSystemId: startSystemId,
      respawnSystemName: sectorById[startSystemId]?.name ?? startSystemId,
      wreckSystemId,
      wreckSystemName: wreckSystem?.name ?? wreckSystemId,
      wreckPosition: deathPosition,
      droppedCredits,
      flatFee: PLAYER_DEATH_FLAT_CREDIT_FEE,
      lostCredits,
      lostLicenseProgress
    };
    rebuildPlayerRuntime(world.player);

    world.currentSectorId = startSystemId;
    enterDestinationSite(world, startStation.id);
    world.dockedStationId = startStation.id;
    world.selectedObject = null;
    world.player.pendingLocks = [];
    world.lockedTargets = [];
    world.activeTarget = null;
    world.routePlan = null;

    pushStory(
      world,
      `Ship destroyed. You woke up back at Lumen Rest. Your wreck was left behind with your fit, cargo, and ${droppedCredits} credits for salvage recovery.${lostLicenseProgress > 0 ? ` Pilot license progress reduced by ${lostLicenseProgress}, but your level held.` : ""}`
    );
  }
}

function evaluateWorldInteractions(world: GameWorld) {
  const station = getCurrentStation(world);
  const currentMission = getActiveMission(world);

  getSystemBeacons(world.currentSectorId).forEach((beacon) => {
    if (distance(world.player.position, beacon.position) <= getCachedDerivedStats(world.player).interactionRange) {
      missionCatalog
        .filter((mission) => mission.targetDestinationId === beacon.id)
        .forEach((mission) => completeTravelMission(world, mission.id));
    }
  });

  if (
    currentMission?.type === "deliver" &&
    station &&
    currentMission.targetStationId === station.id &&
    world.dockedStationId === station.id &&
    currentMission.targetResource &&
    currentMission.targetCount &&
    world.player.cargo[currentMission.targetResource] >= currentMission.targetCount
  ) {
    world.missions[currentMission.id].status = "readyToTurnIn";
  }
}

function buildTransportTracker(world: GameWorld): TransportTracker | null {
  const mission = getActiveTransportMissionDefinition(world);
  if (!mission) return null;
  const state = world.transportMissions[mission.id];
  if (!state || state.status !== "active") return null;
  const objective = state.pickedUp ? "deliver" : "pickup";
  const objectiveSystemId = objective === "pickup" ? mission.pickupSystemId : mission.destinationSystemId;
  const objectiveStationId = objective === "pickup" ? mission.pickupStationId : mission.destinationStationId;
  const objectiveStation = getSystemDestination(objectiveSystemId, objectiveStationId);
  const pickupStation = getSystemDestination(mission.pickupSystemId, mission.pickupStationId);
  const destinationStation = getSystemDestination(mission.destinationSystemId, mission.destinationStationId);
  const currentRoute =
    world.routePlan && world.routePlan.destinationSystemId === objectiveSystemId
      ? world.routePlan
      : planRoute(world, world.currentSectorId, objectiveSystemId, mission.routePreference, false);
  const routeSteps = currentRoute?.steps ?? [];
  const nextStep = routeSteps.find((step) => step.fromSystemId === world.currentSectorId) ?? null;
  const routeSystemIds =
    routeSteps.length > 0
      ? [world.currentSectorId, ...routeSteps.map((step) => step.toSystemId)]
      : [world.currentSectorId];
  const dueInSec = state.dueAt !== null ? Math.max(0, Math.round(state.dueAt - world.elapsedTime)) : null;
  const cargoReimbursement = getTransportCargoReimbursement(mission);

  return {
    missionId: mission.id,
    title: mission.title,
    objective,
    objectiveText:
      objective === "pickup"
        ? `Pick up ${mission.cargoVolume}u ${mission.cargoType} at ${pickupStation?.name ?? mission.pickupStationId}`
        : `Deliver ${mission.cargoVolume}u ${mission.cargoType} to ${destinationStation?.name ?? mission.destinationStationId}`,
    objectiveSystemId,
    objectiveStationId,
    cargoType: mission.cargoType,
    cargoVolume: mission.cargoVolume,
    cargoOnboard: getMissionCargoOnboard(world, mission.id),
    pickupSystemId: mission.pickupSystemId,
    pickupStationName: pickupStation?.name ?? mission.pickupStationId,
    pickupSystemName: sectorById[mission.pickupSystemId]?.name ?? mission.pickupSystemId,
    destinationSystemId: mission.destinationSystemId,
    destinationStationName: destinationStation?.name ?? mission.destinationStationId,
    destinationSystemName: sectorById[mission.destinationSystemId]?.name ?? mission.destinationSystemId,
    jumpsRemaining: routeSteps.length,
    nextGateId: nextStep?.gateId ?? null,
    nextGateName: nextStep?.gateName ?? null,
    routeSystemIds,
    routeRisk: estimateRouteRisk(routeSteps),
    baseReward: mission.baseReward,
    bonusReward: mission.bonusReward ?? 0,
    cargoReimbursement,
    rewardEstimate: mission.baseReward + cargoReimbursement + (mission.bonusReward ?? 0),
    dueInSec,
    recommendedRoute: mission.routePreference
  };
}

function getPrompt(world: GameWorld) {
  const transport = buildTransportTracker(world);
  const procedural = getActiveProceduralContract(world);
  const proceduralState = getActiveProceduralState(world);
  const activeMission = getActiveMission(world);
  const activeMissionState = activeMission ? world.missions[activeMission.id] : null;
  if (world.dockedStationId) {
    if (procedural && proceduralState && proceduralState.status !== "completed") {
      return proceduralState.status === "readyToTurnIn"
        ? `${procedural.title} • Ready for turn-in`
        : `${procedural.title} • Active contract`;
    }
    if (transport) {
      return `${transport.objectiveText} • Jumps ${transport.jumpsRemaining}${transport.nextGateName ? ` • Next ${transport.nextGateName}` : ""}`;
    }
    return world.player.queuedUndockActions.length > 0
      ? `Docked. Queued: ${world.player.queuedUndockActions.map((item) => item.type).join(", ")}`
      : "Docked. Plan, fit, or queue commands before undocking.";
  }
  if (world.player.buildSwap.active) {
    return `Reconfiguring ${world.player.buildSwap.targetBuildName}. ${world.player.buildSwap.changedModuleCount} modules changing.`;
  }
  const nextRoute = getNextRouteStep(world);
  if (nextRoute) {
    return `Route: ${nextRoute.gateName} to ${sectorById[nextRoute.toSystemId].name}${world.routePlan?.autoFollow ? " (auto)" : ""}`;
  }
  if (transport) {
    return `${transport.objectiveText}${transport.nextGateName ? ` • Next gate ${transport.nextGateName}` : ""}`;
  }
  if (procedural && proceduralState && proceduralState.status !== "completed") {
    if (procedural.type === "transport") {
      return `${procedural.title} • Deliver cargo to ${getSystemDestination(procedural.targetSystemId, procedural.targetStationId ?? "")?.name ?? procedural.targetSystemId}`;
    }
    if (procedural.type === "mining") {
      return `${procedural.title} • Mine ${procedural.targetCount} ${procedural.targetResource}`;
    }
    return `${procedural.title} • Hunt hostiles in ${sectorById[procedural.targetSystemId]?.name ?? procedural.targetSystemId}`;
  }
  if (activeMission && activeMissionState && activeMissionState.status === "active") {
    if (activeMission.combatObjective === "survive") {
      return `${activeMission.title} • Survive ${Math.ceil(activeMissionState.objectiveTimer ?? activeMission.objectiveDurationSec ?? 0)}s`;
    }
    if (activeMission.combatObjective === "clear") {
      return `${activeMission.title} • Clear pressure pocket${activeMissionState.reinforcementTimer ? ` • reinforcements ${Math.ceil(activeMissionState.reinforcementTimer)}s` : ""}`;
    }
    return `${activeMission.title} • Combat objective active`;
  }
  const selected = getObjectInfo(world, world.selectedObject);
  if (!selected) {
    return "Left click to select. Right click a target for commands.";
  }
  return `Selected ${selected.name}. Right click for commands.`;
}

function getNavLabel(world: GameWorld) {
  if (world.player.buildSwap.active) {
    return `Reconfiguring ${world.player.buildSwap.targetBuildName} (${Math.ceil(world.player.buildSwap.remaining)}s)`;
  }
  const nav = world.player.navigation;
  if (nav.mode === "idle") {
    if (world.routePlan?.autoFollow) {
      return `Autopilot standing by for ${sectorById[world.routePlan.destinationSystemId].name}`;
    }
    return "Idle";
  }
  const targetName = getObjectInfo(world, nav.target)?.name ?? "destination";
  if (nav.mode === "approach") return `Approaching ${targetName}`;
  if (nav.mode === "keep_range") return `Keeping ${nav.desiredRange}m from ${targetName}`;
  if (nav.mode === "orbit") return `Orbiting ${targetName} at ${nav.desiredRange}m`;
  if (nav.mode === "boundary_return") return "Returning to local pocket";
  if (nav.mode === "align") {
    return nav.desiredRange >= 0
      ? `Aligning to warp ${targetName} at ${nav.desiredRange}m (${Math.round(nav.warpProgress * 100)}%)`
      : `Aligning to ${targetName}`;
  }
  if (nav.mode === "warping") return `Warping to ${targetName} at ${nav.desiredRange}m`;
  if (nav.mode === "docking") return `Docking on ${targetName}`;
  if (nav.mode === "jumping") return `Jumping via ${targetName}`;
  if (world.routePlan) return `Route active to ${sectorById[world.routePlan.destinationSystemId].name}`;
  return nav.mode;
}

export function updateWorld(world: GameWorld, dt: number) {
  world.elapsedTime += dt;
  ensureProcgenState(world);
  if (world.dockedStationId) {
    world.boundary.warningLevel = 0;
    world.boundary.correctionLevel = 0;
    world.boundary.active = false;
    world.boundary.zone = "active";
    world.boundary.title = null;
    world.boundary.detail = null;
    world.boundary.returnState.active = false;
    world.boundary.returnState.reason = null;
    world.boundary.returnState.suspendedNav = null;
    world.boundary.returnState.recoveryPoint = null;
    world.boundary.returnState.pocketId = null;
    world.boundary.returnState.releaseRadius = 0;
  }
  const timeScale = getWorldTimeScale(world);
  const simDt = dt * timeScale;
  updateTacticalSlowTimers(world, dt);
  updateBeltSpawnCooldowns(world, simDt);
  if (!world.dockedStationId) {
    refreshSectorChallenge(world, world.currentSectorId, simDt);
  }
  ensureMissionUnlocks(world);
  normalizeTransportMissionStates(world);
  normalizeProceduralContractState(world);
  normalizeDeliveryMissionStates(world);
  resolveTransportMissionDeliveries(world);
  resolveProceduralContractDeliveries(world);
  updateTransportRoute(world);
  if (world.dockedStationId) {
    return;
  }
  updateMissionBossEncounters(world);
  updateBuildSwap(world, dt);
  resetCombatEffects(world);
  applyTacticalSlowEffects(world);
  applyPlayerControlEffects(world);
  applyEnemyControlEffects(world);
  maintainEnemyLockIntent(world);
  updatePendingLocks(world, simDt);
  updateRouteAutopilot(world);
  updatePlayerNavigation(world, simDt);
  applyAnomalyFields(world, simDt);
  applySalvageBoundaryPull(world, simDt);
  autoEngageNearbyHostile(world);
  runPlayerModules(world, simDt);
  runEnemyModules(world, simDt);
  updateCombatMissionPressure(world, simDt);
  maybeSpawnSectorReinforcement(world, world.currentSectorId);
  updateProjectiles(world, simDt);
  cleanupWorld(world);
  updateParticles(world, simDt);
  evaluateWorldInteractions(world);
}

export function createSnapshot(world: GameWorld): GameSnapshot {
  const activeMission = getActiveMission(world);
  const activeTransportMission = buildTransportTracker(world);
  const economy = getLocalEconomySnapshot(world);
  const currentStation = world.dockedStationId ? getCurrentStation(world) : null;
  const boardContracts = generateContractsForStation(world, currentStation, world.currentSectorId);
  const availableProceduralContracts =
    currentStation &&
    world.procgen.activeContract &&
    world.procgen.activeContract.issuerStationId === currentStation.id &&
    !boardContracts.some((entry) => entry.id === world.procgen.activeContract?.id)
      ? [world.procgen.activeContract, ...boardContracts]
      : boardContracts;
  return {
    world,
    derived: getCachedDerivedStats(world.player),
    sector: getCurrentSectorDef(world),
    currentRegion: regionById[getCurrentSectorDef(world).regionId],
    currentSite: world.localSite.destinationId
      ? getSystemDestination(world.currentSectorId, world.localSite.destinationId)
      : null,
    currentStation,
    activeMission,
    selectedInfo: getObjectInfo(world, world.selectedObject),
    activeTargetInfo: getObjectInfo(world, world.activeTarget),
    lockedTargetInfos: world.lockedTargets
      .map((entry) => getObjectInfo(world, entry))
      .filter((item): item is ObjectInfo => Boolean(item)),
    pendingLockInfos: world.player.pendingLocks
      .map((entry) => {
        const info = getObjectInfo(world, entry.ref);
        return info ? { info, progress: entry.progress, duration: entry.duration } : null;
      })
      .filter((item): item is { info: ObjectInfo; progress: number; duration: number } => Boolean(item)),
    overview: getOverviewEntries(world),
    navLabel: getNavLabel(world),
    nearbyPrompt: getPrompt(world),
    nextRouteStep: getNextRouteStep(world),
    buildMatchId: findMatchingBuild(world),
    activeTransportMission,
    activeProceduralContract: world.procgen.activeContract,
    availableProceduralContracts,
    regionalEvent: getRegionalEventForSystem(world, world.currentSectorId),
    currentHotspot: getSiteHotspotForSystem(world, world.currentSectorId),
    economy
  };
}

export function resolveSelectionAtPoint(world: GameWorld, point: Vec2) {
  return findObjectAtPoint(world, point);
}
