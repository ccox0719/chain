import { useEffect, useMemo, useRef, useState } from "react";
import { factionData, factionDamageLabel, factionResistLabel } from "../game/data/factions";
import { missionCatalog } from "../game/data/missions";
import { CollapsibleSection } from "./CollapsibleSection";
import { WeaponDetailsCard } from "./WeaponDetailsCard";
import { moduleById, moduleCatalog } from "../game/data/modules";
import { playerShips } from "../game/data/ships";
import { transportMissionCatalog } from "../game/missions/data/transportMissions";
import { getSystemDestination, regionById, regionCatalog, sectorById, sectorCatalog } from "../game/data/sectors";
import { getFactionStandingLabel } from "../game/utils/factionStanding";
import { findComparableEquippedWeapon } from "../game/utils/weaponStats";
import { planRoute } from "../game/universe/routePlanning";
import { CommandAction, GameSnapshot, ModuleSlot, SelectableRef } from "../types/game";

interface SidebarPanelsProps {
  overlay: "map" | "inventory" | "fitting" | "missions";
  snapshot: GameSnapshot;
  onClose: () => void;
  onEquip: (slotType: ModuleSlot, slotIndex: number, moduleId: string | null) => void;
  onPlanRoute: (systemId: string, preference: "shortest" | "safer", autoFollow?: boolean) => void;
  onClearRoute: () => void;
  onSetRouteAutoFollow: (autoFollow: boolean) => void;
  onSelectOverview: (ref: SelectableRef | null) => void;
  onIssueCommand: (command: CommandAction) => void;
}

const OVERLAY_LABELS: Record<string, string> = {
  inventory: "⊡ Inventory",
  missions:  "⊕ Missions",
  map:       "◎ Map",
  fitting:   "⚙ Fitting",
};

const MISSION_TYPE_LABELS: Record<string, string> = {
  bounty: "Bounty",
  mining: "Mining",
  deliver: "Delivery",
  travel: "Survey",
  haul: "Haul"
};

function formatWarTimeRemaining(seconds: number) {
  if (seconds <= 0) return "ending";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (minutes <= 0) return `${secs}s`;
  return `${minutes}m ${secs.toString().padStart(2, "0")}s`;
}

function getWarIntelStateLabel(status: "announced" | "active" | "resolved") {
  if (status === "announced") return "Announced";
  if (status === "active") return "Active";
  return "Resolved";
}

const mapWidth = 2200;
const mapHeight = 1200;
const MAP_MIN_ZOOM = 0.55;
const MAP_MAX_ZOOM = 2.4;
const MAP_ZOOM_STEP = 0.12;

type PinchState = {
  distance: number;
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
  focalX: number;
  focalY: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
  dragging: boolean;
};

