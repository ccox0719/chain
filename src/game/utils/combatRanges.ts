import { enemyVariantById } from "../data/ships";
import { moduleById } from "../data/modules";
import { GameWorld, SelectableRef } from "../../types/game";

function getModuleMaxReach(moduleId: string | null | undefined) {
  if (!moduleId) return 0;
  const module = moduleById[moduleId];
  if (!module) return 0;
  return Math.max(module.range ?? 0, (module.optimal ?? 0) + (module.falloff ?? 0));
}

export function getPlayerWeaponMaxRange(world: GameWorld) {
  return world.player.modules.weapon.reduce((maxRange, runtime) => Math.max(maxRange, getModuleMaxReach(runtime.moduleId)), 0);
}

export function getEnemyWeaponMaxRange(world: GameWorld, enemyId: string) {
  const enemy = world.sectors[world.currentSectorId].enemies.find((entry) => entry.id === enemyId);
  if (!enemy) return 0;
  const variant = enemyVariantById[enemy.variantId];
  if (!variant) return 0;
  return variant.fittedModules.reduce((maxRange, moduleId) => Math.max(maxRange, getModuleMaxReach(moduleId)), 0);
}

export function getCombatControlRanges(world: GameWorld, target: SelectableRef) {
  if (target.type !== "enemy") return null;
  const playerRange = getPlayerWeaponMaxRange(world);
  const enemyRange = getEnemyWeaponMaxRange(world, target.id);

  if (playerRange <= 0 && enemyRange <= 0) {
    return { playerRange: 0, enemyRange: 0, orbitRange: 120, keepRange: 260 };
  }

  const hasPlayer = playerRange > 0;
  const hasEnemy = enemyRange > 0;
  const baseline = hasPlayer && hasEnemy ? Math.min(playerRange, enemyRange) : Math.max(playerRange, enemyRange);
  const gap = Math.max(24, Math.min(72, Math.round(baseline * 0.12)));

  let keepRange: number;
  let orbitRange: number;

  if (hasPlayer && hasEnemy && playerRange <= enemyRange) {
    keepRange = Math.max(60, Math.round(playerRange - gap * 0.35));
    orbitRange = Math.max(45, Math.round(playerRange - gap));
  } else if (hasPlayer && hasEnemy) {
    keepRange = Math.max(60, Math.round(enemyRange + gap * 0.35));
    orbitRange = Math.max(45, Math.round(enemyRange + gap * 0.1));
  } else if (hasPlayer) {
    keepRange = Math.max(60, Math.round(playerRange * 0.92));
    orbitRange = Math.max(45, Math.round(playerRange * 0.78));
  } else {
    keepRange = Math.max(60, Math.round(enemyRange * 1.08));
    orbitRange = Math.max(45, Math.round(enemyRange * 0.92));
  }

  if (orbitRange >= keepRange) {
    orbitRange = Math.max(45, keepRange - 24);
  }

  return { playerRange, enemyRange, orbitRange, keepRange };
}
