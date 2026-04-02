import { moduleCatalog } from "../data/modules";
import { DamageType, DamageProfile, ModuleDefinition, SizeClass } from "../../types/game";

export interface WeaponStatMetric {
  id:
    | "damage"
    | "fireRate"
    | "range"
    | "tracking"
    | "application"
    | "efficiency"
    | "shield"
    | "armor";
  label: string;
  value: number;
  normalized: number;
  displayValue: string;
  tone: string;
}

export interface CompactModuleMetric {
  id: string;
  label: string;
  value: number;
  normalized: number;
  displayValue: string;
  tone: string;
}

export interface WeaponSummaryStats {
  damagePerCycle: number;
  dps: number;
  cycleTime: number;
  effectiveRange: number;
  optimal: number;
  falloff: number;
  tracking: number;
  application: number;
  capacitorUse: number;
  capacitorPerSecond: number;
  efficiency: number;
  shieldPressure: number;
  armorPressure: number;
}

export interface WeaponComparisonHighlight {
  label: string;
  direction: "up" | "down";
}

export interface WeaponMetricDelta {
  direction: "up" | "down" | "flat";
  amount: number;
}

const SHIELD_WEIGHTS: Record<DamageType, number> = {
  em: 1,
  thermal: 0.72,
  kinetic: 0.42,
  explosive: 0.24
};

const ARMOR_WEIGHTS: Record<DamageType, number> = {
  em: 0.28,
  thermal: 0.52,
  kinetic: 0.78,
  explosive: 1
};

const BAR_TONES: Record<WeaponStatMetric["id"], string> = {
  damage: "damage",
  fireRate: "cycle",
  range: "range",
  tracking: "tracking",
  application: "application",
  efficiency: "efficiency",
  shield: "shield",
  armor: "armor"
};

const weaponModules = moduleCatalog.filter((module) => isWeaponModule(module));

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function sumDamageWeight(profile: DamageProfile | undefined, weights: Record<DamageType, number>) {
  if (!profile) return 0;
  return (Object.keys(weights) as DamageType[]).reduce(
    (total, type) => total + (profile[type] ?? 0) * weights[type],
    0
  );
}

export function isWeaponModule(module: ModuleDefinition | null | undefined): module is ModuleDefinition {
  return Boolean(module?.slot === "weapon" && module.damage && module.damageProfile);
}

function isWeaponLikeModule(module: ModuleDefinition) {
  return module.slot === "weapon" && Boolean(module.damage && module.damageProfile);
}

export function getWeaponClassKey(module: ModuleDefinition) {
  return (module.weaponClass ?? module.sizeClass ?? "light") as SizeClass;
}

export function getWeaponComparablePool(module: ModuleDefinition) {
  const classKey = getWeaponClassKey(module);
  return weaponModules.filter((entry) => getWeaponClassKey(entry) === classKey);
}

export function getComparableModulePool(module: ModuleDefinition) {
  if (isWeaponLikeModule(module)) return getWeaponComparablePool(module);
  const sameKind = moduleCatalog.filter((entry) => entry.slot === module.slot && entry.kind === module.kind);
  if (sameKind.length > 1) return sameKind;
  const sameSlot = moduleCatalog.filter((entry) => entry.slot === module.slot);
  return sameSlot.length > 0 ? sameSlot : moduleCatalog;
}

