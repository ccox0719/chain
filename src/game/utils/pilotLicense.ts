import { ModuleDefinition, PilotLicenseState } from "../../types/game";

export const PILOT_LICENSE_MAX_LEVEL = 3;
export const PILOT_LICENSE_LEVEL_STARTS = [0, 900, 3200] as const;

export function clampPilotLicenseProgress(progress: number) {
  return Math.max(0, Math.round(progress));
}

export function getPilotLicenseLevelForProgress(progress: number): PilotLicenseState["level"] {
  const normalized = clampPilotLicenseProgress(progress);
  if (normalized >= PILOT_LICENSE_LEVEL_STARTS[2]) return 3;
  if (normalized >= PILOT_LICENSE_LEVEL_STARTS[1]) return 2;
  return 1;
}

export function normalizePilotLicense(license: Partial<PilotLicenseState> | undefined): PilotLicenseState {
  const progress = clampPilotLicenseProgress(license?.progress ?? 0);
  return {
    level: getPilotLicenseLevelForProgress(progress),
    progress
  };
}

export function getPilotLicenseProgressRange(level: PilotLicenseState["level"]) {
  const start = PILOT_LICENSE_LEVEL_STARTS[level - 1];
  const end =
    level === 1
      ? PILOT_LICENSE_LEVEL_STARTS[1]
      : level === 2
        ? PILOT_LICENSE_LEVEL_STARTS[2]
        : start;
  return { start, end };
}

export function getPilotLicenseProgressPercent(license: PilotLicenseState) {
  if (license.level >= PILOT_LICENSE_MAX_LEVEL) return 100;
  const { start, end } = getPilotLicenseProgressRange(license.level);
  return Math.max(0, Math.min(100, ((license.progress - start) / Math.max(1, end - start)) * 100));
}

export function getRequiredPilotLicenseLevel(module: Pick<ModuleDefinition, "techLevel">) {
  if (!module.techLevel || module.techLevel <= 1) return 1;
  return Math.min(PILOT_LICENSE_MAX_LEVEL, module.techLevel) as PilotLicenseState["level"];
}

export function hasPilotLicenseForModule(license: PilotLicenseState, module: Pick<ModuleDefinition, "techLevel">) {
  return license.level >= getRequiredPilotLicenseLevel(module);
}
