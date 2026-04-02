import { useEffect, useMemo, useRef, useState } from "react";
import { missionCatalog } from "../game/data/missions";
import { moduleCatalog } from "../game/data/modules";
import { playerShips } from "../game/data/ships";
import { renderSector } from "../game/scenes/renderSector";
import {
  acceptMission,
  addCredits,
  buyCommodity,
  buyModule,
  buyShip,
  clearQueuedUndockActions,
  clearRouteDestination,
  createSnapshot,
  dock,
  equipModuleToSlot,
  issueCommand,
  lockTarget,
  repairShip,
  resolveSelectionAtPoint,
  loadBuildSlot,
  saveBuildSlot,
  sellModule,
  selectObject,
  startBuildSwap,
  sellCargo,
  sellCommodity,
  setActiveTarget,
  setDifficulty,
  setRouteAutoFollow,
  setRouteDestination,
  switchShip,
  toggleModule,
  turnInMission,
  undock,
  unlockTarget,
  updateWorld
} from "../game/systems/simulation";
import { createInitialWorld } from "../game/entities/factories";
import { defaultStarterShipConfigId } from "../game/data/starterShips";
import { normalizePilotLicense } from "../game/utils/pilotLicense";
import { CommodityId, GameSnapshot, GameWorld, ModuleSlot, SelectableRef, StarterShipConfigId, Vec2 } from "../types/game";

function worldPointFromClient(
  canvas: HTMLCanvasElement,
  playerPosition: Vec2,
  zoom: number,
  clientX: number,
  clientY: number
) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (clientX - bounds.left - canvas.clientWidth / 2) / zoom + playerPosition.x,
    y: (clientY - bounds.top - canvas.clientHeight / 2) / zoom + playerPosition.y
  };
}

