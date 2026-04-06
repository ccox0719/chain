import { ModuleDefinition } from "../types/game";
import {
  CompactModuleMetric,
  getCompactModuleMetrics,
  getDamageProfileEntries,
  getModuleResistanceLabel,
  getModuleResistanceProfile,
  getModuleRoleTag,
  getUtilityModuleDisplay,
  getWeaponComparisonHighlights,
  getWeaponSummaryStats,
  isWeaponModule
} from "../game/utils/weaponStats";

interface WeaponDetailsCardProps {
  module: ModuleDefinition;
  compareTo?: ModuleDefinition | null;
  contextLabel?: string;
  compactMode?: "default" | "minimal";
}

function DeltaGlyph({ direction }: { direction: "up" | "down" | "flat" }) {
  if (direction === "up") return <span className="weapon-delta up">▲</span>;
  if (direction === "down") return <span className="weapon-delta down">▼</span>;
  return <span className="weapon-delta flat">•</span>;
}

function getMetricDelta(metric: CompactModuleMetric, compareTo: ModuleDefinition | null | undefined) {
  if (!compareTo) return "flat" as const;
  const compareMetrics = getCompactModuleMetrics(compareTo);
  const baseline = compareMetrics.find((entry) => entry.id === metric.id);
  if (!baseline) return "flat" as const;
  const denom = Math.max(Math.abs(baseline.value), 0.001);
  const delta = (metric.value - baseline.value) / denom;
  if (Math.abs(delta) < 0.05) return "flat" as const;
  return delta > 0 ? "up" : "down";
}

