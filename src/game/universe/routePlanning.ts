import { GameWorld, RoutePlan, RoutePreference, RouteStep, SecurityBand, TransportRisk } from "../../types/game";
import { getSystemGates, sectorById } from "./data/universe";

function securityWeight(security: SecurityBand) {
  if (security === "high") return 0;
  if (security === "medium") return 1.5;
  if (security === "low") return 3.5;
  return 6;
}

function gateAccessible(world: GameWorld, gateId: string, targetSystemId: string, unlockMissionId?: string) {
  if (!unlockMissionId) return true;
  return (
    world.missions[unlockMissionId]?.status === "completed" ||
    world.unlockedSectorIds.includes(targetSystemId)
  );
}

function buildSteps(previous: Record<string, RouteStep | null>, destinationSystemId: string) {
  const reversed: RouteStep[] = [];
  let cursor = destinationSystemId;
  while (previous[cursor]) {
    const step = previous[cursor];
    if (!step) break;
    reversed.push(step);
    cursor = step.fromSystemId;
  }
  return reversed.reverse();
}

export function planRoute(
  world: GameWorld,
  startSystemId: string,
  destinationSystemId: string,
  preference: RoutePreference,
  autoFollow = false
): RoutePlan | null {
  if (startSystemId === destinationSystemId) {
    return {
      destinationSystemId,
      preference,
      autoFollow,
      steps: []
    };
  }

  const queue = new Set(Object.keys(sectorById));
  const distanceBySystem = Object.fromEntries(
    Object.keys(sectorById).map((systemId) => [systemId, Number.POSITIVE_INFINITY])
  ) as Record<string, number>;
  const previous: Record<string, RouteStep | null> = Object.fromEntries(
    Object.keys(sectorById).map((systemId) => [systemId, null])
  );
  distanceBySystem[startSystemId] = 0;

  while (queue.size > 0) {
    let currentSystemId: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    queue.forEach((systemId) => {
      if (distanceBySystem[systemId] < bestDistance) {
        bestDistance = distanceBySystem[systemId];
        currentSystemId = systemId;
      }
    });

    if (!currentSystemId) break;
    const activeSystemId = currentSystemId;
    queue.delete(activeSystemId);
    if (activeSystemId === destinationSystemId) break;

    getSystemGates(activeSystemId).forEach((gate) => {
      if (!gate.connectedSystemId || !queue.has(gate.connectedSystemId)) return;
      if (!gateAccessible(world, gate.id, gate.connectedSystemId, gate.unlockMissionId)) return;
      const nextSystem = sectorById[gate.connectedSystemId];
      if (!nextSystem) return;
      const weight = preference === "shortest" ? 1 : 1 + securityWeight(nextSystem.security) + nextSystem.danger * 0.35;
      const nextDistance = distanceBySystem[activeSystemId] + weight;
      if (nextDistance < distanceBySystem[nextSystem.id]) {
        distanceBySystem[nextSystem.id] = nextDistance;
        previous[nextSystem.id] = {
          fromSystemId: activeSystemId,
          toSystemId: nextSystem.id,
          gateId: gate.id,
          gateName: gate.name,
          security: nextSystem.security
        };
      }
    });
  }

  if (!previous[destinationSystemId]) return null;
  return {
    destinationSystemId,
    preference,
    autoFollow,
    steps: buildSteps(previous, destinationSystemId)
  };
}

export function getNextRouteStep(world: GameWorld) {
  if (!world.routePlan) return null;
  return world.routePlan.steps.find((step) => step.fromSystemId === world.currentSectorId) ?? null;
}

export function advanceRouteAfterJump(world: GameWorld, arrivedSystemId: string) {
  if (!world.routePlan) return;
  if (world.routePlan.steps[0]?.toSystemId === arrivedSystemId) {
    world.routePlan.steps.shift();
  }
  if (world.routePlan.destinationSystemId === arrivedSystemId && world.routePlan.steps.length === 0) {
    world.routePlan.autoFollow = false;
  }
}

export function estimateRouteRisk(steps: RouteStep[]): TransportRisk {
  if (steps.length === 0) return "low";
  const score = steps.reduce((total, step) => total + securityWeight(step.security), 0) / steps.length;
  if (score >= 5.2) return "extreme";
  if (score >= 3.2) return "high";
  if (score >= 1.4) return "medium";
  return "low";
}
