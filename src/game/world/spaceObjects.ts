import { DamageType, DestinationKind, EnemyVariant, GameWorld, ObjectInfo, OverviewEntry, SelectableRef, SpaceObjectType, Vec2 } from "../../types/game";
import { factionData } from "../data/factions";
import { enemyVariantById, playerShipById } from "../data/ships";
import { getSystemDestination, getSystemDestinations, sectorById } from "../data/sectors";
import { commodityById } from "../economy/data/commodities";
import { distance } from "../utils/vector";

const DAMAGE_TYPES: DamageType[] = ["em", "thermal", "kinetic", "explosive"];

const DAMAGE_LABELS: Record<DamageType, string> = {
  em: "EM",
  thermal: "Thermal",
  kinetic: "Kinetic",
  explosive: "Explosive"
};

const COMBAT_PROFILE_LABELS: Record<EnemyVariant["combatStyle"], string> = {
  shield: "Shield strong",
  armor: "Armor strong",
  speed: "Speed strong"
};

function getCombatProfileTone(variant: EnemyVariant) {
  return variant.combatStyle;
}

function getWeightedDamageWeakness(variant: EnemyVariant, enemyShield: number, enemyArmor: number, enemyHull: number) {
  const shieldWeight = Math.max(enemyShield / Math.max(variant.shield, 1), 0.2);
  const armorWeight = Math.max(enemyArmor / Math.max(variant.armor, 1), 0.2);
  const hullWeight = Math.max(enemyHull / Math.max(variant.hull, 1), 0.2);
  const weightTotal = shieldWeight + armorWeight + hullWeight;
  const effective = DAMAGE_TYPES.map((damageType) => {
    const value =
      (variant.shieldResists[damageType] * shieldWeight +
        variant.armorResists[damageType] * armorWeight +
        variant.hullResists[damageType] * hullWeight) /
      weightTotal;
    return { damageType, value };
  }).sort((a, b) => a.value - b.value);
  const weakest = effective[0];
  const runnerUp = effective[1];
  if (!weakest) return null;
  if (!runnerUp || runnerUp.value - weakest.value > 0.03) {
    return `Weak to ${DAMAGE_LABELS[weakest.damageType]}`;
  }
  return `Weak to ${DAMAGE_LABELS[weakest.damageType]} / ${DAMAGE_LABELS[runnerUp.damageType]}`;
}

function destinationKindToObjectType(kind: DestinationKind) {
  return kind as SpaceObjectType;
}

export function getObjectPosition(world: GameWorld, ref: SelectableRef): Vec2 | null {
  const sector = world.sectors[world.currentSectorId];

  switch (ref.type) {
    case "enemy":
      if (ref.id === "player") return world.player.position;
      return sector.enemies.find((item) => item.id === ref.id)?.position ?? null;
    case "asteroid":
      return sector.asteroids.find((item) => item.id === ref.id)?.position ?? null;
    case "loot":
      return sector.loot.find((item) => item.id === ref.id)?.position ?? null;
    case "wreck":
      return (
        sector.wrecks.find((item) => item.id === ref.id)?.position ??
        getSystemDestination(world.currentSectorId, ref.id)?.position ??
        null
      );
    default: {
      const destination = getSystemDestination(world.currentSectorId, ref.id);
      return destination ? destination.position : null;
    }
  }
}

