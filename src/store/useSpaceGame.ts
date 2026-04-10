import { useEffect, useMemo, useRef, useState } from "react";
import { missionCatalog } from "../game/data/missions";
import { moduleById, moduleCatalog } from "../game/data/modules";
import { playerShips } from "../game/data/ships";
import { getCameraFrame, renderSector } from "../game/scenes/renderSector";
import { sectorById } from "../game/data/sectors";
import {
  acceptMission,
  addCredits,
  claimFactionReward,
  buyCommodity,
  buyModule,
  buyShip,
  activateTacticalSlow as triggerTacticalSlow,
  clearQueuedUndockActions,
  clearDeathSummary,
  clearRouteDestination,
  createSnapshot,
  dock,
  equipModuleToSlot,
  disengageCombat,
  forcePilotLicenseLevel,
  issueCommand,
  lockTarget,
  repairShip,
  regenShip,
  resolveSelectionAtPoint,
  loadBuildSlot,
  saveBuildSlot,
  sellModule,
  sellShip,
  selectObject,
  startBuildSwap,
  sellCargo,
  sellCommodity,
  setActiveTarget,
  setDifficulty,
  setRouteAutoFollow,
  setRouteDestination,
  setWeaponHoldFire,
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
import { PERFORMANCE } from "../game/config/performance";
import {
  forceDevRegionalEvent,
  forceDevSiteHotspot,
  forceDevWarEvent
} from "../game/procgen/runtime";
import { CommodityId, GameSnapshot, GameWorld, ModuleSlot, SelectableRef, StarterShipConfigId, Vec2 } from "../types/game";

function normalizeNumericRecord<T extends string>(
  values: Partial<Record<T, unknown>> | undefined,
  fallback: Record<T, number>
): Record<T, number> {
  const normalized = { ...fallback };
  Object.entries(values ?? {}).forEach(([key, value]) => {
    const numeric = Number(value);
    normalized[key as T] = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  });
  return normalized;
}

function normalizeMissionCargo(
  missionCargo: GameWorld["player"]["missionCargo"] | undefined
): GameWorld["player"]["missionCargo"] {
  return (missionCargo ?? []).map((entry) => {
    const numericVolume = Number(entry.volume);
    return {
      ...entry,
      volume: Number.isFinite(numericVolume) ? Math.max(0, numericVolume) : 0
    };
  });
}

function normalizeNonNegativeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
}

function worldPointFromClient(
  canvas: HTMLCanvasElement,
  zoom: number,
  cameraX: number,
  cameraY: number,
  clientX: number,
  clientY: number
) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (clientX - bounds.left) / zoom + cameraX,
    y: (clientY - bounds.top) / zoom + cameraY
  };
}

