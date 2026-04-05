import { useEffect, useMemo, useState } from "react";
import { factionData, factionDamageLabel, factionResistLabel } from "../game/data/factions";
import { missionCatalog } from "../game/data/missions";
import { CollapsibleSection } from "./CollapsibleSection";
import { WeaponDetailsCard } from "./WeaponDetailsCard";
import { moduleById, moduleCatalog } from "../game/data/modules";
import { playerShips } from "../game/data/ships";
import { transportMissionCatalog } from "../game/missions/data/transportMissions";
import { getSystemDestination, getSystemDestinations, regionById, regionCatalog, sectorById, sectorCatalog } from "../game/data/sectors";
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

const mapWidth = 1120;
const mapHeight = 560;

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
  const [selectedSystemId, setSelectedSystemId] = useState(snapshot.world.currentSectorId);

  // ESC closes this modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const { world, sector, currentRegion, nextRouteStep, activeTransportMission, activeMission } = snapshot;
  const deathSummary = world.player.deathSummary;
  const selectedSystem = sectorById[selectedSystemId] ?? sector;
  const selectedRegion = regionById[selectedSystem.regionId];
  const selectedFaction = factionData[selectedSystem.controllingFaction];
  const regionFaction = factionData[selectedRegion.dominantFaction];
  const localDestinations = getSystemDestinations(world.currentSectorId);
  const objectiveInCurrentSystem =
    activeTransportMission && activeTransportMission.objectiveSystemId === world.currentSectorId
      ? activeTransportMission.objectiveStationId
      : null;
  const nextGateId = activeTransportMission?.nextGateId ?? nextRouteStep?.gateId ?? null;
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
                <CollapsibleSection title="Story Log" subtitle={`${world.storyLog.length} entries`}>
                  <ul className="stack-list">
                    {world.storyLog.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </CollapsibleSection>
              </section>
            </div>
          )}

          {overlay === "map" && (
            <div className="map-overlay-grid">
              <section className="panel-lite map-primary-panel">
                <h3>Universe</h3>
                <div className="map-meta-row">
                  <span className="status-chip">{sector.name}</span>
                  <span className="status-chip">{currentRegion.name}</span>
                  {deathSummary && (
                    <span className="status-chip status-chip-danger">
                      Last death · {deathSummary.wreckSystemName}
                    </span>
                  )}
                  {world.routePlan && (
                    <span className="status-chip">
                      Route {world.routePlan.steps.length} jumps{world.routePlan.autoFollow ? " · auto" : ""}
                    </span>
                  )}
                  {activeTransportMission && (
                    <span className="status-chip">
                      {activeTransportMission.objective === "pickup" ? "Pickup" : "Delivery"} ·
                      {" "}{activeTransportMission.jumpsRemaining} jumps ·
                      {" "}{activeTransportMission.routeRisk} risk
                    </span>
                  )}
                </div>
                {(activeTransportMission || activeMissionRoute.routeSteps > 0 || activeMissionRoute.targetLabel) && (
                  <div className="mission-route-banner">
                    <div>
                      <strong>
                        {activeTransportMission?.title ?? activeMission?.title ?? "Mission route"}
                      </strong>
                      <p>
                        {activeTransportMission
                          ? activeTransportMission.objectiveText
                          : `Target: ${activeMissionRoute.targetLabel ?? activeMission?.targetSystemId ?? "Unknown"}`}
                      </p>
                    </div>
                    <div className="mission-route-meta">
                      <span className="status-chip">
                        {activeTransportMission
                          ? `${activeTransportMission.jumpsRemaining} jumps`
                          : `${activeMissionRoute.routeSteps} jumps`}
                      </span>
                      <span className="status-chip">
                        {activeTransportMission
                          ? activeTransportMission.nextGateName ?? "Route planned"
                          : activeMissionRoute.nextGateName ?? "In-system"}
                      </span>
                    </div>
                  </div>
                )}
                <div className="faction-legend-row">
                  {factionLegend.map((faction) => (
                    <span
                      key={faction.id}
                      className="status-chip faction-legend-chip"
                      style={{ borderColor: faction.color, color: faction.color }}
                    >
                      <span className="faction-legend-dot" style={{ background: faction.color }} />
                      {faction.icon} {faction.name}
                    </span>
                  ))}
                </div>
                <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="universe-map">
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
                  {regionCatalog.map((region) => (
                    <text
                      key={region.id}
                      x={Math.min(...sectorCatalog.filter((s) => s.regionId === region.id).map((s) => s.mapPosition.x))}
                      y={Math.min(...sectorCatalog.filter((s) => s.regionId === region.id).map((s) => s.mapPosition.y)) - 22}
                      className="map-region-label"
                      style={{ fill: factionData[region.dominantFaction].color }}
                    >
                      {region.name}
                    </text>
                  ))}
                  {sectorCatalog.map((system) => {
                    const faction = factionData[system.controllingFaction];
                    const influence = system.factionInfluence ?? 68;
                    const ringOpacity = Math.min(0.9, Math.max(0.4, influence / 110));
                    return (
                      <g
                        key={system.id}
                        transform={`translate(${system.mapPosition.x} ${system.mapPosition.y})`}
                        className="map-node-group"
                        onClick={() => setSelectedSystemId(system.id)}
                      >
                        <circle
                          r={system.id === world.currentSectorId ? 24 : 18}
                          className={`map-node faction-ring${selectedSystemId === system.id ? " selected" : ""}`}
                          style={{
                            stroke: faction.color,
                            fill: `rgba(0, 0, 0, ${system.id === world.currentSectorId ? 0.18 : 0.12})`,
                            opacity: ringOpacity
                          }}
                        />
                        <circle
                          r={system.id === world.currentSectorId ? 16 : 12}
                          className={`map-node security-${system.security}${
                            selectedSystemId === system.id ? " selected" : ""
                          }${activeTransportMission?.pickupSystemId === system.id ? " map-pickup" : ""}${
                            activeTransportMission?.destinationSystemId === system.id ? " map-destination" : ""
                          }${activeTransportMission?.routeSystemIds.includes(system.id) ? " map-route-node" : ""}${
                            activeMissionRoute.systemIds.has(system.id) ? " mission-route-node" : ""
                          }`}
                          style={{ fill: `${faction.color}22` }}
                        />
                        <text x={20} y={5} className="map-node-label">
                          {system.name}
                        </text>
                        {deathSummary?.wreckSystemId === system.id && (
                          <>
                            <circle r={20} className="map-node last-death-node" />
                            <text x={20} y={18} className="map-node-label last-death-label">
                              Last death
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </section>

              <section className="panel-lite map-sidebar-panel">
                <h3>{selectedSystem.name}</h3>
                <p>{selectedSystem.description}</p>
                <div className="map-meta-grid">
                  <span className="status-chip">{selectedSystem.identityLabel}</span>
                  <span className="status-chip">{regionById[selectedSystem.regionId].name}</span>
                  <span className="status-chip">{selectedSystem.security.toUpperCase()}</span>
                  <span className="status-chip">{selectedSystem.traffic} traffic</span>
                  <span className="status-chip">{selectedSystem.population}</span>
                  {deathSummary?.wreckSystemId === selectedSystem.id && (
                    <span className="status-chip status-chip-danger">Last death here</span>
                  )}
                </div>
                <div className="faction-intel-card" style={{ borderColor: selectedFaction.color }}>
                  <div className="mission-card-header" style={{ marginBottom: "0.35rem" }}>
                    <strong>Faction Intel</strong>
                    <span className="status-chip faction-name-chip" style={{ borderColor: selectedFaction.color, color: selectedFaction.color }}>
                      {selectedFaction.icon} {selectedFaction.name}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 0.45rem" }}>{selectedFaction.description}</p>
                  <p style={{ margin: "0 0 0.45rem", color: "var(--text-dim)" }}>{selectedFaction.doctrineSummary}</p>
                  <div className="map-meta-grid">
                    <span className="status-chip">Damage {factionDamageLabel(selectedFaction.id)}</span>
                    <span className="status-chip">Defense {selectedFaction.tankStyle}</span>
                    <span className="status-chip">Resists {factionResistLabel(selectedFaction.id)}</span>
                    {selectedSystem.factionInfluence !== undefined && (
                      <span className="status-chip">Influence {selectedSystem.factionInfluence}%</span>
                    )}
                  </div>
                  <p style={{ margin: "0.45rem 0 0", color: "var(--text-dim)" }}>
                    {selectedSystem.threatSummary ?? selectedFaction.threatSummary}
                  </p>
                  <div className="tag-row" style={{ marginTop: "0.45rem" }}>
                    {selectedFaction.enemyArchetypePreferences.map((entry) => (
                      <span key={entry} className="status-chip">{entry}</span>
                    ))}
                  </div>
                  <p style={{ margin: "0.45rem 0 0", color: "var(--text-dim)", fontSize: "0.8rem" }}>
                    Prep: {selectedFaction.prepAdvice}
                  </p>
                  {selectedSystem.contestedFactionIds?.length ? (
                    <div className="tag-row" style={{ marginTop: "0.45rem" }}>
                      {selectedSystem.contestedFactionIds.map((factionId) => (
                        <span key={factionId} className="status-chip" style={{ borderColor: factionData[factionId].color, color: factionData[factionId].color }}>
                          {factionData[factionId].icon} {factionData[factionId].name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p style={{ margin: "0.45rem 0 0", color: "var(--text-dim)", fontSize: "0.8rem" }}>
                    Region power: {regionFaction.icon} {regionFaction.name} · {selectedRegion.threatSummary ?? regionFaction.threatSummary}
                  </p>
                </div>
                <div className="panel-lite" style={{ marginTop: "0.75rem", padding: "0.75rem 0.85rem" }}>
                  <div className="mission-card-header" style={{ marginBottom: "0.35rem" }}>
                    <strong>System Role</strong>
                    <span className="status-chip">{selectedSystem.identityLabel}</span>
                  </div>
                  <p style={{ margin: "0 0 0.35rem" }}>{selectedSystem.gameplayPurpose}</p>
                  <p style={{ margin: 0, color: "var(--text-dim)", fontSize: "0.8rem" }}>
                    Prep: {selectedSystem.prepAdvice}
                  </p>
                </div>
                <div className="panel-lite" style={{ marginTop: "0.75rem", padding: "0.75rem 0.85rem" }}>
                  <div className="mission-card-header" style={{ marginBottom: "0.35rem" }}>
                    <strong>Region Intel</strong>
                    <span className="status-chip" style={{ borderColor: regionFaction.color, color: regionFaction.color }}>
                      {regionFaction.icon} {selectedRegion.name}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 0.35rem" }}>{selectedRegion.identitySummary}</p>
                  <p style={{ margin: 0, color: "var(--text-dim)", fontSize: "0.8rem" }}>
                    Prep: {selectedRegion.prepAdvice}
                  </p>
                </div>
                <div className="tag-row">
                  {selectedSystem.economyTags.map((tag) => (
                    <span key={tag} className="status-chip">{tag}</span>
                  ))}
                </div>
                <div className="action-row">
                  <button type="button" onClick={() => onPlanRoute(selectedSystem.id, "shortest", false)}>
                    Shortest
                  </button>
                  <button type="button" onClick={() => onPlanRoute(selectedSystem.id, "safer", false)}>
                    Safer
                  </button>
                  <button type="button" onClick={() => onPlanRoute(selectedSystem.id, "safer", true)}>
                    Autopilot Route
                  </button>
                </div>
                <div className="action-row" style={{ marginTop: "0.5rem" }}>
                  <button type="button" className="ghost-button" onClick={onClearRoute}>
                    Clear Route
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onSetRouteAutoFollow(!Boolean(world.routePlan?.autoFollow))}
                    disabled={!world.routePlan}
                  >
                    {world.routePlan?.autoFollow ? "Disable Autopilot" : "Enable Autopilot"}
                  </button>
                </div>
                {nextRouteStep && (
                  <p style={{ marginTop: "0.75rem" }}>
                    Next gate: {nextRouteStep.gateName} → {sectorById[nextRouteStep.toSystemId].name}
                  </p>
                )}
                {activeTransportMission && <p>{activeTransportMission.objectiveText}</p>}
              </section>

              <section className="panel-lite map-sidebar-panel">
                <h3>System Destinations</h3>
                <p>
                  Current site: <strong>{world.localSite.label}</strong>
                  {" · "}
                  {world.localSite.subtitle}
                </p>
                <ul className="stack-list">
                  {localDestinations.map((destination) => {
                    const ref = { id: destination.id, type: destination.kind as SelectableRef["type"] };
                    const isObjective = objectiveInCurrentSystem === destination.id;
                    const isNextGate = nextGateId === destination.id;
                    const isCurrentSite = world.localSite.destinationId === destination.id;
                    return (
                      <li
                        key={destination.id}
                        className={`${isObjective ? "objective-item" : ""}${isNextGate ? " waypoint-item" : ""}${
                          destination.kind === "gate" && activeMissionRoute.systemIds.has(destination.id) ? " mission-route-item" : ""
                        }`}
                      >
                        <strong>{destination.name}</strong>
                        <span className="status-chip">
                          {destination.kind}
                          {isCurrentSite ? " · current site" : ""}
                          {isObjective ? " · objective" : ""}
                          {isNextGate ? " · next gate" : ""}
                        </span>
                        <p>{destination.description}</p>
                        <div className="action-row">
                          <button type="button" onClick={() => onSelectOverview(ref)}>
                            Select
                          </button>
                          {destination.warpable && (
                            <>
                              <button type="button" onClick={() => onIssueCommand({ type: "warp", target: ref, range: 0 })}>
                                Warp 0
                              </button>
                              <button type="button" onClick={() => onIssueCommand({ type: "warp", target: ref, range: 30 })}>
                                Warp 30
                              </button>
                            </>
                          )}
                          {destination.kind === "station" && (
                            <button type="button" onClick={() => onIssueCommand({ type: "dock", target: ref })}>
                              Dock
                            </button>
                          )}
                          {isObjective && (
                            <button type="button" className="primary-button" onClick={() => onIssueCommand({ type: "warp", target: ref, range: destination.kind === "station" ? 130 : 150 })}>
                              Warp to Objective
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          )}

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
