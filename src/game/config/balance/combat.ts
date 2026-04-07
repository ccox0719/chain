import { createBalanceConfig } from "./overrides";

const COMBAT_BALANCE_DEFAULT = {
  // Individual combat pressure multipliers. Each directly scales one aspect of the fight.
  // Defaults reflect the normal-difficulty tuning.
  pressure: {
    masterDial: 1.23,                   // UI only, not read by simulation
    playerDamageMultiplier: 1.175,      // your outgoing damage
    enemyDamageMultiplier: 0.775,       // enemy outgoing damage
    playerTrackingMultiplier: 1.1125,    // your turret accuracy vs moving targets
    enemyTrackingMultiplier: 0.9,       // enemy turret accuracy vs you
    enemyDetectionMultiplier: 0.925,    // how far enemies spot and chase you
    enemyDamageTakenMultiplier: 0.7     // multiplier on damage enemies actually receive
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
    easy: { playerDamageMultiplier: 1.14, enemyDamageMultiplier: 0.84, enemyDurabilityMultiplier: 0.86 },
    normal: { playerDamageMultiplier: 1.04, enemyDamageMultiplier: 0.94, enemyDurabilityMultiplier: 0.92 },
    hard: { playerDamageMultiplier: 0.94, enemyDamageMultiplier: 1.18, enemyDurabilityMultiplier: 0.96 },
    extreme: { playerDamageMultiplier: 0.86, enemyDamageMultiplier: 1.32 }
  }
} as const;

export const COMBAT_BALANCE = createBalanceConfig("combat", COMBAT_BALANCE_DEFAULT);