export function getWeaponSummaryStats(module: ModuleDefinition): WeaponSummaryStats {
  const damagePerCycle = module.damage ?? 0;
  const cycleTime = Math.max(module.cycleTime ?? 0, 0.01);
  const optimal = module.optimal ?? module.range ?? 0;
  const falloff = module.falloff ?? Math.max(0, (module.range ?? optimal) - optimal);
  const effectiveRange = optimal + falloff;
  const tracking = module.kind === "missile" ? 0.16 : module.tracking ?? 0;
  const signatureResolution = module.kind === "missile" ? 36 : Math.max(module.signatureResolution ?? 40, 1);
  const application = module.kind === "missile" ? 1 : tracking * (40 / signatureResolution) * 12;
  const capacitorUse = module.capacitorUse ?? 0;
  const capacitorPerSecond =
    module.capacitorDrain ?? (module.capacitorUse && cycleTime > 0 ? module.capacitorUse / cycleTime : 0);
  const efficiency = capacitorUse > 0 ? damagePerCycle / capacitorUse : damagePerCycle;
  const shieldPressure = damagePerCycle * sumDamageWeight(module.damageProfile, SHIELD_WEIGHTS);
  const armorPressure = damagePerCycle * sumDamageWeight(module.damageProfile, ARMOR_WEIGHTS);

  return {
    damagePerCycle,
    dps: damagePerCycle / cycleTime,
    cycleTime,
    effectiveRange,
    optimal,
    falloff,
    tracking,
    application,
    capacitorUse,
    capacitorPerSecond,
    efficiency,
    shieldPressure,
    armorPressure
  };
}

function getMetricValue(module: ModuleDefinition, metricId: WeaponStatMetric["id"]) {
  const stats = getWeaponSummaryStats(module);
  switch (metricId) {
    case "damage":
      return stats.dps;
    case "fireRate":
      return 1 / stats.cycleTime;
    case "range":
      return stats.effectiveRange;
    case "tracking":
      return stats.tracking;
    case "application":
      return stats.application;
    case "efficiency":
      return stats.efficiency;
    case "shield":
      return stats.shieldPressure;
    case "armor":
      return stats.armorPressure;
  }
}

export function getWeaponMetricDelta(
  module: ModuleDefinition,
  metricId: WeaponStatMetric["id"],
  compareTo?: ModuleDefinition | null
): WeaponMetricDelta {
  if (!compareTo || !isWeaponModule(compareTo)) {
    return { direction: "flat", amount: 0 };
  }
  const current = getMetricValue(module, metricId);
  const baseline = getMetricValue(compareTo, metricId);
  const relative = getRelativeDelta(current, baseline);
  if (Math.abs(relative) < 0.05) return { direction: "flat", amount: Math.abs(relative) };
  return { direction: relative > 0 ? "up" : "down", amount: Math.abs(relative) };
}

function getMetricDisplay(module: ModuleDefinition, metricId: WeaponStatMetric["id"]) {
  const stats = getWeaponSummaryStats(module);
  switch (metricId) {
    case "damage":
      return `${stats.dps.toFixed(1)} dps`;
    case "fireRate":
      return `${(60 / stats.cycleTime).toFixed(1)}/min`;
    case "range":
      return `${Math.round(stats.effectiveRange)} m`;
    case "tracking":
      return module.kind === "missile" ? "Guided" : `${stats.tracking.toFixed(3)} rad/s`;
    case "application":
      return module.kind === "missile" ? "High" : `${stats.application.toFixed(2)} score`;
    case "efficiency":
      return stats.capacitorUse > 0 ? `${stats.efficiency.toFixed(2)} dmg/cap` : "Cap-free";
    case "shield":
      return `${stats.shieldPressure.toFixed(1)} pressure`;
    case "armor":
      return `${stats.armorPressure.toFixed(1)} pressure`;
  }
}

export function getWeaponMetrics(module: ModuleDefinition): WeaponStatMetric[] {
  const pool = getWeaponComparablePool(module);
  const metricIds: WeaponStatMetric["id"][] = [
    "damage",
    "fireRate",
    "range",
    "tracking",
    "application",
    "efficiency",
    "shield",
    "armor"
  ];

  return metricIds.map((metricId) => {
    const value = getMetricValue(module, metricId);
    const max = Math.max(...pool.map((entry) => getMetricValue(entry, metricId)), 1);
    return {
      id: metricId,
      label:
        metricId === "fireRate"
          ? "Fire Rate"
          : metricId === "shield"
            ? "Shield Pressure"
            : metricId === "armor"
              ? "Armor Pressure"
              : metricId === "efficiency"
                ? "Energy Efficiency"
                : metricId === "application"
                  ? "Damage Application"
                  : metricId.charAt(0).toUpperCase() + metricId.slice(1),
      value,
      normalized: clamp01(value / max),
      displayValue: getMetricDisplay(module, metricId),
      tone: BAR_TONES[metricId]
    };
  });
}

