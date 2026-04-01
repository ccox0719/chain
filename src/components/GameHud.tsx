import type { MouseEvent as ReactMouseEvent } from "react";
import { useMemo, useState } from "react";
import { moduleById } from "../game/data/modules";
import { getSystemDestination, sectorById } from "../game/data/sectors";
import { playerShipById } from "../game/data/ships";
import { planRoute } from "../game/universe/routePlanning";
import { getCargoUsed } from "../game/utils/stats";
import { GameSnapshot, ModuleSlot, ResistProfile, SelectableRef } from "../types/game";

const MISSION_TYPE_LABELS: Record<string, string> = {
  bounty: "Bounty",
  mining: "Mining",
  deliver: "Delivery",
  travel: "Survey"
};

const MODULE_KIND_ICON: Record<string, string> = {
  laser: "◈",
  railgun: "▣",
  missile: "✦",
  mining_laser: "⛏",
  afterburner: "➤",
  webifier: "⟲",
  target_painter: "◍",
  tracking_disruptor: "≋",
  sensor_dampener: "◌",
  salvager: "◇",
  shield_booster: "⬡",
  armor_repairer: "◼",
  hardener: "◆",
  passive: "•"
};

const MODULE_KIND_LABEL: Record<string, string> = {
  laser: "Laser",
  railgun: "Rail",
  missile: "Missile",
  mining_laser: "Mining",
  afterburner: "Drive",
  webifier: "Web",
  target_painter: "Painter",
  tracking_disruptor: "Disrupt",
  sensor_dampener: "Dampen",
  salvager: "Salvage",
  shield_booster: "Shield",
  armor_repairer: "Armor",
  hardener: "Hardener",
  passive: "Passive"
};

interface GameHudProps {
  snapshot: GameSnapshot;
  overlay: "map" | "inventory" | "fitting" | "missions" | null;
  setOverlay: (value: "map" | "inventory" | "fitting" | "missions" | null) => void;
  panelsVisible: boolean;
  onSelectOverview: (ref: SelectableRef) => void;
  onOpenContextForOverview: (ref: SelectableRef, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onSetActiveTarget: (ref: SelectableRef | null) => void;
  onUnlockTarget: (ref: SelectableRef) => void;
  onToggleModule: (slotType: ModuleSlot, slotIndex: number) => void;
  onActivateBuild: (buildId: "build-1" | "build-2" | "build-3") => void;
  onIssueCommand: (command: { type: "warp"; target: SelectableRef; range?: number }) => void;
  onStopShip: () => void;
  onToggleAutopilot: () => void;
}

export function GameHud({
  snapshot,
  overlay,
  setOverlay,
  panelsVisible,
  onSelectOverview,
  onOpenContextForOverview,
  onSetActiveTarget,
  onUnlockTarget,
  onToggleModule,
  onActivateBuild,
  onIssueCommand,
  onStopShip,
  onToggleAutopilot
}: GameHudProps) {
  const { world, derived, activeMission, selectedInfo, activeTargetInfo, lockedTargetInfos, overview, activeTransportMission, sector, currentRegion } = snapshot;
  const ship = playerShipById[world.player.hullId];
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
  const [pilotCollapsed, setPilotCollapsed] = useState(false);
  const [targetCollapsed, setTargetCollapsed] = useState(false);
  const [overviewCollapsed, setOverviewCollapsed] = useState(false);
  const [missionCollapsed, setMissionCollapsed] = useState(false);

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

  function getModulePresentation(slotType: ModuleSlot, slotIndex: number) {
    const runtime = world.player.modules[slotType][slotIndex];
    if (!runtime?.moduleId) {
      return { label: "—", detail: "—", progress: 0, tone: "empty" as const, kind: null as string | null };
    }

    const module = moduleById[runtime.moduleId];
    if (!module) {
      return { label: runtime.moduleId, detail: "—", progress: 0, tone: "empty" as const, kind: null as string | null };
    }

    const needsTarget = Boolean(module.requiresTarget?.length);
    const hasTarget = Boolean(activeTargetInfo && (!module.range || activeTargetInfo.distance <= module.range));
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
        detail: "⏸",
        progress: 0,
        tone: "idle" as const,
        kind: module.kind
      };
    }

