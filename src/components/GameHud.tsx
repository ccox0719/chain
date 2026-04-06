import type { MouseEvent as ReactMouseEvent } from "react";
import { useMemo, useState } from "react";
import { moduleById } from "../game/data/modules";
import { getSystemDestination, sectorById } from "../game/data/sectors";
import { enemyVariantById, playerShipById } from "../game/data/ships";
import { planRoute } from "../game/universe/routePlanning";
import { getCombatControlRanges } from "../game/utils/combatRanges";
import { getMiningModuleTier } from "../game/utils/mining";
import { getCargoUsed, getStationaryCapacitorRegenMultiplier } from "../game/utils/stats";
import { CommandAction, GameSnapshot, ModuleSlot, ObjectInfo, SelectableRef } from "../types/game";
import { contractProgressFraction } from "../game/procgen/runtime";

const MISSION_TYPE_LABELS: Record<string, string> = {
  bounty: "Bounty",
  mining: "Mining",
  deliver: "Delivery",
  travel: "Survey"
};

// Primary icon shown large on module button face
const MODULE_KIND_ICON: Record<string, string> = {
  laser: "◈",
  railgun: "▶▶",
  missile: "⧖",
  cannon: "▥",
  mining_laser: "⛏",
  afterburner: "⟴",
  webifier: "⊕",
  warp_disruptor: "⌖",
  target_painter: "◎",
  tracking_disruptor: "≋",
  sensor_dampener: "◌",
  energy_neutralizer: "ϟ",
  salvager: "◇",
  shield_booster: "⬡",
  armor_repairer: "◼",
  hardener: "◆",
  passive: "•"
};

type RailButton = {
  label: string;
  icon?: string;
  command?: CommandAction;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "neutral" | "danger";
};

