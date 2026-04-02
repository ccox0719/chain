import { useState } from "react";
import { ContextMenu } from "../components/ContextMenu";
import { DeathOverlay } from "../components/DeathOverlay";
import { GameCanvas } from "../components/GameCanvas";
import { GameHud } from "../components/GameHud";
import { GameMenu } from "../components/GameMenu";
import { SidebarPanels } from "../components/SidebarPanels";
import { StarterShipPicker } from "../components/StarterShipPicker";
import { StationPanel } from "../components/StationPanel";
import { useSpaceGame } from "../store/useSpaceGame";

export function GamePage() {
  const { canvasRef, snapshot, overlay, setOverlay, contextMenu, actions } = useSpaceGame();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [starterPickerOpen, setStarterPickerOpen] = useState(
    () => window.localStorage.getItem("starfall-world") === null
  );
  const deathSummary = snapshot.world.player.deathSummary;

  return (
    <div className="game-shell">
      <div className="play-area">
        <GameCanvas
          canvasRef={canvasRef}
          onLeftClick={actions.handleCanvasLeftClick}
          onRightClick={actions.handleCanvasRightClick}
          onWheelZoom={actions.adjustZoom}
          onPanBy={actions.panCamera}
        />

        <button
          type="button"
          className="hud-toggle-btn"
          onClick={() => setHudVisible((v) => !v)}
          title={hudVisible ? "Hide HUD" : "Show HUD"}
        >
          {hudVisible ? "⊟" : "⊞"}
        </button>

        <GameHud
          snapshot={snapshot}
          overlay={overlay}
          setOverlay={setOverlay}
          panelsVisible={hudVisible}
          onOpenMenu={() => setMenuOpen(true)}
          onSelectOverview={actions.selectObject}
          onOpenContextForOverview={(ref, event) =>
            actions.openContextMenuForObject(ref, event.clientX, event.clientY)
          }
          onSetActiveTarget={actions.setActiveTarget}
          onUnlockTarget={actions.unlockTarget}
          onToggleModule={actions.toggleModule}
          onActivateBuild={actions.activateBuild}
          onActivateTacticalSlow={actions.activateTacticalSlow}
          onIssueCommand={actions.issueCommand}
          onStopShip={() => actions.issueCommand({ type: "stop" })}
          onToggleAutopilot={() => actions.setRouteAutoFollow(!Boolean(snapshot.world.routePlan?.autoFollow))}
          onRecenterView={actions.resetCameraView}
        />

        {overlay && (
          <SidebarPanels
            overlay={overlay}
            snapshot={snapshot}
            onClose={() => setOverlay(null)}
            onEquip={actions.equipModule}
            onPlanRoute={actions.setRouteDestination}
            onClearRoute={actions.clearRoute}
            onSetRouteAutoFollow={actions.setRouteAutoFollow}
            onSelectOverview={actions.selectObject}
            onIssueCommand={actions.issueCommand}
          />
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            target={contextMenu.target}
            onCommand={(command) => {
              actions.issueCommand(command);
              actions.closeContextMenu();
            }}
          />
        )}

        {menuOpen && (
          <GameMenu
            difficulty={snapshot.world.difficulty}
            onSetDifficulty={actions.setDifficulty}
            onResetGame={() => {
              setMenuOpen(false);
              setStarterPickerOpen(true);
            }}
            onClose={() => setMenuOpen(false)}
          />
        )}

        {starterPickerOpen && (
          <StarterShipPicker
            allowClose={window.localStorage.getItem("starfall-world") !== null}
            onClose={() => setStarterPickerOpen(false)}
            onSelect={(starterConfigId) => {
              actions.resetGame(starterConfigId);
              setStarterPickerOpen(false);
            }}
          />
        )}

        <StationPanel
          snapshot={snapshot}
          onUndock={actions.undock}
          onRepair={actions.repair}
          onSellCargo={actions.sellCargo}
          onBuyModule={actions.buyModule}
          onSellModule={actions.sellModule}
          onBuyCommodity={actions.buyCommodity}
          onSellCommodity={actions.sellCommodity}
          onEquip={actions.equipModule}
          onAcceptMission={actions.acceptMission}
          onTurnInMission={actions.turnInMission}
          onBuyShip={actions.buyShip}
          onSwitchShip={actions.switchShip}
          onSaveBuild={actions.saveBuild}
          onLoadBuild={actions.loadBuild}
          onQueueUndockAction={actions.issueCommand}
          onClearUndockQueue={actions.clearUndockQueue}
        />

        {deathSummary && (
          <DeathOverlay
            snapshot={snapshot}
            onContinue={() => {
              actions.clearDeathSummary();
            }}
          />
        )}
      </div>
    </div>
  );
}