function getNonWeaponMetricSpecs(module: ModuleDefinition) {
  const capCost = module.capacitorDrain ?? (module.capacitorUse && module.cycleTime ? module.capacitorUse / module.cycleTime : 0);
  const rate = module.cycleTime && module.cycleTime > 0 ? 1 / module.cycleTime : module.activation === "passive" ? 1 : 0.5;
  const range = module.range ?? 0;

  const impact =
    module.repairAmount ??
    module.speedBonus ??
    module.miningAmount ??
    module.resistBonus ??
    module.signatureBonus ??
    module.speedPenalty ??
    module.trackingPenalty ??
    module.lockRangePenalty ??
    (module.modifiers.maxShield ??
      module.modifiers.maxArmor ??
      module.modifiers.maxHull ??
      module.modifiers.cargoCapacity ??
      module.modifiers.capacitorCapacity ??
      module.modifiers.maxSpeed ??
      module.modifiers.lockRange ??
      module.modifiers.miningYieldMultiplier ??
      module.modifiers.laserDamageMultiplier ??
      module.modifiers.railgunDamageMultiplier ??
      module.modifiers.missileDamageMultiplier ??
      module.modifiers.shieldResistBonus ??
      module.modifiers.armorResistBonus ??
      module.modifiers.hullResistBonus ??
      0);

  const special =
    module.kind === "shield_booster"
      ? module.repairAmount ?? 0
      : module.kind === "armor_repairer"
        ? module.repairAmount ?? 0
        : module.kind === "hardener"
          ? module.resistBonus ?? 0
          : module.kind === "afterburner"
            ? module.speedBonus ?? 0
            : module.kind === "mining_laser"
              ? module.miningAmount ?? 0
              : module.kind === "webifier"
                ? module.speedPenalty ?? 0
                : module.kind === "target_painter"
                  ? module.signatureBonus ?? 0
                  : module.kind === "tracking_disruptor"
                    ? module.trackingPenalty ?? 0
                    : module.kind === "sensor_dampener"
                      ? module.lockRangePenalty ?? 0
                      : module.modifiers.cargoCapacity ??
                        module.modifiers.capacitorCapacity ??
                        module.modifiers.maxShield ??
                        module.modifiers.maxArmor ??
                        module.modifiers.maxHull ??
                        0;

  return [
    {
      id: "impact",
      label:
        module.kind === "afterburner"
          ? "Speed"
          : module.kind === "mining_laser"
            ? "Yield"
            : module.kind === "salvager"
              ? "Salvage"
              : module.kind === "shield_booster" || module.kind === "armor_repairer"
                ? "Repair"
                : module.kind === "hardener"
                  ? "Resist"
                  : module.kind === "webifier"
                    ? "Slow"
                    : module.kind === "target_painter"
                      ? "Bloom"
                      : module.kind === "tracking_disruptor"
                        ? "Disrupt"
                        : module.kind === "sensor_dampener"
                          ? "Dampen"
                          : "Impact",
      value: Math.abs(impact),
      displayValue:
        module.kind === "afterburner"
          ? `+${module.speedBonus ?? 0} speed`
          : module.kind === "mining_laser"
            ? `${module.miningAmount ?? 0} ore`
            : module.kind === "salvager"
              ? `${Math.round((module.cycleTime ?? 0) > 0 ? 60 / (module.cycleTime ?? 1) : 0)} / min`
              : module.kind === "shield_booster" || module.kind === "armor_repairer"
                ? `+${module.repairAmount ?? 0}`
                : module.kind === "hardener"
                  ? `+${Math.round((module.resistBonus ?? 0) * 100)}%`
                  : module.kind === "webifier"
                    ? `-${Math.round((module.speedPenalty ?? 0) * 100)}%`
                    : module.kind === "target_painter"
                      ? `+${Math.round((module.signatureBonus ?? 0) * 100)}%`
                      : module.kind === "tracking_disruptor"
                        ? `-${Math.round((module.trackingPenalty ?? 0) * 100)}%`
                        : module.kind === "sensor_dampener"
                          ? `-${Math.round((module.lockRangePenalty ?? 0) * 100)}%`
                          : `${Math.round(Math.abs(impact))}`,
      tone: "damage"
    },
    {
      id: "rate",
      label: "Rate",
      value: rate,
      displayValue:
        module.activation === "passive" ? "Passive" : module.cycleTime ? `${module.cycleTime.toFixed(1)} s` : "Active",
      tone: "cycle"
    },
    {
      id: "range",
      label: range > 0 ? "Range" : "Reach",
      value: range,
      displayValue: range > 0 ? `${Math.round(range)} m` : module.activation === "passive" ? "None" : "Local",
      tone: "range"
    },
    {
      id: "energy",
      label: capCost > 0 ? "Energy" : "Uptime",
      value: capCost > 0 ? capCost : 1,
      displayValue:
        capCost > 0
          ? module.capacitorDrain
            ? `${module.capacitorDrain.toFixed(1)}/s`
            : `${(module.capacitorUse ?? 0).toFixed(0)}/cycle`
          : "Cap-free",
      tone: "efficiency"
    },
    {
      id: "special",
      label:
        module.kind === "shield_booster"
          ? "Repair"
          : module.kind === "armor_repairer"
            ? "Repair"
            : module.kind === "hardener"
              ? "Mitigation"
              : module.kind === "afterburner"
                ? "Mobility"
                : module.kind === "mining_laser"
                  ? "Coverage"
                  : module.kind === "salvager"
                    ? "Recovery"
                    : module.kind === "webifier"
                      ? "Control"
                      : module.kind === "target_painter"
                        ? "Bloom"
                        : module.kind === "tracking_disruptor"
                          ? "Disrupt"
                          : module.kind === "sensor_dampener"
                            ? "Dampen"
                            : "Buff",
      value: Math.abs(special),
      displayValue:
        module.kind === "shield_booster" || module.kind === "armor_repairer"
          ? `${module.repairAmount ?? 0} hp`
          : module.kind === "hardener"
            ? `+${Math.round((module.resistBonus ?? 0) * 100)}%`
            : module.kind === "afterburner"
              ? `+${module.speedBonus ?? 0}`
              : module.kind === "mining_laser"
                ? `${module.miningAmount ?? 0}`
                : module.kind === "webifier"
                  ? `-${Math.round((module.speedPenalty ?? 0) * 100)}%`
                  : module.kind === "target_painter"
                    ? `+${Math.round((module.signatureBonus ?? 0) * 100)}%`
                    : module.kind === "tracking_disruptor"
                      ? `-${Math.round((module.trackingPenalty ?? 0) * 100)}%`
                      : module.kind === "sensor_dampener"
                        ? `-${Math.round((module.lockRangePenalty ?? 0) * 100)}%`
                        : `${Math.round(Math.abs(special))}`,
      tone: "shield"
    }
  ];
}

