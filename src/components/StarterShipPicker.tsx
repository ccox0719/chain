import { playerShipById } from "../game/data/ships";
import { starterShipConfigs } from "../game/data/starterShips";
import { StarterShipConfigId } from "../types/game";

function formatStarterStat(value: number) {
  return `${Math.round(value)}%`;
}

interface StarterShipPickerProps {
  onSelect: (starterConfigId: StarterShipConfigId) => void;
  onClose?: () => void;
  allowClose?: boolean;
}

export function StarterShipPicker({ onSelect, onClose, allowClose = false }: StarterShipPickerProps) {
  return (
    <div className="menu-backdrop" onClick={() => allowClose && onClose?.()}>
      <section className="menu-panel starter-picker-panel" onClick={(event) => event.stopPropagation()}>
        <div className="overlay-head">
          <h2>Choose Your Starter Ship</h2>
          {allowClose && (
            <button type="button" className="ghost-button" onClick={onClose}>
              Close
            </button>
          )}
        </div>

        <div className="panel-lite">
          <p>
            Each option uses the same <strong>{playerShipById["rookie-sparrow"]?.name ?? "starter hull"}</strong>,
            but each fit pushes it toward a different early-game role.
          </p>
        </div>

        <div className="starter-grid">
          {starterShipConfigs.map((config) => {
            const hull = playerShipById[config.shipId];
            return (
              <button key={config.id} type="button" className="starter-card" onClick={() => onSelect(config.id)}>
                <span className="starter-card-top">
                  <strong>{config.name}</strong>
                  <span>{hull?.name ?? config.shipId}</span>
                </span>
                <span className="starter-card-summary">{config.summary}</span>
                <div className="starter-card-bars" aria-label={`${config.name} starter stats`}>
                  <div className="starter-stat">
                    <span>Offense</span>
                    <strong>{formatStarterStat(config.starterStats.offense)}</strong>
                    <div className="starter-stat-bar">
                      <span className="starter-stat-fill offense" style={{ width: `${config.starterStats.offense}%` }} />
                    </div>
                  </div>
                  <div className="starter-stat">
                    <span>Mobility</span>
                    <strong>{formatStarterStat(config.starterStats.mobility)}</strong>
                    <div className="starter-stat-bar">
                      <span className="starter-stat-fill mobility" style={{ width: `${config.starterStats.mobility}%` }} />
                    </div>
                  </div>
                  <div className="starter-stat">
                    <span>Defense</span>
                    <strong>{formatStarterStat(config.starterStats.defense)}</strong>
                    <div className="starter-stat-bar">
                      <span className="starter-stat-fill defense" style={{ width: `${config.starterStats.defense}%` }} />
                    </div>
                  </div>
                  <div className="starter-stat">
                    <span>Utility</span>
                    <strong>{formatStarterStat(config.starterStats.utility)}</strong>
                    <div className="starter-stat-bar">
                      <span className="starter-stat-fill utility" style={{ width: `${config.starterStats.utility}%` }} />
                    </div>
                  </div>
                </div>
                <span className="starter-card-copy">{config.description}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