export function WeaponDetailsCard({
  module,
  compareTo = null,
  contextLabel,
  compactMode = "default"
}: WeaponDetailsCardProps) {
  const metrics = getCompactModuleMetrics(module);
  const roleTag = getModuleRoleTag(module);
  const weaponLike = isWeaponModule(module);
  const utilityLike = module.slot === "utility";
  const utilityDisplay = utilityLike ? getUtilityModuleDisplay(module) : null;
  const weaponStats = weaponLike ? getWeaponSummaryStats(module) : null;
  const comparisonHighlights = weaponLike ? getWeaponComparisonHighlights(module, compareTo) : [];
  const profileEntries = weaponLike ? getDamageProfileEntries(module.damageProfile) : [];
  const resistanceEntries = weaponLike ? [] : getModuleResistanceProfile(module);
  const resistanceLabel = resistanceEntries.length > 0 ? getModuleResistanceLabel(module) : "";
  const visibleMetrics = compactMode === "minimal" ? metrics.slice(0, 2) : metrics;
  const overflowMetrics = compactMode === "minimal" ? metrics.slice(2) : [];

  return (
    <section className={`weapon-details-card weapon-details-card-compact${compactMode === "minimal" ? " minimal" : ""}`}>
      <div className="weapon-details-head">
        <div className="weapon-title-block">
          <div className="weapon-details-title-row">
            <strong>{module.name}</strong>
            {!utilityLike && <span className="status-chip">{module.weaponClass ?? module.sizeClass ?? module.slot}</span>}
          </div>
          {!utilityLike && contextLabel && (
            <div className="weapon-tag-row">
              <span className="weapon-role-tag">{roleTag}</span>
              <span
                className="weapon-context-label"
                title={contextLabel === "Market Analysis" ? "Stat bars and deltas compared to your currently equipped weapon" : undefined}
              >
                {contextLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      {comparisonHighlights.length > 0 && (
        <div className="weapon-compare-row">
          {comparisonHighlights.map((entry) => (
            <span key={entry.label} className={`weapon-compare-chip ${entry.direction === "up" ? "up" : "down"}`}>
              {entry.direction === "up" ? "+" : "-"} {entry.label}
              <span className="weapon-compare-pct">{Math.round(entry.amount * 100)}%</span>
            </span>
          ))}
        </div>
      )}

      {utilityLike ? (
        <div className="weapon-utility-hero">
          <div className="weapon-utility-purpose">
            {utilityDisplay?.purposeLabel} · {utilityDisplay?.activationLabel}
          </div>
          <strong className="weapon-utility-description">{utilityDisplay?.summary ?? module.description}</strong>
          <div className="weapon-utility-fact-grid">
            {(utilityDisplay?.facts ?? []).map((fact) => (
              <div key={`${fact.label}-${fact.value}`} className="weapon-utility-fact">
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`weapon-stat-grid compact${compactMode === "minimal" ? " weapon-stat-grid-minimal" : ""}`}>
          {visibleMetrics.map((metric) => {
            const delta = getMetricDelta(metric, compareTo);
            return (
              <div key={metric.id} className="weapon-stat-row compact">
                <div className="weapon-stat-topline compact">
                  <span>{metric.label}</span>
                  <div className="weapon-stat-value-wrap">
                    <strong>{metric.displayValue}</strong>
                    <DeltaGlyph direction={delta} />
                  </div>
                </div>
                <div className="weapon-stat-bar compact">
                  <div className={`weapon-stat-bar-fill tone-${metric.tone}`} style={{ width: `${metric.normalized * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <details className={`weapon-details-expander${utilityLike ? " utility-build-lite" : ""}`}>
        <summary>{compactMode === "minimal" ? "Details" : "More Info"}</summary>
        {overflowMetrics.length > 0 && !utilityLike && (
          <div className="weapon-stat-grid compact weapon-stat-grid-overflow">
            {overflowMetrics.map((metric) => {
              const delta = getMetricDelta(metric, compareTo);
              return (
                <div key={metric.id} className="weapon-stat-row compact">
                  <div className="weapon-stat-topline compact">
                    <span>{metric.label}</span>
                    <div className="weapon-stat-value-wrap">
                      <strong>{metric.displayValue}</strong>
                      <DeltaGlyph direction={delta} />
                    </div>
                  </div>
                  <div className="weapon-stat-bar compact">
                    <div className={`weapon-stat-bar-fill tone-${metric.tone}`} style={{ width: `${metric.normalized * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {utilityLike ? (
          <div className="weapon-utility-audit">
            {(utilityDisplay?.auditLines ?? []).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ) : (
          <div className={`weapon-meta-grid compact`}>
            {weaponLike ? (
              <>
                <div className="weapon-meta-item">
                  <span>DPS</span>
                  <strong>{weaponStats?.dps.toFixed(1)}</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Damage / cycle</span>
                  <strong>{weaponStats?.damagePerCycle.toFixed(1)}</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Optimal</span>
                  <strong>{Math.round(weaponStats?.optimal ?? 0)} m</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Falloff</span>
                  <strong>{Math.round(weaponStats?.falloff ?? 0)} m</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Cycle time</span>
                  <strong>{weaponStats?.cycleTime.toFixed(1)} s</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Tracking</span>
                  <strong>{module.kind === "missile" ? "Guided" : `${weaponStats?.tracking.toFixed(3)} rad/s`}</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Shield pressure</span>
                  <strong>{weaponStats?.shieldPressure.toFixed(1)}</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Armor pressure</span>
                  <strong>{weaponStats?.armorPressure.toFixed(1)}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="weapon-meta-item">
                  <span>Slot</span>
                  <strong>{module.slot}</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Category</span>
                  <strong>{module.category}</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Activation</span>
                  <strong>{module.activation}</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Cycle / drain</span>
                  <strong>
                    {module.cycleTime ? `${module.cycleTime.toFixed(1)} s` : module.capacitorDrain ? `${module.capacitorDrain.toFixed(1)}/s` : "Passive"}
                  </strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Range</span>
                  <strong>{module.range ? `${Math.round(module.range)} m` : "None"}</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Cap use</span>
                  <strong>{module.capacitorUse ? `${module.capacitorUse}/cycle` : module.capacitorDrain ? `${module.capacitorDrain}/s` : "Cap-free"}</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Role</span>
                  <strong>{roleTag}</strong>
                </div>
                <div className="weapon-meta-item">
                  <span>Price</span>
                  <strong>{module.price} cr</strong>
                </div>
              </>
            )}
          </div>
        )}

        {weaponLike ? (
          <div className="weapon-damage-profile compact">
            {profileEntries.map((entry) => (
              <div key={entry.type} className="weapon-profile-row">
                <span className={`weapon-profile-swatch type-${entry.type}`} aria-hidden="true" />
                <span>{entry.label}</span>
                <div className="weapon-profile-bar">
                  <div className={`weapon-profile-fill type-${entry.type}`} style={{ width: `${entry.value * 100}%` }} />
                </div>
                <strong>{Math.round(entry.value * 100)}%</strong>
              </div>
            ))}
          </div>
        ) : resistanceEntries.length > 0 ? (
          <div className="weapon-damage-profile compact weapon-resist-profile">
            <div className="weapon-profile-section-head">
              <span>{resistanceLabel}</span>
              <small>Applies to all incoming damage types.</small>
            </div>
            {resistanceEntries.map((entry) => (
              <div key={entry.type} className="weapon-profile-row">
                <span className={`weapon-profile-swatch resist-${entry.type}`} aria-hidden="true" />
                <span>{entry.label}</span>
                <div className="weapon-profile-bar">
                  <div
                    className={`weapon-profile-fill resist-${entry.type}`}
                    style={{ width: `${Math.min(100, Math.max(0, entry.value * 100))}%` }}
                  />
                </div>
                <strong>{Math.round(entry.value * 100)}%</strong>
              </div>
            ))}
          </div>
        ) : null}
      </details>
    </section>
  );
}
