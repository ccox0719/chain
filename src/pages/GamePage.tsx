import { useEffect, useState } from "react";
import { ContextMenu } from "../components/ContextMenu";
import { DeathOverlay } from "../components/DeathOverlay";
import { GameCanvas } from "../components/GameCanvas";
import { GameHud } from "../components/GameHud";
import { GameMenu } from "../components/GameMenu";
import { SidebarPanels } from "../components/SidebarPanels";
import { StarterShipPicker } from "../components/StarterShipPicker";
import { DeveloperBalanceModal, StationPanel } from "../components/StationPanel";
import { getCombatControlRanges } from "../game/utils/combatRanges";
import { useSpaceGame } from "../store/useSpaceGame";

export function GamePage() {
  const { canvasRef, snapshot, overlay, setOverlay, contextMenu, actions } = useSpaceGame();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [starterPickerOpen, setStarterPickerOpen] = useState(
    () => window.localStorage.getItem("starfall-world") === null
  );
  const deathSummary = snapshot.world.player.deathSummary;
  const uiMode =
    !menuOpen && !starterPickerOpen && !overlay && !snapshot.world.dockedStationId && !deathSummary
      ? "battle"
      : "menu";
  const contextCombatRanges =
    contextMenu && contextMenu.target.type === "enemy"
      ? getCombatControlRanges(snapshot.world, contextMenu.target)
      : null;

  useEffect(() => {
    const orientation = window.screen.orientation as unknown as {
      lock?: (orientation: "portrait" | "landscape") => Promise<void>;
      unlock?: () => void;
    };
    if (!orientation?.lock) return;

    const desiredOrientation = uiMode === "battle" ? "landscape" : "portrait";
    orientation.lock(desiredOrientation).catch(() => {
      // Ignore browsers that do not allow programmatic orientation changes.
    });

    return () => {
      orientation.unlock?.();
    };
  }, [uiMode]);

  return (
    <div className={`game-shell mode-${uiMode}`}>
      <div className="play-area">
        <GameCanvas
          canvasRef={canvasRef}
          onLeftClick={actions.handleCanvasLeftClick}
          onDoubleClick={actions.handleCanvasDoubleClick}
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
          onSetWeaponHoldFire={actions.setWeaponHoldFire}
          onDisengageCombat={actions.disengageCombat}
          onActivateBuild={actions.activateBuild}
          onActivateTacticalSlow={actions.activateTacticalSlow}
          onSetTimeScale={actions.setTimeScale}
          onSetRouteDestination={actions.setRouteDestination}
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
            controlRanges={contextCombatRanges}
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
            onOpenBalance={() => setBalanceOpen(true)}
            onClose={() => setMenuOpen(false)}
          />
        )}

        <DeveloperBalanceModal
          open={balanceOpen}
          onClose={() => setBalanceOpen(false)}
          snapshot={snapshot}
          onRegenShip={actions.regenShip}
          onTriggerDevRegionalEvent={actions.triggerDevRegionalEvent}
          onTriggerDevSiteHotspot={actions.triggerDevSiteHotspot}
          onTriggerDevWarEvent={actions.triggerDevWarEvent}
        />

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
          onOpenBalance={() => setBalanceOpen(true)}
          onBuyModule={actions.buyModule}
          onSellModule={actions.sellModule}
          onBuyCommodity={actions.buyCommodity}
          onSellCommodity={actions.sellCommodity}
          onEquip={actions.equipModule}
          onAcceptMission={actions.acceptMission}
          onTurnInMission={actions.turnInMission}
          onClaimFactionReward={actions.claimFactionReward}
          onBuyShip={actions.buyShip}
          onSellShip={actions.sellShip}
          onSwitchShip={actions.switchShip}
          onSaveBuild={actions.saveBuild}
          onLoadBuild={actions.loadBuild}
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
