import { missionCatalog } from "../data/missions";
import { getSystemDestination, getSystemDestinations, getSystemStation } from "../data/sectors";
import { transportMissionById } from "../missions/data/transportMissions";
import { MOVEMENT_BALANCE } from "../config/balance";
import { BoundaryProfile, BoundaryTone, GameWorld, PocketType, SelectableRef, Vec2 } from "../../types/game";
import { distance } from "../utils/vector";

type PocketTuning = {
  activeRadius: number;
  bufferRadius: number;
  containmentRadius: number;
  recoveryReleaseRadius: number;
  pullStrength: number;
  dampingStrength: number;
  turnAssistStrength: number;
};

const POCKETS = MOVEMENT_BALANCE.boundary.pocketTypes;
const SELECTION = MOVEMENT_BALANCE.boundary.selection;

function makePocket(
  id: string,
  type: PocketType,
  center: Vec2,
  tone: BoundaryTone,
  visualLabel: string,
  title: string,
  detail: string,
  tuning: PocketTuning
): BoundaryProfile {
  return {
    id,
    type,
    center: { ...center },
    activeRadius: tuning.activeRadius,
    bufferRadius: tuning.bufferRadius,
    containmentRadius: tuning.containmentRadius,
    recoveryReleaseRadius: tuning.recoveryReleaseRadius,
    pullStrength: tuning.pullStrength,
    dampingStrength: tuning.dampingStrength,
    turnAssistStrength: tuning.turnAssistStrength,
    zoneType: tone,
    visualLabel,
    title,
    detail
  };
}

function destinationPocket(world: GameWorld, destinationId: string) {
  const destination = getSystemDestination(world.currentSectorId, destinationId);
  if (!destination) return null;
  const kind = destination.kind;
  if (kind === "station" || kind === "outpost") {
    return makePocket(
      `station:${destination.id}`,
      "station",
      destination.position,
      "station",
      destination.kind === "station" ? "Station control pocket" : "Outpost control pocket",
      destination.kind === "station" ? "Station traffic envelope" : "Outpost traffic envelope",
      "You are leaving the local traffic and docking control area.",
      POCKETS.station
    );
  }
  if (kind === "gate") {
    return makePocket(
      `gate:${destination.id}`,
      "gate",
      destination.position,
      "gate",
      "Gate traffic pocket",
      "Gate traffic envelope",
      "You are drifting out of the local gate traffic corridor.",
      {
        ...POCKETS.gate,
        containmentRadius: POCKETS.gate.containmentRadius + SELECTION.gatePocketBonusRadius
      }
    );
  }
  if (kind === "belt") {
    return makePocket(
      `belt:${destination.id}`,
      "belt",
      destination.position,
      "belt",
      "Belt working pocket",
      "Belt pocket boundary",
      "You are drifting beyond the local mining and salvage area.",
      POCKETS.belt
    );
  }
  if (kind === "anomaly") {
    return makePocket(
      `anomaly:${destination.id}`,
      "anomaly",
      destination.position,
      "anomaly",
      "Deadspace pocket",
      "Deadspace pocket boundary",
      "You are nearing the edge of the active anomaly pocket.",
      POCKETS.anomaly
    );
  }
  if (kind === "wreck") {
    return makePocket(
      `wreck:${destination.id}`,
      "wreck",
      destination.position,
      "wreck",
      "Salvage pocket",
      "Salvage pocket boundary",
      "You are moving beyond the local wreck field.",
      POCKETS.wreck
    );
  }
  return null;
}

function getActiveMissionPocket(world: GameWorld) {
  const mission = missionCatalog.find((entry) => world.missions[entry.id]?.status === "active");
  if (!mission || mission.targetSystemId !== world.currentSectorId) return null;
  if (mission.targetDestinationId) {
    const destination = getSystemDestination(world.currentSectorId, mission.targetDestinationId);
    if (destination) {
      return makePocket(
        `mission:${mission.id}`,
        "mission",
        destination.position,
        "mission",
        "Mission pocket",
        "Mission pocket boundary",
        "You are leaving the active mission area.",
        POCKETS.mission
      );
    }
  }
  return makePocket(
    `mission:${mission.id}`,
    "mission",
    world.player.position,
    "mission",
    "Mission pocket",
    "Mission pocket boundary",
    "You are leaving the active mission area.",
    POCKETS.mission
  );
}

function getActiveTransportPocket(world: GameWorld) {
  const state = Object.values(world.transportMissions).find((entry) => entry.status === "active");
  if (!state) return null;
  const mission = transportMissionById[state.missionId];
  if (!mission) return null;
  const systemId = state.pickedUp ? mission.destinationSystemId : mission.pickupSystemId;
  if (systemId !== world.currentSectorId) return null;
  const destinationId = state.pickedUp ? mission.destinationStationId : mission.pickupStationId;
  const destination = getSystemDestination(world.currentSectorId, destinationId);
  if (!destination) return null;
  return makePocket(
    `transport:${mission.id}`,
    "mission",
    destination.position,
    "mission",
    "Contract pocket",
    "Contract pocket boundary",
    "You are leaving the active contract area.",
    POCKETS.mission
  );
}

function getNavTargetPocket(world: GameWorld) {
  const target = world.player.navigation.target;
  if (!target) return null;
  if (target.type === "enemy" || target.type === "loot" || target.type === "asteroid") return null;
  return destinationPocket(world, target.id);
}

function getNearestPocket(world: GameWorld, currentPocket: BoundaryProfile | null) {
  const playerPosition = world.player.position;
  const destinations = getSystemDestinations(world.currentSectorId);
  const siteCandidates = destinations
    .map((destination) => ({ destination, pocket: destinationPocket(world, destination.id) }))
    .filter((entry): entry is { destination: (typeof destinations)[number]; pocket: BoundaryProfile } => Boolean(entry.pocket))
    .map((entry) => {
      const stickyBonus =
        currentPocket?.id === entry.pocket.id ? SELECTION.siteStickinessRadius : 0;
      return {
        pocket: entry.pocket,
        score: distance(playerPosition, entry.destination.position) - stickyBonus
      };
    })
    .filter((entry) => entry.score <= SELECTION.siteAcquireRadius)
    .sort((left, right) => left.score - right.score);

  return siteCandidates[0]?.pocket ?? null;
}

export function selectLocalPocket(world: GameWorld, currentPocket: BoundaryProfile | null) {
  const navPocket = getNavTargetPocket(world);
  if (navPocket) return navPocket;

  const missionPocket = getActiveMissionPocket(world);
  if (missionPocket) return missionPocket;

  const transportPocket = getActiveTransportPocket(world);
  if (transportPocket) return transportPocket;

  const currentStation = getSystemStation(world.currentSectorId);
  if (world.dockedStationId && currentStation) {
    const pocket = destinationPocket(world, currentStation.id);
    if (pocket) return pocket;
  }

  const nearbyPocket = getNearestPocket(world, currentPocket);
  if (nearbyPocket) return nearbyPocket;

  const shouldReanchorTransit =
    !currentPocket ||
    currentPocket.type !== "transit" ||
    distance(world.player.position, currentPocket.center) > SELECTION.transitReanchorDistance;

  if (!shouldReanchorTransit && currentPocket) return currentPocket;

  return makePocket(
    `transit:${world.currentSectorId}`,
    "transit",
    world.player.position,
    "transit",
    "Local navigation grid",
    "Local navigation envelope",
    "The current site falls off past this point and navigation guidance will arc you back in.",
    POCKETS.transit
  );
}