export function getCompactModuleMetrics(module: ModuleDefinition): CompactModuleMetric[] {
  if (isWeaponLikeModule(module)) {
    return getWeaponMetrics(module).map((metric) => ({ ...metric }));
  }

  const specs = getNonWeaponMetricSpecs(module);
  const pool = getComparableModulePool(module);
  return specs.map((metric) => {
    const max = Math.max(
      ...pool.map((entry) => {
        if (isWeaponModule(entry)) return 0;
        return getNonWeaponMetricSpecs(entry).find((item) => item.id === metric.id)?.value ?? 0;
      }),
      1
    );
    return {
      ...metric,
      normalized: clamp01(metric.value / max)
    };
  });
}

export function getCompactWeaponMetrics(module: ModuleDefinition) {
  const priority: WeaponStatMetric["id"][] = ["damage", "fireRate", "range", "tracking", "efficiency"];
  const metrics = getWeaponMetrics(module);
  return priority
    .map((id) => metrics.find((metric) => metric.id === id))
    .filter((metric): metric is WeaponStatMetric => Boolean(metric));
}

export function getWeaponRoleDescription(module: ModuleDefinition) {
  const stats = getWeaponSummaryStats(module);
  if (stats.shieldPressure > stats.armorPressure * 1.18) return "Anti-Shield";
  if (stats.armorPressure > stats.shieldPressure * 1.18) return "Anti-Armor";
  if (stats.effectiveRange >= 560 || (stats.effectiveRange >= 430 && stats.tracking < 0.11)) {
    return "Long Range";
  }
  if (stats.cycleTime <= 2.5 && stats.effectiveRange <= 320) return "Close Range";
  if (stats.application >= 0.7 || module.kind === "missile") return "Generalist";
  return "Balanced";
}