export function getObjectInfo(world: GameWorld, ref: SelectableRef | null): ObjectInfo | null {
  if (!ref) return null;
  const sector = world.sectors[world.currentSectorId];
  const system = sectorById[world.currentSectorId];
  const position = getObjectPosition(world, ref);
  if (!position) return null;
  const distanceFromPlayer = distance(world.player.position, position);
  const relativeVector = {
    x: position.x - world.player.position.x,
    y: position.y - world.player.position.y
  };
  const relativeDistance = Math.max(distanceFromPlayer, 1);
  const playerVelocity = world.player.velocity;

  switch (ref.type) {
    case "enemy": {
      const enemy = sector.enemies.find((item) => item.id === ref.id);
      if (!enemy) return null;
      const variant = enemyVariantById[enemy.variantId];
      const relativeVelocity = {
        x: enemy.velocity.x - playerVelocity.x,
        y: enemy.velocity.y - playerVelocity.y
      };
      const angularVelocity = Math.abs(
        (relativeVector.x * relativeVelocity.y - relativeVector.y * relativeVelocity.x) /
          (relativeDistance * relativeDistance)
      );
      return {
        ref,
        name: variant.name,
        type: "enemy",
        position,
        distance: distanceFromPlayer,
        velocity: Math.hypot(enemy.velocity.x, enemy.velocity.y),
        angularVelocity,
        signatureRadius: variant.signatureRadius,
        subtitle: `${system.name} hostile`,
        factionLabel: factionData[variant.faction].name,
        threatLabel: `Threat ${Math.ceil((variant.hull + variant.armor + variant.shield) / 90)}`,
        combatProfileLabel: COMBAT_PROFILE_LABELS[variant.combatStyle],
        combatProfileTone: getCombatProfileTone(variant),
        weaknessLabel: getWeightedDamageWeakness(variant, enemy.shield, enemy.armor, enemy.hull) ?? undefined,
        preferredRange: variant.preferredRange,
        armorPercent: enemy.armor / Math.max(variant.armor, 1),
        hullPercent: enemy.hull / Math.max(variant.hull, 1),
        shieldPercent: enemy.shield / Math.max(variant.shield, 1),
        shieldResists: variant.shieldResists,
        armorResists: variant.armorResists,
        hullResists: variant.hullResists
      };
    }
    case "asteroid": {
      const asteroid = sector.asteroids.find((item) => item.id === ref.id);
      if (!asteroid) return null;
      return {
        ref,
        name: `${asteroid.resource} asteroid`,
        type: "asteroid",
        position,
        distance: distanceFromPlayer,
        velocity: 0,
        subtitle: asteroid.beltId,
        threatLabel: "Resource",
        signatureRadius: asteroid.radius * 2,
        oreRemaining: asteroid.oreRemaining
      };
    }
    case "loot": {
      const drop = sector.loot.find((item) => item.id === ref.id);
      if (!drop) return null;
      const resourceSummary = Object.entries(drop.resources)
        .filter(([, amount]) => (amount ?? 0) > 0)
        .map(([resource, amount]) => `${amount} ${resource}`)
        .join(", ");
      const commoditySummary = Object.entries(drop.commodities ?? {})
        .filter(([, amount]) => (amount ?? 0) > 0)
        .map(([commodityId, amount]) => `${amount} ${commodityById[commodityId]?.name ?? commodityId}`)
        .join(", ");
      return {
        ref,
        name: "Loot Crate",
        type: "loot",
        position,
        distance: distanceFromPlayer,
        velocity: Math.hypot(drop.velocity.x, drop.velocity.y),
        subtitle: [resourceSummary || `${drop.credits} credits`, commoditySummary].filter(Boolean).join(" • "),
        threatLabel: "Salvage",
        signatureRadius: 18,
        lootCredits: drop.credits
      };
    }
    case "wreck": {
      const wreck = sector.wrecks.find((item) => item.id === ref.id);
      if (wreck) {
        const resourceSummary = Object.entries(wreck.resources)
          .filter(([, amount]) => (amount ?? 0) > 0)
          .map(([resource, amount]) => `${amount} ${resource}`)
          .join(", ");
        const commoditySummary = Object.entries(wreck.commodities ?? {})
          .filter(([, amount]) => (amount ?? 0) > 0)
          .map(([commodityId, amount]) => `${amount} ${commodityById[commodityId]?.name ?? commodityId}`)
          .join(", ");
        const shipSummary = wreck.shipId ? `${playerShipById[wreck.shipId]?.name ?? wreck.shipId} hull` : "";
        const moduleSummary = wreck.modules.length > 0 ? `${wreck.modules.length} modules` : "";
        return {
          ref,
          name: `${wreck.sourceName} Wreck`,
          type: "wreck",
          position,
          distance: distanceFromPlayer,
          velocity: 0,
          subtitle: [resourceSummary || `${wreck.credits} credits`, commoditySummary, shipSummary, moduleSummary].filter(Boolean).join(" • "),
          threatLabel: "Salvage",
          signatureRadius: 28,
          lootCredits: wreck.credits
        };
      }
      const destination = getSystemDestination(world.currentSectorId, ref.id);
      if (!destination) return null;
      return {
        ref,
        name: destination.name,
        type: "wreck",
        position,
        distance: distanceFromPlayer,
        velocity: 0,
        subtitle: destination.description,
        threatLabel: "Salvage",
        signatureRadius: 28
      };
    }
    default: {
      const destination = getSystemDestination(world.currentSectorId, ref.id);
      if (!destination) return null;
      const targetSystemName =
        destination.kind === "gate" && destination.connectedSystemId
          ? sectorById[destination.connectedSystemId]?.name
          : null;
      return {
        ref,
        name: destination.name,
        type: destinationKindToObjectType(destination.kind),
        position,
        distance: distanceFromPlayer,
        velocity: 0,
        subtitle:
          destination.kind === "gate" && targetSystemName
            ? `Jump to ${targetSystemName}`
            : destination.kind === "anomaly" && destination.anomalyField
              ? `${destination.anomalyField.effect === "pull" ? "Pull field" : "Push field"} · ${destination.description}`
              : destination.description,
        factionLabel:
          destination.kind === "station" || destination.kind === "outpost"
            ? factionData[system.controllingFaction].name
            : undefined,
        threatLabel:
          destination.kind === "belt"
            ? destination.resource
            : destination.kind === "anomaly"
              ? destination.anomalyField?.effect === "pull"
                ? "Pull Field"
                : destination.anomalyField?.effect === "push"
                  ? "Push Field"
                  : "Combat"
              : destination.kind === "station"
                ? "Safe"
                : destination.kind === "gate"
                  ? system.security.toUpperCase()
                  : destination.kind === "wreck"
                    ? "Salvage"
                    : "Transit",
        signatureRadius:
          destination.kind === "station"
            ? 420
            : destination.kind === "gate"
              ? 260
              : destination.kind === "belt"
                ? 240
                : destination.kind === "anomaly" && destination.anomalyField
                  ? destination.anomalyField.radius
                  : 150
      };
    }
  }
}

