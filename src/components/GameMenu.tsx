import { DifficultyId } from "../types/game";

interface GameMenuProps {
  difficulty: DifficultyId;
  onSetDifficulty: (difficulty: DifficultyId) => void;
  onResetGame: () => void;
  onOpenBalance: () => void;
  onClose: () => void;
}

export function GameMenu({ difficulty, onSetDifficulty, onResetGame, onOpenBalance, onClose }: GameMenuProps) {
  return (
    <div className="menu-backdrop" onClick={onClose}>
      <section className="menu-panel" onClick={(event) => event.stopPropagation()}>
        <div className="overlay-head">
          <h2>Menu</h2>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="panel-lite">
          <h3>Difficulty</h3>
          <div className="action-row">
            {(["easy", "normal", "hard"] as DifficultyId[]).map((value) => (
              <button
                key={value}
                type="button"
                className={difficulty === value ? "primary-button" : ""}
                onClick={() => onSetDifficulty(value)}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
          <p>
            Easy boosts your outgoing damage and reduces enemy damage. Hard does the reverse.
          </p>
        </div>

        <div className="panel-lite">
          <h3>New Run</h3>
          <p>Choose a starter fit with a distinct weapon mix and role profile, then regenerate the current save.</p>
          <button type="button" onClick={onResetGame}>
            Pick Starter Ship
          </button>
        </div>

        <div className="panel-lite">
          <h3>Developer</h3>
          <p>Adjust simulation balance values from the main menu.</p>
          <button type="button" onClick={onOpenBalance}>
            Open Balance Window
          </button>
        </div>
      </section>
    </div>
  );
}
