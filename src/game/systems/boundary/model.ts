import { BoundaryProfile, BoundaryZone, Vec2 } from "../../../types/game";
import { add, length, scale, subtract } from "../../utils/vector";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getPocketVectors(position: Vec2, pocket: BoundaryProfile) {
  const offset = subtract(position, pocket.center);
  const radialDistance = length(offset);
  const outward = radialDistance > 0.0001 ? scale(offset, 1 / radialDistance) : ({ x: 1, y: 0 } as Vec2);
  const inward = scale(outward, -1);
  return { radialDistance, outward, inward };
}

export function evaluatePocketZone(radialDistance: number, pocket: BoundaryProfile, inRecovery = false): BoundaryZone {
  if (inRecovery || radialDistance > pocket.containmentRadius) return "recovery";
  if (radialDistance > pocket.bufferRadius) return "containment";
  if (radialDistance > pocket.activeRadius) return "buffer";
  return "active";
}

export function getPocketPressure(radialDistance: number, pocket: BoundaryProfile) {
  const warningLevel = clamp(
    (radialDistance - pocket.activeRadius) / Math.max(1, pocket.bufferRadius - pocket.activeRadius),
    0,
    1
  );
  const correctionLevel = clamp(
    (radialDistance - pocket.bufferRadius) / Math.max(1, pocket.containmentRadius - pocket.bufferRadius),
    0,
    1
  );
  return { warningLevel, correctionLevel };
}

export function getPocketRecoveryPoint(pocket: BoundaryProfile, inward: Vec2, inset: number) {
  return add(pocket.center, scale(inward, Math.max(0, pocket.recoveryReleaseRadius - inset)));
}

export function projectIntoPocket(pocket: BoundaryProfile, position: Vec2, margin = 0) {
  const { radialDistance, outward } = getPocketVectors(position, pocket);
  const allowedRadius = Math.max(0, pocket.containmentRadius - margin);
  if (radialDistance <= allowedRadius) return { ...position };
  return add(pocket.center, scale(outward, allowedRadius));
}