function collectRefs(world: GameWorld): SelectableRef[] {
  const sector = world.sectors[world.currentSectorId];
  return [
    ...getSystemDestinations(world.currentSectorId).map((entry) => ({
      id: entry.id,
      type: destinationKindToObjectType(entry.kind)
    })),
    ...(sector?.enemies ?? []).map((item) => ({ id: item.id, type: "enemy" as const })),
    ...(sector?.asteroids ?? []).map((item) => ({ id: item.id, type: "asteroid" as const })),
    ...(sector?.loot ?? []).map((item) => ({ id: item.id, type: "loot" as const })),
    ...(sector?.wrecks ?? []).map((item) => ({ id: item.id, type: "wreck" as const }))
  ];
}

export function getOverviewEntries(world: GameWorld): OverviewEntry[] {
  return collectRefs(world)
    .map((ref) => getObjectInfo(world, ref))
    .filter((item): item is OverviewEntry => Boolean(item))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 24);
}

export function findObjectAtPoint(world: GameWorld, point: Vec2, maxDistance = 28): SelectableRef | null {
  let bestRef: SelectableRef | null = null;
  let bestDistance = Infinity;

  for (const ref of collectRefs(world)) {
    const position = getObjectPosition(world, ref);
    if (!position) continue;
    const hitRadius =
      ref.type === "station"
        ? 50
        : ref.type === "gate"
          ? 40
          : ref.type === "belt"
            ? 28
            : ref.type === "loot"
              ? 16
            : ref.type === "anomaly" || ref.type === "outpost" || ref.type === "wreck"
              ? 24
              : 20;
    const current = distance(point, position) - hitRadius;
    if (current <= maxDistance && current < bestDistance) {
      bestDistance = current;
      bestRef = ref;
    }
  }

  return bestRef;
}

export function getSystemDestinationsForMap(world: GameWorld) {
  return getSystemDestinations(world.currentSectorId).map((destination) => ({
    ...destination,
    ref: { id: destination.id, type: destinationKindToObjectType(destination.kind) as SpaceObjectType }
  }));
}

export function getPlayerSignature(world: GameWorld) {
  return playerShipById[world.player.hullId].signatureRadius;
}
