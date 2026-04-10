import { ModuleDefinition, PilotLicenseState } from "../../types/game";

export const PILOT_LICENSE_MAX_LEVEL = 3;
export const PILOT_LICENSE_LEVEL_STARTS = [0, 900, 3200] as const;

export function clampPilotLicenseProgress(progress: number) {
  const numeric = Number(progress);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function normalizePilotLicenseLevel(level: unknown): PilotLicenseState["level"] | null {
  const numeric = Number(level);
  if (numeric === 1 || numeric === 2 || numeric === 3) return numeric;
  return null;
}

export function getPilotLicenseLevelForProgress(progress: number): PilotLicenseState["level"] {
  const normalized = clampPilotLicenseProgress(progress);
  if (normalized >= PILOT_LICENSE_LEVEL_STARTS[2]) return 3;
  if (normalized >= PILOT_LICENSE_LEVEL_STARTS[1]) return 2;
  return 1;
}

export function normalizePilotLicense(license: Partial<PilotLicenseState> | undefined): PilotLicenseState {
  const progress = clampPilotLicenseProgress(license?.progress ?? 0);
  const normalizedLevel = normalizePilotLicenseLevel(license?.level);
  const derivedLevel = getPilotLicenseLevelForProgress(progress);
  return {
    level: normalizedLevel !== null ? Math.max(normalizedLevel, derivedLevel) as PilotLicenseState["level"] : derivedLevel,
    progress
  };
}

export function getPilotLicenseProgressRange(level: PilotLicenseState["level"]) {
  const safeLevel = normalizePilotLicenseLevel(level) ?? 1;
  const start = PILOT_LICENSE_LEVEL_STARTS[safeLevel - 1];
  const end =
    safeLevel === 1
      ? PILOT_LICENSE_LEVEL_STARTS[1]
      : safeLevel === 2
        ? PILOT_LICENSE_LEVEL_STARTS[2]
        : start;
  return { start, end };
}

export function getPilotLicenseProgressPercent(license: PilotLicenseState) {
  const normalized = normalizePilotLicense(license);
  if (normalized.level >= PILOT_LICENSE_MAX_LEVEL) return 100;
  const { start, end } = getPilotLicenseProgressRange(normalized.level);
  return Math.max(0, Math.min(100, ((normalized.progress - start) / Math.max(1, end - start)) * 100));
}

export function getRequiredPilotLicenseLevel(module: Pick<ModuleDefinition, "techLevel">) {
  if (!module.techLevel || module.techLevel <= 1) return 1;
  return Math.min(PILOT_LICENSE_MAX_LEVEL, module.techLevel) as PilotLicenseState["level"];
}

export function hasPilotLicenseForModule(license: PilotLicenseState, module: Pick<ModuleDefinition, "techLevel">) {
  return license.level >= getRequiredPilotLicenseLevel(module);
}
