import { playerShipById } from "../game/data/ships";
import { GameSnapshot } from "../types/game";

interface DeathOverlayProps {
  snapshot: GameSnapshot;
  onContinue: () => void;
}

export function DeathOverlay({ snapshot, onContinue }: DeathOverlayProps) {
  const summary = snapshot.world.player.deathSummary;
  if (!summary) return null;
  const respawnHull = playerShipById[snapshot.world.player.hullId]?.name ?? snapshot.world.player.hullId;
  const totalLost = Math.max(0, summary.lostCredits);

  return (
    <div className="menu-backdrop death-backdrop" onClick={onContinue}>
      <section className="menu-panel death-panel" onClick={(event) => event.stopPropagation()}>
        <div className="overlay-head">
          <h2>Ship Destroyed</h2>
          <button type="button" className="ghost-button" onClick={onContinue}>
            Continue
          </button>
        </div>

        <div className="panel-lite death-hero">
          <p className="death-line">
            You woke up docked at <strong>{summary.respawnStationName}</strong> in <strong>{summary.respawnSystemName}</strong>.
          </p>
          <p className="death-line">
            Your current hull is now <strong>{respawnHull}</strong>. The destroyed ship remains in a salvage wreck at{" "}
            <strong>{summary.wreckSystemName}</strong> and can be recovered later.
          </p>
        </div>

        <div className="panel-lite">
          <h3>What You Lost</h3>
          <div className="death-loss-grid">
            <span>Total credits lost</span>
            <strong>{totalLost} cr</strong>
            <span>Wreck salvage</span>
            <strong>{summary.droppedCredits} cr</strong>
            <span>Recovery fee</span>
            <strong>{summary.flatFee} cr</strong>
            <span>Pilot license progress</span>
            <strong>{summary.lostLicenseProgress > 0 ? `-${summary.lostLicenseProgress}` : "None"}</strong>
          </div>
        </div>

        <div className="panel-lite">
          <h3>Next Steps</h3>
          <ol className="death-steps">
            <li>Use the station to repair, fit, or switch ships.</li>
            <li>Undock and return to the wreck in {summary.wreckSystemName} if you want the lost hull back.</li>
            <li>Recover the wreck salvage to reclaim the ship, cargo, credits, and modules that were left behind.</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
