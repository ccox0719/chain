import {
  BuildSlotId,
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
  ModuleSlot,
  NavigationState,
  ObjectInfo,
  ParticleShape,
  ParticleState,
  ResistProfile,
  ResourceId,
  SelectableRef,
  SpaceObjectType,
  TransportMissionDefinition,
  TransportTracker,
  TransportRisk,
  Vec2
} from "../../types/game";
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
import { getCargoUsed, computeDerivedStats } from "../utils/stats";
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
  getShipBuyPrice
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
import { findObjectAtPoint, getObjectInfo, getObjectPosition, getOverviewEntries } from "../world/spaceObjects";

const TACTICAL_SLOW_CONFIG = {
  timeScale: 0.4,
  durationSec: 4,
  cooldownSec: 55,
  capPenaltySec: 10,
  speedPenaltySec: 8,
  speedPenaltyMultiplier: 0.85,
  capacitorRegenPenaltyMultiplier: 0.8
} as const;

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
    // Missile: expanding orange fireball with slow debris
    emitBurst(world, position, "#ffffff", 1, 0, 0, 0.12, 28, "dot", 42);
    emitBurst(world, position, "#ffb265", 1, 0, 0, 0.22, 20, "dot", 30);
    emitBurst(world, position, "#ffb265", 18, 80, 300, 0.55, 5, "spark", 18);
    emitBurst(world, position, "#ffffff", 6, 60, 180, 0.28, 3, "spark", 12);
    emitBurst(world, position, "#ff8830", 10, 20, 90, 1.2, 5, "dot", 16);
  } else if (moduleId?.includes("rail")) {
    // Railgun: white kinetic punch + blue sparks
    emitBurst(world, position, "#ffffff", 1, 0, 0, 0.10, 22, "dot", 48);
    emitBurst(world, position, "#b8e8ff", 14, 120, 380, 0.35, 3.5, "spark", 14);
    emitBurst(world, position, "#ffffff", 5, 80, 220, 0.22, 2.5, "spark", 20);
    emitBurst(world, position, "#88ccff", 6, 10, 60, 0.6, 4, "dot", 12);
  } else {
    // Laser: tight cyan flash + thin sparks
    emitBurst(world, position, color, 1, 0, 0, 0.10, 12, "dot", 24);
    emitBurst(world, position, color, 10, 60, 220, 0.28, 2.8, "spark", 12);
    emitBurst(world, position, "#ffffff", 4, 20, 70, 0.18, 2, "dot", 10);
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
  // Instant blinding core flash
  emitBurst(world, position, "#ffffff", 1, 0, 0, 0.18, 48, "dot", 50);
  emitBurst(world, position, color, 1, 0, 0, 0.28, 32, "dot", 40);
  // Outer fast sparks — primary color and white mixed
  emitBurst(world, position, color, 32, 200, 560, 0.5, 4.5, "spark", 18);
  emitBurst(world, position, "#ffffff", 14, 140, 380, 0.38, 3, "spark", 14);
  // Mid-speed diamond shards
  emitBurst(world, position, color, 10, 70, 200, 1.0, 6, "diamond", 22);
  // Slower glowing debris — drift and linger
  emitBurst(world, position, color, 18, 30, 110, 1.4, 5, "dot", 20);
  // Ember core — almost stationary, long glow
  emitBurst(world, position, "#ffffff", 10, 5, 28, 2.0, 7, "dot", 26);
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
  if (sector.particles.length > 700) sector.particles = sector.particles.slice(-700);
}

function pushStory(world: GameWorld, message: string) {
  world.storyLog = [message, ...world.storyLog].slice(0, 7);
}

export function addCredits(world: GameWorld, amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return;
  world.player.credits = Math.max(0, world.player.credits + Math.round(amount));
  pushStory(world, `DEV: added ${Math.round(amount)} credits.`);
}

function ensurePilotLicense(world: GameWorld) {
  world.player.pilotLicense = normalizePilotLicense(world.player.pilotLicense);
}

