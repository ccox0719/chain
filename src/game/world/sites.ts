import { GameWorld, LocalSiteState, SelectableRef, SystemDestination, Vec2 } from "../../types/game";
import { getSystemDestination, getSystemDestinations } from "../data/sectors";
import { distance } from "../utils/vector";

const SITE_RADIUS_BY_KIND: Record<NonNullable<SystemDestination["kind"]> | "transit" | "mission", number> = {
  transit: 760,
  station: 620,
  gate: 700,
  belt: 860,
  anomaly: 920,
  mission: 940,
  wreck: 720,
  outpost: 660,
  beacon: 700
};

function siteLabel(destination: SystemDestination | null) {
  if (!destination) {
    return {
      type: "transit" as const,
      label: "In transit",
      subtitle: "Warp between points of interest to move across the system."
    };
  }

  switch (destination.kind) {
    case "station":
      return { type: "station" as const, label: destination.name, subtitle: "Station control space" };
    case "gate":
      return { type: "gate" as const, label: destination.name, subtitle: "Gate traffic envelope" };
    case "belt":
      return { type: "belt" as const, label: destination.name, subtitle: "Belt working zone" };
    case "anomaly":
      return { type: "anomaly" as const, label: destination.name, subtitle: "Anomaly contact zone" };
    case "wreck":
      return { type: "wreck" as const, label: destination.name, subtitle: "Salvage site" };
    case "outpost":
      return { type: "outpost" as const, label: destination.name, subtitle: "Outpost perimeter" };
    case "beacon":
      return { type: "mission" as const, label: destination.name, subtitle: "Local beacon pocket" };
    default:
      return { type: "transit" as const, label: "In transit", subtitle: "Warp between points of interest to move across the system." };
  }
}

export function createTransitLocalSite(systemId: string, center: Vec2): LocalSiteState {
  return {
    systemId,
    destinationId: null,
    type: "transit",
    center: { ...center },
    activeRadius: SITE_RADIUS_BY_KIND.transit,
    label: "In transit",
    subtitle: "Warp between points of interest to move across the system."
  };
}

export function createWarzoneLocalSite(systemId: string, center: Vec2, label: string, subtitle: string): LocalSiteState {
  return {
    systemId,
    destinationId: null,
    type: "warzone",
    center: { ...center },
    activeRadius: SITE_RADIUS_BY_KIND.anomaly,
    label,
    subtitle
  };
}

export function createLocalSiteFromDestination(systemId: string, destination: SystemDestination): LocalSiteState {
  const info = siteLabel(destination);
  return {
    systemId,
    destinationId: destination.id,
    type: info.type,
    center: { ...destination.position },
    activeRadius: SITE_RADIUS_BY_KIND[info.type],
    label: info.label,
    subtitle: info.subtitle
  };
}

export function getActiveLocalDestination(world: GameWorld) {
  if (!world.localSite.destinationId) return null;
  return getSystemDestination(world.currentSectorId, world.localSite.destinationId);
}

export function syncLocalSite(world: GameWorld) {
  if (world.localSite.systemId !== world.currentSectorId) {
    world.localSite = createTransitLocalSite(world.currentSectorId, world.player.position);
  }

  if (world.localSite.type === "warzone" && world.localSite.systemId === world.currentSectorId) {
    return world.localSite;
  }

  const destination = getActiveLocalDestination(world);
  if (destination) {
    world.localSite = createLocalSiteFromDestination(world.currentSectorId, destination);
    return world.localSite;
  }

  world.localSite = createTransitLocalSite(world.currentSectorId, world.player.position);
  return world.localSite;
}

export function enterDestinationSite(world: GameWorld, destinationId: string) {
  const destination = getSystemDestination(world.currentSectorId, destinationId);
  if (!destination) {
    world.localSite = createTransitLocalSite(world.currentSectorId, world.player.position);
    return null;
  }
  world.localSite = createLocalSiteFromDestination(world.currentSectorId, destination);
  return destination;
}

export function isDestinationLocal(world: GameWorld, destinationId: string) {
  return world.localSite.systemId === world.currentSectorId && world.localSite.destinationId === destinationId;
}

export function isPositionInLocalSite(world: GameWorld, position: Vec2, margin = 0) {
  const center = world.localSite.center;
  return distance(center, position) <= world.localSite.activeRadius + margin;
}

export function getVisibleSystemDestinations(world: GameWorld) {
  const currentDestination = getActiveLocalDestination(world);
  const persistentDestinations = getSystemDestinations(world.currentSectorId).filter(
    (destination) => destination.kind === "station" || destination.kind === "gate"
  );

  if (!currentDestination) return persistentDestinations;

  return Array.from(
    new Map(
      [currentDestination, ...persistentDestinations].map((destination) => [destination.id, destination])
    ).values()
  );
}

export function isRefLocalToSite(world: GameWorld, ref: SelectableRef) {
  switch (ref.type) {
    case "station":
    case "gate":
    case "belt":
    case "anomaly":
    case "outpost":
    case "wreck":
    case "beacon":
      return isDestinationLocal(world, ref.id);
    default:
      return true;
  }
}