export function useSpaceGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<GameWorld>(loadWorld());
  const autosaveRef = useRef<number | null>(null);
  const isMobileRef = useRef<boolean>(window.innerWidth < 768);
  const zoomTargetRef = useRef<number>(
    window.innerWidth < 768
      ? 0.28
      : Number(window.localStorage.getItem("starfall-zoom") ?? "1")
  );
  const zoomCurrentRef = useRef<number>(zoomTargetRef.current);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => createSnapshot(worldRef.current));
  const [overlay, setOverlay] = useState<"map" | "inventory" | "fitting" | "missions" | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: SelectableRef;
  } | null>(null);

  const refresh = () => {
    setSnapshot(createSnapshot(worldRef.current));
    saveWorld(worldRef.current);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case "i":
          setOverlay((current) => (current === "inventory" ? null : "inventory"));
          break;
        case "f":
          setOverlay((current) => (current === "fitting" ? null : "fitting"));
          break;
        case "j":
          setOverlay((current) => (current === "missions" ? null : "missions"));
          break;
        case "m":
          setOverlay((current) => (current === "map" ? null : "map"));
          break;
        case "escape":
          setContextMenu(null);
          break;
        case "f8":
          addCredits(worldRef.current, 10000);
          refresh();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleWindowClick = () => setContextMenu(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  useEffect(() => {
    const saveNow = () => {
      saveWorld(worldRef.current);
    };

    saveNow();
    autosaveRef.current = window.setInterval(saveNow, 2000);
    window.addEventListener("beforeunload", saveNow);
    window.addEventListener("pagehide", saveNow);

    return () => {
      if (autosaveRef.current !== null) {
        window.clearInterval(autosaveRef.current);
        autosaveRef.current = null;
      }
      window.removeEventListener("beforeunload", saveNow);
      window.removeEventListener("pagehide", saveNow);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const resize = () => {
      isMobileRef.current = window.innerWidth < 768;
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(bounds.width * pixelRatio);
      canvas.height = Math.floor(bounds.height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    window.visualViewport?.addEventListener("resize", resize);

    let lastTime = performance.now();
    let snapshotAccumulator = 0;
    let frameId = 0;

    const frame = (time: number) => {
      const dt = Math.min(0.033, (time - lastTime) / 1000);
      lastTime = time;

      updateWorld(worldRef.current, dt);
      zoomCurrentRef.current += (zoomTargetRef.current - zoomCurrentRef.current) * Math.min(1, dt * 8);
      renderSector(context, canvas, worldRef.current, zoomCurrentRef.current, isMobileRef.current);

      snapshotAccumulator += dt;
      if (snapshotAccumulator >= 0.2) {
        snapshotAccumulator = 0;
        setSnapshot(createSnapshot(worldRef.current));
      }

      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, []);

  const actions = useMemo(
    () => ({
      undock: () => {
        undock(worldRef.current);
        refresh();
      },
      dock: () => {
        dock(worldRef.current);
        refresh();
      },
      repair: () => {
        repairShip(worldRef.current);
        refresh();
      },
      sellCargo: () => {
        sellCargo(worldRef.current);
        refresh();
      },
      buyCommodity: (commodityId: CommodityId, quantity: number) => {
        buyCommodity(worldRef.current, commodityId, quantity);
        refresh();
      },
      sellCommodity: (commodityId: CommodityId, quantity: number) => {
        sellCommodity(worldRef.current, commodityId, quantity);
        refresh();
      },
      buyModule: (moduleId: string) => {
        buyModule(worldRef.current, moduleId);
        refresh();
      },
      sellModule: (moduleId: string) => {
        sellModule(worldRef.current, moduleId);
        refresh();
      },
      equipModule: (slotType: ModuleSlot, slotIndex: number, moduleId: string | null) => {
        equipModuleToSlot(worldRef.current, slotType, slotIndex, moduleId);
        refresh();
      },
      saveBuild: (buildId: "build-1" | "build-2" | "build-3") => {
        saveBuildSlot(worldRef.current, buildId);
        refresh();
      },
      loadBuild: (buildId: "build-1" | "build-2" | "build-3") => {
        loadBuildSlot(worldRef.current, buildId);
        refresh();
      },
      activateBuild: (buildId: "build-1" | "build-2" | "build-3") => {
        startBuildSwap(worldRef.current, buildId);
        refresh();
      },
      acceptMission: (missionId: string) => {
        acceptMission(worldRef.current, missionId);
        refresh();
      },
      turnInMission: (missionId: string) => {
        turnInMission(worldRef.current, missionId);
        refresh();
      },
      buyShip: (shipId: string) => {
        buyShip(worldRef.current, shipId);
        refresh();
      },
      switchShip: (shipId: string) => {
        switchShip(worldRef.current, shipId);
        refresh();
      },
      toggleModule: (slotType: ModuleSlot, slotIndex: number) => {
        toggleModule(worldRef.current, slotType, slotIndex);
        refresh();
      },
      selectObject: (ref: SelectableRef | null) => {
        selectObject(worldRef.current, ref);
        refresh();
      },
      lockTarget: (ref: SelectableRef) => {
        lockTarget(worldRef.current, ref);
        refresh();
      },
      unlockTarget: (ref: SelectableRef) => {
        unlockTarget(worldRef.current, ref);
        refresh();
      },
      setActiveTarget: (ref: SelectableRef | null) => {
        setActiveTarget(worldRef.current, ref);
        refresh();
      },
      issueCommand: (command: Parameters<typeof issueCommand>[1]) => {
        issueCommand(worldRef.current, command);
        refresh();
      },
      clearUndockQueue: () => {
        clearQueuedUndockActions(worldRef.current);
        refresh();
      },
      setRouteDestination: (systemId: string, preference: "shortest" | "safer", autoFollow = false) => {
        setRouteDestination(worldRef.current, systemId, preference, autoFollow);
        refresh();
      },
      clearRoute: () => {
        clearRouteDestination(worldRef.current);
        refresh();
      },
      setRouteAutoFollow: (autoFollow: boolean) => {
        setRouteAutoFollow(worldRef.current, autoFollow);
        refresh();
      },
      openContextMenuForObject: (ref: SelectableRef, x: number, y: number) => {
        selectObject(worldRef.current, ref);
        setContextMenu({ x, y, target: ref });
        refresh();
      },
      handleCanvasLeftClick: (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const point = worldPointFromClient(
          canvas,
          worldRef.current.player.position,
          zoomCurrentRef.current,
          clientX,
          clientY
        );
        const ref = resolveSelectionAtPoint(worldRef.current, point);
        selectObject(worldRef.current, ref);
        setContextMenu(null);
        refresh();
      },
      handleCanvasRightClick: (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const point = worldPointFromClient(
          canvas,
          worldRef.current.player.position,
          zoomCurrentRef.current,
          clientX,
          clientY
        );
        const ref =
          resolveSelectionAtPoint(worldRef.current, point) ?? worldRef.current.selectedObject;
        if (!ref) {
          setContextMenu(null);
          return;
        }
        selectObject(worldRef.current, ref);
        setContextMenu({ x: clientX, y: clientY, target: ref });
        refresh();
      },
      adjustZoom: (deltaY: number) => {
        const next = clampZoom(zoomTargetRef.current + (deltaY > 0 ? -0.12 : 0.12));
        zoomTargetRef.current = next;
        window.localStorage.setItem("starfall-zoom", String(next));
      },
      setDifficulty: (difficulty: GameWorld["difficulty"]) => {
        setDifficulty(worldRef.current, difficulty);
        refresh();
      },
      resetGame: (starterConfigId?: StarterShipConfigId) => {
        const difficulty = worldRef.current.difficulty;
        worldRef.current = createInitialWorld(
          difficulty,
          starterConfigId ?? worldRef.current.player.starterConfigId ?? defaultStarterShipConfigId
        );
        window.localStorage.setItem("starfall-world", JSON.stringify(worldRef.current));
        refresh();
      },
      closeContextMenu: () => setContextMenu(null)
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let pinchDistance = 0;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = performance.now();
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          actions.handleCanvasRightClick(touchStartX, touchStartY);
        }, 400);
      } else if (e.touches.length === 2) {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDistance = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (pinchDistance > 0) actions.adjustZoom(pinchDistance - dist);
        pinchDistance = dist;
      } else if (e.touches.length === 1 && longPressTimer) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        if (Math.hypot(dx, dy) > 8) { clearTimeout(longPressTimer); longPressTimer = null; }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length < 2) pinchDistance = 0;
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        if (performance.now() - touchStartTime < 400) {
          actions.handleCanvasLeftClick(touchStartX, touchStartY);
        }
      }
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      if (longPressTimer) clearTimeout(longPressTimer);
    };
  }, [actions]);

  return {
    canvasRef,
    snapshot,
    overlay,
    setOverlay,
    contextMenu,
    setContextMenu,
    actions,
    missionCatalog,
    moduleCatalog,
    playerShips
  };
}

function clampZoom(value: number) {
  return Math.max(0.28, Math.min(1.8, value));
}

function loadWorld() {
  const fallback = createInitialWorld();
  const raw = window.localStorage.getItem("starfall-world");
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<GameWorld>;
    const mergedSectors = Object.fromEntries(
      Object.entries(fallback.sectors).map(([sectorId, fallbackSector]) => {
        const parsedSector = parsed.sectors?.[sectorId];
        return [
          sectorId,
          {
            ...fallbackSector,
            ...parsedSector,
            enemies:
              parsedSector?.enemies?.map((enemy) => ({
                ...enemy,
                patrolBehavior: enemy.patrolBehavior ?? "anchor-patrol",
                patrolTarget: enemy.patrolTarget ?? enemy.patrolAnchor ?? null,
                effects: enemy.effects ?? {
                  speedMultiplier: 1,
                  signatureMultiplier: 1,
                  turretTrackingMultiplier: 1,
                  lockRangeMultiplier: 1
                }
              })) ?? fallbackSector.enemies,
            asteroids: parsedSector?.asteroids ?? fallbackSector.asteroids,
            projectiles: parsedSector?.projectiles ?? fallbackSector.projectiles,
            loot: parsedSector?.loot ?? fallbackSector.loot,
            wrecks: parsedSector?.wrecks ?? fallbackSector.wrecks,
            floatingText: parsedSector?.floatingText ?? fallbackSector.floatingText,
            beltSpawnCooldowns: parsedSector?.beltSpawnCooldowns ?? fallbackSector.beltSpawnCooldowns
          }
        ];
      })
    ) as GameWorld["sectors"];

    const mergedBuilds = fallback.player.savedBuilds.map((fallbackBuild) => {
      const parsedBuild = parsed.player?.savedBuilds?.find((entry) => entry.id === fallbackBuild.id);
      return parsedBuild
        ? {
            ...fallbackBuild,
            ...parsedBuild,
            equipped: parsedBuild.equipped ?? fallbackBuild.equipped
          }
        : fallbackBuild;
    });

    return {
      ...fallback,
      ...parsed,
      player: {
        ...fallback.player,
        ...parsed.player,
        starterConfigId: parsed.player?.starterConfigId ?? fallback.player.starterConfigId,
        pilotLicense: normalizePilotLicense(parsed.player?.pilotLicense ?? fallback.player.pilotLicense),
        commodities: {
          ...fallback.player.commodities,
          ...(parsed.player?.commodities ?? {})
        },
        savedBuilds: mergedBuilds,
        buildSwap: parsed.player?.buildSwap
          ? {
              ...fallback.player.buildSwap,
              ...parsed.player.buildSwap,
              targetEquipped:
                parsed.player.buildSwap.targetEquipped ?? fallback.player.buildSwap.targetEquipped
            }
          : fallback.player.buildSwap,
        recentDamageTimer: parsed.player?.recentDamageTimer ?? fallback.player.recentDamageTimer
      },
      sectors: {
        ...mergedSectors
      },
      missions: {
        ...fallback.missions,
        ...(parsed.missions ?? {})
      },
      transportMissions: {
        ...fallback.transportMissions,
        ...(parsed.transportMissions ?? {})
      },
      routePlan: parsed.routePlan ?? null
    };
  } catch {
    return fallback;
  }
}

function saveWorld(world: GameWorld) {
  window.localStorage.setItem("starfall-world", JSON.stringify(world));
}