export function SidebarPanels({
  overlay,
  snapshot,
  onClose,
  onEquip,
  onPlanRoute,
  onClearRoute,
  onSetRouteAutoFollow,
  onSelectOverview,
  onIssueCommand
}: SidebarPanelsProps) {
  const [modalSystemId, setModalSystemId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const mapScrollRef = useRef<HTMLDivElement | null>(null);
  const pinchStateRef = useRef<PinchState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  // ESC closes modal popup first, then closes overlay
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (modalSystemId !== null) { setModalSystemId(null); return; }
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, modalSystemId]);

  useEffect(() => {
    if (overlay !== "map") return;
    setMapZoom(1);
    if (mapScrollRef.current) {
      mapScrollRef.current.scrollTop = 0;
      mapScrollRef.current.scrollLeft = 0;
    }
  }, [overlay]);

  const { world, sector, currentRegion, nextRouteStep, activeTransportMission, activeMission } = snapshot;
  const deathSummary = world.player.deathSummary;
  const activeMissionRoute = useMemo(() => {
    if (activeTransportMission) {
      const ids = activeTransportMission.routeSystemIds;
      const edgeKeys = new Set<string>();
      for (let index = 0; index < ids.length - 1; index += 1) {
        edgeKeys.add([ids[index], ids[index + 1]].sort().join(":"));
      }
      return {
        systemIds: new Set(activeTransportMission.routeSystemIds),
        edgeKeys,
        routeSteps: ids.length > 1 ? ids.length - 1 : 0,
        nextGateName: activeTransportMission.nextGateName,
        targetLabel: activeTransportMission.objectiveText
      };
    }
    if (!activeMission?.targetSystemId) {
      return { systemIds: new Set<string>(), edgeKeys: new Set<string>(), routeSteps: 0, nextGateName: null as string | null, targetLabel: null as string | null };
    }
    const route = planRoute(world, world.currentSectorId, activeMission.targetSystemId, "safer", false);
    const systemIds = new Set<string>([world.currentSectorId, ...(route?.steps.map((step) => step.toSystemId) ?? [])]);
    const edgeKeys = new Set<string>(
      route?.steps.map((step) => [step.fromSystemId, step.toSystemId].sort().join(":")) ?? []
    );
    const targetDestination = activeMission.targetDestinationId
      ? getSystemDestination(activeMission.targetSystemId, activeMission.targetDestinationId)
      : null;
    const nextStep = route?.steps.find((step) => step.fromSystemId === world.currentSectorId) ?? route?.steps[0] ?? null;
    return {
      systemIds,
      edgeKeys,
      routeSteps: route?.steps.length ?? 0,
      nextGateName: nextStep?.gateName ?? null,
      targetLabel: targetDestination?.name ?? sectorById[activeMission.targetSystemId]?.name ?? activeMission.targetSystemId
    };
  }, [
    activeMission?.id,
    activeMission?.targetDestinationId,
    activeMission?.targetSystemId,
    activeTransportMission?.missionId,
    activeTransportMission?.nextGateId,
    activeTransportMission?.nextGateName,
    activeTransportMission?.objectiveText,
    activeTransportMission?.routeSystemIds,
    world.currentSectorId,
    world.unlockedSectorIds
  ]);

  function missionTypeLabel(type: string) {
    return MISSION_TYPE_LABELS[type] ?? type;
  }

  const factionLegend = Object.values(factionData);

  function clampMapZoom(value: number) {
    return Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, Number(value.toFixed(3))));
  }

  function setMapZoomWithFocus(nextZoom: number, focalX?: number, focalY?: number) {
    const container = mapScrollRef.current;
    const clamped = clampMapZoom(nextZoom);
    if (!container) {
      setMapZoom(clamped);
      return;
    }

    const focusX = focalX ?? container.clientWidth / 2;
    const focusY = focalY ?? container.clientHeight / 2;
    const focusMapX = (container.scrollLeft + focusX) / mapZoom;
    const focusMapY = (container.scrollTop + focusY) / mapZoom;
    setMapZoom(clamped);
    requestAnimationFrame(() => {
      const next = mapScrollRef.current;
      if (!next) return;
      next.scrollLeft = Math.max(0, focusMapX * clamped - focusX);
      next.scrollTop = Math.max(0, focusMapY * clamped - focusY);
    });
  }

  function zoomMap(delta: number, focalX?: number, focalY?: number) {
    setMapZoomWithFocus(mapZoom + delta, focalX, focalY);
  }

  function handleMapWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    zoomMap(event.deltaY < 0 ? MAP_ZOOM_STEP : -MAP_ZOOM_STEP, event.clientX - rect.left, event.clientY - rect.top);
  }

  function handleMapTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2) return;
    const left = event.touches[0];
    const right = event.touches[1];
    const dx = right.clientX - left.clientX;
    const dy = right.clientY - left.clientY;
    pinchStateRef.current = {
      distance: Math.hypot(dx, dy),
      zoom: mapZoom,
      scrollLeft: mapScrollRef.current?.scrollLeft ?? 0,
      scrollTop: mapScrollRef.current?.scrollTop ?? 0,
      focalX: (left.clientX + right.clientX) * 0.5 - (mapScrollRef.current?.getBoundingClientRect().left ?? 0),
      focalY: (left.clientY + right.clientY) * 0.5 - (mapScrollRef.current?.getBoundingClientRect().top ?? 0)
    };
  }

  function handleMapTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const pinch = pinchStateRef.current;
    if (!pinch || event.touches.length !== 2) return;
    event.preventDefault();
    const left = event.touches[0];
    const right = event.touches[1];
    const dx = right.clientX - left.clientX;
    const dy = right.clientY - left.clientY;
    const nextDistance = Math.hypot(dx, dy);
    const nextZoom = clampMapZoom(pinch.zoom * (nextDistance / Math.max(1, pinch.distance)));
    const focusMapX = (pinch.scrollLeft + pinch.focalX) / pinch.zoom;
    const focusMapY = (pinch.scrollTop + pinch.focalY) / pinch.zoom;
    setMapZoom(nextZoom);
    requestAnimationFrame(() => {
      const container = mapScrollRef.current;
      if (!container) return;
      container.scrollLeft = Math.max(0, focusMapX * nextZoom - pinch.focalX);
      container.scrollTop = Math.max(0, focusMapY * nextZoom - pinch.focalY);
    });
  }

  function handleMapTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2) {
      pinchStateRef.current = null;
    }
  }

  function handleMapPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(".map-node-group")) return;
    const container = mapScrollRef.current;
    if (!container) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      dragging: false
    };
    container.setPointerCapture(event.pointerId);
  }

  function handleMapPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const container = mapScrollRef.current;
    if (!container) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.dragging && Math.hypot(deltaX, deltaY) < 5) return;
    drag.dragging = true;
    event.preventDefault();
    container.scrollLeft = Math.max(0, drag.scrollLeft - deltaX);
    container.scrollTop = Math.max(0, drag.scrollTop - deltaY);
  }

  function handleMapPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const container = mapScrollRef.current;
    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
  }

  function handleSystemNodeClick(systemId: string) {
    setModalSystemId(systemId);
  }

  const regionHulls = useMemo(() => {
    function convexHull(pts: { x: number; y: number }[]): { x: number; y: number }[] {
      if (pts.length < 3) return pts;
      const sorted = [...pts].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
      const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
        (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      const lower: typeof pts = [];
      for (const p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
      }
      const upper: typeof pts = [];
      for (let i = sorted.length - 1; i >= 0; i--) {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
      }
      lower.pop();
      upper.pop();
      return [...lower, ...upper];
    }
    const HULL_PAD = 72;
    function expandHull(hull: { x: number; y: number }[]) {
      if (hull.length === 0) return hull;
      const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
      const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
      return hull.map((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        return { x: p.x + (dx / len) * HULL_PAD, y: p.y + (dy / len) * HULL_PAD };
      });
    }
    return regionCatalog.map((region) => {
      const positions = sectorCatalog.filter((s) => s.regionId === region.id).map((s) => s.mapPosition);
      const centroid = positions.length
        ? { x: positions.reduce((s, p) => s + p.x, 0) / positions.length, y: positions.reduce((s, p) => s + p.y, 0) / positions.length }
        : { x: 0, y: 0 };
      return { region, hull: expandHull(convexHull(positions)), centroid };
    });
  }, []);

  const connectionLines = useMemo(() => {
    const seen = new Set<string>();
    return sectorCatalog.flatMap((system) =>
      system.neighbors.flatMap((neighborId) => {
        const key = [system.id, neighborId].sort().join(":");
        if (seen.has(key)) return [];
        seen.add(key);
        const neighbor = sectorById[neighborId];
        if (!neighbor) return [];
        return [[system, neighbor] as const];
      })
    );
  }, []);
  const equippedWeaponIds = world.player.equipped.weapon;
  const storedModuleEntries = moduleCatalog
    .filter((module) => Number(world.player.inventory.modules[module.id] ?? 0) > 0)
    .map((module) => ({
      module,
      count: Number(world.player.inventory.modules[module.id] ?? 0),
      compareTo: findComparableEquippedWeapon(module, equippedWeaponIds)
    }));
  const equippedModuleEntries = equippedWeaponIds
    .map((moduleId) => (moduleId ? moduleById[moduleId] ?? null : null))
    .filter((module): module is NonNullable<typeof module> => Boolean(module))
    .map((module) => ({
      module,
      compareTo:
        equippedWeaponIds
          .map((moduleId) => (moduleId ? moduleById[moduleId] ?? null : null))
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          .find((entry) => entry.id !== module.id && (entry.weaponClass ?? entry.sizeClass ?? entry.slot) === (module.weaponClass ?? module.sizeClass ?? module.slot)) ?? null
    }));
  const warBulletins = Object.values(snapshot.world.procgen.warEvents).sort((left, right) => left.announcedAt - right.announcedAt);
  const warEvents = warBulletins.filter((event) => event.status !== "resolved");
  const upcomingWarEvent = warEvents.find((event) => event.status === "announced") ?? warEvents[0] ?? null;
  const activeWarzoneLabel = upcomingWarEvent
    ? `${upcomingWarEvent.status === "announced" ? "War intel" : "Warzone"} · ${sectorById[upcomingWarEvent.systemId]?.name ?? upcomingWarEvent.systemId}`
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-panel${overlay === "map" ? " modal-panel-map" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{OVERLAY_LABELS[overlay] ?? overlay}</h2>
          <button type="button" className="ghost-button mini" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <div className="modal-body">

          {overlay === "inventory" && (
            <div className="overlay-grid">
              <section className="panel-lite">
                <CollapsibleSection
                  title="Cargo Hold"
                  subtitle={`${Object.values(world.player.cargo).reduce((sum, amount) => sum + amount, 0)} units`}
                  defaultOpen
                >
                  <ul className="plain-list">
                    {Object.entries(world.player.cargo).map(([resource, amount]) => (
                      <li key={resource}>
                        <span>{resource}</span>
                        <strong>{amount}</strong>
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
                <CollapsibleSection
                  title="Trade Goods"
                  subtitle={`${Object.values(world.player.commodities).reduce((sum, amount) => sum + amount, 0)} units`}
                >
                  <ul className="plain-list">
                    {Object.entries(world.player.commodities).map(([commodityId, amount]) => (
                      <li key={commodityId}>
                        <span>{commodityId}</span>
                        <strong>{amount}</strong>
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
                <CollapsibleSection
                  title="Mission Cargo"
                  subtitle={`${world.player.missionCargo.length} entries`}
                >
                  <ul className="stack-list">
                    {world.player.missionCargo.length === 0 ? (
                      <li>No mission cargo loaded.</li>
                    ) : (
                      world.player.missionCargo.map((entry) => (
                        <li key={`${entry.missionId}-${entry.cargoType}`}>
                          <strong>{entry.cargoType}</strong>
                          <span>{entry.volume}u</span>
                        </li>
                      ))
                    )}
                  </ul>
                </CollapsibleSection>
              </section>
              <section className="panel-lite">
                <CollapsibleSection
                  title="Weapon Rack"
                  subtitle={`${storedModuleEntries.length} stored module types`}
                  defaultOpen
                >
                  <div className="weapon-rack-list">
                    {storedModuleEntries.length > 0 ? (
                      storedModuleEntries.map(({ module, count, compareTo }) => (
                        <div key={module.id} className="weapon-rack-item">
                          <div className="weapon-rack-head">
                            <span>{count}x in storage</span>
                            <span>{module.price} cr</span>
                          </div>
                          <WeaponDetailsCard module={module} compareTo={compareTo} contextLabel="Stored" />
                        </div>
                      ))
                    ) : (
                      <div className="fit-empty-copy">No stored weapons.</div>
                    )}
                    {upcomingWarEvent && (
                      <span className="status-chip status-chip-danger">
                        War intel · {upcomingWarEvent.title} · {sectorById[upcomingWarEvent.systemId]?.name ?? upcomingWarEvent.systemId}
                      </span>
                    )}
                  </div>
                </CollapsibleSection>
                <CollapsibleSection title="Stored Modules" subtitle={`${moduleCatalog.length} types`} defaultOpen>
                  <ul className="plain-list">
                    {moduleCatalog.map((module) => (
                      <li key={module.id}>
                        <span>{module.name}</span>
                        <strong>{world.player.inventory.modules[module.id] ?? 0}</strong>
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
              </section>
            </div>
          )}

          {overlay === "missions" && (
            <div className="overlay-grid">
              <section className="panel-lite">
                {warBulletins.length > 0 && (
                  <CollapsibleSection
                    title="Station Bulletin"
                    subtitle={`${warBulletins.length} ${warBulletins.length === 1 ? "entry" : "entries"} this cycle`}
                    defaultOpen
                  >
                    <ul className="stack-list">
                      {warBulletins.map((event) => {
                        const remaining = Math.max(0, event.expiresAt - snapshot.world.elapsedTime);
                        return (
                          <li key={event.id}>
                            <strong>{event.title}</strong>
                            <div className="map-meta-row" style={{ marginTop: "0.2rem" }}>
                              <span className="status-chip status-chip-mission">{getWarIntelStateLabel(event.status)}</span>
                              <span className="status-chip" style={{ borderColor: factionData[event.alliedFactionId].color, color: factionData[event.alliedFactionId].color }}>
                                {factionData[event.alliedFactionId].icon} {factionData[event.alliedFactionId].name}
                              </span>
                              <span className="status-chip" style={{ borderColor: factionData[event.enemyFactionId].color, color: factionData[event.enemyFactionId].color }}>
                                {factionData[event.enemyFactionId].icon} {factionData[event.enemyFactionId].name}
                              </span>
                            </div>
                            <p>{event.description}</p>
                            <p>
                              {sectorById[event.systemId]?.name ?? event.systemId}
                              {" · "}
                              {event.status === "announced"
                                ? `joins in ${formatWarTimeRemaining(remaining)}`
                                : event.status === "active"
                                  ? `ends in ${formatWarTimeRemaining(remaining)}`
                                  : "resolved"}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </CollapsibleSection>
                )}
                <CollapsibleSection title="Mission Log" subtitle={`${missionCatalog.length + transportMissionCatalog.length} contracts`} defaultOpen>
                  <ul className="stack-list">
                    {missionCatalog.map((mission) => (
                      <li key={mission.id}>
                        <strong>{mission.title}</strong>
                        <span className="status-chip">{missionTypeLabel(mission.type)}</span>
                        <span className="status-chip">{world.missions[mission.id].status}</span>
                        <p>{mission.briefing}</p>
                      </li>
                    ))}
                    {transportMissionCatalog.map((mission) => {
                      const state = world.transportMissions[mission.id];
                      if (!state) return null;
                      return (
                        <li key={mission.id}>
                          <strong>{mission.title}</strong>
                          <span className="status-chip">
                            {state.status}{state.status === "active" ? (state.pickedUp ? " · delivering" : " · pickup") : ""}
                          </span>
                          <span className="status-chip">{missionTypeLabel("haul")}</span>
                          <p>{mission.description}</p>
                          <p>
                            {sectorById[mission.pickupSystemId]?.name ?? mission.pickupSystemId}
                            {" → "}
                            {sectorById[mission.destinationSystemId]?.name ?? mission.destinationSystemId}
                            {" · "}
                            {mission.cargoVolume}u {mission.cargoType}
                          </p>
                        </li>
                      );
                    })}
                    {snapshot.activeProceduralContract && snapshot.world.procgen.activeContractState && (
                      <li key={snapshot.activeProceduralContract.id}>
                        <strong>{snapshot.activeProceduralContract.title}</strong>
                        <span className="status-chip">{missionTypeLabel(snapshot.activeProceduralContract.type === "transport" ? "haul" : snapshot.activeProceduralContract.type)}</span>
                        <span className="status-chip">{snapshot.world.procgen.activeContractState.status}</span>
                        <p>{snapshot.activeProceduralContract.briefing}</p>
                      </li>
                    )}
                  </ul>
                </CollapsibleSection>
              </section>
              <section className="panel-lite">
                <CollapsibleSection title="Story Log" subtitle={`${world.storyLog.length} entries`} defaultOpen>
                  <ul className="stack-list story-log-scroll">
                    {world.storyLog.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </CollapsibleSection>
              </section>
            </div>
          )}

          {overlay === "map" && (() => {
            const modalSys = modalSystemId ? sectorById[modalSystemId] ?? null : null;
            const modalFaction = modalSys ? factionData[modalSys.controllingFaction] : null;
            const modalRegion = modalSys ? regionById[modalSys.regionId] : null;
            const modalRegionFaction = modalRegion ? factionData[modalRegion.dominantFaction] : null;
            const modalFactionStanding = modalFaction ? (world.player.factionStandings[modalFaction.id] ?? 0) : 0;
            const modalWarEvent = modalSys ? warEvents.find((event) => event.systemId === modalSys.id) ?? null : null;
            return (
              <div className="map-fullscreen-view">
                <div className="map-top-bar">
                  <div className="map-status-chips">
                    <span className="status-chip">{sector.name}</span>
                    <span className="status-chip">{currentRegion.name}</span>
                    {deathSummary && (
                      <span className="status-chip status-chip-danger">Last death · {deathSummary.wreckSystemName}</span>
                    )}
                    {world.routePlan && (
                      <span className="status-chip">Route · {world.routePlan.steps.length} jumps{world.routePlan.autoFollow ? " · auto" : ""}</span>
                    )}
                    {activeTransportMission && (
                      <span className="status-chip">
                        {activeTransportMission.objective === "pickup" ? "Pickup" : "Delivery"} · {activeTransportMission.jumpsRemaining} jumps · {activeTransportMission.routeRisk} risk
                      </span>
                    )}
                    {(activeTransportMission || activeMissionRoute.routeSteps > 0) && (
                      <span className="status-chip status-chip-mission">
                        {activeTransportMission?.title ?? activeMission?.title ?? "Mission"} · {activeTransportMission ? activeTransportMission.nextGateName ?? "En route" : activeMissionRoute.nextGateName ?? "In-system"}
                      </span>
                    )}
                    {upcomingWarEvent && (
                      <span className="status-chip status-chip-danger">
                        War intel · {upcomingWarEvent.title} · {sectorById[upcomingWarEvent.systemId]?.name ?? upcomingWarEvent.systemId}
                      </span>
                    )}
                  </div>
                  <div className="map-top-bar-right">
                    <div className="faction-legend-row">
                      {factionLegend.map((faction) => (
                        <span key={faction.id} className="status-chip faction-legend-chip" style={{ borderColor: faction.color, color: faction.color }}>
                          <span className="faction-legend-dot" style={{ background: faction.color }} />
                          {faction.icon} {faction.name}
                        </span>
                      ))}
                      {upcomingWarEvent && (
                        <span className="status-chip status-chip-danger faction-legend-chip" style={{ borderColor: "#ff6f6f", color: "#ffb2b2" }}>
                          ⚔ {activeWarzoneLabel}
                        </span>
                      )}
                    </div>
                    <div className="map-zoom-controls">
                      <button type="button" className="ghost-button mini" onClick={() => zoomMap(-MAP_ZOOM_STEP)}>−</button>
                      <button type="button" className="ghost-button mini" onClick={() => setMapZoomWithFocus(1)}>fit</button>
                      <button type="button" className="ghost-button mini" onClick={() => zoomMap(MAP_ZOOM_STEP)}>+</button>
                    </div>
                  </div>
                </div>

                <div
                  className="universe-map-scroll"
                  ref={mapScrollRef}
                  onWheel={handleMapWheel}
                  onTouchStart={handleMapTouchStart}
                  onTouchMove={handleMapTouchMove}
                  onTouchEnd={handleMapTouchEnd}
                  onPointerDown={handleMapPointerDown}
                  onPointerMove={handleMapPointerMove}
                  onPointerUp={handleMapPointerUp}
                  onPointerCancel={handleMapPointerUp}
                  onPointerLeave={handleMapPointerUp}
                >
                  <svg
                    viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                    className="universe-map"
                    style={{ width: `${mapWidth * mapZoom}px`, height: `${mapHeight * mapZoom}px` }}
                  >
                    {/* Faction region background polygons */}
                    {regionHulls.map(({ region, hull }) => (
                      <polygon
                        key={`bg-${region.id}`}
                        points={hull.map((p) => `${p.x},${p.y}`).join(" ")}
                        className="map-region-bg"
                        style={{
                          fill: factionData[region.dominantFaction].color,
                          stroke: factionData[region.dominantFaction].color,
                        }}
                      />
                    ))}

                    {/* Region name labels at centroid */}
                    {regionHulls.map(({ region, centroid }) => (
                      <text
                        key={`label-${region.id}`}
                        x={centroid.x}
                        y={centroid.y - 30}
                        textAnchor="middle"
                        className="map-region-label"
                        style={{ fill: factionData[region.dominantFaction].color }}
                      >
                        {region.name}
                      </text>
                    ))}

                    {/* Connection lines */}
                    {connectionLines.map(([from, to]) => (
                      <line
                        key={`${from.id}-${to.id}`}
                        x1={from.mapPosition.x}
                        y1={from.mapPosition.y}
                        x2={to.mapPosition.x}
                        y2={to.mapPosition.y}
                        className={`map-edge${
                          world.routePlan?.steps.some(
                            (step) =>
                              (step.fromSystemId === from.id && step.toSystemId === to.id) ||
                              (step.fromSystemId === to.id && step.toSystemId === from.id)
                          ) ? " active" : ""
                        }${activeMissionRoute.edgeKeys.has([from.id, to.id].sort().join(":")) ? " mission-route" : ""}`}
                      />
                    ))}

                    {/* System nodes */}
                    {sectorCatalog.map((system) => {
                      const faction = factionData[system.controllingFaction];
                      const influence = system.factionInfluence ?? 68;
                      const ringOpacity = Math.min(0.9, Math.max(0.4, influence / 110));
                      const isSelected = modalSystemId === system.id;
                      const isCurrent = system.id === world.currentSectorId;
                      const systemWarEvent = warEvents.find((event) => event.systemId === system.id) ?? null;
                      return (
                        <g
                          key={system.id}
                          transform={`translate(${system.mapPosition.x} ${system.mapPosition.y})`}
                          className="map-node-group"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSystemNodeClick(system.id);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            handleSystemNodeClick(system.id);
                          }}
                        >
                          <circle
                            r={isCurrent ? 24 : 18}
                            className={`map-node faction-ring${isSelected ? " selected" : ""}`}
                            style={{
                              stroke: faction.color,
                              fill: `rgba(0, 0, 0, ${isCurrent ? 0.18 : 0.12})`,
                              opacity: ringOpacity,
                            }}
                          />
                          <circle
                            r={isCurrent ? 16 : 12}
                            className={`map-node security-${system.security}${isSelected ? " selected" : ""}${
                              activeTransportMission?.pickupSystemId === system.id ? " map-pickup" : ""}${
                              activeTransportMission?.destinationSystemId === system.id ? " map-destination" : ""}${
                              activeTransportMission?.routeSystemIds.includes(system.id) ? " map-route-node" : ""}${
                              activeMissionRoute.systemIds.has(system.id) ? " mission-route-node" : ""}`}
                            style={{ fill: `${faction.color}22` }}
                          />
                          <text x={20} y={5} className="map-node-label">{system.name}</text>
                          {systemWarEvent && (
                            <>
                              <circle r={isCurrent ? 30 : 23} className={`map-node war-event-node war-event-${systemWarEvent.status}`} />
                              <text x={20} y={18} className="map-node-label war-event-label">WAR</text>
                            </>
                          )}
                          {deathSummary?.wreckSystemId === system.id && (
                            <>
                              <circle r={20} className="map-node last-death-node" />
                              <text x={20} y={18} className="map-node-label last-death-label">Last death</text>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* System info modal — bottom sheet */}
                {modalSys && modalFaction && modalRegion && modalRegionFaction && (
                  <div className="map-system-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="map-system-modal-header">
                      <div className="map-system-modal-title">
                        <span className="map-system-modal-name">{modalSys.name}</span>
                        <div className="map-meta-row" style={{ marginTop: "0.3rem" }}>
                          <span className={`status-chip security-chip-${modalSys.security}`}>{modalSys.security.toUpperCase()}</span>
                          <span className="status-chip faction-name-chip" style={{ borderColor: modalFaction.color, color: modalFaction.color }}>
                            {modalFaction.icon} {modalFaction.name}
                          </span>
                          <span className="status-chip">{modalRegion.name}</span>
                          <span className="status-chip">{modalSys.identityLabel}</span>
                          {deathSummary?.wreckSystemId === modalSys.id && (
                            <span className="status-chip status-chip-danger">Last death</span>
                          )}
                          {modalSys.factionInfluence !== undefined && (
                            <span className="status-chip" style={{ color: modalFaction.color }}>Influence {modalSys.factionInfluence}%</span>
                          )}
                          <span className="status-chip">{getFactionStandingLabel(modalFactionStanding)}</span>
                        </div>
                      </div>
                      <button type="button" className="ghost-button mini map-modal-close" onClick={() => setModalSystemId(null)}>✕</button>
                    </div>
                    <p className="map-system-modal-desc">{modalSys.description}</p>
                    <div className="map-system-modal-intel">
                      <span className="map-intel-label">Damage</span>
                      <span className="status-chip">{factionDamageLabel(modalFaction.id)}</span>
                      <span className="map-intel-label">Defense</span>
                      <span className="status-chip">{modalFaction.tankStyle}</span>
                      <span className="map-intel-label">Resists</span>
                      <span className="status-chip">{factionResistLabel(modalFaction.id)}</span>
                      <span className="map-intel-label">Region</span>
                      <span className="status-chip" style={{ color: modalRegionFaction.color, borderColor: modalRegionFaction.color }}>
                        {modalRegionFaction.icon} {modalRegionFaction.name}
                      </span>
                    </div>
                    {modalSys.contestedFactionIds?.length ? (
                      <div className="map-meta-row" style={{ marginTop: "0.4rem" }}>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginRight: "0.3rem" }}>Contested:</span>
                        {modalSys.contestedFactionIds.map((fid) => (
                          <span key={fid} className="status-chip" style={{ borderColor: factionData[fid].color, color: factionData[fid].color }}>
                            {factionData[fid].icon} {factionData[fid].name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {modalWarEvent && (
                      <div className="map-system-modal-intel" style={{ marginTop: "0.6rem" }}>
                        <span className="map-intel-label">War</span>
                        <span className="status-chip status-chip-danger">{getWarIntelStateLabel(modalWarEvent.status)}</span>
                        <span className="map-intel-label">Allies</span>
                        <span className="status-chip" style={{ borderColor: factionData[modalWarEvent.alliedFactionId].color, color: factionData[modalWarEvent.alliedFactionId].color }}>
                          {factionData[modalWarEvent.alliedFactionId].icon} {factionData[modalWarEvent.alliedFactionId].name}
                        </span>
                        <span className="map-intel-label">Hostiles</span>
                        <span className="status-chip" style={{ borderColor: factionData[modalWarEvent.enemyFactionId].color, color: factionData[modalWarEvent.enemyFactionId].color }}>
                          {factionData[modalWarEvent.enemyFactionId].icon} {factionData[modalWarEvent.enemyFactionId].name}
                        </span>
                        <span className="map-intel-label">Window</span>
                        <span className="status-chip">
                          {modalWarEvent.status === "announced"
                            ? `joins in ${formatWarTimeRemaining(Math.max(0, modalWarEvent.expiresAt - snapshot.world.elapsedTime))}`
                            : `ends in ${formatWarTimeRemaining(Math.max(0, modalWarEvent.expiresAt - snapshot.world.elapsedTime))}`}
                        </span>
                      </div>
                    )}
                    <div className="map-system-modal-actions">
                      <button
                        type="button"
                        onClick={() => { onPlanRoute(modalSys.id, "safer", false); setModalSystemId(null); }}
                      >
                        Route (Safer)
                      </button>
                      <button
                        type="button"
                        onClick={() => { onPlanRoute(modalSys.id, "shortest", false); setModalSystemId(null); }}
                      >
                        Shortest
                      </button>
                      <button
                        type="button"
                        onClick={() => { onPlanRoute(modalSys.id, "safer", true); setModalSystemId(null); }}
                      >
                        Autopilot
                      </button>
                      {world.routePlan && (
                        <button type="button" className="ghost-button" onClick={() => { onClearRoute(); }}>
                          Clear Route
                        </button>
                      )}
                    </div>
                    {nextRouteStep && (
                      <p className="map-system-modal-hint">
                        Active route: next gate {nextRouteStep.gateName} → {sectorById[nextRouteStep.toSystemId]?.name}
                      </p>
                    )}
                    {activeTransportMission && (
                      <p className="map-system-modal-hint">{activeTransportMission.objectiveText}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {overlay === "fitting" && (
            <div className="overlay-grid">
              <section className="panel-lite">
                <h3>Command Fit</h3>
                <p>{playerShips.find((ship) => ship.id === world.player.hullId)?.description}</p>
                {(["weapon", "utility", "defense"] as ModuleSlot[]).map((slotType) => (
                  <div key={slotType} className="fit-group">
                    <strong>{slotType} slots</strong>
                    {world.player.equipped[slotType].map((moduleId, index) => (
                      <label key={`${slotType}-${index}`}>
                        Slot {index + 1}
                        <select
                          value={moduleId ?? ""}
                          onChange={(event) => onEquip(slotType, index, event.target.value || null)}
                        >
                          <option value="">Empty</option>
                          {moduleCatalog
                            .filter(
                              (module) =>
                                module.slot === slotType &&
                                ((world.player.inventory.modules[module.id] ?? 0) > 0 || module.id === moduleId)
                            )
                            .map((module) => (
                              <option key={module.id} value={module.id}>
                                {module.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    ))}
                  </div>
                ))}
                <CollapsibleSection title="Equipped Modules" subtitle={`${equippedModuleEntries.length} online`} defaultOpen>
                  <div className="weapon-rack-list">
                    {equippedModuleEntries.length > 0 ? (
                      equippedModuleEntries.map(({ module, compareTo }) => (
                        <WeaponDetailsCard key={module.id} module={module} compareTo={compareTo} contextLabel="Equipped" />
                      ))
                    ) : (
                      <div className="fit-empty-copy">No modules fitted.</div>
                    )}
                  </div>
                </CollapsibleSection>
                <CollapsibleSection title="Stored Modules" subtitle={`${storedModuleEntries.length} ready to fit`}>
                  <div className="weapon-rack-list">
                    {storedModuleEntries.length > 0 ? (
                      storedModuleEntries.map(({ module, count, compareTo }) => (
                        <div key={`fit-${module.id}`} className="weapon-rack-item">
                          <div className="weapon-rack-head">
                            <span>{count}x available</span>
                            <span>{module.weaponClass ?? module.sizeClass ?? "light"}</span>
                          </div>
                          <WeaponDetailsCard module={module} compareTo={compareTo} contextLabel="Fit Compare" />
                        </div>
                      ))
                    ) : (
                      <div className="fit-empty-copy">No spare modules in storage.</div>
                    )}
                  </div>
                </CollapsibleSection>
              </section>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
