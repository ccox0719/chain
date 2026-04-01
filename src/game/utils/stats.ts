import { ModuleDefinition, ModuleSlot, PlayerState, ShipBonusProfile } from "../../types/game";
import { moduleById } from "../data/modules";
import { playerShipById } from "../data/ships";
import { commodityById } from "../economy/data/commodities";

export function getShipBonuses(player: PlayerState): ShipBonusProfile {
  return playerShipById[player.hullId]?.bonuses ?? {};
}

function applyModuleModifiers(
  derived: ReturnType<typeof computeBaseDerivedStats>,
  modifiers: NonNullable<(typeof moduleById)[string]>["modifiers"] | NonNullable<(typeof moduleById)[string]>["activeModifiers"] | undefined
) {
  if (!modifiers) return;
  derived.maxArmor += modifiers.maxArmor ?? 0;
  derived.maxHull += modifiers.maxHull ?? 0;
  derived.maxShield += modifiers.maxShield ?? 0;
  derived.shieldRegen += modifiers.shieldRegen ?? 0;
  derived.capacitorCapacity += modifiers.capacitorCapacity ?? 0;
  derived.capacitorRegen += modifiers.capacitorRegen ?? 0;
  derived.maxSpeed += modifiers.maxSpeed ?? 0;
  derived.lockRange += modifiers.lockRange ?? 0;
  derived.warpSpeed += modifiers.warpSpeed ?? 0;
  derived.cargoCapacity += modifiers.cargoCapacity ?? 0;
  derived.turretTrackingMultiplier *= modifiers.turretTrackingMultiplier ?? 1;
  derived.turretOptimalMultiplier *= modifiers.turretOptimalMultiplier ?? 1;
  derived.turretFalloffMultiplier *= modifiers.turretFalloffMultiplier ?? 1;
  derived.shieldResists.em += modifiers.shieldResistBonus ?? 0;
  derived.shieldResists.thermal += modifiers.shieldResistBonus ?? 0;
  derived.shieldResists.kinetic += modifiers.shieldResistBonus ?? 0;
  derived.shieldResists.explosive += modifiers.shieldResistBonus ?? 0;
  derived.armorResists.em += modifiers.armorResistBonus ?? 0;
  derived.armorResists.thermal += modifiers.armorResistBonus ?? 0;
  derived.armorResists.kinetic += modifiers.armorResistBonus ?? 0;
  derived.armorResists.explosive += modifiers.armorResistBonus ?? 0;
  derived.hullResists.em += modifiers.hullResistBonus ?? 0;
  derived.hullResists.thermal += modifiers.hullResistBonus ?? 0;
  derived.hullResists.kinetic += modifiers.hullResistBonus ?? 0;
  derived.hullResists.explosive += modifiers.hullResistBonus ?? 0;
  derived.miningYieldMultiplier *= modifiers.miningYieldMultiplier ?? 1;
  derived.laserDamageMultiplier *= modifiers.laserDamageMultiplier ?? 1;
  derived.railgunDamageMultiplier *= modifiers.railgunDamageMultiplier ?? 1;
  derived.missileDamageMultiplier *= modifiers.missileDamageMultiplier ?? 1;
  derived.laserCycleMultiplier *= modifiers.laserCycleMultiplier ?? 1;
  derived.railgunCycleMultiplier *= modifiers.railgunCycleMultiplier ?? 1;
  derived.missileCycleMultiplier *= modifiers.missileCycleMultiplier ?? 1;
}

function computeBaseDerivedStats(player: PlayerState) {
  const hull = playerShipById[player.hullId];
  return {
    maxHull: hull.baseHull,
    maxShield: hull.baseShield,
    maxArmor: hull.baseArmor,
    shieldRegen: hull.shieldRegen,
    capacitorCapacity: hull.baseCapacitor,
    capacitorRegen: hull.capacitorRegen,
    acceleration: hull.acceleration,
    turnSpeed: hull.turnSpeed,
    maxSpeed: hull.maxSpeed,
    maxSpeedWithAfterburner: hull.maxSpeed,
    lockRange: hull.lockRange,
    warpSpeed: hull.warpSpeed,
    cargoCapacity: hull.cargoCapacity,
    interactionRange: hull.interactionRange,
    miningYieldMultiplier: 1,
    shieldRepairAmountMultiplier: 1,
    armorRepairAmountMultiplier: 1,
    commodityBuyMultiplier: 1,
    commoditySellMultiplier: 1,
    resourceSellMultiplier: 1,
    moduleBuyMultiplier: 1,
    moduleSellMultiplier: 1,
    shipBuyMultiplier: 1,
    turretTrackingMultiplier: 1,
    turretOptimalMultiplier: 1,
    turretFalloffMultiplier: 1,
    laserDamageMultiplier: 1,
    railgunDamageMultiplier: 1,
    missileDamageMultiplier: 1,
    laserCycleMultiplier: 1,
    railgunCycleMultiplier: 1,
    missileCycleMultiplier: 1,
    shieldResists: { ...hull.shieldResists },
    armorResists: { ...hull.armorResists },
    hullResists: { ...hull.hullResists }
  };
}