    if (runtime.cycleRemaining > 0) {
      return {
        label: module.name,
        detail: `◷ ${runtime.cycleRemaining.toFixed(1)}s`,
        progress,
        tone: "cycling" as const,
        kind: module.kind
      };
    }

    if (needsTarget && !hasTarget) {
      return { label: module.name, detail: "⏳", progress: 0, tone: "blocked" as const, kind: module.kind };
    }

    return { label: module.name, detail: "●", progress: 1, tone: "active" as const, kind: module.kind };
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
      parts.push(module.minesAllInRange ? `Sweeps all asteroids in range` : `Mines ${miningTargets}`);
      if (module.miningAmount) parts.push(`Yield ${module.miningAmount}/cycle`);
    }
    if (module.speedPenalty) parts.push(`Web ${Math.round(module.speedPenalty * 100)}%`);
    if (module.signatureBonus) parts.push(`Paint +${Math.round(module.signatureBonus * 100)}% sig`);
    if (module.trackingPenalty) parts.push(`Tracking -${Math.round(module.trackingPenalty * 100)}%`);
    if (module.lockRangePenalty) parts.push(`Lock -${Math.round(module.lockRangePenalty * 100)}%`);
    if (module.activeModifiers?.lockRange || module.activeModifiers?.turretOptimalMultiplier || module.activeModifiers?.turretFalloffMultiplier) {
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

  function formatResists(label: string, resists?: ResistProfile) {
    if (!resists) return null;
    return `${label} ${Math.round(resists.em * 100)}/${Math.round(resists.thermal * 100)}/${Math.round(resists.kinetic * 100)}/${Math.round(resists.explosive * 100)}`;
  }

  const hasMission = Boolean(activeTransportMission || activeMission);
  const missionGuideTitle = activeTransportMission?.title ?? activeMission?.title ?? null;
  const missionGuideLabel = activeTransportMission ? "Haul" : activeMissionLabel;
  const missionGuideTarget =
    activeTransportMission
      ? activeTransportMission.objectiveText
      : activeMissionRoute?.targetDestination?.name
        ?? activeMissionRoute?.targetSystem?.name
        ?? activeMission?.targetSystemId
        ?? null;
  const missionGuideRoute =
    activeTransportMission
      ? `${activeTransportMission.objective === "pickup" ? "Pickup" : "Delivery"} route · ${activeTransportMission.jumpsRemaining} jumps · ${activeTransportMission.routeRisk} risk${activeTransportMission.nextGateName ? ` · next ${activeTransportMission.nextGateName}` : ""}`
      : activeMission?.targetSystemId === world.currentSectorId
        ? "Objective is in-system"
        : activeMissionRoute?.route
          ? activeMissionRoute.route.steps.length === 0
            ? "Objective is in-system"
            : `${activeMissionRoute.route.steps.length} jumps${activeMissionRoute.route.autoFollow ? " · auto" : ""}${
                activeMissionRoute.nextStep ? ` · next ${activeMissionRoute.nextStep.gateName}` : ""
              }`
          : "Route unavailable";
  const selectedCombatTone = selectedInfo?.combatProfileTone ?? null;
  const activeCombatTone = activeTargetInfo?.combatProfileTone ?? null;

  return (
    <div className={`hud-layer${panelsVisible ? "" : " panels-hidden"}`}>
      {/* System name badge — centered top */}
      <div className="system-badge">
        {sector.name} · {currentRegion.name}
      </div>

      {/* TOP ROW — pilot card only */}
      <div className="hud-top">
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
          <div className="nav-readout">
            <strong>{snapshot.navLabel}</strong>
            <span>{snapshot.nearbyPrompt}</span>
          </div>
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
                      ? `${changed ?? 0}Δ · ${swapTime?.toFixed(1) ?? "0.0"}s`
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

      {/* MIDDLE ROW — target panel (left) + overview (right) */}
      <div className="hud-middle">
        <div className={`hud-window hud-window-left hud-window-target${targetCollapsed ? " collapsed" : ""}`}>
          <button type="button" className="hud-edge-toggle" onClick={() => setTargetCollapsed((current) => !current)}>
            {targetCollapsed ? "+" : "−"}
          </button>
          <div className={`hud-card target-panel${targetCollapsed ? " collapsed" : ""}`}>
            <p className="eyebrow" style={{ margin: 0 }}>Targeting</p>
          {!targetCollapsed && (
            <>
          {/* Selected object info merged into target panel */}
          {selectedInfo && (
            <div className={`selected-info${selectedCombatTone ? ` combat-${selectedCombatTone}` : ""}`}>
              <p className="eyebrow">◉ Select</p>
              <strong>{selectedInfo.name}</strong>
              <span>{getOverviewTypeSymbol(selectedInfo.type as SelectableRef["type"])} {Math.round(selectedInfo.distance)} m · ▶ {Math.round(selectedInfo.velocity)} m/s</span>
              {selectedInfo.signatureRadius !== undefined && <span>⊙ {Math.round(selectedInfo.signatureRadius)} m sig</span>}
              {selectedInfo.combatProfileLabel && <span className="profile-chip">{selectedInfo.combatProfileLabel}</span>}
              {selectedInfo.weaknessLabel && <span>{selectedInfo.weaknessLabel}</span>}
              {selectedInfo.preferredRange !== undefined && <span>Preferred range ~{Math.round(selectedInfo.preferredRange)} m</span>}
              {selectedInfo.shieldResists && <span>{formatResists("S", selectedInfo.shieldResists)}</span>}
              {selectedInfo.armorResists && <span>{formatResists("A", selectedInfo.armorResists)}</span>}
              {selectedInfo.oreRemaining !== undefined && <span>⛏ ore {selectedInfo.oreRemaining}</span>}
            </div>
          )}

          <p className="eyebrow">⊗ Locks</p>
          {lockedTargetInfos.length > 0 ? (
            <div className="target-list">
              {lockedTargetInfos.map((info) => (
                <div key={`${info.ref.type}-${info.ref.id}`} className="target-chip">
                  <button type="button" onClick={() => onSetActiveTarget(info.ref)}>
                    {info.name}
                  </button>
                  <span>{Math.round(info.distance)} m</span>
                  <button type="button" className="unlock-btn" onClick={() => onUnlockTarget(info.ref)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "0.77rem", marginBottom: "0.45rem" }}>—</p>
          )}

          <div className={`active-target-box${activeCombatTone ? ` combat-${activeCombatTone}` : ""}`}>
            <strong>◎ Active Target</strong>
            {activeTargetInfo ? (
              <>
                <span>{activeTargetInfo.name}</span>
                <span>{Math.round(activeTargetInfo.distance)} m · ▶ {Math.round(activeTargetInfo.velocity)} m/s{activeTargetInfo.angularVelocity !== undefined ? ` · ~${activeTargetInfo.angularVelocity.toFixed(3)}` : ""}</span>
                {activeTargetInfo.signatureRadius !== undefined && <span>⊙ {Math.round(activeTargetInfo.signatureRadius)} m</span>}
                {activeTargetInfo.combatProfileLabel && <span className="profile-chip">{activeTargetInfo.combatProfileLabel}</span>}
                {activeTargetInfo.weaknessLabel && <span>{activeTargetInfo.weaknessLabel}</span>}
                {activeTargetInfo.preferredRange !== undefined && <span>Preferred range ~{Math.round(activeTargetInfo.preferredRange)} m</span>}
                {activeTargetInfo.shieldResists && <span>{formatResists("S", activeTargetInfo.shieldResists)}</span>}
                {activeTargetInfo.armorResists && <span>{formatResists("A", activeTargetInfo.armorResists)}</span>}
                {activeTargetInfo.shieldPercent !== undefined && (
                  <div className="mini-meter" title="Shield"><span className="shield-fill" style={{ width: `${activeTargetInfo.shieldPercent * 100}%` }} /></div>
                )}
                {activeTargetInfo.armorPercent !== undefined && (
                  <div className="mini-meter" title="Armor"><span className="armor-fill" style={{ width: `${activeTargetInfo.armorPercent * 100}%` }} /></div>
                )}
                {activeTargetInfo.hullPercent !== undefined && (
                  <div className="mini-meter" title="Hull"><span className="hull-fill" style={{ width: `${activeTargetInfo.hullPercent * 100}%` }} /></div>
                )}
              </>
            ) : (
              <span>—</span>
            )}
          </div>
            </>
          )}
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
              <span>Type</span>
              <span>Dist</span>
              <span>Vel</span>
              <span>Faction</span>
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
                    onClick={(event) => onOpenContextForOverview(entry.ref, event)}
                  >
                    <span className="overview-name">
                      <strong>{entry.name}</strong>
                      {entry.subtitle && <small>{entry.subtitle}</small>}
                      {entry.combatProfileLabel && <small>{entry.combatProfileLabel}</small>}
                      {isObjective && <small>objective</small>}
                      {isNextGate && <small>next gate</small>}
                    </span>
                    <span title={entry.type}>{getOverviewTypeSymbol(entry.type)}</span>
                    <span>{Math.round(entry.distance)} m</span>
                    <span>{Math.round(entry.velocity)}</span>
                    <span>
                      {entry.factionLabel && entry.threatLabel
                        ? `${entry.factionLabel} · ${entry.threatLabel}`
                        : entry.factionLabel ?? entry.threatLabel ?? "-"}
                    </span>
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
              ) : (
                activeMissionRoute?.route && <span className="status-chip">{activeMissionRoute.route.steps.length} jumps</span>
              )}
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

      {/* BOTTOM ROW — module bar */}
      <div className="hud-bottom">
        <div className="module-bar">
          {(["weapon", "utility", "defense"] as ModuleSlot[]).map((slotType) =>
            world.player.modules[slotType].map((runtime, index) => {
              const view = getModulePresentation(slotType, index);
              return (
                <button
                  key={`${slotType}-${index}-${runtime.moduleId ?? "empty"}`}
                  type="button"
                  className={`module-button ${view.tone} kind-${view.kind ?? "empty"}`}
                  disabled={!runtime.moduleId || world.player.buildSwap.active}
                  onClick={() => onToggleModule(slotType, index)}
                  title={getModuleTooltip(slotType, index)}
                >
                  <span className="module-kind-badge" aria-hidden="true">
                    {view.kind ? (MODULE_KIND_ICON[view.kind] ?? "•") : "·"}
                  </span>
                  <div className="module-copy">
                    <span>
                      {view.label}
                      {view.kind && <small>{MODULE_KIND_LABEL[view.kind] ?? view.kind}</small>}
                    </span>
                    <span>{getSlotSymbol(slotType)}</span>
                  </div>
                  <div className="module-state">
                    <span>{view.detail}</span>
                    <div className="module-meter">
                      <span style={{ width: `${view.progress * 100}%` }} />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* MISSION STRIP — floating above module bar, right side */}
      {hasMission && (
        <div className="mission-strip">
          <strong>
            {activeTransportMission?.title ?? activeMission?.title}
          </strong>
          {activeMissionLabel && !activeTransportMission && (
            <span className="status-chip">{activeMissionLabel}</span>
          )}
          <p>
            {activeTransportMission
              ? `${activeTransportMission.objectiveText} · ${activeTransportMission.jumpsRemaining} jumps · ${activeTransportMission.routeRisk} risk`
              : activeMission?.briefing}
          </p>
          {objectiveRef && (
            <button
              type="button"
              className="ghost-button mini"
              onClick={() => onIssueCommand({ type: "warp", target: objectiveRef, range: 130 })}
            >
              Warp to Objective
            </button>
          )}
        </div>
      )}
    </div>
  );
}