export function getModuleRoleTag(module: ModuleDefinition) {
  if (isWeaponLikeModule(module)) return getWeaponRoleDescription(module);
  if (module.kind === "afterburner") return "Mobility";
  if (module.kind === "mining_laser") return "Mining";
  if (module.kind === "salvager") return "Salvage";
  if (module.kind === "shield_booster" || module.kind === "armor_repairer" || module.kind === "hardener") return "Tank";
  if (
    module.kind === "webifier" ||
    module.kind === "warp_disruptor" ||
    module.kind === "target_painter" ||
    module.kind === "tracking_disruptor" ||
    module.kind === "sensor_dampener" ||
    module.kind === "energy_neutralizer"
  ) return "Control";
  if (module.kind === "passive") return "Support";
  return "Utility";
}

function getRelativeDelta(nextValue: number, previousValue: number) {
  const baseline = Math.max(Math.abs(previousValue), 0.001);
  return (nextValue - previousValue) / baseline;
}

export function getWeaponComparisonHighlights(
  module: ModuleDefinition,
  compareTo?: ModuleDefinition | null
): WeaponComparisonHighlight[] {
  if (!compareTo || !isWeaponModule(compareTo)) return [];

  const candidates: Array<{ label: string; delta: number; direction: "up" | "down" }> = [
    { label: "improved damage", delta: getRelativeDelta(getWeaponSummaryStats(module).dps, getWeaponSummaryStats(compareTo).dps), direction: "up" },
    { label: "worse tracking", delta: -getRelativeDelta(getWeaponSummaryStats(module).tracking, getWeaponSummaryStats(compareTo).tracking), direction: "down" },
    { label: "lower capacitor cost", delta: -getRelativeDelta(getWeaponSummaryStats(module).capacitorUse || 0.001, getWeaponSummaryStats(compareTo).capacitorUse || 0.001), direction: "up" },
    { label: "better shield pressure", delta: getRelativeDelta(getWeaponSummaryStats(module).shieldPressure, getWeaponSummaryStats(compareTo).shieldPressure), direction: "up" },
    { label: "worse armor pressure", delta: -getRelativeDelta(getWeaponSummaryStats(module).armorPressure, getWeaponSummaryStats(compareTo).armorPressure), direction: "down" },
    { label: "longer reach", delta: getRelativeDelta(getWeaponSummaryStats(module).effectiveRange, getWeaponSummaryStats(compareTo).effectiveRange), direction: "up" }
  ];

  return candidates
    .filter((entry) => entry.delta > 0.08)
    .sort((left, right) => right.delta - left.delta)
    .slice(0, 3)
    .map(({ label, direction }) => ({ label, direction }));
}

export function findComparableEquippedWeapon(
  module: ModuleDefinition,
  equippedWeaponIds: Array<string | null>
) {
  const equippedWeapons = equippedWeaponIds
    .map((moduleId) => (moduleId ? moduleCatalog.find((entry) => entry.id === moduleId) ?? null : null))
    .filter(isWeaponModule);

  return (
    equippedWeapons.find((entry) => getWeaponClassKey(entry) === getWeaponClassKey(module)) ??
    equippedWeapons.find((entry) => entry.kind === module.kind) ??
    equippedWeapons[0] ??
    null
  );
}

export function getDamageProfileEntries(profile: DamageProfile | undefined) {
  if (!profile) return [];
  return (Object.keys(profile) as DamageType[]).map((type) => ({
    type,
    label: type === "em" ? "EM" : type === "thermal" ? "Thermal" : type === "kinetic" ? "Kinetic" : "Explosive",
    value: profile[type] ?? 0
  }));
}