export function useSpaceGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<GameWorld>(loadWorld());
  const autosaveRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const isMobileRef = useRef<boolean>(window.innerWidth < 768);
  const zoomTargetRef = useRef<number>(
    window.innerWidth < 768
      ? 0.28
      : Number(window.localStorage.getItem("starfall-zoom") ?? "1")
  );
  const zoomCurrentRef = useRef<number>(zoomTargetRef.current);
  const cameraOffsetRef = useRef<Vec2>({ x: 0, y: 0 });
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => createSnapshot(worldRef.current));
  const [overlay, setOverlay] = useState<"map" | "inventory" | "fitting" | "missions" | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: SelectableRef;
  } | null>(null);

  const refresh = () => {
    setSnapshot(createSnapshot(worldRef.current));
    scheduleSave();
  };

  const flushSave = () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveWorld(worldRef.current);
  };

  const scheduleSave = () => {
    if (saveTimerRef.current !== null) return;
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      saveWorld(worldRef.current);
    }, PERFORMANCE.ui.saveDelayMs);
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
        case "[":
          worldRef.current.timeScale = Math.max(0.25, Math.min(3, worldRef.current.timeScale - 0.25));
          refresh();
          break;
        case "]":
          worldRef.current.timeScale = Math.max(0.25, Math.min(3, worldRef.current.timeScale + 0.25));
          refresh();
          break;
        case "0":
          worldRef.current.timeScale = 1;
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
    flushSave();
    autosaveRef.current = window.setInterval(flushSave, 2000);
    window.addEventListener("beforeunload", flushSave);
    window.addEventListener("pagehide", flushSave);

    return () => {
      if (autosaveRef.current !== null) {
        window.clearInterval(autosaveRef.current);
        autosaveRef.current = null;
      }
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      window.removeEventListener("beforeunload", flushSave);
      window.removeEventListener("pagehide", flushSave);
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
      const frameData = getCameraFrame(worldRef.current, canvas, zoomCurrentRef.current, cameraOffsetRef.current);
      cameraOffsetRef.current = frameData.cameraOffset;
      renderSector(
        context,
        canvas,
        worldRef.current,
        zoomCurrentRef.current,
        cameraOffsetRef.current,
        isMobileRef.current
      );

      snapshotAccumulator += dt;
      if (snapshotAccumulator >= PERFORMANCE.ui.snapshotRefreshIntervalSec) {
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
      regenShip: () => {
        regenShip(worldRef.current);
        refresh();
      },
      addCredits: (amount: number) => {
        addCredits(worldRef.current, amount);
        refresh();
      },
      forcePilotLicenseLevel: (level: 1 | 2 | 3) => {
        forcePilotLicenseLevel(worldRef.current, level);
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
      activateTacticalSlow: () => {
        triggerTacticalSlow(worldRef.current);
        refresh();
      },
      triggerDevRegionalEvent: () => {
        forceDevRegionalEvent(worldRef.current, worldRef.current.currentSectorId);
        refresh();
      },
      triggerDevSiteHotspot: () => {
        forceDevSiteHotspot(worldRef.current, worldRef.current.currentSectorId);
        refresh();
      },
      triggerDevWarEvent: () => {
        forceDevWarEvent(worldRef.current, worldRef.current.currentSectorId);
        refresh();
      },
      setTimeScale: (timeScale: number) => {
        worldRef.current.timeScale = Math.max(0.25, Math.min(3, timeScale));
        refresh();
      },
      clearDeathSummary: () => {
        clearDeathSummary(worldRef.current);
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
      claimFactionReward: (factionId: Parameters<typeof claimFactionReward>[1]) => {
        claimFactionReward(worldRef.current, factionId);
        refresh();
      },
      buyShip: (shipId: string) => {
        buyShip(worldRef.current, shipId);
        refresh();
      },
      sellShip: (shipId: string) => {
        sellShip(worldRef.current, shipId);
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
      setWeaponHoldFire: (holdFire: boolean) => {
        setWeaponHoldFire(worldRef.current, holdFire);
        refresh();
      },
      disengageCombat: () => {
        disengageCombat(worldRef.current);
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
        const frameData = getCameraFrame(worldRef.current, canvas, zoomCurrentRef.current, cameraOffsetRef.current);
        const point = worldPointFromClient(canvas, zoomCurrentRef.current, frameData.cameraX, frameData.cameraY, clientX, clientY);
        const ref = resolveSelectionAtPoint(worldRef.current, point);
        selectObject(worldRef.current, ref);
        setContextMenu(null);
        refresh();
      },
      handleCanvasDoubleClick: (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const frameData = getCameraFrame(worldRef.current, canvas, zoomCurrentRef.current, cameraOffsetRef.current);
        const point = worldPointFromClient(canvas, zoomCurrentRef.current, frameData.cameraX, frameData.cameraY, clientX, clientY);
        issueCommand(worldRef.current, { type: "travel", destination: point });
        setContextMenu(null);
        refresh();
      },
      handleCanvasRightClick: (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const frameData = getCameraFrame(worldRef.current, canvas, zoomCurrentRef.current, cameraOffsetRef.current);
        const point = worldPointFromClient(canvas, zoomCurrentRef.current, frameData.cameraX, frameData.cameraY, clientX, clientY);
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
      panCamera: (deltaX: number, deltaY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const nextOffset = {
          x: cameraOffsetRef.current.x - deltaX / Math.max(zoomCurrentRef.current, 0.01),
          y: cameraOffsetRef.current.y - deltaY / Math.max(zoomCurrentRef.current, 0.01)
        };
        const frameData = getCameraFrame(worldRef.current, canvas, zoomCurrentRef.current, nextOffset);
        cameraOffsetRef.current = frameData.cameraOffset;
      },
      resetCameraView: () => {
        cameraOffsetRef.current = { x: 0, y: 0 };
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
        const mergedFieldStates = {
          ...fallbackSector.fieldStates,
          ...(parsedSector?.fieldStates ?? {})
        };
        const mergedEcology = parsedSector?.ecology
          ? {
              ...fallbackSector.ecology,
              ...parsedSector.ecology,
              nearbyInfluence: {
                ...fallbackSector.ecology.nearbyInfluence,
                ...(parsedSector.ecology.nearbyInfluence ?? {})
              }
            }
          : fallbackSector.ecology;
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
                recentDamageTimer: enemy.recentDamageTimer ?? 0,
                pursuitTimer: enemy.pursuitTimer ?? 0,
                effects: enemy.effects ?? {
                  speedMultiplier: 1,
                  signatureMultiplier: 1,
                  turretTrackingMultiplier: 1,
                  lockRangeMultiplier: 1,
                  capacitorRegenMultiplier: 1
                }
              })) ?? fallbackSector.enemies,
            asteroids: parsedSector?.asteroids ?? fallbackSector.asteroids,
            projectiles: parsedSector?.projectiles ?? fallbackSector.projectiles,
            loot: parsedSector?.loot ?? fallbackSector.loot,
            wrecks: parsedSector?.wrecks ?? fallbackSector.wrecks,
            floatingText: parsedSector?.floatingText ?? fallbackSector.floatingText,
            beltSpawnCooldowns: parsedSector?.beltSpawnCooldowns ?? fallbackSector.beltSpawnCooldowns,
            ecology: mergedEcology,
            fieldStates: mergedFieldStates
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

    const normalizeRuntime = (runtime: NonNullable<GameWorld["player"]["modules"]["weapon"][number]>): typeof runtime => {
      const module = runtime.moduleId ? moduleById[runtime.moduleId] : null;
      return {
        ...runtime,
        ammoRemaining:
          runtime.ammoRemaining ??
          (module?.kind === "cannon" ? Math.max(1, module.magazineSize ?? 1) : undefined)
      };
    };

    return {
      ...fallback,
      ...parsed,
      player: {
        ...fallback.player,
        ...parsed.player,
        starterConfigId: parsed.player?.starterConfigId ?? fallback.player.starterConfigId,
        pilotLicense: normalizePilotLicense(parsed.player?.pilotLicense ?? fallback.player.pilotLicense),
        credits: normalizeNonNegativeNumber(parsed.player?.credits, fallback.player.credits),
        cargo: normalizeNumericRecord(parsed.player?.cargo, fallback.player.cargo),
        commodities: {
          ...normalizeNumericRecord(parsed.player?.commodities, fallback.player.commodities)
        },
        missionCargo: normalizeMissionCargo(parsed.player?.missionCargo ?? fallback.player.missionCargo),
        effects: {
          ...fallback.player.effects,
          ...(parsed.player?.effects ?? {})
        },
        weaponHoldFire: parsed.player?.weaponHoldFire ?? fallback.player.weaponHoldFire,
        tacticalSlow: parsed.player?.tacticalSlow ?? fallback.player.tacticalSlow,
        deathSummary: parsed.player?.deathSummary ?? fallback.player.deathSummary,
        pendingLocks: parsed.player?.pendingLocks ?? fallback.player.pendingLocks,
        savedBuilds: mergedBuilds,
        factionRewardClaims: {
          ...fallback.player.factionRewardClaims,
          ...(parsed.player?.factionRewardClaims ?? {})
        },
        modules: {
          weapon: (parsed.player?.modules?.weapon ?? fallback.player.modules.weapon).map(normalizeRuntime),
          utility: (parsed.player?.modules?.utility ?? fallback.player.modules.utility).map(normalizeRuntime),
          defense: (parsed.player?.modules?.defense ?? fallback.player.modules.defense).map(normalizeRuntime)
        },
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
      timeScale:
        typeof parsed.timeScale === "number" && Number.isFinite(parsed.timeScale)
          ? Math.max(0.25, Math.min(3, parsed.timeScale))
          : 0.75,
      missions: {
        ...fallback.missions,
        ...(parsed.missions ?? {})
      },
      transportMissions: {
        ...fallback.transportMissions,
        ...(parsed.transportMissions ?? {})
      },
      boundary: {
        ...fallback.boundary,
        ...(parsed.boundary ?? {})
      },
      localSite: parsed.localSite
        ? {
            ...fallback.localSite,
            ...parsed.localSite,
            center: parsed.localSite.center ?? fallback.localSite.center
          }
        : fallback.localSite,
      routePlan: parsed.routePlan ?? null,
      procgen: {
        ...fallback.procgen,
        ...(parsed.procgen ?? {}),
        regionalEvents: {
          ...fallback.procgen.regionalEvents,
          ...(parsed.procgen?.regionalEvents ?? {})
        },
        siteHotspots: {
          ...fallback.procgen.siteHotspots,
          ...(parsed.procgen?.siteHotspots ?? {})
        },
        warEvents: {
          ...fallback.procgen.warEvents,
          ...(parsed.procgen?.warEvents ?? {})
        },
        activeContract: parsed.procgen?.activeContract ?? fallback.procgen.activeContract,
        activeContractState: parsed.procgen?.activeContractState ?? fallback.procgen.activeContractState
      }
    };
  } catch {
    return fallback;
  }
}

function saveWorld(world: GameWorld) {
  window.localStorage.setItem("starfall-world", JSON.stringify(world));
}