function awardPilotLicenseProgress(world: GameWorld, amount: number) {
  if (amount <= 0) return;
  ensurePilotLicense(world);
  const previousLevel = world.player.pilotLicense.level;
  const nextProgress = world.player.pilotLicense.progress + Math.max(1, Math.round(amount * 1.2));
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

const BOUNDARY_WARNING_DISTANCE = 260;
const BOUNDARY_GRAVITY_START_DISTANCE = 90;
const BOUNDARY_OVERSHOOT_ALLOWANCE = 140;
const BOUNDARY_RETURN_ACCEL = 520;
const BOUNDARY_SLINGSHOT_DAMPING = 0.08;
const BOUNDARY_CLUSTER_PULL_RADIUS = 520;
const BOUNDARY_VISIBLE_MARGIN = 120;
const BOUNDARY_REBOUND_DISTANCE = 260;
const BOUNDARY_RUBBER_BAND_MIN_SPEED = 180;

function getBoundaryContext(world: GameWorld) {
  const player = world.player;
  const destinations = getSystemDestinations(world.currentSectorId);
  const nearest = destinations
    .filter((entry) => entry.kind === "anomaly" || entry.kind === "belt" || entry.kind === "wreck")
    .map((entry) => ({ entry, distance: distance(player.position, entry.position) }))
    .sort((left, right) => left.distance - right.distance)[0];

  if (nearest?.entry.kind === "anomaly" && nearest.distance <= 520) {
    return {
      tone: "anomaly" as const,
      title: "Deadspace instability detected",
      detail: "The pocket lets you drift wide, then the field snaps you back inward."
    };
  }
  if (nearest?.entry.kind === "belt" && nearest.distance <= 460) {
    return {
      tone: "belt" as const,
      title: "Leaving belt perimeter",
      detail: "Dust gravity and lane wash will sling the ship back toward the extraction zone."
    };
  }
  const activeProcedural = getActiveProceduralContract(world);
  const activeMission = getActiveMission(world);
  const activeTransport = getActiveTransportMissionDefinition(world);
  if (
    (activeProcedural && activeProcedural.targetSystemId === world.currentSectorId) ||
    (activeMission && activeMission.targetSystemId === world.currentSectorId) ||
    (activeTransport && getTransportObjectiveTargetSystem(world, activeTransport) === world.currentSectorId)
  ) {
    return {
      tone: "engagement" as const,
      title: "Leaving engagement zone",
      detail: "You can drift beyond the pocket edge briefly before the local well throws you back."
    };
  }
  return {
    tone: "sensor" as const,
    title: "Navigation boundary reached",
    detail: "The local grid weakens near the edge, then pulls your ship back like a gravity sling."
  };
}

function getBoundaryReboundPoint(world: GameWorld, inward: Vec2): Vec2 {
  const sectorDef = getCurrentSectorDef(world);
  return {
    x: clamp(
      world.player.position.x + inward.x * BOUNDARY_REBOUND_DISTANCE,
      BOUNDARY_VISIBLE_MARGIN,
      sectorDef.width - BOUNDARY_VISIBLE_MARGIN
    ),
    y: clamp(
      world.player.position.y + inward.y * BOUNDARY_REBOUND_DISTANCE,
      BOUNDARY_VISIBLE_MARGIN,
      sectorDef.height - BOUNDARY_VISIBLE_MARGIN
    )
  };
}

function applyPlayerBoundaryBehavior(world: GameWorld, dt: number, maxSpeed: number) {
  const sectorDef = getCurrentSectorDef(world);
  const { player } = world;
  const nav = player.navigation;
  const distanceLeft = player.position.x;
  const distanceRight = sectorDef.width - player.position.x;
  const distanceTop = player.position.y;
  const distanceBottom = sectorDef.height - player.position.y;
  const minDistanceToEdge = Math.min(distanceLeft, distanceRight, distanceTop, distanceBottom);
  const warningDepth = Math.max(0, BOUNDARY_WARNING_DISTANCE - minDistanceToEdge);
  const gravityDepth = Math.max(0, BOUNDARY_GRAVITY_START_DISTANCE - minDistanceToEdge);
  const warningLevel = clamp(warningDepth / BOUNDARY_WARNING_DISTANCE, 0, 1);
  const correctionLevel = clamp(gravityDepth / BOUNDARY_GRAVITY_START_DISTANCE, 0, 1);

  const boundary = world.boundary;
  const context = getBoundaryContext(world);
  boundary.warningLevel = warningLevel;
  boundary.correctionLevel = correctionLevel;
  boundary.tone = context.tone;
  boundary.title = warningLevel > 0.04 ? context.title : null;
  boundary.detail = warningLevel > 0.04 ? context.detail : null;
  boundary.forcedFacing = null;
  boundary.forcedTurnRate = 0;

  const center = { x: sectorDef.width / 2, y: sectorDef.height / 2 };
  const inward = normalize(subtract(center, player.position));
  const wasActive = boundary.active;
  boundary.active = correctionLevel > 0.02;

  if (boundary.active && !wasActive) {
    pushStory(world, context.title);
  }

  const overshootLeft = Math.max(0, -distanceLeft);
  const overshootRight = Math.max(0, -distanceRight);
  const overshootTop = Math.max(0, -distanceTop);
  const overshootBottom = Math.max(0, -distanceBottom);
  const overshoot = Math.max(overshootLeft, overshootRight, overshootTop, overshootBottom);
  const slingshotLevel = clamp(overshoot / BOUNDARY_OVERSHOOT_ALLOWANCE, 0, 1);

  if (warningLevel > 0.04) {
    boundary.forcedFacing = Math.atan2(inward.y, inward.x);
    boundary.forcedTurnRate = 3.8 + warningLevel * 3.6 + correctionLevel * 3.2 + slingshotLevel * 6.4;
  }

  if (correctionLevel > 0 || slingshotLevel > 0) {
    if (
      nav.target === null &&
      nav.destination &&
      nav.mode !== "jumping" &&
      nav.mode !== "warping" &&
      nav.mode !== "docking"
    ) {
      const destinationDirection = normalize(subtract(nav.destination, player.position));
      const destinationPush = destinationDirection.x * inward.x + destinationDirection.y * inward.y;
      const shouldReverseCourse =
        slingshotLevel > 0.04 ||
        correctionLevel > 0.38 ||
        (correctionLevel > 0.08 && destinationPush < -0.1);
      if (shouldReverseCourse) {
        nav.mode = "approach";
        nav.destination = getBoundaryReboundPoint(world, inward);
        nav.desiredRange = 0;
        nav.warpFrom = null;
        nav.warpProgress = 0;
      }
    }

    const edgePull = correctionLevel * 0.55 + Math.pow(slingshotLevel, 1.35) * 1.9;
    const inwardVelocity = player.velocity.x * inward.x + player.velocity.y * inward.y;
    if (inwardVelocity < 0) {
      const reversalStrength = 2.1 + slingshotLevel * 2.4;
      player.velocity = add(player.velocity, scale(inward, -inwardVelocity * reversalStrength));
    }
    player.velocity = add(player.velocity, scale(inward, BOUNDARY_RETURN_ACCEL * (1 + edgePull * 1.45) * dt));
    const minimumInwardSpeed =
      BOUNDARY_RUBBER_BAND_MIN_SPEED * (correctionLevel * 0.45 + slingshotLevel * 1.1);
    if (minimumInwardSpeed > 0) {
      const correctedInwardVelocity = player.velocity.x * inward.x + player.velocity.y * inward.y;
      if (correctedInwardVelocity < minimumInwardSpeed) {
        player.velocity = add(player.velocity, scale(inward, minimumInwardSpeed - correctedInwardVelocity));
      }
    }
    boundary.forcedFacing = Math.atan2(inward.y, inward.x);
    boundary.forcedTurnRate = Math.max(
      boundary.forcedTurnRate,
      5.4 + warningLevel * 3.2 + correctionLevel * 4.5 + slingshotLevel * 7.2
    );
    player.velocity = scale(player.velocity, 1 - Math.min(0.32, dt * (BOUNDARY_SLINGSHOT_DAMPING + slingshotLevel * 0.55)));
  }

  if (slingshotLevel > 0) {
    const shift = { x: 0, y: 0 };
    if (player.position.x < BOUNDARY_VISIBLE_MARGIN) {
      shift.x = BOUNDARY_VISIBLE_MARGIN - player.position.x;
    } else if (player.position.x > sectorDef.width - BOUNDARY_VISIBLE_MARGIN) {
      shift.x = (sectorDef.width - BOUNDARY_VISIBLE_MARGIN) - player.position.x;
    }
    if (player.position.y < BOUNDARY_VISIBLE_MARGIN) {
      shift.y = BOUNDARY_VISIBLE_MARGIN - player.position.y;
    } else if (player.position.y > sectorDef.height - BOUNDARY_VISIBLE_MARGIN) {
      shift.y = (sectorDef.height - BOUNDARY_VISIBLE_MARGIN) - player.position.y;
    }

    if (shift.x !== 0 || shift.y !== 0) {
      const sector = getCurrentSector(world);
      const moveBody = (position: Vec2) => {
        position.x += shift.x;
        position.y += shift.y;
      };
      const isOutOfBounds = (position: Vec2) =>
        position.x < BOUNDARY_VISIBLE_MARGIN ||
        position.x > sectorDef.width - BOUNDARY_VISIBLE_MARGIN ||
        position.y < BOUNDARY_VISIBLE_MARGIN ||
        position.y > sectorDef.height - BOUNDARY_VISIBLE_MARGIN;

      moveBody(player.position);

      sector.enemies.forEach((enemy) => {
        if (distance(enemy.position, player.position) <= BOUNDARY_CLUSTER_PULL_RADIUS) {
          moveBody(enemy.position);
          moveBody(enemy.patrolAnchor);
          if (enemy.patrolTarget) moveBody(enemy.patrolTarget);
        }
      });

      sector.loot.forEach((drop) => {
        if (distance(drop.position, player.position) <= BOUNDARY_CLUSTER_PULL_RADIUS || isOutOfBounds(drop.position)) {
          moveBody(drop.position);
        }
      });

      sector.wrecks.forEach((wreck) => {
        if (distance(wreck.position, player.position) <= BOUNDARY_CLUSTER_PULL_RADIUS || isOutOfBounds(wreck.position)) {
          moveBody(wreck.position);
        }
      });

      sector.floatingText.forEach((entry) => {
        if (distance(entry.position, player.position) <= BOUNDARY_CLUSTER_PULL_RADIUS) {
          moveBody(entry.position);
        }
      });

      if (shift.x !== 0) {
        player.velocity.x *= 0.82;
      }
      if (shift.y !== 0) {
        player.velocity.y *= 0.82;
      }
    }
  }

  const minX = -BOUNDARY_OVERSHOOT_ALLOWANCE;
  const maxX = sectorDef.width + BOUNDARY_OVERSHOOT_ALLOWANCE;
  const minY = -BOUNDARY_OVERSHOOT_ALLOWANCE;
  const maxY = sectorDef.height + BOUNDARY_OVERSHOOT_ALLOWANCE;
  if (player.position.x < minX) {
    player.position.x = minX;
    player.velocity.x = Math.abs(player.velocity.x) + maxSpeed * 0.28;
  } else if (player.position.x > maxX) {
    player.position.x = maxX;
    player.velocity.x = -Math.abs(player.velocity.x) - maxSpeed * 0.28;
  }
  if (player.position.y < minY) {
    player.position.y = minY;
    player.velocity.y = Math.abs(player.velocity.y) + maxSpeed * 0.28;
  } else if (player.position.y > maxY) {
    player.position.y = maxY;
    player.velocity.y = -Math.abs(player.velocity.y) - maxSpeed * 0.28;
  }
}

function getDifficultyModifiers(world: GameWorld) {
  if (world.difficulty === "easy") {
    return {
      playerDamageMultiplier: 1.18,
      enemyDamageMultiplier: 0.82
    };
  }
  if (world.difficulty === "hard") {
    return {
      playerDamageMultiplier: 0.9,
      enemyDamageMultiplier: 1.28
    };
  }
  return {
    playerDamageMultiplier: 1,
    enemyDamageMultiplier: 1
  };
}

function getTacticalSlowState(world: GameWorld) {
  return world.player.tacticalSlow;
}

function getWorldTimeScale(world: GameWorld) {
  return getTacticalSlowState(world).activeRemaining > 0 ? TACTICAL_SLOW_CONFIG.timeScale : 1;
}

function getShipPowerTier(shipId: string) {
  const ship = playerShipById[shipId];
  if (!ship) return 1;
  if (ship.shipClass === "cruiser") return 3;
  if (ship.shipClass === "destroyer") return 2;
  return 1;
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
  if (averageTech >= 2.4) tier += 1;
  if (averageTech >= 3.2 || highWater >= 4) tier += 1;
  if (shipTier >= 3 && highWater >= 3) tier = Math.max(tier, 3);
  return Math.max(1, Math.min(4, tier));
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
    em: clamp(resists.em + bonus, 0, 0.82),
    thermal: clamp(resists.thermal + bonus, 0, 0.82),
    kinetic: clamp(resists.kinetic + bonus, 0, 0.82),
    explosive: clamp(resists.explosive + bonus, 0, 0.82)
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
  const derived = computeDerivedStats(world.player);
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
      TACTICAL_SLOW_CONFIG.speedPenaltyMultiplier
    );
  }
  if (tacticalSlow.capPenaltyRemaining > 0) {
    world.player.effects.capacitorRegenMultiplier = Math.min(
      world.player.effects.capacitorRegenMultiplier,
      TACTICAL_SLOW_CONFIG.capacitorRegenPenaltyMultiplier
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
  derived: ReturnType<typeof computeDerivedStats>
) {
  if (kind === "laser") return derived.laserDamageMultiplier;
  if (kind === "railgun") return derived.railgunDamageMultiplier;
  if (kind === "missile") return derived.missileDamageMultiplier;
  return 1;
}

function getWeaponCycleMultiplier(
  kind: string | undefined,
  derived: ReturnType<typeof computeDerivedStats>
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
  const derived = computeDerivedStats(world.player);
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
  const derived = computeDerivedStats(world.player);
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
    shipBuyPrices
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

  world.player.credits += mission.rewardCredits;
  awardPilotLicenseProgress(world, mission.rewardCredits / 8);
  state.status = "completed";
  if (mission.unlockSystemId && !world.unlockedSectorIds.includes(mission.unlockSystemId)) {
    world.unlockedSectorIds.push(mission.unlockSystemId);
    pushStory(world, `Jump access granted: ${sectorById[mission.unlockSystemId].name}`);
  }
  pushStory(world, `Mission complete: ${mission.title} (+${mission.rewardCredits} credits)`);
  ensureMissionUnlocks(world);
  return true;
}

export function acceptMission(world: GameWorld, missionId: string) {
  if (missionId.startsWith("proc:")) {
    const contract = getBoardContractById(world, missionId);
    if (!contract) return false;
    const hasActiveClassic = missionCatalog.some((entry) => world.missions[entry.id]?.status === "active");
    const hasActiveTransport = Object.values(world.transportMissions).some((entry) => entry.status === "active");
    if (hasActiveClassic || hasActiveTransport || world.procgen.activeContractState?.status === "active") {
      return false;
    }
    if (contract.type === "transport") {
      const cargoCapacity = computeDerivedStats(world.player).cargoCapacity;
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
    pushStory(world, `Mission accepted: ${mission.title}`);
    return true;
  }

  const transport = transportMissionById[missionId];
  const transportState = world.transportMissions[missionId];
  if (!transport || !transportState) return false;
  if (
    transportState.status === "completed" ||
    transportState.status === "active" ||
    transportState.status === "locked"
  ) {
    return false;
  }
  const cargoCapacity = computeDerivedStats(world.player).cargoCapacity;
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

function objectInRange(world: GameWorld, ref: SelectableRef, range: number) {
  const position = getObjectPosition(world, ref);
  return position ? distance(world.player.position, position) <= range : false;
}

function canDock(world: GameWorld) {
  const station = getCurrentStation(world);
  if (!station) return false;
  const stationRef: SelectableRef = { id: station.id, type: "station" };
  return objectInRange(world, stationRef, computeDerivedStats(world.player).interactionRange);
}

export function dock(world: GameWorld) {
  const station = getCurrentStation(world);
  if (!station) return false;
  if (!canDock(world)) return false;
  const derived = computeDerivedStats(world.player);
  world.dockedStationId = station.id;
  world.player.velocity = { x: 0, y: 0 };
  world.player.shield = derived.maxShield;
  world.player.capacitor = derived.capacitorCapacity;
  setIdle(world.player.navigation);
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
      const derived = computeDerivedStats(world.player);
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
  world.player.position = { x: station.position.x + 120, y: station.position.y + 24 };
  world.player.rotation = 0;
  world.player.velocity = { x: 0, y: 0 };
  setIdle(world.player.navigation);
  pushStory(world, `Undocked from ${station.name}.`);
  const queued = [...world.player.queuedUndockActions];
  world.player.queuedUndockActions = [];
  queued.forEach((action) => {
    tryExecuteCommand(world, action, true);
  });
}

export function repairShip(world: GameWorld) {
  const derived = computeDerivedStats(world.player);
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

  const freeCargo = computeDerivedStats(world.player).cargoCapacity - getCargoUsed(world.player);
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
  const derived = computeDerivedStats(world.player);
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

export function selectObject(world: GameWorld, ref: SelectableRef | null) {
  world.selectedObject = ref;
}

export function lockTarget(world: GameWorld, ref: SelectableRef) {
  const derived = computeDerivedStats(world.player);
  const info = getObjectInfo(world, ref);
  if (!info || info.distance > derived.lockRange * world.player.effects.lockRangeMultiplier) return false;
  if (!world.lockedTargets.find((entry) => entry.id === ref.id && entry.type === ref.type)) {
    world.lockedTargets.push(ref);
  }
  if (!world.activeTarget) {
    world.activeTarget = ref;
  }
  return true;
}

export function unlockTarget(world: GameWorld, ref: SelectableRef) {
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
  const locked = world.lockedTargets.find((entry) => entry.id === ref.id && entry.type === ref.type);
  if (locked) {
    world.activeTarget = locked;
  }
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
  tacticalSlow.activeRemaining = TACTICAL_SLOW_CONFIG.durationSec;
  tacticalSlow.cooldownRemaining = TACTICAL_SLOW_CONFIG.cooldownSec;
  tacticalSlow.capPenaltyRemaining = TACTICAL_SLOW_CONFIG.capPenaltySec;
  tacticalSlow.speedPenaltyRemaining = TACTICAL_SLOW_CONFIG.speedPenaltySec;
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
}

function issuePointNav(world: GameWorld, destination: Vec2) {
  world.player.navigation.mode = "approach";
  world.player.navigation.target = null;
  world.player.navigation.desiredRange = 0;
  world.player.navigation.destination = { ...destination };
  world.player.navigation.warpFrom = null;
  world.player.navigation.warpProgress = 0;
}

function activateAllWeapons(world: GameWorld) {
  world.player.modules.weapon.forEach((runtime) => {
    if (!runtime.moduleId) return;
    runtime.active = true;
  });
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
  const derived = computeDerivedStats(world.player);
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

function tryExecuteCommand(world: GameWorld, command: CommandAction, skipDockedCheck = false) {
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
    disableAutopilot(world);
    issueNav(world, "keep_range", command.target, command.range);
    return true;
  }
  if (command.type === "orbit") {
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
    issueNav(world, "align", command.target, command.range ?? 120);
    world.player.navigation.mode = "align";
    world.player.navigation.desiredRange = command.range ?? 120;
    return true;
  }
  if (command.type === "dock") {
    disableAutopilot(world);
    issueNav(world, "docking", command.target, 0);
    return true;
  }
  if (command.type === "jump") {
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
  runtime.active = !runtime.active;
  if (!runtime.active) {
    runtime.cycleRemaining = 0;
  }
  return true;
}

function getRangePenalty(distanceToTarget: number, optimal = 200, falloff = 120) {
  if (distanceToTarget <= optimal) return 1;
  const over = Math.max(0, distanceToTarget - optimal);
  return 1 / (1 + (over / Math.max(falloff, 1)) ** 2);
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
    Math.pow(Math.max(targetSignatureRadius, 1) / Math.max(weapon.signatureResolution ?? 40, 1), 0.55),
    0.7,
    1.65
  );
  const effectiveTracking = Math.max(0.02, (weapon.tracking ?? 0.06) * signatureScale * 4.4);
  const angularPressure = angularVelocity * 0.32;
  const trackingRatio = angularPressure / effectiveTracking;
  const rawTrackingFactor = 1 / (1 + Math.pow(trackingRatio, 1.35));
  const trackingFactor = clamp(0.18 + rawTrackingFactor * 0.82, 0, 1);
  const damage = (weapon.damage ?? 0) * rangeFactor * trackingFactor;

  let quality: "miss" | "grazing" | "solid" | "excellent" = "miss";
  if (damage > (weapon.damage ?? 0) * 0.82) quality = "excellent";
  else if (damage > (weapon.damage ?? 0) * 0.48) quality = "solid";
  else if (damage > (weapon.damage ?? 0) * 0.14) quality = "grazing";

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
  derived?: ReturnType<typeof computeDerivedStats>,
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

function canMineResource(module: { miningTargets?: ResourceId[] }, resource: ResourceId) {
  return !module.miningTargets?.length || module.miningTargets.includes(resource);
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
  if (variant.combatStyle === "speed") return Math.round(variant.preferredRange * 1.18);
  if (variant.combatStyle === "armor") return Math.round(Math.max(120, variant.preferredRange * 0.88));
  if (variant.combatStyle === "shield") return Math.round(Math.max(140, variant.preferredRange * 0.94));
  return variant.preferredRange;
}

function getEnemyCombatMode(enemyVariantId: string) {
  const variant = enemyVariantById[enemyVariantId];
  if (!variant) return "orbit" as const;
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
  patrolAnchor = position
) {
  const variant = enemyVariantById[variantId] ?? enemyVariantById["dust-raider"];
  const patrolBehavior = "anchor-patrol" as const;
  return {
    id: `enemy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    variantId: variant.id,
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
      warpProgress: 0
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

const HOSTILE_TRIGGER_COOLDOWN_SEC = 18;
const MAX_TRIGGERED_HOSTILES_NEAR_PLAYER = 5;

const HOSTILE_TRIGGER_PROFILES = {
  low: { chance: 0.1, count: 1 },
  mid: { chance: 0.2, count: 2 },
  high: { chance: 0.35, count: 3 }
} as const;

function getHostileTriggerProfile(sectorId: string) {
  const sectorDef = sectorById[sectorId];
  if (sectorDef.danger >= 5) return HOSTILE_TRIGGER_PROFILES.high;
  if (sectorDef.danger >= 3) return HOSTILE_TRIGGER_PROFILES.mid;
  return HOSTILE_TRIGGER_PROFILES.low;
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

type HostilePackRole = "tackle" | "sniper" | "brawler" | "support" | "skirmisher" | "anchor" | "escort";
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
  variantId: string,
  role: HostilePackRole,
  preferredVariantIds: string[] | undefined,
  playerPowerTier: number
) {
  const variant = enemyVariantById[variantId];
  if (!variant) return Number.NEGATIVE_INFINITY;
  const moduleKinds = getEnemyVariantModuleKinds(variantId);
  const totalBulk = variant.shield + variant.armor + variant.hull;
  let score = preferredVariantIds?.includes(variantId) ? 1.5 : 0;
  const techPressure = Math.max(0, playerPowerTier - 1);

  if (role === "tackle") {
    if (variant.combatStyle === "speed") score += 3.2;
    if (variant.speed >= 108) score += 1.6;
    if (variant.preferredRange <= 220) score += 1.0;
    if (moduleKinds.has("warp_disruptor")) score += 4.2;
    if (moduleKinds.has("webifier")) score += 2.8;
    if (moduleKinds.has("missile") || moduleKinds.has("railgun")) score += 0.5;
  } else if (role === "sniper") {
    if (variant.preferredRange >= 260) score += 2.6;
    if (variant.lockRange >= 600) score += 1.0;
    if (variant.combatStyle === "armor") score += 1.6;
    if (moduleKinds.has("railgun")) score += 2.2;
    if (moduleKinds.has("missile")) score += 0.7;
  } else if (role === "brawler") {
    if (variant.combatStyle === "shield" || variant.combatStyle === "armor") score += 2.6;
    if (variant.preferredRange <= 240) score += 2.0;
    if (totalBulk >= 260) score += 1.0;
    if (moduleKinds.has("laser")) score += 0.6;
  } else if (role === "support") {
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
    if (variant.combatStyle === "speed") score += 3.0;
    if (variant.speed >= 110) score += 1.5;
    if (variant.preferredRange >= 190 && variant.preferredRange <= 340) score += 1.5;
    if (moduleKinds.has("missile") || moduleKinds.has("railgun") || moduleKinds.has("laser")) score += 0.5;
    score += techPressure * 0.2;
  } else if (role === "anchor") {
    if (totalBulk >= 280) score += 3.2;
    if (variant.speed <= 100) score += 1.5;
    if (variant.combatStyle === "shield" || variant.combatStyle === "armor") score += 1.5;
    if (moduleKinds.has("shield_booster") || moduleKinds.has("armor_repairer")) score += 1.0;
    score += techPressure * 0.25;
  } else if (role === "escort") {
    if (variant.combatStyle === "speed") score += 2.2;
    if (variant.speed >= 112) score += 1.2;
    if (moduleKinds.has("missile")) score += 1.8;
    if (moduleKinds.has("railgun")) score += 1.4;
    if (moduleKinds.has("laser")) score += 0.8;
    if (totalBulk <= 250) score += 1.2;
    score += techPressure * 0.3;
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
  role: HostilePackRole,
  preferredVariantIds: string[] | undefined,
  usedVariantIds: Set<string>,
  playerPowerTier: number
) {
  const scored = enemyVariants
    .map((variant) => ({
      variant,
      score:
        scoreEnemyVariantForHostileRole(variant.id, role, preferredVariantIds, playerPowerTier) -
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
  context: TriggerContext,
  sectorId: string,
  playerPowerTier: number,
  preferredVariantIds?: string[]
): TriggeredHostileSpawn[] {
  const template = chooseHostilePackTemplate(context, sectorId, playerPowerTier);
  const usedVariantIds = new Set<string>();
  const roles = [...template.roles];
  if (playerPowerTier >= 4 && sectorById[sectorId]?.danger >= 4 && Math.random() < 0.35) {
    roles.push(context === "belt" ? "support" : "escort");
  }
  if (playerPowerTier >= 4 && sectorById[sectorId]?.security === "frontier" && Math.random() < 0.25) {
    roles.push("support");
  }
  return roles.map((role) => {
    const variantId = pickEnemyVariantForHostileRole(role, preferredVariantIds, usedVariantIds, playerPowerTier);
    usedVariantIds.add(variantId);
    return { role, variantId };
  });
}

function getTriggerSpawnRadius(role: HostilePackRole) {
  if (role === "tackle") return 180 + Math.random() * 60;
  if (role === "sniper") return 280 + Math.random() * 90;
  if (role === "support") return 240 + Math.random() * 80;
  if (role === "anchor") return 300 + Math.random() * 90;
  if (role === "escort") return 210 + Math.random() * 70;
  if (role === "skirmisher") return 210 + Math.random() * 70;
  return 220 + Math.random() * 80;
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
  const failingPursuit = playerDistance > preferredRange * (variant.combatStyle === "speed" ? 1.45 : 1.7);
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
    (enemy) => enemy.hull > 0 && distance(enemy.position, world.player.position) <= 720
  ).length;
  if (nearbyHostiles >= MAX_TRIGGERED_HOSTILES_NEAR_PLAYER) return;

  const actualPack = pack.slice(0, Math.max(1, MAX_TRIGGERED_HOSTILES_NEAR_PLAYER - nearbyHostiles));
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
  const frontierBoost = getCurrentSectorDef(world).security === "frontier" ? Math.max(0, playerPowerTier - 1) * 0.02 : 0;
  const triggerChance = Math.min(0.5, (profile.chance + 0.05 + frontierBoost) * getHostileActivityMultiplier(world, world.currentSectorId));
  if (Math.random() > triggerChance) return;
  spawnTriggeredHostiles(
    world,
    world.currentSectorId,
    anchorPosition,
    buildTriggeredHostilePack(
      "belt",
      world.currentSectorId,
      playerPowerTier,
      getSectorResponseVariants(world.currentSectorId, preferredVariantIds)
    )
  );
  sector.beltSpawnCooldowns[beltId] = HOSTILE_TRIGGER_COOLDOWN_SEC;
}

function maybeTriggerPortalSpawn(world: GameWorld, destinationSectorId: string, anchorPosition: Vec2) {
  const profile = getHostileTriggerProfile(destinationSectorId);
  const destinationDef = sectorById[destinationSectorId];
  const playerPowerTier = getPlayerPowerTier(world);
  const frontierBoost = destinationDef?.security === "frontier" ? Math.max(0, playerPowerTier - 1) * 0.025 : 0;
  const triggerChance = Math.min(0.65, (profile.chance + 0.08 + frontierBoost) * getHostileActivityMultiplier(world, destinationSectorId));
  if (Math.random() > triggerChance) return;
  spawnTriggeredHostiles(
    world,
    destinationSectorId,
    anchorPosition,
    buildTriggeredHostilePack("gate", destinationSectorId, playerPowerTier, getSectorResponseVariants(destinationSectorId))
  );
}

function updateRouteAutopilot(world: GameWorld) {
  if (!world.routePlan?.autoFollow || world.dockedStationId) return;
  const interactionRange = computeDerivedStats(world.player).interactionRange;
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
  const derived = computeDerivedStats(player);

  player.recentDamageTimer = Math.max(0, player.recentDamageTimer - dt);
  const passiveShieldFactor = player.recentDamageTimer > 0 ? 0.02 : 0.18;
  player.shield = clamp(player.shield + derived.shieldRegen * passiveShieldFactor * dt, 0, derived.maxShield);
  player.capacitor = clamp(
    player.capacitor + derived.capacitorRegen * player.effects.capacitorRegenMultiplier * dt,
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
          world.player.position = { x: arrival.position.x + 100, y: arrival.position.y + 20 };
          world.player.velocity = { x: 0, y: 0 };
          maybeTriggerPortalSpawn(world, gate.connectedSystemId, arrival.position);
        }
        advanceRouteAfterJump(world, gate.connectedSystemId);
        setIdle(world.player.navigation);
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
      setIdle(nav);
      aggroEnemyToPlayer(world, warpInterdictor.enemy.id);
      pushStory(world, `Warp interrupted by ${warpInterdictor.variant.name}.`);
      return;
    }
    if (nav.warpProgress >= 1 || distance(player.position, targetPosition) <= nav.desiredRange + 20) {
      player.position = add(targetPosition, scale(direction, -nav.desiredRange));
      emitWarpArrive(world, player.position);
      setIdle(nav);
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
      const orbitSpeed = clamp(nav.desiredRange * 0.33, 54, maxSpeed * 0.62);
      desiredVelocity = scale(orbitDirection, orbitSpeed);
      desiredFacing = Math.atan2(orbitDirection.y, orbitDirection.x);
    }
  }

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
  applyPlayerBoundaryBehavior(world, dt, maxSpeed);

  if (nav.mode === "idle") {
    player.velocity = scale(player.velocity, 1 - Math.min(0.65, dt * 1.25));
  }
}

function resolveModuleTarget(world: GameWorld, requiresTarget: SpaceObjectType[] | undefined) {
  if (!requiresTarget) return null;
  const target = world.activeTarget;
  if (!target) return null;
  if (!requiresTarget.includes(target.type)) return null;
  const info = getObjectInfo(world, target);
  return info ? target : null;
}

function runPlayerModules(world: GameWorld, dt: number) {
  const sector = getCurrentSector(world);
  const player = world.player;
  const derived = computeDerivedStats(player);
  const difficulty = getDifficultyModifiers(world);

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

      const target = resolveModuleTarget(world, module.requiresTarget);
      const targetPosition = target ? getObjectPosition(world, target) : null;
      const targetDistance = targetPosition ? distance(player.position, targetPosition) : 0;
      const inRange = !module.range || (targetPosition && targetDistance <= module.range);

      if (module.kind === "mining_laser" && (!target || !inRange)) {
        runtime.active = false;
        runtime.cycleRemaining = 0;
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
            const adjustedModule = getTurretAdjustedModule(module, derived, player.effects.turretTrackingMultiplier);
            const application = computeTurretApplication(
              player.position,
              player.velocity,
              enemy.position,
              enemy.velocity,
              adjustedModule,
              enemyVariantById[enemy.variantId].signatureRadius * enemy.effects.signatureMultiplier
            );
            appliedDamage = application.damage * difficulty.playerDamageMultiplier;
            quality = application.quality;
          } else if (module.kind === "missile") {
            appliedDamage =
              (module.damage ?? 0) *
              getRangePenalty(targetDistance, module.optimal, module.falloff) *
              difficulty.playerDamageMultiplier;
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
            const mined = Math.min(
              Math.max(1, Math.round((module.miningAmount ?? 0) * derived.miningYieldMultiplier)),
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
  const effectiveSpeed = variant.speed * enemy.effects.speedMultiplier;
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
    desiredVelocity = scale(orbitVector, clamp(effectiveSpeed * 0.4, 40, effectiveSpeed * 0.62));
    desiredFacing = Math.atan2(orbitVector.y, orbitVector.x);
  } else {
    desiredVelocity = scale(dirToTarget, clamp(currentDistance * 0.3, 18, effectiveSpeed * 0.36));
    desiredFacing = Math.atan2(dirToTarget.y, dirToTarget.x);
  }

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
  const sectorDef = getCurrentSectorDef(world);
  enemy.position.x = clamp(enemy.position.x, 30, sectorDef.width - 30);
  enemy.position.y = clamp(enemy.position.y, 30, sectorDef.height - 30);
}

function runEnemyModules(world: GameWorld, dt: number) {
  const sector = getCurrentSector(world);
  const difficulty = getDifficultyModifiers(world);
  sector.enemies.forEach((enemy) => {
    const variant = enemyVariantById[enemy.variantId];
    enemy.recentDamageTimer = Math.max(0, enemy.recentDamageTimer - dt);
    enemy.pursuitTimer = Math.max(0, enemy.pursuitTimer - dt);
    enemy.shield = clamp(enemy.shield + 2.5 * (enemy.recentDamageTimer > 0 ? 0.03 : 0.18) * dt, 0, variant.shield);
    enemy.capacitor = clamp(enemy.capacitor + variant.capacitorRegen * 0.6 * dt, 0, variant.capacitor);

    const playerRef: SelectableRef = { id: "player", type: "enemy" };
    const playerDistance = distance(enemy.position, world.player.position);
    const detectionRange = variant.lockRange * enemy.effects.lockRangeMultiplier;
    const pursuitRange = Math.max(detectionRange * 1.95, getEnemyPreferredRange(enemy.variantId) * 2.2);
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
              tracking: (module.tracking ?? 0) * enemy.effects.turretTrackingMultiplier
            },
            playerShipById[world.player.hullId].signatureRadius * world.player.effects.signatureMultiplier
          );
          appliedDamage = application.damage * difficulty.enemyDamageMultiplier;
          quality = application.quality;
        } else {
          appliedDamage =
            (module.damage ?? 0) *
            getRangePenalty(playerDistance, module.optimal, module.falloff) *
            difficulty.enemyDamageMultiplier;
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
    }
    projectile.position = add(projectile.position, scale(projectile.velocity, dt));

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
            const impactColor = projectile.moduleId.includes("missile") ? "#ffb265" : "#6feeff";
            emitImpact(world, projectile.position, impactColor, projectile.moduleId);
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
      nextVelocity = add(nextVelocity, scale(radial, force));
      nextVelocity = add(nextVelocity, scale(tangent, force * 0.24));
    });
    return clampMagnitude(nextVelocity, maxVelocity);
  };

  if (world.player.navigation.mode !== "warping" && world.player.navigation.mode !== "jumping") {
    const derived = computeDerivedStats(world.player);
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
    world.dockedStationId = startStation.id;
    world.selectedObject = null;
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
    if (distance(world.player.position, beacon.position) <= computeDerivedStats(world.player).interactionRange) {
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
  if (nav.mode === "align") {
    return nav.desiredRange >= 0
      ? `Aligning to warp on ${targetName} (${Math.round(nav.warpProgress * 100)}%)`
      : `Aligning to ${targetName}`;
  }
  if (nav.mode === "warping") return `Warping to ${targetName}`;
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
    world.boundary.title = null;
    world.boundary.detail = null;
  }
  const timeScale = getWorldTimeScale(world);
  const simDt = dt * timeScale;
  updateTacticalSlowTimers(world, dt);
  updateBeltSpawnCooldowns(world, simDt);
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
  updateBuildSwap(world, dt);
  resetCombatEffects(world);
  applyTacticalSlowEffects(world);
  applyPlayerControlEffects(world);
  applyEnemyControlEffects(world);
  updateRouteAutopilot(world);
  updatePlayerNavigation(world, simDt);
  applyAnomalyFields(world, simDt);
  autoEngageNearbyHostile(world);
  runPlayerModules(world, simDt);
  runEnemyModules(world, simDt);
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
    derived: computeDerivedStats(world.player),
    sector: getCurrentSectorDef(world),
    currentRegion: regionById[getCurrentSectorDef(world).regionId],
    currentStation,
    activeMission,
    selectedInfo: getObjectInfo(world, world.selectedObject),
    activeTargetInfo: getObjectInfo(world, world.activeTarget),
    lockedTargetInfos: world.lockedTargets
      .map((entry) => getObjectInfo(world, entry))
      .filter((item): item is ObjectInfo => Boolean(item)),
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
