import { createBalanceConfig } from "./overrides";

const CAPACITOR_BALANCE_DEFAULT = {
  // Shared regen multiplier applied after hull and module bonuses.
  playerRegenMultiplier: 0.6,
  // Capacitor should recover best when a ship is settled and not spending thrust.
  stationaryRegenBonusMultiplier: 1.3,
  stationarySpeedThresholdFraction: 0.18,
  // Tactical slow should feel meaningful without turning ships into dead weight.
  tacticalSlow: {
    timeScale: 0.4,
    durationSec: 4,
    cooldownSec: 55,
    capPenaltySec: 10,
    speedPenaltySec: 8,
    speedPenaltyMultiplier: 0.85,
    capacitorRegenPenaltyMultiplier: 0.8
  }
} as const;

export const CAPACITOR_BALANCE = createBalanceConfig("capacitor", CAPACITOR_BALANCE_DEFAULT);
