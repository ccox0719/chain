import { moduleCatalog } from "../data/modules";
import { DamageType, DamageProfile, ModuleDefinition, SizeClass, WeaponDefinition } from "../../types/game";

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

export interface UtilityDisplayFact {
  label: string;
  value: string;
}

export interface UtilityDisplayChip {
  label: string;
  value: string;
  tone: string;
}

export interface UtilityModuleDisplay {
  purposeLabel: string;
  activationLabel: string;
  summary: string;
  chips: UtilityDisplayChip[];
  facts: UtilityDisplayFact[];
  auditLines: string[];
}

export interface ResistanceProfileEntry {
  type: DamageType;
  label: string;
  value: number;
}

export interface WeaponSummaryStats {
  burstCycleTime: number;
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
  magazineSize: number;
  reloadTime: number;
}

export interface WeaponComparisonHighlight {
  label: string;
  direction: "up" | "down";
  amount: number;
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

export function isWeaponModule(module: ModuleDefinition | null | undefined): module is WeaponDefinition {
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
  const burstCycleTime = Math.max(module.cycleTime ?? 0, 0.01);
  const magazineSize = module.kind === "cannon" ? Math.max(1, module.magazineSize ?? 1) : 0;
  const reloadTime = module.kind === "cannon" ? Math.max(module.reloadTime ?? burstCycleTime, 0) : 0;
  const cycleTime = magazineSize > 0 ? burstCycleTime + reloadTime / magazineSize : burstCycleTime;
  const optimal = module.optimal ?? module.range ?? 0;
  const falloff = module.falloff ?? Math.max(0, (module.range ?? optimal) - optimal);
  const effectiveRange = optimal + falloff;
  const tracking = module.kind === "missile" ? 0.16 : module.tracking ?? 0;
  const signatureResolution = module.kind === "missile" ? 36 : module.kind === "cannon" ? Math.max(module.signatureResolution ?? 46, 1) : Math.max(module.signatureResolution ?? 40, 1);
  const application = module.kind === "missile" ? 1 : tracking * (40 / signatureResolution) * 12;
  const capacitorUse = module.capacitorUse ?? 0;
  const capacitorPerSecond =
    module.capacitorDrain ?? (module.capacitorUse && cycleTime > 0 ? module.capacitorUse / cycleTime : 0);
  const efficiency = capacitorUse > 0 ? damagePerCycle / capacitorUse : damagePerCycle;
  const shieldPressure = damagePerCycle * sumDamageWeight(module.damageProfile, SHIELD_WEIGHTS);
  const armorPressure = damagePerCycle * sumDamageWeight(module.damageProfile, ARMOR_WEIGHTS);

  return {
    burstCycleTime,
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
    armorPressure,
    magazineSize,
    reloadTime
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
      return module.kind === "missile" ? "Guided" : module.kind === "cannon" ? "Ballistic" : `${stats.tracking.toFixed(3)} rad/s`;
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
  const miningYield = module.kind === "mining_laser"
    ? Math.max(1, Math.round((module.miningAmount ?? 0) * (module.miningYieldMultiplier ?? 1)))
    : 0;
  const salvageBonusPct = module.kind === "salvager"
    ? Math.max(0, ((module.salvageYieldMultiplier ?? 1) - 1) * 100)
    : 0;

  const impact =
    module.kind === "mining_laser"
      ? miningYield
      : module.kind === "salvager"
        ? salvageBonusPct
        : module.repairAmount ??
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
              ? miningYield
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
            ? `${miningYield} ore${module.miningYieldMultiplier && module.miningYieldMultiplier !== 1 ? ` x${module.miningYieldMultiplier.toFixed(2)}` : ""}`
            : module.kind === "salvager"
              ? `${salvageBonusPct > 0 ? `+${Math.round(salvageBonusPct)}%` : "No"} salvage`
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
                  ? "Automation"
                  : module.kind === "salvager"
                    ? "Automation"
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
                ? `${module.autoMine ? "Auto-mine" : "Manual"}`
                : module.kind === "salvager"
                  ? `${module.autoSalvage ? "Auto-salvage" : "Manual"}`
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

function getModuleResistanceBonus(module: ModuleDefinition) {
  return (
    module.resistBonus ??
    module.modifiers.shieldResistBonus ??
    module.modifiers.armorResistBonus ??
    module.modifiers.hullResistBonus ??
    module.activeModifiers?.shieldResistBonus ??
    module.activeModifiers?.armorResistBonus ??
    module.activeModifiers?.hullResistBonus ??
    0
  );
}

export function getModuleResistanceProfile(module: ModuleDefinition) {
  const profile = module.resistProfile ?? module.modifiers.shieldResistProfile ?? module.modifiers.armorResistProfile ?? module.modifiers.hullResistProfile;
  if (profile) {
    return (["em", "thermal", "kinetic", "explosive"] as DamageType[]).map((type) => ({
      type,
      label: type === "em" ? "EM" : type === "thermal" ? "Thermal" : type === "kinetic" ? "Kinetic" : "Explosive",
      value: profile[type] ?? 0
    })) as ResistanceProfileEntry[];
  }

  const bonus = getModuleResistanceBonus(module);
  if (bonus <= 0) return [];

  return (["em", "thermal", "kinetic", "explosive"] as DamageType[]).map((type) => ({
    type,
    label: type === "em" ? "EM" : type === "thermal" ? "Thermal" : type === "kinetic" ? "Kinetic" : "Explosive",
    value: bonus
  })) as ResistanceProfileEntry[];
}

function formatSignedNumber(value: number, digits = 0) {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(digits));
  return `${rounded >= 0 ? "+" : "-"}${Math.abs(rounded)}`;
}

function formatPercent(value: number) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

function formatRatio(value: number, digits = 2) {
  return `x${value.toFixed(digits)}`;
}

function formatCapUse(module: ModuleDefinition) {
  if (module.capacitorDrain !== undefined) return `${module.capacitorDrain.toFixed(1)}/s`;
  if (module.capacitorUse !== undefined) return `${module.capacitorUse.toFixed(0)}/cycle`;
  return "Cap-free";
}

function pushFact(facts: UtilityDisplayFact[], label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return;
  facts.push({ label, value: String(value) });
}

function pushChip(chips: UtilityDisplayChip[], label: string, value: string | number, tone: string) {
  chips.push({ label, value: String(value), tone });
}

function getUtilityPurposeLabel(module: ModuleDefinition) {
  if (module.kind === "mining_laser") return "Mining";
  if (module.kind === "salvager") return "Salvage";
  if (module.kind === "afterburner") return "Mobility";
  if (module.kind === "webifier") return "Tackle";
  if (module.kind === "warp_disruptor") return "Interdiction";
  if (module.kind === "target_painter") return "Targeting";
  if (module.kind === "tracking_disruptor") return "Jamming";
  if (module.kind === "sensor_dampener") return "Dampening";
  if (module.kind === "energy_neutralizer") return "Cap Pressure";
  if (module.modifiers.miningYieldMultiplier || module.activeModifiers?.miningYieldMultiplier) return "Mining Support";
  if (module.modifiers.cargoCapacity || module.activeModifiers?.cargoCapacity) return "Cargo";
  if (module.modifiers.capacitorCapacity || module.modifiers.capacitorRegen) return "Capacitor";
  if (module.modifiers.turretTrackingMultiplier || module.modifiers.turretOptimalMultiplier || module.modifiers.turretFalloffMultiplier) {
    return "Fire Control";
  }
  if (module.modifiers.maxSpeed || module.activeModifiers?.maxSpeed) return "Mobility";
  return "Support";
}

export function getUtilityModuleDisplay(module: ModuleDefinition): UtilityModuleDisplay {
  const purposeLabel = getUtilityPurposeLabel(module);
  const activationLabel = module.activation === "passive" ? "Passive utility" : "Active utility";
  const chips: UtilityDisplayChip[] = [];
  const facts: UtilityDisplayFact[] = [];
  const auditLines: string[] = [];

  pushChip(chips, "Mode", activationLabel, "efficiency");

  if (module.kind === "mining_laser") {
    const yieldAmount = Math.max(1, Math.round((module.miningAmount ?? 0) * (module.miningYieldMultiplier ?? 1)));
    pushChip(chips, "Yield", `${yieldAmount} ore/cycle`, "damage");
    if (module.range) pushChip(chips, "Range", `${Math.round(module.range)} m`, "range");
    pushChip(chips, "Cap use", formatCapUse(module), "efficiency");
    if (module.autoMine || module.minesAllInRange) {
      pushChip(chips, module.minesAllInRange ? "Sweep" : "Automation", module.minesAllInRange ? "All in range" : "Auto-mine", "application");
    }
    if (module.miningTargets?.length) pushChip(chips, "Targets", module.miningTargets.join(" · "), "application");

    pushFact(facts, "Yield", `${yieldAmount} ore/cycle`);
    pushFact(facts, "Range", `${Math.round(module.range ?? 0)} m`);
    pushFact(facts, "Cap use", formatCapUse(module));
    pushFact(facts, "Targets", module.miningTargets?.length ? module.miningTargets.join(" · ") : null);

    auditLines.push("Mining output uses miningAmount multiplied by miningYieldMultiplier.");
    if (module.autoMine) auditLines.push("Auto-mine is wired to nearby asteroids when no target is selected.");
    if (module.minesAllInRange) auditLines.push("Sweeps all eligible asteroids within range on each cycle.");
  } else if (module.kind === "salvager") {
    const salvageBonusPct = Math.max(0, ((module.salvageYieldMultiplier ?? 1) - 1) * 100);
    pushChip(chips, "Recovery", salvageBonusPct > 0 ? `+${Math.round(salvageBonusPct)}% scrap` : "Standard salvage", "shield");
    if (module.range) pushChip(chips, "Range", `${Math.round(module.range)} m`, "range");
    pushChip(chips, "Cap use", formatCapUse(module), "efficiency");
    if (module.autoSalvage) pushChip(chips, "Automation", "Auto-salvage", "application");

    pushFact(facts, "Bonus", salvageBonusPct > 0 ? `+${Math.round(salvageBonusPct)}% salvage-scrap` : "None");
    pushFact(facts, "Range", `${Math.round(module.range ?? 0)} m`);
    pushFact(facts, "Cap use", formatCapUse(module));
    pushFact(facts, "Automation", module.autoSalvage ? "Auto-salvage" : "Manual");

    auditLines.push("Salvage transfers wreck contents directly to the player.");
    if ((module.salvageYieldMultiplier ?? 1) > 1) {
      auditLines.push("Bonus salvage-scrap is added on top of the wreck's contents.");
    }
    if (module.autoSalvage) auditLines.push("Auto-salvage is wired to nearby wrecks when no target is selected.");
  } else if (module.kind === "afterburner") {
    pushChip(chips, "Speed", `+${module.speedBonus ?? 0}`, "damage");
    pushChip(chips, "Drain", formatCapUse(module), "efficiency");
    pushFact(facts, "Speed bonus", `+${module.speedBonus ?? 0}`);
    pushFact(facts, "Cap drain", formatCapUse(module));
    auditLines.push("Raises sublight speed while active.");
    auditLines.push("Consumes capacitor continuously.");
  } else if (module.kind === "webifier") {
    pushChip(chips, "Slow", module.speedPenalty ? formatPercent(-(module.speedPenalty * 100)) : "-0%", "tracking");
    if (module.range) pushChip(chips, "Range", `${Math.round(module.range)} m`, "range");
    pushChip(chips, "Cap drain", formatCapUse(module), "efficiency");
    pushFact(facts, "Slow", module.speedPenalty ? formatPercent(-(module.speedPenalty * 100)) : "-0%");
    pushFact(facts, "Range", `${Math.round(module.range ?? 0)} m`);
    pushFact(facts, "Cap drain", formatCapUse(module));
    auditLines.push("Applies a speed multiplier penalty to the target while in range.");
  } else if (module.kind === "warp_disruptor") {
    pushChip(chips, "Strength", `${module.warpDisruptStrength ?? 0}`, "application");
    if (module.range) pushChip(chips, "Range", `${Math.round(module.range)} m`, "range");
    pushChip(chips, "Cap drain", formatCapUse(module), "efficiency");
    pushFact(facts, "Interdiction", `${module.warpDisruptStrength ?? 0}`);
    pushFact(facts, "Range", `${Math.round(module.range ?? 0)} m`);
    pushFact(facts, "Cap drain", formatCapUse(module));
    auditLines.push("Warp blocking is currently enforced by hostile disruptor checks during warp commands.");
  } else if (module.kind === "target_painter") {
    pushChip(chips, "Signature", module.signatureBonus ? formatPercent(module.signatureBonus * 100) : "+0%", "application");
    if (module.range) pushChip(chips, "Range", `${Math.round(module.range)} m`, "range");
    pushChip(chips, "Cap drain", formatCapUse(module), "efficiency");
    pushFact(facts, "Signature", module.signatureBonus ? formatPercent(module.signatureBonus * 100) : "+0%");
    pushFact(facts, "Range", `${Math.round(module.range ?? 0)} m`);
    pushFact(facts, "Cap drain", formatCapUse(module));
    auditLines.push("Raises target signature multiplier to improve weapon application.");
  } else if (module.kind === "tracking_disruptor") {
    pushChip(chips, "Tracking", module.trackingPenalty ? formatPercent(-(module.trackingPenalty * 100)) : "-0%", "tracking");
    if (module.range) pushChip(chips, "Range", `${Math.round(module.range)} m`, "range");
    pushChip(chips, "Cap drain", formatCapUse(module), "efficiency");
    pushFact(facts, "Tracking", module.trackingPenalty ? formatPercent(-(module.trackingPenalty * 100)) : "-0%");
    pushFact(facts, "Range", `${Math.round(module.range ?? 0)} m`);
    pushFact(facts, "Cap drain", formatCapUse(module));
    auditLines.push("Reduces target turret tracking while in range.");
  } else if (module.kind === "sensor_dampener") {
    pushChip(chips, "Lock range", module.lockRangePenalty ? formatPercent(-(module.lockRangePenalty * 100)) : "-0%", "range");
    if (module.range) pushChip(chips, "Range", `${Math.round(module.range)} m`, "range");
    pushChip(chips, "Cap drain", formatCapUse(module), "efficiency");
    pushFact(facts, "Lock range", module.lockRangePenalty ? formatPercent(-(module.lockRangePenalty * 100)) : "-0%");
    pushFact(facts, "Range", `${Math.round(module.range ?? 0)} m`);
    pushFact(facts, "Cap drain", formatCapUse(module));
    auditLines.push("Reduces target lock range while in range.");
  } else if (module.kind === "energy_neutralizer") {
    pushChip(chips, "Neutralize", `${module.capacitorNeutralizeAmount ?? 0} cap`, "shield");
    pushChip(chips, "Cycle", module.cycleTime ? `${module.cycleTime.toFixed(1)} s` : "Cycle", "cycle");
    if (module.range) pushChip(chips, "Range", `${Math.round(module.range)} m`, "range");
    pushChip(chips, "Cap use", formatCapUse(module), "efficiency");
    pushFact(facts, "Neutralize", `${module.capacitorNeutralizeAmount ?? 0} cap`);
    pushFact(facts, "Cycle", module.cycleTime ? `${module.cycleTime.toFixed(1)} s` : null);
    pushFact(facts, "Range", `${Math.round(module.range ?? 0)} m`);
    pushFact(facts, "Cap use", formatCapUse(module));
    auditLines.push("Drains enemy capacitor directly on cycle completion.");
  } else {
    const cargoCapacity = module.modifiers.cargoCapacity ?? module.activeModifiers?.cargoCapacity;
    const capacitorCapacity = module.modifiers.capacitorCapacity ?? module.activeModifiers?.capacitorCapacity;
    const capacitorRegen = module.modifiers.capacitorRegen ?? module.activeModifiers?.capacitorRegen;
    const maxSpeed = module.modifiers.maxSpeed ?? module.activeModifiers?.maxSpeed;
    const lockRange = module.modifiers.lockRange ?? module.activeModifiers?.lockRange;
    const miningYieldMultiplier = module.modifiers.miningYieldMultiplier ?? module.activeModifiers?.miningYieldMultiplier;
    const turretTrackingMultiplier = module.modifiers.turretTrackingMultiplier ?? module.activeModifiers?.turretTrackingMultiplier;
    const turretOptimalMultiplier = module.modifiers.turretOptimalMultiplier ?? module.activeModifiers?.turretOptimalMultiplier;
    const turretFalloffMultiplier = module.modifiers.turretFalloffMultiplier ?? module.activeModifiers?.turretFalloffMultiplier;
    const active = module.activeModifiers;

    if (cargoCapacity !== undefined) {
      pushChip(chips, 'Cargo', formatSignedNumber(cargoCapacity), 'shield');
      pushFact(facts, 'Cargo', formatSignedNumber(cargoCapacity));
      auditLines.push('Adds cargo capacity.');
    }
    if (capacitorCapacity !== undefined) {
      pushChip(chips, 'Capacitance', formatSignedNumber(capacitorCapacity), 'efficiency');
      pushFact(facts, 'Capacitor', formatSignedNumber(capacitorCapacity));
      auditLines.push('Adds capacitor reserve.');
    }
    if (capacitorRegen !== undefined) {
      pushChip(chips, 'Regen', `${formatSignedNumber(capacitorRegen, 1)}/s`, 'efficiency');
      pushFact(facts, 'Cap regen', `${formatSignedNumber(capacitorRegen, 1)}/s`);
      auditLines.push('Adds capacitor regeneration.');
    }
    if (maxSpeed !== undefined) {
      pushChip(chips, 'Speed', formatSignedNumber(maxSpeed), maxSpeed >= 0 ? 'damage' : 'armor');
      pushFact(facts, 'Speed', formatSignedNumber(maxSpeed));
      auditLines.push(maxSpeed >= 0 ? 'Improves sublight speed.' : 'Reduces sublight speed.');
    }
    if (lockRange !== undefined) {
      pushChip(chips, 'Lock range', `${formatSignedNumber(lockRange)} m`, 'range');
      pushFact(facts, 'Lock range', `${formatSignedNumber(lockRange)} m`);
      auditLines.push('Extends sensor lock range.');
    }
    if (active?.lockRange !== undefined && active.lockRange !== lockRange) {
      pushChip(chips, 'Overcharge', `Lock ${formatSignedNumber(active.lockRange)} m`, 'range');
      pushFact(facts, 'Active lock range', `${formatSignedNumber(active.lockRange)} m`);
      auditLines.push('Active mode extends lock range further.');
    }
    if (miningYieldMultiplier !== undefined) {
      pushChip(chips, 'Mining', formatRatio(miningYieldMultiplier), 'damage');
      pushFact(facts, 'Mining', formatRatio(miningYieldMultiplier));
      auditLines.push('Multiplies mining yield.');
    }
    if (turretTrackingMultiplier !== undefined) {
      pushChip(chips, 'Tracking', formatRatio(turretTrackingMultiplier), 'tracking');
      pushFact(facts, 'Tracking', formatRatio(turretTrackingMultiplier));
      auditLines.push('Improves turret tracking.');
    }
    if (turretOptimalMultiplier !== undefined) {
      pushChip(chips, 'Optimal', formatRatio(turretOptimalMultiplier), 'range');
      pushFact(facts, 'Optimal', formatRatio(turretOptimalMultiplier));
      auditLines.push('Extends turret optimal range.');
    }
    if (active?.turretOptimalMultiplier !== undefined && active.turretOptimalMultiplier !== turretOptimalMultiplier) {
      pushChip(chips, 'Overcharge', `Optimal ${formatRatio(active.turretOptimalMultiplier)}`, 'range');
      pushFact(facts, 'Active optimal', formatRatio(active.turretOptimalMultiplier));
      auditLines.push('Active mode extends turret optimal range further.');
    }
    if (turretFalloffMultiplier !== undefined) {
      pushChip(chips, 'Falloff', formatRatio(turretFalloffMultiplier), 'range');
      pushFact(facts, 'Falloff', formatRatio(turretFalloffMultiplier));
      auditLines.push('Extends turret falloff range.');
    }
    if (active?.turretFalloffMultiplier !== undefined && active.turretFalloffMultiplier !== turretFalloffMultiplier) {
      pushChip(chips, 'Overcharge', `Falloff ${formatRatio(active.turretFalloffMultiplier)}`, 'range');
      pushFact(facts, 'Active falloff', formatRatio(active.turretFalloffMultiplier));
      auditLines.push('Active mode extends turret falloff range further.');
    }
  }
  return {
    purposeLabel,
    activationLabel,
    summary: module.description,
    chips: chips.slice(0, 5),
    facts: facts.slice(0, 5),
    auditLines
  };
}

export function getModuleResistanceLabel(module: ModuleDefinition) {
  if (module.resistMode === "reactive") return "Reactive Resistance";
  if (module.resistMode === "adaptive") return "Adaptive Resistance";
  if (module.resistProfile) return module.resistLayer === "shield" ? "Shield Resistance" : module.resistLayer === "armor" ? "Armor Resistance" : "Hull Resistance";
  if (module.kind === "hardener") return "Adaptive Resistance";
  if (module.modifiers.shieldResistBonus || module.activeModifiers?.shieldResistBonus) return "Shield Resistance";
  if (module.modifiers.armorResistBonus || module.activeModifiers?.armorResistBonus) return "Armor Resistance";
  if (module.modifiers.hullResistBonus || module.activeModifiers?.hullResistBonus) return "Hull Resistance";
  return "Resistance";
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
  if (module.kind === "cannon" && stats.effectiveRange <= 380) return "Brawl Cannon";
  if (module.kind === "cannon") return "Siege Cannon";
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
    .map(({ label, direction, delta }) => ({ label, direction, amount: delta }));
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
