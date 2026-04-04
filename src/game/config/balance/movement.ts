import { createBalanceConfig } from "./overrides";

const MOVEMENT_BALANCE_DEFAULT = {
  boundary: {
    warningDistance: 260,
    gravityStartDistance: 90,
    overshootAllowance: 140,
    returnAcceleration: 520,
    slingshotDamping: 0.08,
    clusterPullRadius: 520,
    visibleMargin: 120,
    reboundDistance: 260,
    rubberBandMinSpeed: 180,
    clusterDamping: 0.82
  },
  terrain: {
    asteroidRepelPadding: 120,
    asteroidPushStrength: 110,
    asteroidRadiusScale: 0.85,
    anomalyPullScale: 0.08,
    anomalySpinScale: 0.015,
    anomalyPushScale: 0.08,
    dragSlowScale: 0.34,
    ionSlowScale: 0.18,
    slipstreamScale: 0.04,
    collisionPadding: 3,
    collisionDamping: 0.92,
    collisionOverlapScale: 0.0012
  }
} as const;

export const MOVEMENT_BALANCE = createBalanceConfig("movement", MOVEMENT_BALANCE_DEFAULT);
