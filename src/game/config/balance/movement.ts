import { createBalanceConfig } from "./overrides";

const MOVEMENT_BALANCE_DEFAULT = {
  boundary: {
    deepSpaceMargin: 2400,
    warningDistance: 135,
    // Each site type owns its own local-space pocket instead of inheriting a sector-sized edge.
    pocketTypes: {
      transit: {
        activeRadius: 760,
        bufferRadius: 980,
        containmentRadius: 1220,
        recoveryReleaseRadius: 690,
        pullStrength: 210,
        dampingStrength: 0.62,
        turnAssistStrength: 2.4
      },
      station: {
        activeRadius: 880,
        bufferRadius: 1100,
        containmentRadius: 1360,
        recoveryReleaseRadius: 820,
        pullStrength: 230,
        dampingStrength: 0.66,
        turnAssistStrength: 2.6
      },
      gate: {
        activeRadius: 920,
        bufferRadius: 1180,
        containmentRadius: 1460,
        recoveryReleaseRadius: 860,
        pullStrength: 235,
        dampingStrength: 0.68,
        turnAssistStrength: 2.7
      },
      belt: {
        activeRadius: 840,
        bufferRadius: 1080,
        containmentRadius: 1340,
        recoveryReleaseRadius: 790,
        pullStrength: 225,
        dampingStrength: 0.66,
        turnAssistStrength: 2.5
      },
      anomaly: {
        activeRadius: 820,
        bufferRadius: 1040,
        containmentRadius: 1280,
        recoveryReleaseRadius: 760,
        pullStrength: 250,
        dampingStrength: 0.72,
        turnAssistStrength: 2.9
      },
      mission: {
        activeRadius: 940,
        bufferRadius: 1200,
        containmentRadius: 1480,
        recoveryReleaseRadius: 880,
        pullStrength: 240,
        dampingStrength: 0.7,
        turnAssistStrength: 2.8
      },
      wreck: {
        activeRadius: 720,
        bufferRadius: 900,
        containmentRadius: 1120,
        recoveryReleaseRadius: 640,
        pullStrength: 200,
        dampingStrength: 0.58,
        turnAssistStrength: 2.2
      }
    },
    recovery: {
      returnSpeedFloor: 150,
      returnDamping: 0.18,
      salvagePullStrength: 110
    },
    selection: {
      siteAcquireRadius: 1080,
      siteStickinessRadius: 180,
      transitReanchorDistance: 420,
      recoveryPointInset: 48,
      gatePocketBonusRadius: 220
    },
    // Legacy tuning for cluster nudges and outside-pocket cleanup.
    clusterPullRadius: 520,
    visibleMargin: 120,
    reboundDistance: 260,
    clusterDamping: 0.82,
    gateCorridorAllowance: 360
  },
  terrain: {
    asteroidRepelPadding: 96,
    asteroidPushStrength: 84,
    asteroidRadiusScale: 0.85,
    anomalyPullScale: 0.06,
    anomalySpinScale: 0.015,
    anomalyPushScale: 0.06,
    dragSlowScale: 0.28,
    ionSlowScale: 0.14,
    slipstreamScale: 0.04,
    collisionPadding: 3,
    collisionDamping: 0.92,
    collisionOverlapScale: 0.0012
  }
} as const;

export const MOVEMENT_BALANCE = createBalanceConfig("movement", MOVEMENT_BALANCE_DEFAULT);
