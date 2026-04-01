import { moduleById } from "../game/data/modules";
import { playerShipById } from "../game/data/ships";
import { starterShipConfigs } from "../game/data/starterShips";
import { StarterShipConfigId } from "../types/game";

interface StarterShipPickerProps {
  onSelect: (starterConfigId: StarterShipConfigId) => void;
  onClose?: () => void;
  allowClose?: boolean;
}

export function StarterShipPicker({
  onSelect,
  onClose,
  allowClose = false
}: StarterShipPickerProps) {
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
            Each option is the same <strong>{playerShipById["rookie-sparrow"]?.name ?? "starter hull"}</strong> with a
            different stripped-down fit: two basic weapons, one utility, and empty remaining slots.
          </p>
        </div>

        <div className="starter-grid">
          {starterShipConfigs.map((config) => {
            const hull = playerShipById[config.shipId];
            const modules = [...config.equipped.weapon, ...config.equipped.utility, ...config.equipped.defense]
              .filter((moduleId): moduleId is string => Boolean(moduleId))
              .map((moduleId) => moduleById[moduleId]?.name ?? moduleId);

            return (
              <button
                key={config.id}
                type="button"
                className="starter-card"
                onClick={() => onSelect(config.id)}
              >
                <span className="starter-card-top">
                  <strong>{config.name}</strong>
                  <span>{hull?.name ?? config.shipId}</span>
                </span>
                <span className="starter-card-summary">{config.summary}</span>
                <span className="starter-card-copy">{config.description}</span>
                <span className="starter-card-modules">{modules.join(" • ")}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
