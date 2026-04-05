import type { MouseEvent as ReactMouseEvent } from "react";
import { useMemo, useState } from "react";
import { moduleById } from "../game/data/modules";
import { getSystemDestination, sectorById } from "../game/data/sectors";
import { playerShipById } from "../game/data/ships";
import { planRoute } from "../game/universe/routePlanning";
import { getCargoUsed } from "../game/utils/stats";
import { CommandAction, GameSnapshot, ModuleSlot, ObjectInfo, SelectableRef } from "../types/game";
import { contractProgressFraction } from "../game/procgen/runtime";

const MISSION_TYPE_LABELS: Record<string, string> = {
  bounty: "Bounty",
  mining: "Mining",
  deliver: "Delivery",
  travel: "Survey"
};

const MODULE_KIND_ICON: Record<string, string> = {
  laser: "◈",
  railgun: "▶▶",
  missile: "⧖",
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

// Short uppercase tags used as secondary text on module buttons (icon is primary)
const MODULE_KIND_ABBREV: Record<string, string> = {
  laser: "LASER",
  railgun: "RAIL",
  missile: "MSL",
  mining_laser: "MINE",
  afterburner: "AB",
  webifier: "WEB",
  warp_disruptor: "SCRAM",
  target_painter: "PAINT",
  tracking_disruptor: "TRCK",
  sensor_dampener: "DAMP",
  energy_neutralizer: "NEUT",
  salvager: "SALV",
  shield_booster: "SB",
  armor_repairer: "AR",
  hardener: "HARD",
  passive: ""
};

type RailButton = {
  label: string;
  icon?: string;
  command?: CommandAction;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "neutral" | "danger";
};

type WarpBand = {
  label: string;
  icon?: string;
  range: number;
  tone?: "primary" | "neutral";
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

function getSlotSymbol(slotType: ModuleSlot) {
  if (slotType === "weapon") return "⊕";
  if (slotType === "utility") return "◈";
  if (slotType === "defense") return "⬡";
  return "·";
}

function moduleCapUsePerSecond(module: (typeof moduleById)[string]) {
  if (module.capacitorDrain) return module.capacitorDrain;
  if (module.capacitorUse && module.cycleTime && module.cycleTime > 0) return module.capacitorUse / module.cycleTime;
  return 0;
}

function moduleCapPressureLabel(module: (typeof moduleById)[string]) {
  const capPerSec = moduleCapUsePerSecond(module);
  if (capPerSec <= 0) return "Cap-free";
  if (capPerSec < 4) return "Cap-light";
  if (capPerSec < 8) return "Cap-moderate";
  return "Cap-hungry";
}

function moduleFitAdvice(module: (typeof moduleById)[string]) {
  const capPerSec = moduleCapUsePerSecond(module);
  if (capPerSec >= 8) return "Best paired with passive shield or armor.";
  if (capPerSec >= 4) return "Balanced tank or mixed utility fit.";
  if (module.kind === "laser" || module.kind === "missile" || module.kind === "railgun") {
    return "Leaves room for active defense or speed modules.";
  }
  return "Low demand; flexible fit.";
}

function formatCapTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "<1s";
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

function formatAngularVelocity(value?: number) {
  if (value === undefined) return "—";
  return `${value.toFixed(3)} rad/s`;
}

function getModuleStateLabel(
  runtime: { active: boolean; cycleRemaining: number },
  needsTarget: boolean,
  hasTarget: boolean
) {
  if (!runtime.active) return "Offline";
  if (runtime.cycleRemaining > 0) return "Cycling";
  if (needsTarget && !hasTarget) return "Waiting";
  return "Online";
}

function getSystemRiskLabel(danger: number) {
  if (danger <= 1) return "Low Risk";
  if (danger <= 2) return "Medium Risk";
  if (danger <= 3) return "High Risk";
  return "Extreme Risk";
}

function getWarpBands(type: SelectableRef["type"]): WarpBand[] {
  switch (type) {
    case "gate":
      return [
        { label: "W+0", icon: "✦", range: 0, tone: "primary" },
        { label: "W+10", icon: "✦", range: 10 },
        { label: "W+20", icon: "✦", range: 20 },
        { label: "W+30", icon: "✦", range: 30 }
      ];
    case "station":
      return [
        { label: "W+0", icon: "✦", range: 0, tone: "primary" },
        { label: "W+10", icon: "✦", range: 10 },
        { label: "W+20", icon: "✦", range: 20 },
        { label: "W+30", icon: "✦", range: 30 }
      ];
    case "belt":
    case "anomaly":
    case "beacon":
    case "outpost":
      return [
        { label: "W+0", icon: "✦", range: 0, tone: "primary" },
        { label: "W+10", icon: "✦", range: 10 },
        { label: "W+20", icon: "✦", range: 20 },
        { label: "W+30", icon: "✦", range: 30 }
      ];
    default:
      return [{ label: "W+0", icon: "✦", range: 0, tone: "primary" }];
  }
}

function makeWarpButtons(target: SelectableRef, type: SelectableRef["type"]) {
  return getWarpBands(type).map((band) => ({
    label: band.label,
    icon: band.icon,
    command: { type: "warp", target, range: band.range } as const,
    tone: band.tone ?? "neutral"
  }));
}

function makeTravelButtons(targetInfo: ObjectInfo | null): RailButton[] {
  if (!targetInfo) return [];
  const { ref, distance } = targetInfo;
  const target = ref;
  const warpButtons = makeWarpButtons(target, ref.type);
  const defaultWarp = warpButtons[0]?.command ?? ({ type: "warp", target, range: 0 } as const);
  const approach = { type: "approach", target } as const;

  switch (ref.type) {
    case "station":
      return [
        ...(distance > 320 ? warpButtons : [{ icon: "→", label: "Approach", command: approach, tone: "primary" as const }]),
        { icon: "⬡", label: "Dock", command: { type: "dock", target }, disabled: distance > 165 }
      ];
    case "gate":
      return [
        ...(distance > 320 ? warpButtons : [{ icon: "→", label: "Approach", command: approach, tone: "primary" as const }]),
        { icon: "⊟", label: "Jump", command: { type: "jump", target }, disabled: distance > 150 }
      ];
    case "enemy":
      return [
        { icon: distance > 420 ? "✦" : "→", label: distance > 420 ? "W+0" : "Approach", command: distance > 420 ? defaultWarp : approach, tone: "primary" },
        { icon: "↺", label: "Orbit 180", command: { type: "orbit", target, range: 180 } },
        { icon: "⇤", label: "Keep 320", command: { type: "keep_range", target, range: 320 } }
      ];
    case "asteroid":
      return [
        { icon: distance > 420 ? "✦" : "→", label: distance > 420 ? "W+0" : "Approach", command: distance > 420 ? defaultWarp : approach, tone: "primary" },
        { icon: "↺", label: "Orbit 100", command: { type: "orbit", target, range: 100 } }
      ];
    case "wreck":
    case "loot":
      return [
        { icon: distance > 320 ? "✦" : "→", label: distance > 320 ? "W+0" : "Approach", command: distance > 320 ? defaultWarp : approach, tone: "primary" }
      ];
    case "belt":
    case "anomaly":
    case "outpost":
    case "beacon":
      return [...warpButtons, { icon: "→", label: "Approach", command: approach }];
    default:
      return [{ icon: distance > 320 ? "✦" : "→", label: distance > 320 ? "W+0" : "Approach", command: distance > 320 ? defaultWarp : approach, tone: "primary" }];
  }
}

function makeActionButtons(
  targetInfo: ObjectInfo | null,
  selectedIsLocked: boolean,
  selectedIsActive: boolean,
  onSetActiveTarget: (ref: SelectableRef | null) => void
): RailButton[] {
  if (!targetInfo) return [];
  const target = targetInfo.ref;
  const trackButton: RailButton = {
    icon: "◎",
    label: selectedIsActive ? "Tracking" : "Track",
    onClick: () => onSetActiveTarget(selectedIsActive ? null : target),
    tone: selectedIsActive ? "primary" : "neutral"
  };
  const stopButton: RailButton = { icon: "◼", label: "Stop", command: { type: "stop" }, tone: "danger" };

  switch (target.type) {
    case "enemy":
      return [
        { icon: "⌖", label: selectedIsLocked ? "Locked" : "Lock", command: { type: "lock", target }, disabled: selectedIsLocked },
        trackButton,
        { icon: "◈", label: "Fire", command: { type: "attack", target }, tone: "primary" },
        stopButton
      ];
    case "asteroid":
      return [
        { icon: "⛏", label: "Mine", command: { type: "mine", target }, tone: "primary" },
        stopButton
      ];
    case "wreck":
      return [
        { icon: "◇", label: "Salvage", command: { type: "salvage", target }, tone: "primary" },
        stopButton
      ];
    case "station":
      return [stopButton];
    case "gate":
      return [stopButton];
    default:
      return [stopButton];
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
  onUnlockTarget,
  onToggleModule,
  onSetWeaponHoldFire,
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
    lockedTargetInfos,
    pendingLockInfos,
    overview,
    activeTransportMission,
    activeProceduralContract,
    sector,
    currentRegion,
    currentHotspot
  } = snapshot;
  const ship = playerShipById[world.player.hullId];
  const boundary = world.boundary;
  const localSite = world.localSite;
  const roundedCargoCapacity = Math.round(derived.cargoCapacity);
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
    const nextStep = route?.steps.find((step) => step.fromSystemId === world.currentSectorId) ?? route?.steps[0] ?? null;
    return { route, targetSystem, targetDestination, nextStep };
  }, [activeMission?.id, activeMission?.targetDestinationId, activeMission?.targetSystemId, world.currentSectorId, world.unlockedSectorIds]);
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
  const activeMissionLabel = activeMission ? (MISSION_TYPE_LABELS[activeMission.type] ?? activeMission.type) : null;
  const [overviewFilter, setOverviewFilter] = useState<
    "all" | "ships" | "hostile" | "stations" | "gates" | "asteroids" | "missions" | "loot"
  >("all");
  const [pilotCollapsed, setPilotCollapsed] = useState(() => window.innerWidth < 900);
  const [targetCollapsed, setTargetCollapsed] = useState(false);
  const [overviewCollapsed, setOverviewCollapsed] = useState(false);
  const [missionCollapsed, setMissionCollapsed] = useState(false);
  const tacticalSlow = world.player.tacticalSlow;
  const tacticalActive = tacticalSlow.activeRemaining > 0;
  const tacticalReady = !tacticalActive && tacticalSlow.cooldownRemaining <= 0;
  const timeScale = Math.max(0.25, Math.min(3, world.timeScale || 1));
  const tacticalStatus = tacticalActive
    ? `Active ${tacticalSlow.activeRemaining.toFixed(1)}s`
    : tacticalSlow.cooldownRemaining > 0
      ? `Cooldown ${Math.ceil(tacticalSlow.cooldownRemaining)}s`
      : "Ready";
  const timeScaleOptions = [0.5, 0.75, 1, 1.5, 2, 3];
  const systemRiskLabel = getSystemRiskLabel(sector.danger);

  const filteredOverview = useMemo(() => {
    return overview.filter((entry) => {
      if (overviewFilter === "all") return true;
      if (overviewFilter === "ships") return entry.type === "enemy";
      if (overviewFilter === "hostile") return entry.type === "enemy";
      if (overviewFilter === "stations") return entry.type === "station";
      if (overviewFilter === "gates") return entry.type === "gate";
      if (overviewFilter === "asteroids") return entry.type === "asteroid" || entry.type === "belt";
      if (overviewFilter === "missions") return entry.type === "beacon";
      if (overviewFilter === "loot") return entry.type === "loot" || entry.type === "wreck";
      return true;
    });
  }, [overview, overviewFilter]);

  const capacitorStatus = useMemo(() => {
    const activeLoad = (["weapon", "utility", "defense"] as ModuleSlot[]).reduce((total, slotType) => {
      return total + world.player.modules[slotType].reduce((slotTotal, runtime) => {
        if (!runtime.active || !runtime.moduleId) return slotTotal;
        const module = moduleById[runtime.moduleId];
        return module ? slotTotal + moduleCapUsePerSecond(module) : slotTotal;
      }, 0);
    }, 0);
    const net = derived.capacitorRegen - activeLoad;
    const pressure = activeLoad <= 0.2
      ? "idle"
      : net >= -0.4
        ? "stable"
        : net >= -3
          ? "strained"
          : "draining";
    const collapseTime = net < -0.05 ? world.player.capacitor / Math.abs(net) : null;
    return {
      activeLoad,
      net,
      pressure,
      collapseTime
    };
  }, [derived.capacitorRegen, world.player.capacitor, world.player.modules]);

  function getModulePresentation(slotType: ModuleSlot, slotIndex: number) {
    const runtime = world.player.modules[slotType][slotIndex];
    if (!runtime?.moduleId) {
      return { label: "—", detail: "—", progress: 0, tone: "empty" as const, kind: null as string | null, stateLabel: "Empty" };
    }

    const module = moduleById[runtime.moduleId];
    if (!module) {
      return { label: runtime.moduleId, detail: "—", progress: 0, tone: "empty" as const, kind: null as string | null, stateLabel: "Empty" };
    }

    const needsTarget = Boolean(module.requiresTarget?.length);
    const hasTarget = Boolean(activeTargetInfo && (!module.range || activeTargetInfo.distance <= module.range));
    const capUse = moduleCapUsePerSecond(module);
    const cycleTime = module.cycleTime ?? 0;
    const progress =
      cycleTime > 0 && runtime.cycleRemaining > 0
        ? 1 - runtime.cycleRemaining / cycleTime
        : runtime.active
          ? 1
          : 0;

    if (!runtime.active) {
      return {
        label: module.name,
        detail: `Off${capUse > 0 ? ` · ${capUse.toFixed(1)}/s` : ""}`,
        progress: 0,
        tone: "idle" as const,
        kind: module.kind,
        stateLabel: "Offline"
      };
    }

    if (runtime.cycleRemaining > 0) {
      return {
        label: module.name,
        detail: `◷ ${runtime.cycleRemaining.toFixed(1)}s${capUse > 0 ? ` · ${capUse.toFixed(1)}/s` : ""}`,
        progress,
        tone: "cycling" as const,
        kind: module.kind,
        stateLabel: "Cycling"
      };
    }

    if (needsTarget && !hasTarget) {
      return {
        label: module.name,
        detail: `Wait${capUse > 0 ? ` · ${capUse.toFixed(1)}/s` : ""}`,
        progress: 0,
        tone: "blocked" as const,
        kind: module.kind,
        stateLabel: "Waiting"
      };
    }

    return {
      label: module.name,
      detail: `On${capUse > 0 ? ` · ${capUse.toFixed(1)}/s` : ""}`,
      progress: 1,
      tone: "active" as const,
      kind: module.kind,
      stateLabel: "Online"
    };
  }

  function getModuleTooltip(slotType: ModuleSlot, slotIndex: number) {
    const runtime = world.player.modules[slotType][slotIndex];
    if (!runtime?.moduleId) return "Empty slot";
    const module = moduleById[runtime.moduleId];
    if (!module) return runtime.moduleId;
    const parts = [module.description, `${module.category}${module.sizeClass ? ` ${module.sizeClass}` : ""}`];
    if (module.optimal || module.falloff) {
      parts.push(
        `Optimal ${Math.round(module.optimal ?? module.range ?? 0)} m`,
        `Falloff ${Math.round(module.falloff ?? 0)} m`
      );
    }
    if (module.tracking) parts.push(`Tracking ${module.tracking.toFixed(3)} rad/s`);
    if (module.damageProfile) {
      parts.push(
        `DMG EM ${Math.round(module.damageProfile.em * 100)} / TH ${Math.round(module.damageProfile.thermal * 100)} / KI ${Math.round(module.damageProfile.kinetic * 100)} / EX ${Math.round(module.damageProfile.explosive * 100)}`
      );
    }
    if (module.cycleTime) parts.push(`Cycle ${module.cycleTime.toFixed(1)} s`);
    if (module.capacitorUse) parts.push(`Cap ${module.capacitorUse}/cycle`);
    if (module.capacitorDrain) parts.push(`Cap ${module.capacitorDrain}/s`);
    parts.push(`${moduleCapPressureLabel(module)} • ${moduleFitAdvice(module)}`);
    if (module.kind === "mining_laser") {
      const miningTargets = module.miningTargets?.length ? module.miningTargets.join(", ") : "any ore";
      parts.push(module.minesAllInRange ? "Sweeps all asteroids in range" : `Mines ${miningTargets}`);
      if (module.miningAmount) parts.push(`Yield ${module.miningAmount}/cycle`);
    }
    if (module.speedPenalty) parts.push(`Web ${Math.round(module.speedPenalty * 100)}%`);
    if (module.signatureBonus) parts.push(`Paint +${Math.round(module.signatureBonus * 100)}% sig`);
    if (module.trackingPenalty) parts.push(`Tracking -${Math.round(module.trackingPenalty * 100)}%`);
    if (module.lockRangePenalty) parts.push(`Lock -${Math.round(module.lockRangePenalty * 100)}%`);
    if (
      module.activeModifiers?.lockRange ||
      module.activeModifiers?.turretOptimalMultiplier ||
      module.activeModifiers?.turretFalloffMultiplier
    ) {
      parts.push(
        `Active boost${module.activeModifiers.lockRange ? ` • Lock +${module.activeModifiers.lockRange}m` : ""}${
          module.activeModifiers.turretOptimalMultiplier
            ? ` • Opt x${module.activeModifiers.turretOptimalMultiplier.toFixed(2)}`
            : ""
        }${
          module.activeModifiers.turretFalloffMultiplier
            ? ` • Falloff x${module.activeModifiers.turretFalloffMultiplier.toFixed(2)}`
            : ""
        }`
      );
    }
    return parts.join(" • ");
  }

  const proceduralProgress = activeProceduralContract && world.procgen.activeContractState
    ? Math.round(contractProgressFraction(activeProceduralContract, world.procgen.activeContractState) * 100)
    : 0;
  const hasMission = Boolean(activeTransportMission || activeMission || activeProceduralContract);
  const missionGuideTitle = activeTransportMission?.title ?? activeProceduralContract?.title ?? activeMission?.title ?? null;
  const missionGuideLabel = activeTransportMission ? "Haul" : activeProceduralContract ? MISSION_TYPE_LABELS[activeProceduralContract.type] ?? activeProceduralContract.type : activeMissionLabel;
  const missionGuideTarget =
    activeTransportMission
      ? activeTransportMission.objectiveText
      : activeProceduralContract
        ? activeProceduralContract.type === "transport"
          ? `Deliver to ${getSystemDestination(activeProceduralContract.targetSystemId, activeProceduralContract.targetStationId ?? "")?.name ?? activeProceduralContract.targetSystemId}`
          : activeProceduralContract.type === "mining"
            ? `Mine ${activeProceduralContract.targetCount} ${activeProceduralContract.targetResource}`
            : `Destroy ${activeProceduralContract.targetCount} hostiles in ${sectorById[activeProceduralContract.targetSystemId]?.name ?? activeProceduralContract.targetSystemId}`
      : activeMissionRoute?.targetDestination?.name ?? activeMissionRoute?.targetSystem?.name ?? activeMission?.targetSystemId ?? null;
  const missionGuideRoute =
    activeTransportMission
      ? `${activeTransportMission.objective === "pickup" ? "Pickup" : "Delivery"} route · ${activeTransportMission.jumpsRemaining} jumps · ${activeTransportMission.routeRisk} risk${activeTransportMission.nextGateName ? ` · next ${activeTransportMission.nextGateName}` : ""}`
      : activeProceduralContract
        ? `${activeProceduralContract.riskLevel} risk · ${proceduralProgress}% progress${
            currentHotspot && currentHotspot.systemId === activeProceduralContract.targetSystemId ? ` · hotspot live` : ""
          }`
      : activeMission?.targetSystemId === world.currentSectorId
        ? "Objective is in-system"
        : activeMissionRoute?.route
          ? activeMissionRoute.route.steps.length === 0
            ? "Objective is in-system"
            : `${activeMissionRoute.route.steps.length} jumps${activeMissionRoute.route.autoFollow ? " · auto" : ""}${
                activeMissionRoute.nextStep ? ` · next ${activeMissionRoute.nextStep.gateName}` : ""
              }`
          : "Route unavailable";
  const routeTracker = useMemo(() => {
    if (activeTransportMission) {
      return {
        title: activeTransportMission.title,
        destination: activeTransportMission.objectiveText,
        currentSystem: sector.name,
        jumpsRemaining: activeTransportMission.jumpsRemaining,
        nextGate: activeTransportMission.nextGateName ?? "Route planned",
        routeMode: activeTransportMission.recommendedRoute,
        risk: activeTransportMission.routeRisk
      };
    }
    if (world.routePlan) {
      const destinationSystem = sectorById[world.routePlan.destinationSystemId];
      const destinationName =
        world.routePlan.destinationDestinationId
          ? getSystemDestination(world.routePlan.destinationSystemId, world.routePlan.destinationDestinationId)?.name
          : destinationSystem?.name;
      return {
        title: "Route Tracker",
        destination: destinationName ?? world.routePlan.destinationSystemId,
        currentSystem: sector.name,
        jumpsRemaining: world.routePlan.steps.length,
        nextGate: snapshot.nextRouteStep?.gateName ?? "In-system",
        routeMode: world.routePlan.preference,
        risk: null as string | null
      };
    }
    if (activeMissionRoute?.route || activeMissionRoute?.targetDestination || activeMissionRoute?.targetSystem) {
      return {
        title: activeMission?.title ?? "Mission Route",
        destination: activeMissionRoute?.targetDestination?.name ?? activeMissionRoute?.targetSystem?.name ?? "Objective",
        currentSystem: sector.name,
        jumpsRemaining: activeMissionRoute?.route?.steps.length ?? 0,
        nextGate: activeMissionRoute?.nextStep?.gateName ?? "In-system",
        routeMode: activeMissionRoute?.route?.preference ?? "safer",
        risk: null as string | null
      };
    }
    return null;
  }, [activeMission?.title, activeMissionRoute, activeTransportMission, sector.name, snapshot.nextRouteStep?.gateName, world.routePlan]);
  const selectedCombatTone = selectedInfo?.combatProfileTone ?? null;
  const selectedIsLocked = Boolean(
    selectedInfo && lockedTargetInfos.some((info) => info.ref.id === selectedInfo.ref.id && info.ref.type === selectedInfo.ref.type)
  );
  const selectedPendingLock = selectedInfo
    ? pendingLockInfos.find((entry) => entry.info.ref.id === selectedInfo.ref.id && entry.info.ref.type === selectedInfo.ref.type) ?? null
    : null;
  const selectedIsActive = Boolean(
    selectedInfo && activeTargetInfo && activeTargetInfo.ref.id === selectedInfo.ref.id && activeTargetInfo.ref.type === selectedInfo.ref.type
  );
  const travelButtons = makeTravelButtons(selectedInfo);
  const actionButtons = makeActionButtons(selectedInfo, selectedIsLocked, selectedIsActive, onSetActiveTarget);
  const selectedButtons = [...travelButtons, ...actionButtons];

  return (
    <div className={`hud-layer${panelsVisible ? "" : " panels-hidden"}`}>
      <div className="system-badge">
        {sector.name} · {systemRiskLabel} · {currentRegion.name}
      </div>
      <div className="system-badge" style={{ top: "3.5rem" }}>
        {localSite.label} · {localSite.subtitle}
      </div>
      {boundary.warningLevel > 0.04 && boundary.title && (
        <div
          className="system-badge"
          style={{
            top: "3.5rem",
            borderColor:
              boundary.tone === "anomaly"
                ? "rgba(200, 155, 255, 0.45)"
                : boundary.tone === "belt"
                  ? "rgba(127, 220, 255, 0.45)"
                  : boundary.tone === "mission"
                    ? "rgba(255, 166, 120, 0.45)"
                    : boundary.tone === "gate"
                      ? "rgba(255, 194, 120, 0.45)"
                      : boundary.tone === "station"
                        ? "rgba(129, 255, 210, 0.45)"
            : "rgba(127, 220, 255, 0.45)"
          }}
        >
          {boundary.title} · {boundary.profile.visualLabel}
          {boundary.zone === "recovery" ? " · recovery" : boundary.active ? " · containment" : ""}
        </div>
      )}

      <div className="hud-top">
        {tacticalActive && <div className="tactical-slow-overlay active" aria-hidden="true" />}
        <div className={`hud-window hud-window-left hud-window-pilot${pilotCollapsed ? " collapsed" : ""}`}>
          <button type="button" className="hud-edge-toggle" onClick={() => setPilotCollapsed((current) => !current)}>
            {pilotCollapsed ? "+" : "−"}
          </button>
          <div className={`hud-card pilot-card${pilotCollapsed ? " collapsed" : ""}`}>
            <h2>{ship.name}</h2>
            {!pilotCollapsed && (
              <>
                <div className="bar-stack">
                  <label title="Shield">⬡<div className="meter"><span className="shield-fill" style={{ width: `${(world.player.shield / derived.maxShield) * 100}%` }} /></div></label>
                  <label title="Armor">◼<div className="meter"><span className="armor-fill" style={{ width: `${(world.player.armor / derived.maxArmor) * 100}%` }} /></div></label>
                  <label title="Hull">▲<div className="meter"><span className="hull-fill" style={{ width: `${(world.player.hull / derived.maxHull) * 100}%` }} /></div></label>
                  <label title="Capacitor">⚡<div className="meter"><span className="cap-fill" style={{ width: `${(world.player.capacitor / derived.capacitorCapacity) * 100}%` }} /></div></label>
                </div>
                <div className="hud-stats">
                  <span title="Speed">▶ {Math.round(Math.hypot(world.player.velocity.x, world.player.velocity.y))}</span>
                  <span title="Cargo">⊡ {getCargoUsed(world.player)}/{roundedCargoCapacity}</span>
                  <span title="Credits">✦ {world.player.credits}</span>
                  {snapshot.nextRouteStep && <span title="Next gate">⊟ {snapshot.nextRouteStep.gateName}</span>}
                </div>
                <div className="tactical-status-row">
                  <span
                    className={`status-chip cap-status-chip cap-${capacitorStatus.pressure}`}
                    title={`Cap regen ${derived.capacitorRegen.toFixed(1)}/s · load ${capacitorStatus.activeLoad.toFixed(1)}/s`}
                  >
                    ⚡{" "}
                    {capacitorStatus.pressure === "idle"
                      ? "idle"
                      : capacitorStatus.net >= 0
                        ? `+${capacitorStatus.net.toFixed(1)}/s`
                        : capacitorStatus.pressure === "draining"
                          ? `${formatCapTime(capacitorStatus.collapseTime ?? 0)} dry`
                          : `${capacitorStatus.net.toFixed(1)}/s`}
                  </span>
                  {tacticalSlow.capPenaltyRemaining > 0 && <span className="status-chip">Cap −20%</span>}
                  {tacticalSlow.speedPenaltyRemaining > 0 && <span className="status-chip">Spd −15%</span>}
                </div>
                <div className="nav-readout">
                  <strong>{snapshot.navLabel}</strong>
                  <span>{snapshot.nearbyPrompt}</span>
                </div>
                {routeTracker && (
                  <div className="nav-readout">
                    <strong>{routeTracker.title}</strong>
                    <span>
                      Dest {routeTracker.destination} · Current {routeTracker.currentSystem} · Jumps {routeTracker.jumpsRemaining}
                    </span>
                    <span>
                      Next gate {routeTracker.nextGate} · Route {routeTracker.routeMode}
                      {routeTracker.risk ? ` · ${routeTracker.risk} risk` : ""}
                    </span>
                  </div>
                )}
                {boundary.warningLevel > 0.04 && boundary.detail && (
                  <div className="tactical-status-row">
                    <span className={`status-chip${boundary.active ? " active" : ""}`}>{boundary.detail}</span>
                  </div>
                )}
                <div className="hud-actions">
                  <button
                    type="button"
                    className={`ghost-button mini${world.routePlan?.autoFollow ? " active" : ""}`}
                    onClick={onToggleAutopilot}
                  >
                    {world.routePlan?.autoFollow ? "Autopilot On" : "Autopilot"}
                  </button>
                  <button type="button" className="ghost-button mini" onClick={onStopShip}>
                    Stop
                  </button>
                  <button type="button" className="ghost-button mini" onClick={onRecenterView} title="Snap view back to the player ship">
                    Recenter
                  </button>
                  <button
                    type="button"
                    className={`ghost-button mini tactical-button${tacticalActive ? " active" : ""}`}
                    onClick={onActivateTacticalSlow}
                    disabled={!tacticalReady || Boolean(world.dockedStationId) || world.player.buildSwap.active}
                    title="Briefly slow combat to read the field"
                  >
                    Slow Time
                  </button>
                </div>
                <div className="tactical-status-row">
                  <span className="status-chip" title="Current simulation speed multiplier">
                    Time x{timeScale.toFixed(timeScale % 1 === 0 ? 0 : 2)}
                  </span>
                  {timeScaleOptions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`ghost-button mini${Math.abs(timeScale - value) < 0.01 ? " active" : ""}`}
                      onClick={() => onSetTimeScale(value)}
                      title={`Set time to x${value.toFixed(value % 1 === 0 ? 0 : 2)}`}
                    >
                      x{value.toFixed(value % 1 === 0 ? 0 : 2)}
                    </button>
                  ))}
                </div>
                <div className="tactical-status-row">
                  <span className={`status-chip${tacticalActive ? " active" : ""}`}>{tacticalStatus}</span>
                </div>
                <div className="build-strip">
                  {world.player.savedBuilds.map((build) => {
                    const changed = build.shipId === world.player.hullId
                      ? (["weapon", "utility", "defense"] as ModuleSlot[]).reduce((total, slotType) => {
                          const slotCount = Math.max(world.player.equipped[slotType].length, build.equipped[slotType].length);
                          let slotChanges = 0;
                          for (let index = 0; index < slotCount; index += 1) {
                            if ((world.player.equipped[slotType][index] ?? null) !== (build.equipped[slotType][index] ?? null)) {
                              slotChanges += 1;
                            }
                          }
                          return total + slotChanges;
                        }, 0)
                      : null;
                    const swapTime = changed === null ? null : 1 + changed * 0.95;
                    const swapTarget = world.player.buildSwap.targetBuildId === build.id;
                    const isCurrent = snapshot.buildMatchId === build.id;
                    return (
                      <button
                        key={build.id}
                        type="button"
                        className={`build-button${isCurrent ? " active" : ""}${swapTarget ? " swapping" : ""}`}
                        onClick={() => onActivateBuild(build.id)}
                        disabled={
                          world.dockedStationId !== null ||
                          world.player.buildSwap.active ||
                          build.shipId !== world.player.hullId ||
                          changed === 0
                        }
                        title={
                          build.shipId !== world.player.hullId
                            ? "Saved for another hull"
                            : `${changed ?? 0} module changes • ${swapTime?.toFixed(1) ?? "0.0"}s`
                        }
                      >
                        <span>{build.name}</span>
                        <small>
                          {build.shipId === world.player.hullId
                            ? changed === 0 ? "current" : `${changed}mod · ${swapTime?.toFixed(1)}s`
                            : "other hull"}
                        </small>
                      </button>
                    );
                  })}
                </div>
                {world.player.buildSwap.active && (
                  <div className="swap-readout">
                    <strong>{world.player.buildSwap.targetBuildName}</strong>
                    <span>{world.player.buildSwap.changedModuleCount} modules · {world.player.buildSwap.remaining.toFixed(1)}s</span>
                    <div className="mini-meter">
                      <span
                        className="cap-fill"
                        style={{
                          width: `${(1 - world.player.buildSwap.remaining / Math.max(world.player.buildSwap.duration, 0.01)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="hud-middle">
        <div className={`hud-window hud-window-left hud-window-target${targetCollapsed ? " collapsed" : ""}`}>
          <button type="button" className="hud-edge-toggle" onClick={() => setTargetCollapsed((current) => !current)}>
            {targetCollapsed ? "+" : "−"}
          </button>
          <div className={`command-rail command-rail-left${targetCollapsed ? " collapsed" : ""}`}>
            {!targetCollapsed &&
              (selectedInfo ? (
                <div className="command-rail-stack">
                  {selectedButtons.map((item, index) => (
                    <button
                      key={`${item.label}-${index}`}
                      type="button"
                      className={`command-button${item.tone ? ` ${item.tone}` : ""}`}
                      disabled={item.disabled}
                      onClick={() => {
                        if (item.onClick) item.onClick();
                        if (item.command) onIssueCommand(item.command);
                      }}
                    >
                      {item.icon && <span className="cmd-icon" aria-hidden="true">{item.icon}</span>}
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="command-rail-empty">Select a target</div>
              ))}
          </div>
        </div>

        <div className={`hud-window hud-window-right hud-window-overview${overviewCollapsed ? " collapsed" : ""}`}>
          <button type="button" className="hud-edge-toggle" onClick={() => setOverviewCollapsed((current) => !current)}>
            {overviewCollapsed ? "+" : "−"}
          </button>
          <div className={`hud-card overview-panel${overviewCollapsed ? " collapsed" : ""}`}>
            <div className="overview-head">
              <p className="eyebrow" style={{ margin: 0 }}>Overview</p>
              <div className="overlay-shortcuts">
                <button type="button" title="Menu" onClick={onOpenMenu}>≡</button>
                <button type="button" title="Missions (J)" onClick={() => setOverlay(overlay === "missions" ? null : "missions")}>⊕</button>
                <button type="button" title="Inventory (I)" onClick={() => setOverlay(overlay === "inventory" ? null : "inventory")}>⊡</button>
                <button type="button" title="Fitting (F)" onClick={() => setOverlay(overlay === "fitting" ? null : "fitting")}>⚙</button>
                <button type="button" title="Map (M)" onClick={() => setOverlay(overlay === "map" ? null : "map")}>◎</button>
              </div>
            </div>
            {!overviewCollapsed && (
              <>
                <div className="overview-filters">
                  {[
                    ["all", "ALL"],
                    ["ships", "◈"],
                    ["hostile", "⚠"],
                    ["stations", "⬡"],
                    ["gates", "⊟"],
                    ["asteroids", "◌"],
                    ["missions", "⊕"],
                    ["loot", "◇"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`filter-pill${overviewFilter === value ? " active" : ""}`}
                      title={value.charAt(0).toUpperCase() + value.slice(1)}
                      onClick={() =>
                        setOverviewFilter(
                          value as "all" | "ships" | "hostile" | "stations" | "gates" | "asteroids" | "missions" | "loot"
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="overview-table">
                  <div className="overview-row overview-header-row">
                    <span>Name</span>
                    <span>Dist</span>
                  </div>
                  <div className="overview-list">
                    {filteredOverview.map((entry) => {
                      const isSelected = selectedInfo?.ref.id === entry.ref.id && selectedInfo.ref.type === entry.ref.type;
                      const isObjective =
                        Boolean(objectiveRef) &&
                        objectiveRef?.id === entry.ref.id &&
                        objectiveRef?.type === entry.ref.type;
                      const isNextGate =
                        Boolean(nextGateRef) &&
                        nextGateRef?.id === entry.ref.id &&
                        nextGateRef?.type === entry.ref.type;
                      return (
                        <button
                          key={`${entry.ref.type}-${entry.ref.id}`}
                          type="button"
                          className={`overview-row${isSelected ? " selected" : ""}${isObjective ? " objective" : ""}${isNextGate ? " waypoint" : ""}${entry.combatProfileTone ? ` combat-${entry.combatProfileTone}` : ""}`}
                          onClick={() => onSelectOverview(entry.ref)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            onOpenContextForOverview(entry.ref, event);
                          }}
                        >
                            <span className="overview-name">
                              <strong>{getOverviewTypeSymbol(entry.type)} {entry.name}</strong>
                              {entry.subtitle && <small>{entry.subtitle}</small>}
                              {entry.roleLabel && <small>{entry.roleLabel}{entry.bossLabel ? ` · ${entry.bossLabel}` : ""}</small>}
                              {entry.combatProfileLabel && <small>{entry.combatProfileLabel}</small>}
                              {tacticalActive && entry.type === "enemy" && (
                                <small>
                                  {entry.threatLabel ?? "Threat"}
                                  {entry.preferredRange ? ` • Pref ${Math.round(entry.preferredRange)}m` : ""}
                                  {entry.weaknessLabel ? ` • ${entry.weaknessLabel}` : ""}
                                </small>
                              )}
                              {isObjective && <small>objective</small>}
                              {isNextGate && <small>next gate</small>}
                            </span>
                          <span>{Math.round(entry.distance)} m</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {hasMission && (
          <div className={`hud-window hud-window-right hud-window-floating hud-window-mission${missionCollapsed ? " collapsed" : ""}`}>
            <button type="button" className="hud-edge-toggle" onClick={() => setMissionCollapsed((current) => !current)}>
              {missionCollapsed ? "+" : "−"}
            </button>
            <div className={`hud-card mission-card${missionCollapsed ? " collapsed" : ""}`}>
              <p className="eyebrow">Mission Guide</p>
              <h2>{missionGuideTitle}</h2>
              {!missionCollapsed && (
                <>
                  <div className="mission-guide-row">
                    {missionGuideLabel && <span className="status-chip">{missionGuideLabel}</span>}
                    {activeTransportMission ? (
                      <span className="status-chip">{activeTransportMission.routeRisk} risk</span>
                    ) : activeProceduralContract ? (
                      <span className="status-chip">{activeProceduralContract.riskLevel} risk</span>
                    ) : (
                      activeMissionRoute?.route && <span className="status-chip">{activeMissionRoute.route.steps.length} jumps</span>
                    )}
                    {activeProceduralContract && <span className="status-chip">{proceduralProgress}%</span>}
                  </div>
                  <p className="mission-guide-copy">
                    Target: {missionGuideTarget ?? "Unknown"}
                  </p>
                  <p className="mission-guide-copy">
                    {missionGuideRoute}
                  </p>
                  <div className="hud-actions">
                    <button type="button" className="ghost-button mini" onClick={() => setOverlay("map")}>
                      Open Map
                    </button>
                    {activeTransportMission ? (
                      objectiveRef && (
                        <button
                          type="button"
                          className="primary-button mini"
                          onClick={() => onIssueCommand({ type: "warp", target: objectiveRef, range: 130 })}
                        >
                          Warp to Objective
                        </button>
                      )
                    ) : activeProceduralContract ? (
                      <button type="button" className="ghost-button mini" onClick={() => setOverlay("missions")}>
                        Open Board
                      </button>
                    ) : (
                      missionObjectiveRef && (
                        <button
                          type="button"
                          className="primary-button mini"
                          onClick={() => onIssueCommand({ type: "warp", target: missionObjectiveRef, range: 130 })}
                        >
                          Warp to Objective
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="hud-bottom">
        <div className="module-bar">
          {(["weapon", "utility", "defense"] as ModuleSlot[]).map((slotType) => (
            <div key={slotType} className="module-group">
              <div className="module-group-label">
                <span aria-hidden="true">
                  {slotType === "weapon" ? "⚔" : slotType === "utility" ? "⚙" : "⬡"}
                </span>
                <span>{slotType === "weapon" ? "WPN" : slotType === "utility" ? "UTIL" : "TANK"}</span>
                {slotType === "weapon" && (
                  <button
                    type="button"
                    className={`ghost-button mini${world.player.weaponHoldFire ? " active" : ""}`}
                    onClick={() => onSetWeaponHoldFire(!world.player.weaponHoldFire)}
                    title={world.player.weaponHoldFire ? "Release weapons to auto-engage" : "Hold fire and preserve capacitor"}
                    style={{ marginLeft: "auto", padding: "0.2rem 0.45rem" }}
                  >
                    {world.player.weaponHoldFire ? "Hold" : "Auto"}
                  </button>
                )}
              </div>
              {world.player.modules[slotType].map((runtime, index) => {
                const view = getModulePresentation(slotType, index);
                const abbrev = view.kind ? (MODULE_KIND_ABBREV[view.kind] ?? view.kind.slice(0, 5).toUpperCase()) : "—";
                return (
                  <button
                    key={`${slotType}-${index}-${runtime.moduleId ?? "empty"}`}
                    type="button"
                    className={`module-button ${view.tone} kind-${view.kind ?? "empty"}`}
                    disabled={!runtime.moduleId || world.player.buildSwap.active}
                    onClick={() => onToggleModule(slotType, index)}
                    title={getModuleTooltip(slotType, index)}
                  >
                    <div className="module-icon-row">
                      <span className="module-icon" aria-hidden="true">
                        {view.kind ? (MODULE_KIND_ICON[view.kind] ?? "•") : "·"}
                      </span>
                      <div className="module-label-col">
                        {abbrev && <span className="module-kind-tag">{abbrev}</span>}
                        {view.tone === "cycling" && runtime.cycleRemaining > 0 ? (
                          <span className="module-state-time">{runtime.cycleRemaining.toFixed(1)}s</span>
                        ) : view.tone === "blocked" ? (
                          <span className="module-state-time module-state-wait">wait</span>
                        ) : null}
                      </div>
                      <span className={`module-state-dot dot-${view.tone}`} aria-hidden="true" />
                    </div>
                    <div className="module-progress">
                      <span style={{ width: `${view.progress * 100}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {hasMission && (
        <div className="mission-strip">
          <div className="mission-strip-head">
            <strong>{activeTransportMission?.title ?? activeMission?.title}</strong>
            {activeMissionLabel && !activeTransportMission && (
              <span className="status-chip">{activeMissionLabel}</span>
            )}
          </div>
          <p>{missionGuideRoute}</p>
          {objectiveRef && (
            <button
              type="button"
              className="ghost-button mini"
              onClick={() => onIssueCommand({ type: "warp", target: objectiveRef, range: 130 })}
            >
              Warp
            </button>
          )}
        </div>
      )}
    </div>
  );
}
