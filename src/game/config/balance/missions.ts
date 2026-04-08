import { createBalanceConfig } from "./overrides";

const MISSION_BALANCE_DEFAULT = {
  // Story mission wave pacing is intentionally slower than open-space reinforcement pacing.
  survive: {
    defaultReinforcementIntervalSec: 82,
    objectivePressurePerSecond: 0.012
  },
  clear: {
    defaultReinforcementIntervalSec: 80,
    pressurePerWave: 0.35
  }
} as const;

export const MISSION_BALANCE = createBalanceConfig("missions", MISSION_BALANCE_DEFAULT);
