export const PERFORMANCE = {
  simulation: {
    backgroundSectorUpdateIntervalSec: 1.25
  },
  rendering: {
    objectCullMargin: 220,
    effectCullMargin: 280,
    particleCullMargin: 180,
    labelCullMargin: 340
  },
  ui: {
    snapshotRefreshIntervalSec: 0.2,
    saveDelayMs: 150
  }
} as const;