interface GameHudProps {
  snapshot: GameSnapshot;
  overlay: "map" | "inventory" | "fitting" | "missions" | null;
  setOverlay: (value: "map" | "inventory" | "fitting" | "missions" | null) => void;
  panelsVisible: boolean;
  onOpenMenu: () => void;
  onSelectOverview: (ref: SelectableRef) => void;
  onOpenContextForOverview: (ref: SelectableRef, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onSetActiveTarget: (ref: SelectableRef | null) => void;
  onUnlockTarget: (ref: SelectableRef) => void;
  onToggleModule: (slotType: ModuleSlot, slotIndex: number) => void;
  onSetWeaponHoldFire: (holdFire: boolean) => void;
  onDisengageCombat: () => void;
  onActivateBuild: (buildId: "build-1" | "build-2" | "build-3") => void;
  onActivateTacticalSlow: () => void;
  onSetTimeScale: (value: number) => void;
  onIssueCommand: (command: CommandAction) => void;
  onStopShip: () => void;
  onToggleAutopilot: () => void;
  onRecenterView: () => void;
}

function getOverviewTypeSymbol(type: SelectableRef["type"]) {
  if (type === "enemy") return "◈";
  if (type === "station") return "⬡";
  if (type === "gate") return "⊟";
  if (type === "asteroid") return "◌";
  if (type === "loot") return "◇";
  if (type === "beacon") return "⊕";
  if (type === "belt") return "◌";
  if (type === "anomaly") return "?";
  if (type === "outpost") return "⬡";
  if (type === "wreck") return "◻";
  return "·";
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getHostileWarpBlocker(world: GameSnapshot["world"]) {
  const sector = world.sectors[world.currentSectorId];
  if (!sector) return null;
  return (
    sector.enemies.find((enemy) => {
      const variant = enemyVariantById[enemy.variantId];
      if (!variant || enemy.hull <= 0) return false;
      const playerDistance = distance(enemy.position, world.player.position);
      const seesPlayer = playerDistance <= variant.lockRange * enemy.effects.lockRangeMultiplier;
      if (!seesPlayer) return false;
      return enemy.modules.some((runtime) => {
        if (!runtime.active || !runtime.moduleId) return false;
        const module = moduleById[runtime.moduleId];
        if (!module || module.kind !== "warp_disruptor") return false;
        return !module.range || playerDistance <= module.range;
      });
    }) ?? null
  );
}
function moduleCapUsePerSecond(module: (typeof moduleById)[string]) {
  if (module.capacitorDrain) return module.capacitorDrain;
  if (module.capacitorUse && module.cycleTime && module.cycleTime > 0)
    return module.capacitorUse / module.cycleTime;
  return 0;
}

function moduleCapPressureLabel(module: (typeof moduleById)[string]) {
  const c = moduleCapUsePerSecond(module);
  if (c <= 0) return "Cap-free";
  if (c < 4) return "Cap-light";
  if (c < 8) return "Cap-moderate";
  return "Cap-hungry";
}

function moduleFitAdvice(module: (typeof moduleById)[string]) {
  const c = moduleCapUsePerSecond(module);
  if (c >= 8) return "Best paired with passive shield or armor.";
  if (c >= 4) return "Balanced tank or mixed utility fit.";
  if (module.kind === "laser" || module.kind === "missile" || module.kind === "railgun" || module.kind === "cannon")
    return "Leaves room for active defense or speed modules.";
  return "Low demand; flexible fit.";
}

function formatCapTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "<1s";
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

function getSystemRiskLabel(danger: number) {
  if (danger <= 1) return "Low";
  if (danger <= 2) return "Med";
  if (danger <= 3) return "Hi";
  return "EXTR";
}

function getSystemRiskTone(danger: number): "low" | "med" | "hi" | "extr" {
  if (danger <= 1) return "low";
  if (danger <= 2) return "med";
  if (danger <= 3) return "hi";
  return "extr";
}

function getOverviewTooltip(entry: ObjectInfo) {
  const lines = [entry.name];
  if (entry.subtitle) lines.push(entry.subtitle);
  if (entry.factionLabel) lines.push(`Faction: ${entry.factionLabel}`);
  if (entry.roleLabel) lines.push(`Role: ${entry.roleLabel}`);
  if (entry.threatLabel) lines.push(`Threat: ${entry.threatLabel}`);
  if (entry.combatProfileLabel) lines.push(`Profile: ${entry.combatProfileLabel}`);
  if (entry.weaknessLabel) lines.push(entry.weaknessLabel);
  if (entry.type === "enemy") {
    if (entry.velocity !== undefined) lines.push(`Speed: ${Math.round(entry.velocity)} m/s`);
    if (entry.signatureRadius !== undefined) lines.push(`Signature: ${Math.round(entry.signatureRadius)} m`);
    if (entry.preferredRange !== undefined) lines.push(`Preferred range: ${Math.round(entry.preferredRange)} m`);
    if (entry.shieldPercent !== undefined) lines.push(`Shield: ${Math.round(entry.shieldPercent * 100)}%`);
    if (entry.armorPercent !== undefined) lines.push(`Armor: ${Math.round(entry.armorPercent * 100)}%`);
    if (entry.hullPercent !== undefined) lines.push(`Hull: ${Math.round(entry.hullPercent * 100)}%`);
  } else {
    lines.push(`Distance: ${Math.round(entry.distance)} m`);
  }
  return lines.join("\n");
}

function makeWarpButtons(target: SelectableRef, type: SelectableRef["type"]): RailButton[] {
  const makeBand = (label: string, range: number, tone?: "primary") => ({
    label,
    icon: "✦",
    command: { type: "warp" as const, target, range },
    tone: tone ?? ("neutral" as const)
  });
  switch (type) {
    case "gate":
    case "station":
    case "belt":
    case "anomaly":
    case "beacon":
    case "outpost":
      return [
        makeBand("W+0", 0, "primary"),
        makeBand("W+10", 10),
        makeBand("W+20", 20),
        makeBand("W+30", 30)
      ];
    default:
      return [makeBand("W+0", 0, "primary")];
  }
}

function makeTravelButtons(world: GameSnapshot["world"], targetInfo: ObjectInfo | null): RailButton[] {
  if (!targetInfo) return [];
  const { ref, distance } = targetInfo;
  const target = ref;
  const warpBtns = makeWarpButtons(target, ref.type);
  const defaultWarp = warpBtns[0]?.command ?? ({ type: "warp", target, range: 0 } as const);
  const approach = { type: "approach", target } as const;
  const combatRanges = ref.type === "enemy" ? getCombatControlRanges(world, ref) : null;

  switch (ref.type) {
    case "station":
      return [
        ...(distance > 320
          ? warpBtns
          : [{ icon: "→", label: "Approach", command: approach, tone: "primary" as const }]),
        { icon: "⬡", label: "Dock", command: { type: "dock", target }, disabled: distance > 165 }
      ];
    case "gate":
      return [
        ...(distance > 320
          ? warpBtns
          : [{ icon: "→", label: "Approach", command: approach, tone: "primary" as const }]),
        { icon: "⊟", label: "Jump", command: { type: "jump", target }, disabled: distance > 150 }
      ];
    case "enemy": {
      const orbitRange = combatRanges?.orbitRange ?? 180;
      const keepRange = combatRanges?.keepRange ?? 320;
      return [
        {
          icon: distance > 420 ? "✦" : "→",
          label: distance > 420 ? "W+0" : "Approach",
          command: distance > 420 ? defaultWarp : approach,
          tone: "primary"
        },
        { icon: "↺", label: `Orbit ${Math.round(orbitRange)}m`, command: { type: "orbit", target, range: orbitRange } },
        { icon: "⇤", label: `Keep ${Math.round(keepRange)}m`, command: { type: "keep_range", target, range: keepRange } }
      ];
    }
    case "asteroid":
      return [
        {
          icon: distance > 420 ? "✦" : "→",
          label: distance > 420 ? "W+0" : "Approach",
          command: distance > 420 ? defaultWarp : approach,
          tone: "primary"
        },
        { icon: "↺", label: "Orbit", command: { type: "orbit", target, range: 100 } }
      ];
    case "wreck":
    case "loot":
      return [
        {
          icon: distance > 320 ? "✦" : "→",
          label: distance > 320 ? "W+0" : "Approach",
          command: distance > 320 ? defaultWarp : approach,
          tone: "primary"
        }
      ];
    case "belt":
    case "anomaly":
    case "outpost":
    case "beacon":
      return [...warpBtns, { icon: "→", label: "Approach", command: approach }];
    default:
      return [
        {
          icon: distance > 320 ? "✦" : "→",
          label: distance > 320 ? "W+0" : "Approach",
          command: distance > 320 ? defaultWarp : approach,
          tone: "primary"
        }
      ];
  }
}

function makeActionButtons(
  targetInfo: ObjectInfo | null,
  selectedIsActive: boolean,
  onSetActiveTarget: (ref: SelectableRef | null) => void
): RailButton[] {
  if (!targetInfo) return [];
  const target = targetInfo.ref;
  const trackBtn: RailButton = {
    icon: "◎",
    label: selectedIsActive ? "Tracking" : "Track",
    onClick: () => onSetActiveTarget(selectedIsActive ? null : target),
    tone: selectedIsActive ? "primary" : "neutral"
  };
  const stopBtn: RailButton = {
    icon: "◼",
    label: "Stop",
    command: { type: "stop" },
    tone: "danger"
  };
  switch (target.type) {
    case "enemy":
      return [
        { icon: "⌖", label: "Target", command: { type: "lock", target }, disabled: selectedIsActive },
        trackBtn,
        { icon: "◈", label: "Fire", command: { type: "attack", target }, tone: "primary" },
        stopBtn
      ];
    case "asteroid":
      return [
        { icon: "⛏", label: "Mine", command: { type: "mine", target }, tone: "primary" },
        stopBtn
      ];
    case "wreck":
      return [
        { icon: "◇", label: "Salvage", command: { type: "salvage", target }, tone: "primary" },
        stopBtn
      ];
    default:
      return [stopBtn];
  }
}

export function GameHud({
  snapshot,
  overlay,
  setOverlay,
  panelsVisible,
  onOpenMenu,
  onSelectOverview,
  onOpenContextForOverview,
  onSetActiveTarget,
  onUnlockTarget: _onUnlockTarget,
  onToggleModule,
  onSetWeaponHoldFire,
  onDisengageCombat,
  onActivateBuild,
  onActivateTacticalSlow,
  onSetTimeScale,
  onIssueCommand,
  onStopShip,
  onToggleAutopilot,
  onRecenterView
}: GameHudProps) {
  const {
    world,
    derived,
    activeMission,
    selectedInfo,
    activeTargetInfo,
    lockedTargetInfos: _lockedTargetInfos,
    pendingLockInfos: _pendingLockInfos,
    overview,
    activeTransportMission,
    activeProceduralContract,
    sector,
    currentRegion: _currentRegion,
    currentHotspot: _currentHotspot
  } = snapshot;

  const ship = playerShipById[world.player.hullId];
  const boundary = world.boundary;
  const localSite = world.localSite;

  // ── Mission info
  const objectiveRef =
    activeTransportMission && activeTransportMission.objectiveSystemId === world.currentSectorId
      ? ({ id: activeTransportMission.objectiveStationId, type: "station" } as SelectableRef)
      : null;

  const activeMissionRoute = useMemo(() => {
    if (!activeMission?.targetSystemId) return null;
    const route = planRoute(world, world.currentSectorId, activeMission.targetSystemId, "safer", false);
    const targetSystem = sectorById[activeMission.targetSystemId] ?? null;
    const targetDestination = activeMission.targetDestinationId
      ? getSystemDestination(activeMission.targetSystemId, activeMission.targetDestinationId)
      : null;
    const nextStep =
      route?.steps.find((s) => s.fromSystemId === world.currentSectorId) ??
      route?.steps[0] ??
      null;
    return { route, targetSystem, targetDestination, nextStep };
  }, [
    activeMission?.id,
    activeMission?.targetDestinationId,
    activeMission?.targetSystemId,
    world.currentSectorId,
    world.unlockedSectorIds
  ]);

  const missionObjectiveRef =
    activeMission?.targetSystemId === world.currentSectorId && activeMission.targetDestinationId
      ? ({
          id: activeMission.targetDestinationId,
          type: (activeMissionRoute?.targetDestination?.kind ?? "beacon") as SelectableRef["type"]
        } as SelectableRef)
      : null;

  const nextGateRef =
    activeTransportMission?.nextGateId && activeTransportMission.jumpsRemaining > 0
      ? ({ id: activeTransportMission.nextGateId, type: "gate" } as SelectableRef)
      : null;

  const activeMissionLabel = activeMission
    ? (MISSION_TYPE_LABELS[activeMission.type] ?? activeMission.type)
    : null;

  const proceduralProgress =
    activeProceduralContract && world.procgen.activeContractState
      ? Math.round(
          contractProgressFraction(activeProceduralContract, world.procgen.activeContractState) * 100
        )
      : 0;

  const hasMission = Boolean(
    activeTransportMission || activeMission || activeProceduralContract
  );

  const missionGuideLabel =
    activeTransportMission
      ? "Haul"
      : activeProceduralContract
        ? (MISSION_TYPE_LABELS[activeProceduralContract.type] ?? activeProceduralContract.type)
        : activeMissionLabel;

  const missionGuideTarget =
    activeTransportMission
      ? activeTransportMission.objectiveText
      : activeProceduralContract
        ? activeProceduralContract.type === "transport"
          ? `→ ${getSystemDestination(activeProceduralContract.targetSystemId, activeProceduralContract.targetStationId ?? "")?.name ?? activeProceduralContract.targetSystemId}`
          : activeProceduralContract.type === "mining"
            ? `Mine ${activeProceduralContract.targetCount} ${activeProceduralContract.targetResource}`
            : `Destroy ${activeProceduralContract.targetCount} in ${sectorById[activeProceduralContract.targetSystemId]?.name ?? activeProceduralContract.targetSystemId}`
        : activeMissionRoute?.targetDestination?.name ??
          activeMissionRoute?.targetSystem?.name ??
          activeMission?.targetSystemId ??
          null;

  // ── Route tracker
  const routeTracker = useMemo(() => {
    if (activeTransportMission) {
      return {
        nextGate: activeTransportMission.nextGateName ?? "Route planned",
        jumpsRemaining: activeTransportMission.jumpsRemaining,
        routeMode: activeTransportMission.recommendedRoute
      };
    }
    if (world.routePlan) {
      return {
        nextGate: snapshot.nextRouteStep?.gateName ?? "In-system",
        jumpsRemaining: world.routePlan.steps.length,
        routeMode: world.routePlan.preference
      };
    }
    if (activeMissionRoute?.route || activeMissionRoute?.targetSystem) {
      return {
        nextGate: activeMissionRoute?.nextStep?.gateName ?? "In-system",
        jumpsRemaining: activeMissionRoute?.route?.steps.length ?? 0,
        routeMode: activeMissionRoute?.route?.preference ?? "safer"
      };
    }
    return null;
  }, [
    activeMission?.title,
    activeMissionRoute,
    activeTransportMission,
    snapshot.nextRouteStep?.gateName,
    world.routePlan
  ]);

  // ── Target state
  const selectedIsActive = Boolean(
    selectedInfo &&
      activeTargetInfo &&
      activeTargetInfo.ref.id === selectedInfo.ref.id &&
      activeTargetInfo.ref.type === selectedInfo.ref.type
  );
  const hostileWarpBlocker = getHostileWarpBlocker(world);

  // ── Capacitor status
  const stationaryCapacitorBonus = getStationaryCapacitorRegenMultiplier(world.player, derived);
  const effectiveCapacitorRegen = derived.capacitorRegen * stationaryCapacitorBonus;
  const capacitorStatus = useMemo(() => {
    const activeLoad = (["weapon", "utility", "defense"] as ModuleSlot[]).reduce(
      (total, slotType) =>
        total +
        world.player.modules[slotType].reduce((st, runtime) => {
          if (!runtime.active || !runtime.moduleId) return st;
          const m = moduleById[runtime.moduleId];
          return m ? st + moduleCapUsePerSecond(m) : st;
        }, 0),
      0
    );
    const net = effectiveCapacitorRegen - activeLoad;
    const pressure =
      activeLoad <= 0.2
        ? "idle"
        : net >= -0.4
          ? "stable"
          : net >= -3
            ? "strained"
            : "draining";
    const collapseTime = net < -0.05 ? world.player.capacitor / Math.abs(net) : null;
    return { activeLoad, net, pressure, collapseTime };
  }, [effectiveCapacitorRegen, world.player.capacitor, world.player.modules]);

  const capLabel =
    capacitorStatus.pressure === "idle"
      ? "─"
      : capacitorStatus.net >= 0
        ? `+${capacitorStatus.net.toFixed(1)}`
        : capacitorStatus.pressure === "draining"
          ? `${formatCapTime(capacitorStatus.collapseTime ?? 0)}`
          : `${capacitorStatus.net.toFixed(1)}`;

  // ── Module presentation helper
  function getModulePresentation(slotType: ModuleSlot, slotIndex: number) {
    const runtime = world.player.modules[slotType][slotIndex];
    if (!runtime?.moduleId)
      return {
        progress: 0,
        tone: "empty" as const,
        kind: null as string | null
      };

    const m = moduleById[runtime.moduleId];
    if (!m)
      return {
        progress: 0,
        tone: "empty" as const,
        kind: null as string | null
      };

    const needsTarget = Boolean(m.requiresTarget?.length);
    const hasTarget = Boolean(
      activeTargetInfo && (!m.range || activeTargetInfo.distance <= m.range)
    );
    const cycleTime = m.cycleTime ?? 0;
    const progress =
      cycleTime > 0 && runtime.cycleRemaining > 0
        ? 1 - runtime.cycleRemaining / cycleTime
        : runtime.active
          ? 1
          : 0;

    if (!runtime.active)
      return { progress: 0, tone: "idle" as const, kind: m.kind };

    if (runtime.cycleRemaining > 0)
      return { progress, tone: "cycling" as const, kind: m.kind };

    if (needsTarget && !hasTarget)
      return { progress: 0, tone: "blocked" as const, kind: m.kind };

    return { progress: 1, tone: "active" as const, kind: m.kind };
  }

  function getModuleTooltip(slotType: ModuleSlot, slotIndex: number) {
    const runtime = world.player.modules[slotType][slotIndex];
    if (!runtime?.moduleId) return "Empty slot";
    const m = moduleById[runtime.moduleId];
    if (!m) return runtime.moduleId;
    const parts = [
      m.name,
      m.description,
      `${m.category}${m.sizeClass ? ` ${m.sizeClass}` : ""}`
    ];
    if (m.optimal || m.falloff) {
      parts.push(
        `Opt ${Math.round(m.optimal ?? m.range ?? 0)}m  Falloff ${Math.round(m.falloff ?? 0)}m`
      );
    }
    if (m.tracking) parts.push(`Tracking ${m.tracking.toFixed(3)} rad/s`);
    if (m.damageProfile) {
      parts.push(
        `DMG EM${Math.round(m.damageProfile.em * 100)} TH${Math.round(m.damageProfile.thermal * 100)} KI${Math.round(m.damageProfile.kinetic * 100)} EX${Math.round(m.damageProfile.explosive * 100)}`
      );
    }
    if (m.cycleTime) parts.push(`Cycle ${m.cycleTime.toFixed(1)}s`);
    if (m.capacitorUse) parts.push(`Cap ${m.capacitorUse}/cycle`);
    if (m.capacitorDrain) parts.push(`Cap ${m.capacitorDrain}/s drain`);
    parts.push(`${moduleCapPressureLabel(m)} · ${moduleFitAdvice(m)}`);
    if (m.kind === "mining_laser") {
      const miningTier = getMiningModuleTier(m);
      const miningTargets = m.miningTargets?.length ? m.miningTargets.join(", ") : "any ore";
      parts.push(`Tier ${miningTier}`);
      parts.push(m.minesAllInRange ? "Sweeps all in range" : `Mines ${miningTargets}`);
      if (m.miningAmount) {
        const boostedYield = Math.max(1, Math.round(m.miningAmount * (m.miningYieldMultiplier ?? 1)));
        parts.push(`Yield ${boostedYield}/cycle${m.miningYieldMultiplier && m.miningYieldMultiplier !== 1 ? ` x${m.miningYieldMultiplier.toFixed(2)}` : ""}`);
      }
      if (miningTier > 1) parts.push("Better yield on lower-grade ore");
      if (m.autoMine) parts.push("Auto-mine");
    }
    if (m.kind === "salvager") {
      if (m.salvageYieldMultiplier && m.salvageYieldMultiplier > 1) {
        parts.push(`Bonus salvage +${Math.round((m.salvageYieldMultiplier - 1) * 100)}%`);
      }
      if (m.autoSalvage) parts.push("Auto-salvage");
    }
    return parts.join(" · ");
  }

  // ── Overview filter state
  const [overviewFilter, setOverviewFilter] = useState<
    "all" | "ships" | "hostile" | "stations" | "gates" | "asteroids" | "missions" | "loot"
  >("all");
  const [overviewCollapsed, setOverviewCollapsed] = useState(false);
  const [statusCollapsed, setStatusCollapsed] = useState(false);
  const [hoveredOverviewRef, setHoveredOverviewRef] = useState<SelectableRef | null>(null);

  // ── Tactical
  const tacticalSlow = world.player.tacticalSlow;
  const tacticalActive = tacticalSlow.activeRemaining > 0;
  const tacticalReady = !tacticalActive && tacticalSlow.cooldownRemaining <= 0;
  const timeScale = Math.max(0.25, Math.min(3, world.timeScale || 1));

  // ── Derived values
  const speed = Math.round(Math.hypot(world.player.velocity.x, world.player.velocity.y));
  const cargoUsed = getCargoUsed(world.player);
  const cargoCap = Math.round(derived.cargoCapacity);

  const filteredOverview = useMemo(() => {
    return overview.filter((entry) => {
      if (overviewFilter === "all") return true;
      if (overviewFilter === "ships") return entry.type === "enemy";
      if (overviewFilter === "hostile") return entry.type === "enemy";
      if (overviewFilter === "stations") return entry.type === "station";
      if (overviewFilter === "gates") return entry.type === "gate";
      if (overviewFilter === "asteroids")
        return entry.type === "asteroid" || entry.type === "belt";
      if (overviewFilter === "missions") return entry.type === "beacon";
      if (overviewFilter === "loot")
        return entry.type === "loot" || entry.type === "wreck";
      return true;
    });
  }, [overview, overviewFilter]);

  const hoveredOverviewInfo = useMemo(() => {
    if (!hoveredOverviewRef || hoveredOverviewRef.type !== "enemy") return null;
    return (
      filteredOverview.find(
        (entry) =>
          entry.ref.id === hoveredOverviewRef.id && entry.ref.type === hoveredOverviewRef.type
      ) ?? null
    );
  }, [filteredOverview, hoveredOverviewRef]);

  // ── Command buttons for selected target
  const travelButtons = makeTravelButtons(world, selectedInfo);
  const actionButtons = makeActionButtons(selectedInfo, selectedIsActive, onSetActiveTarget);
  const allCmdButtons = [...travelButtons, ...actionButtons];

  // ── Boundary zone badge
  const showBoundary = boundary.warningLevel > 0.04 && boundary.title;

  return (
    <div className={`hud-layer${panelsVisible ? "" : " panels-hidden"}`}>
      {/* Tactical VFX full-screen overlay */}
      {tacticalActive && <div className="tactical-vfx" aria-hidden="true" />}

      {/* ── System badge — top center ── */}
      <div className="sys-badge" aria-label={`${sector.name}, ${getSystemRiskLabel(sector.danger)} risk`}>
        {sector.name}
        <span
          className="sys-badge-risk"
          data-risk={getSystemRiskTone(sector.danger)}
        >
          {getSystemRiskLabel(sector.danger)}
        </span>
        {localSite.label !== sector.name && (
          <span style={{ color: "var(--text-dim)", fontSize: "0.62rem" }}>
            · {localSite.label}
          </span>
        )}
      </div>

      {/* ── Boundary alert ── */}
      {showBoundary && (
        <div
          className="boundary-badge"
          data-tone={boundary.tone}
          aria-live="polite"
        >
          {boundary.title}
          {boundary.active ? " ⊛" : boundary.zone === "recovery" ? " ⟳" : ""}
        </div>
      )}

      {/* ════════════════════════════════════════
          TOP-LEFT: Status Stack
      ════════════════════════════════════════ */}
      <div className="hud-tl">
        {/* Ship status card */}
        <div className={`status-card${statusCollapsed ? " collapsed" : ""}`}>
          <div className="status-card-head">
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                width: 14,
                height: 14,
                fontSize: "0.65rem",
                color: "var(--neon-b)",
                opacity: 0.65,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                flexShrink: 0
              }}
              title={statusCollapsed ? "Expand status" : "Collapse status"}
              onClick={() => setStatusCollapsed((c) => !c)}
            >
              {statusCollapsed ? "+" : "−"}
            </button>
            <span className="status-ship-name">{ship.name}</span>
            <span
              className={`cap-badge cap-${capacitorStatus.pressure}`}
              title={`Cap regen ${effectiveCapacitorRegen.toFixed(1)}/s · load ${capacitorStatus.activeLoad.toFixed(1)}/s`}
            >
              ⚡{capLabel}
            </span>
          </div>

          <div className="status-bars">
            <div className="sbar sbar-shield" title="Shield">
              <div
                className="sbar-fill"
                style={{ width: `${(world.player.shield / derived.maxShield) * 100}%` }}
              />
            </div>
            <div className="sbar sbar-armor" title="Armor">
              <div
                className="sbar-fill"
                style={{ width: `${(world.player.armor / derived.maxArmor) * 100}%` }}
              />
            </div>
            <div className="sbar sbar-hull" title="Hull">
              <div
                className="sbar-fill"
                style={{ width: `${(world.player.hull / derived.maxHull) * 100}%` }}
              />
            </div>
            <div className="sbar sbar-cap" title="Capacitor">
              <div
                className="sbar-fill"
                style={{
                  width: `${(world.player.capacitor / derived.capacitorCapacity) * 100}%`
                }}
              />
            </div>
          </div>

          <div className="status-stats">
            <span title="Speed">▶{speed}</span>
            <span title="Cargo">⊡{cargoUsed}/{cargoCap}</span>
            <span title="Credits">✦{world.player.credits}</span>
            {snapshot.nextRouteStep && (
              <span title="Next gate">⊟{snapshot.nextRouteStep.gateName}</span>
            )}
          </div>

          <div className={`travel-hud status-time-controls${speed > 10 ? " moving" : ""}`} aria-label="Time controls">
            <button
              type="button"
              className={`util-btn${timeScale <= 0.25 ? " dim" : ""}`}
              title={`Slow time to ${Math.max(0.25, timeScale - 0.25).toFixed(2)}x`}
              disabled={timeScale <= 0.25}
              onClick={() => onSetTimeScale(Math.max(0.25, timeScale - 0.25))}
            >
              −
            </button>
            <button
              type="button"
              className="util-btn status-time-reset"
              title={`Reset time to 1.00x (current ${timeScale.toFixed(2)}x)`}
              onClick={() => onSetTimeScale(1)}
            >
              1×
            </button>
            <button
              type="button"
              className={`util-btn${timeScale >= 3 ? " dim" : ""}`}
              title={`Speed time to ${Math.min(3, timeScale + 0.25).toFixed(2)}x`}
              disabled={timeScale >= 3}
              onClick={() => onSetTimeScale(Math.min(3, timeScale + 0.25))}
            >
              +
            </button>
            <span className="status-time-label" title={`Current time scale ${timeScale.toFixed(2)}x`}>
              {timeScale.toFixed(2)}x
            </span>
          </div>

        </div>

        {/* Route nano strip */}
        {routeTracker && (
          <div className="route-nano">
            <span className="route-nano-dest">⊟ {routeTracker.nextGate}</span>
            <span className="route-nano-meta">
              {routeTracker.jumpsRemaining}j
            </span>
          </div>
        )}

        {/* Mission nano strip */}
        {hasMission && (
          <div className="mission-nano">
            {missionGuideLabel && (
              <span className="mission-nano-label">{missionGuideLabel}</span>
            )}
            {missionGuideTarget && (
              <span className="mission-nano-target" title={missionGuideTarget}>
                {missionGuideTarget}
              </span>
            )}
            {(objectiveRef || missionObjectiveRef) && (
              <button
                type="button"
                className="mission-nano-warp"
                title="Warp to objective"
                onClick={() =>
                  onIssueCommand({
                    type: "warp",
                    target: (objectiveRef ?? missionObjectiveRef)!,
                    range: 130
                  })
                }
              >
                ✦
              </button>
            )}
          </div>
        )}

        {/* Tactical penalties */}
        {(tacticalSlow.capPenaltyRemaining > 0 || tacticalSlow.speedPenaltyRemaining > 0) && (
          <div
            style={{
              display: "flex",
              gap: 3,
              flexWrap: "wrap"
            }}
          >
            {tacticalSlow.capPenaltyRemaining > 0 && (
              <span className="status-chip">Cap −20%</span>
            )}
            {tacticalSlow.speedPenaltyRemaining > 0 && (
              <span className="status-chip">Spd −15%</span>
            )}
          </div>
        )}

        {/* Build swap in progress */}
        {world.player.buildSwap.active && (
          <div className="swap-nano">
            <span>{world.player.buildSwap.targetBuildName}</span>
            <div className="swap-nano-bar">
              <div
                className="swap-nano-fill"
                style={{
                  width: `${(1 - world.player.buildSwap.remaining / Math.max(world.player.buildSwap.duration, 0.01)) * 100}%`
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          TOP-RIGHT: Overview Panel
      ════════════════════════════════════════ */}
      <div className={`hud-tr${overviewCollapsed ? " collapsed" : ""}`}>
        <div className="ov-panel">
          {/* Header: collapse + shortcuts */}
          <div className="ov-head">
            <button
              type="button"
              className="ov-toggle-btn"
              title={overviewCollapsed ? "Expand overview" : "Collapse overview"}
              onClick={() => setOverviewCollapsed((c) => !c)}
            >
              {overviewCollapsed ? "⊞" : "⊟"}
            </button>
            <div className="ov-shortcuts">
              <button
                type="button"
                className="ov-shortcut"
                title="Menu"
                onClick={onOpenMenu}
              >
                ≡
              </button>
              <button
                type="button"
                className={`ov-shortcut${overlay === "missions" ? " active" : ""}`}
                title="Missions"
                onClick={() => setOverlay(overlay === "missions" ? null : "missions")}
              >
                ⊕
              </button>
              <button
                type="button"
                className={`ov-shortcut${overlay === "inventory" ? " active" : ""}`}
                title="Inventory"
                onClick={() => setOverlay(overlay === "inventory" ? null : "inventory")}
              >
                ⊡
              </button>
              <button
                type="button"
                className={`ov-shortcut${overlay === "fitting" ? " active" : ""}`}
                title="Fitting"
                onClick={() => setOverlay(overlay === "fitting" ? null : "fitting")}
              >
                ⚙
              </button>
              <button
                type="button"
                className={`ov-shortcut${overlay === "map" ? " active" : ""}`}
                title="Map"
                onClick={() => setOverlay(overlay === "map" ? null : "map")}
              >
                ◎
              </button>
            </div>
          </div>

          {!overviewCollapsed && (
            <>
              {/* Icon-only filter row */}
              <div className="ov-filters">
                {(
                  [
                    ["all", "ALL", "All"],
                    ["ships", "◈", "Ships"],
                    ["hostile", "⚠", "Hostile"],
                    ["stations", "⬡", "Stations"],
                    ["gates", "⊟", "Gates"],
                    ["asteroids", "◌", "Asteroids"],
                    ["missions", "⊕", "Mission"],
                    ["loot", "◇", "Loot"]
                  ] as const
                ).map(([value, icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`ov-filter${overviewFilter === value ? " active" : ""}`}
                    title={label}
                    onClick={() =>
                      setOverviewFilter(
                        value as
                          | "all"
                          | "ships"
                          | "hostile"
                          | "stations"
                          | "gates"
                          | "asteroids"
                          | "missions"
                          | "loot"
                      )
                    }
                  >
                    {icon}
                  </button>
                ))}
              </div>

              {/* Dense object list */}
              <div className="ov-list">
                {filteredOverview.map((entry) => {
                  const isSelected =
                    selectedInfo?.ref.id === entry.ref.id &&
                    selectedInfo.ref.type === entry.ref.type;
                  const isObjective =
                    Boolean(objectiveRef) &&
                    objectiveRef?.id === entry.ref.id &&
                    objectiveRef?.type === entry.ref.type;
                  const isNextGate =
                    Boolean(nextGateRef) &&
                    nextGateRef?.id === entry.ref.id &&
                    nextGateRef?.type === entry.ref.type;
                  const dist =
                    entry.distance < 1000
                      ? `${Math.round(entry.distance)}`
                      : `${(entry.distance / 1000).toFixed(1)}k`;
                  return (
                    <button
                      key={`${entry.ref.type}-${entry.ref.id}`}
                      type="button"
                      className={[
                        "ov-row",
                        isSelected ? "selected" : "",
                        isObjective ? "objective" : "",
                        isNextGate ? "waypoint" : "",
                        entry.combatProfileTone ? `cmb-${entry.combatProfileTone}` : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={getOverviewTooltip(entry)}
                      onMouseEnter={() => {
                        if (entry.type === "enemy") setHoveredOverviewRef(entry.ref);
                      }}
                      onMouseLeave={() => setHoveredOverviewRef(null)}
                      onFocus={() => {
                        if (entry.type === "enemy") setHoveredOverviewRef(entry.ref);
                      }}
                      onBlur={() => setHoveredOverviewRef(null)}
                      onClick={() => onSelectOverview(entry.ref)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onOpenContextForOverview(entry.ref, e);
                      }}
                    >
                      <span className="ov-row-icon">
                        {getOverviewTypeSymbol(entry.type)}
                      </span>
                      <span className="ov-row-name">
                        {entry.name}
                        {entry.subtitle && <small>{entry.subtitle}</small>}
                        {tacticalActive && entry.type === "enemy" && entry.threatLabel && (
                          <small>{entry.threatLabel}</small>
                        )}
                        {isObjective && <small>objective</small>}
                        {isNextGate && <small>next gate</small>}
                      </span>
                      <span className="ov-row-dist">{dist}</span>
                    </button>
                  );
                })}
                {filteredOverview.length === 0 && (
                  <div className="ov-empty">—</div>
                )}
              </div>

              {hoveredOverviewInfo && (
                <div className="ov-hover-card" aria-live="polite">
                  <div className="ov-hover-head">
                    <div className="ov-hover-title">
                      <strong>{hoveredOverviewInfo.name}</strong>
                      <small>{hoveredOverviewInfo.subtitle}</small>
                    </div>
                    {hoveredOverviewInfo.threatLabel && (
                      <span className="status-chip">{hoveredOverviewInfo.threatLabel}</span>
                    )}
                  </div>

                  <div className="ov-hover-grid">
                    <span>Faction</span>
                    <strong>{hoveredOverviewInfo.factionLabel ?? "Unknown"}</strong>
                    <span>Role</span>
                    <strong>{hoveredOverviewInfo.roleLabel ?? "Hostile"}</strong>
                    <span>Speed</span>
                    <strong>{Math.round(hoveredOverviewInfo.velocity)} m/s</strong>
                    <span>Signature</span>
                    <strong>
                      {hoveredOverviewInfo.signatureRadius
                        ? `${Math.round(hoveredOverviewInfo.signatureRadius)} m`
                        : "—"}
                    </strong>
                    <span>Preferred</span>
                    <strong>
                      {hoveredOverviewInfo.preferredRange
                        ? `${Math.round(hoveredOverviewInfo.preferredRange)} m`
                        : "—"}
                    </strong>
                    <span>Track</span>
                    <strong>
                      {hoveredOverviewInfo.angularVelocity
                        ? `${hoveredOverviewInfo.angularVelocity.toFixed(3)} rad/s`
                        : "—"}
                    </strong>
                    <span>Shield</span>
                    <strong>
                      {hoveredOverviewInfo.shieldPercent !== undefined
                        ? `${Math.round(hoveredOverviewInfo.shieldPercent * 100)}%`
                        : "—"}
                    </strong>
                    <span>Armor</span>
                    <strong>
                      {hoveredOverviewInfo.armorPercent !== undefined
                        ? `${Math.round(hoveredOverviewInfo.armorPercent * 100)}%`
                        : "—"}
                    </strong>
                    <span>Hull</span>
                    <strong>
                      {hoveredOverviewInfo.hullPercent !== undefined
                        ? `${Math.round(hoveredOverviewInfo.hullPercent * 100)}%`
                        : "—"}
                    </strong>
                  </div>

                  {hoveredOverviewInfo.combatProfileLabel && (
                    <div className="ov-hover-note">{hoveredOverviewInfo.combatProfileLabel}</div>
                  )}
                  {hoveredOverviewInfo.weaknessLabel && (
                    <div className="ov-hover-note weakness">{hoveredOverviewInfo.weaknessLabel}</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════
          BOTTOM-LEFT: Utility Strip
      ════════════════════════════════════════ */}
      <div className="hud-bl">
        <div className="util-strip">
          <div className="util-strip-row">
          {/* Stop */}
          <button
            type="button"
            className="util-btn"
            title="Stop all commands"
            onClick={onStopShip}
          >
            ◼
          </button>
          {/* Autopilot */}
          <button
            type="button"
            className={`util-btn${world.routePlan?.autoFollow ? " active" : ""}`}
            title={world.routePlan?.autoFollow ? "Autopilot ON — tap to disable" : "Autopilot OFF — tap to enable"}
            onClick={onToggleAutopilot}
          >
            ⟴
          </button>
          {/* Recenter */}
          <button
            type="button"
            className="util-btn"
            title="Recenter view on ship"
            onClick={onRecenterView}
          >
            ◎
          </button>
          {/* Disengage */}
          <button
            type="button"
            className={`util-btn${world.player.weaponHoldFire ? " active danger" : ""}`}
            title="Cease fire, drop hostile locks, and stop auto-engaging enemies"
            onClick={onDisengageCombat}
          >
            ✕
          </button>
          {/* Tactical Slow */}
          <button
            type="button"
            className={`util-btn${tacticalActive ? " active glow-tac" : ""}${!tacticalReady && !tacticalActive ? " dim" : ""}`}
            title={`Tactical Slow — ${
              tacticalActive
                ? `Active ${tacticalSlow.activeRemaining.toFixed(1)}s`
                : tacticalSlow.cooldownRemaining > 0
                  ? `Cooldown ${Math.ceil(tacticalSlow.cooldownRemaining)}s`
                  : "Ready"
            }`}
            disabled={
              !tacticalReady || Boolean(world.dockedStationId) || world.player.buildSwap.active
            }
            onClick={onActivateTacticalSlow}
          >
            ⧖
          </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          BOTTOM-CENTER: Travel HUD + Command Strip
      ════════════════════════════════════════ */}
      <div className="hud-bc">
        {/* Context command buttons — icon-first */}
        {selectedInfo && allCmdButtons.length > 0 && (
          <div className="cmd-strip">
            {allCmdButtons.map((btn, i) => (
              <button
                key={`cmd-${i}`}
                type="button"
                className={`cmd-btn${btn.tone ? ` tone-${btn.tone}` : ""}`}
                disabled={btn.disabled}
                title={btn.label}
                onClick={() => {
                  if (btn.onClick) btn.onClick();
                  if (btn.command) onIssueCommand(btn.command);
                }}
              >
                <span className="cmd-btn-icon" aria-hidden="true">
                  {btn.icon}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Selected target mini info */}
        {selectedInfo && (
          <div className="sel-target-nano">
            <span className="sel-target-name">
              {getOverviewTypeSymbol(selectedInfo.type)} {selectedInfo.name}
            </span>
            <span className="sel-target-dist">
              {Math.round(selectedInfo.distance)}m
            </span>
          </div>
        )}
        {selectedInfo && hostileWarpBlocker && (selectedInfo.type === "station" || selectedInfo.type === "gate") && (
          <div className="sel-target-warning">
            Warp blocked by {enemyVariantById[hostileWarpBlocker.variantId]?.name ?? "hostile disruptor"}.
          </div>
        )}

        {/* Travel instrument — octagonal dial */}
      </div>

      {/* ════════════════════════════════════════
          BOTTOM-RIGHT: Module Cluster
      ════════════════════════════════════════ */}
      <div className="hud-br">
        {/* Build preset buttons */}
        {world.player.savedBuilds.length > 0 && (
          <div className="build-nano">
            {world.player.savedBuilds.map((build) => {
              const changed =
                build.shipId === world.player.hullId
                  ? (["weapon", "utility", "defense"] as ModuleSlot[]).reduce(
                      (total, slotType) => {
                        const slotCount = Math.max(
                          world.player.equipped[slotType].length,
                          build.equipped[slotType].length
                        );
                        let slotChanges = 0;
                        for (let idx = 0; idx < slotCount; idx++) {
                          if (
                            (world.player.equipped[slotType][idx] ?? null) !==
                            (build.equipped[slotType][idx] ?? null)
                          )
                            slotChanges++;
                        }
                        return total + slotChanges;
                      },
                      0
                    )
                  : null;
              const isCurrent = snapshot.buildMatchId === build.id;
              const swapTarget = world.player.buildSwap.targetBuildId === build.id;
              return (
                <button
                  key={build.id}
                  type="button"
                  className={`build-nano-btn${isCurrent ? " active" : ""}${swapTarget ? " swapping" : ""}`}
                  title={
                    build.shipId !== world.player.hullId
                      ? `${build.name} — other hull`
                      : changed === 0
                        ? `${build.name} — current`
                        : `${build.name} — ${changed} changes`
                  }
                  disabled={
                    world.dockedStationId !== null ||
                    world.player.buildSwap.active ||
                    build.shipId !== world.player.hullId ||
                    changed === 0
                  }
                  onClick={() => onActivateBuild(build.id)}
                >
                  {build.name.slice(0, 1).toUpperCase()}
                </button>
              );
            })}
          </div>
        )}

        {/* Module cluster — 3 columns: WPN / UTIL / TANK */}
        <div className="mod-cluster">
          {(["weapon", "utility", "defense"] as ModuleSlot[]).map((slotType) => (
            <div key={slotType} className="mod-col">
              {slotType === "weapon" && (
                <button
                  type="button"
                  className={`mod-col-action${world.player.weaponHoldFire ? " active danger" : ""}`}
                  title={
                    world.player.weaponHoldFire
                      ? "Weapons on hold fire — tap to release auto fire"
                      : "Weapons on auto fire — tap to hold fire and fire single weapons manually"
                  }
                  onClick={() => onSetWeaponHoldFire(!world.player.weaponHoldFire)}
                >
                  ⌖
                </button>
              )}
              {/* Column icon header */}
              <div
                className="mod-col-hd"
                title={
                  slotType === "weapon"
                    ? "Weapons"
                    : slotType === "utility"
                      ? "Utility"
                      : "Defense"
                }
              >
                {slotType === "weapon" ? "⊕" : slotType === "utility" ? "⚙" : "⬡"}
              </div>

              {world.player.modules[slotType].map((runtime, index) => {
                const view = getModulePresentation(slotType, index);
                const icon = view.kind ? (MODULE_KIND_ICON[view.kind] ?? "•") : "·";
                return (
                  <button
                    key={`${slotType}-${index}-${runtime.moduleId ?? "empty"}`}
                    type="button"
                    className={`mod-btn tone-${view.tone} kind-${view.kind ?? "empty"}`}
                    disabled={!runtime.moduleId || world.player.buildSwap.active}
                    onClick={() => onToggleModule(slotType, index)}
                    title={getModuleTooltip(slotType, index)}
                  >
                    {/* Large icon — primary visual */}
                    <span className="mod-btn-icon" aria-hidden="true">
                      {icon}
                    </span>

                    {/* Cycle timer when running */}
                    {view.tone === "cycling" && runtime.cycleRemaining > 0 && (
                      <span className="mod-btn-timer">
                        {runtime.cycleRemaining.toFixed(1)}
                      </span>
                    )}

                    {/* Blocked indicator */}
                    {view.tone === "blocked" && (
                      <span className="mod-btn-wait" aria-label="Waiting for target">
                        ⊘
                      </span>
                    )}

                    {/* State dot — top-right */}
                    <span
                      className={`mod-btn-dot dot-${view.tone}`}
                      aria-hidden="true"
                    />

                    {/* Progress bar — bottom edge */}
                    <div className="mod-btn-bar" aria-hidden="true">
                      <div
                        className="mod-btn-bar-fill"
                        style={{ width: `${view.progress * 100}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
