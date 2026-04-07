import { createBalanceConfig } from "./overrides";

const MISSION_BALANCE_DEFAULT = {
  // Story mission wave pacing is intentionally slower than open-space reinforcement pacing.
  survive: {
    defaultReinforcementIntervalSec: 90,
    objectivePressurePerSecond: 0.012
  },
  clear: {
    defaultReinforcementIntervalSec: 90,
    pressurePerWave: 0.35
  }
} as const;

export const MISSION_BALANCE = createBalanceConfig("missions", MISSION_BALANCE_DEFAULT);
