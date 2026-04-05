import { createBalanceConfig } from "./overrides";

const COMBAT_BALANCE_DEFAULT = {
  // Master combat pressure dial. Lower values soften the fight; higher values make it harsher.
  pressure: {
    dial: 1
  },
  // Core damage model defaults. Used when a weapon does not provide a typed profile.
  damage: {
    defaultProfile: { em: 0.25, thermal: 0.25, kinetic: 0.25, explosive: 0.25 },
    resistClamp: 0.82
  },
  // Turret math. Keep these together so range/tracking tuning stays readable.
  turret: {
    defaultOptimalRange: 200,
    defaultFalloff: 120,
    defaultSignatureResolution: 40,
    // Trajectory matters here: ships moving broadly across the firing line are harder to apply damage to.
    trackingScalar: 4.4,
    minimumTracking: 0.02,
    trackingExponent: 1.35,
    trajectoryScalar: 0.58,
    trajectoryRadialBonus: 0.22,
    trajectoryLateralPenalty: 0.18,
    qualityExcellent: 0.82,
    qualitySolid: 0.48,
    qualityGrazing: 0.14
  },
  difficulty: {
    easy: { playerDamageMultiplier: 1.1, enemyDamageMultiplier: 0.9 },
    normal: { playerDamageMultiplier: 1, enemyDamageMultiplier: 1 },
    hard: { playerDamageMultiplier: 0.9, enemyDamageMultiplier: 1.28 },
    extreme: { playerDamageMultiplier: 0.82, enemyDamageMultiplier: 1.42 }
  }
} as const;

export const COMBAT_BALANCE = createBalanceConfig("combat", COMBAT_BALANCE_DEFAULT);