export function getCargoUsed(player: PlayerState) {
  const resourceCargo = Object.values(player.cargo).reduce((total, amount) => total + amount, 0);
  const commodityCargo = Object.entries(player.commodities).reduce((total, [commodityId, amount]) => {
    const volume = commodityById[commodityId as keyof typeof commodityById]?.volume ?? 1;
    return total + amount * volume;
  }, 0);
  const missionCargo = player.missionCargo.reduce((total, item) => total + item.volume, 0);
  return resourceCargo + commodityCargo + missionCargo;
}

export function computeDerivedStats(player: PlayerState) {
  const derived = computeBaseDerivedStats(player);
  const shipBonuses = getShipBonuses(player);
  const fittedKinds = new Set<ModuleDefinition["kind"]>();

  if (shipBonuses.cargoCapacity !== undefined) {
    derived.cargoCapacity += shipBonuses.cargoCapacity;
  }
  derived.cargoCapacity = Math.max(0, Math.round(derived.cargoCapacity * (shipBonuses.cargoCapacityMultiplier ?? 1)));
  derived.miningYieldMultiplier *= shipBonuses.miningYieldMultiplier ?? 1;
  derived.commodityBuyMultiplier *= shipBonuses.commodityBuyMultiplier ?? 1;
  derived.commoditySellMultiplier *= shipBonuses.commoditySellMultiplier ?? 1;
  derived.resourceSellMultiplier *= shipBonuses.resourceSellMultiplier ?? 1;
  derived.moduleBuyMultiplier *= shipBonuses.moduleBuyMultiplier ?? 1;
  derived.moduleSellMultiplier *= shipBonuses.moduleSellMultiplier ?? 1;
  derived.shipBuyMultiplier *= shipBonuses.shipBuyMultiplier ?? 1;

  (["weapon", "utility", "defense"] as ModuleSlot[]).forEach((slotType) => {
    player.equipped[slotType]
      .filter((moduleId): moduleId is string => Boolean(moduleId))
      .forEach((moduleId, index) => {
        const module = moduleById[moduleId];
        if (!module) return;
        fittedKinds.add(module.kind);
        applyModuleModifiers(derived, module.modifiers);
        const runtime = player.modules[slotType][index];
        if (runtime?.active) {
          applyModuleModifiers(derived, module.activeModifiers);
        }
      });
  });

  fittedKinds.forEach((kind) => {
    const bonus = shipBonuses.moduleKinds?.[kind];
    if (!bonus) return;
    if (kind === "laser") {
      derived.laserDamageMultiplier *= bonus.damageMultiplier ?? 1;
      derived.laserCycleMultiplier *= bonus.cycleMultiplier ?? 1;
      derived.turretTrackingMultiplier *= bonus.turretTrackingMultiplier ?? 1;
      derived.turretOptimalMultiplier *= bonus.turretOptimalMultiplier ?? 1;
      derived.turretFalloffMultiplier *= bonus.turretFalloffMultiplier ?? 1;
    } else if (kind === "railgun") {
      derived.railgunDamageMultiplier *= bonus.damageMultiplier ?? 1;
      derived.railgunCycleMultiplier *= bonus.cycleMultiplier ?? 1;
      derived.turretTrackingMultiplier *= bonus.turretTrackingMultiplier ?? 1;
      derived.turretOptimalMultiplier *= bonus.turretOptimalMultiplier ?? 1;
      derived.turretFalloffMultiplier *= bonus.turretFalloffMultiplier ?? 1;
    } else if (kind === "missile") {
      derived.missileDamageMultiplier *= bonus.damageMultiplier ?? 1;
      derived.missileCycleMultiplier *= bonus.cycleMultiplier ?? 1;
    } else if (kind === "mining_laser") {
      derived.miningYieldMultiplier *= bonus.miningYieldMultiplier ?? 1;
    } else if (kind === "shield_booster") {
      derived.shieldRepairAmountMultiplier *= bonus.repairAmountMultiplier ?? 1;
    } else if (kind === "armor_repairer") {
      derived.armorRepairAmountMultiplier *= bonus.repairAmountMultiplier ?? 1;
    }
  });

  const afterburnerActive = player.modules.utility.some((runtime) => {
    if (!runtime.active || !runtime.moduleId) return false;
    return moduleById[runtime.moduleId]?.kind === "afterburner";
  });

  if (afterburnerActive) {
    const bonus = player.modules.utility.reduce((total, runtime) => {
      if (!runtime.active || !runtime.moduleId) return total;
      const module = moduleById[runtime.moduleId];
      return total + (module?.speedBonus ?? 0);
    }, 0);
    derived.maxSpeedWithAfterburner = derived.maxSpeed + bonus;
  } else {
    derived.maxSpeedWithAfterburner = derived.maxSpeed;
  }

  (["shieldResists", "armorResists", "hullResists"] as const).forEach((layer) => {
    derived[layer].em = Math.min(0.82, derived[layer].em);
    derived[layer].thermal = Math.min(0.82, derived[layer].thermal);
    derived[layer].kinetic = Math.min(0.82, derived[layer].kinetic);
    derived[layer].explosive = Math.min(0.82, derived[layer].explosive);
  });

  return derived;
}

export function getRepairCost(player: PlayerState) {
  const derived = computeDerivedStats(player);
  const missingHull = derived.maxHull - player.hull;
  const missingArmor = derived.maxArmor - player.armor;
  const missingShield = derived.maxShield - player.shield;
  return Math.max(0, Math.ceil(missingHull * 2 + missingArmor * 1.7 + missingShield * 1.5));
}
