import { GameWorld, ParticleState, Vec2 } from "../../types/game";
import { enemyVariantById, playerShipById } from "../data/ships";
import { moduleById } from "../data/modules";
import { getSystemDestinations, sectorById } from "../data/sectors";
import { computeDerivedStats } from "../utils/stats";
import { getObjectInfo } from "../world/spaceObjects";

function setGlow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function clearGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

function worldToScreen(point: Vec2, cameraX: number, cameraY: number, zoom: number) {
  return {
    x: (point.x - cameraX) * zoom,
    y: (point.y - cameraY) * zoom
  };
}

function drawShipShape(
  ctx: CanvasRenderingContext2D,
  silhouette: "dart" | "wing" | "heavy" | "needle" | "wedge" | "kite" | "box" | "claw",
  fillColor: string,
  strokeColor: string
) {
  ctx.beginPath();
  if (silhouette === "dart") {
    // Compact arrowhead — general skirmisher
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-12, 9);
  } else if (silhouette === "needle") {
    // Ultra-slim spear — long-range snipers
    ctx.moveTo(26, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-4, 4);
  } else if (silhouette === "wing") {
    // Swept-wing fighter — brawlers and interceptors
    ctx.moveTo(20, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(0, -2);
    ctx.lineTo(-4, 0);
    ctx.lineTo(0, 2);
    ctx.lineTo(-10, 12);
  } else if (silhouette === "kite") {
    // Diamond kite — fast kiters and Veilborn
    ctx.moveTo(20, 0);
    ctx.lineTo(2, -14);
    ctx.lineTo(-14, 0);
    ctx.lineTo(2, 14);
  } else if (silhouette === "heavy") {
    // Hexagonal block — armor destroyers and gunships
    ctx.moveTo(19, 0);
    ctx.lineTo(5, -12);
    ctx.lineTo(-14, -8);
    ctx.lineTo(-18, 0);
    ctx.lineTo(-14, 8);
    ctx.lineTo(5, 12);
  } else if (silhouette === "wedge") {
    // Broad triangle — cruisers and command ships
    ctx.moveTo(16, 0);
    ctx.lineTo(-18, -16);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-18, 16);
  } else if (silhouette === "box") {
    // Wide rectangular — industrials and haulers
    ctx.moveTo(18, -10);
    ctx.lineTo(18, 10);
    ctx.lineTo(-16, 12);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-16, -12);
  } else {
    // Claw — aggressive rear-taloned brawlers
    ctx.moveTo(20, 0);
    ctx.lineTo(2, -8);
    ctx.lineTo(-10, -16);
    ctx.lineTo(-16, -6);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-16, 6);
    ctx.lineTo(-10, 16);
    ctx.lineTo(2, 8);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.4;
  ctx.fill();
  ctx.stroke();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, stroke: string, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.6;
  ctx.fill();
  ctx.stroke();
}

function drawArenaBackdrop(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  world: GameWorld,
  zoom: number,
  cameraX: number,
  cameraY: number
) {
  const time = world.elapsedTime;

  ctx.fillStyle = "#020611";
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  const radialA = ctx.createRadialGradient(
    viewportWidth * 0.25,
    viewportHeight * 0.3,
    10,
    viewportWidth * 0.25,
    viewportHeight * 0.3,
    viewportWidth * 0.65
  );
  radialA.addColorStop(0, "rgba(52, 114, 255, 0.20)");
  radialA.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = radialA;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  const radialB = ctx.createRadialGradient(
    viewportWidth * 0.7,
    viewportHeight * 0.58,
    10,
    viewportWidth * 0.7,
    viewportHeight * 0.58,
    viewportWidth * 0.58
  );
  radialB.addColorStop(0, "rgba(255, 106, 76, 0.14)");
  radialB.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = radialB;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  ctx.save();
  ctx.beginPath();
  ctx.rect(10, 10, viewportWidth - 20, viewportHeight - 20);
  ctx.clip();

  ctx.strokeStyle = "rgba(102, 196, 255, 0.28)";
  ctx.lineWidth = 1;
  setGlow(ctx, "#4ecbff", 5);

  const spacing = 34;
  const offsetX = ((cameraX * zoom) % spacing + spacing) % spacing;
  const offsetY = ((cameraY * zoom) % spacing + spacing) % spacing;
  const centerX = viewportWidth / 2;
  const centerY = viewportHeight / 2;

  for (let x = -spacing * 2; x <= viewportWidth + spacing * 2; x += spacing) {
    ctx.beginPath();
    for (let y = -spacing * 2; y <= viewportHeight + spacing * 2; y += 12) {
      const distanceToCenter = (y - centerY) / viewportHeight;
      const warp =
        Math.sin((y + time * 120 + x * 0.16) * 0.013) * 10 +
        Math.sin((x + time * 70) * 0.01) * 5 +
        distanceToCenter * Math.sin((x - centerX) * 0.012) * 24;
      const pointX = x - offsetX + warp;
      if (y === -spacing * 2) {
        ctx.moveTo(pointX, y);
      } else {
        ctx.lineTo(pointX, y);
      }
    }
    ctx.stroke();
  }

  for (let y = -spacing * 2; y <= viewportHeight + spacing * 2; y += spacing) {
    ctx.beginPath();
    for (let x = -spacing * 2; x <= viewportWidth + spacing * 2; x += 12) {
      const distanceToCenter = (x - centerX) / viewportWidth;
      const warp =
        Math.sin((x + time * 90 + y * 0.14) * 0.013) * 10 +
        Math.cos((y + time * 60) * 0.012) * 5 +
        distanceToCenter * Math.cos((y - centerY) * 0.012) * 24;
      const pointY = y - offsetY + warp;
      if (x === -spacing * 2) {
        ctx.moveTo(x, pointY);
      } else {
        ctx.lineTo(x, pointY);
      }
    }
    ctx.stroke();
  }

  clearGlow(ctx);
  ctx.restore();

  for (let index = 0; index < 36; index += 1) {
    const px = ((index * 179 + time * 40) % (viewportWidth + 120)) - 60;
    const py = ((index * 97 + time * 24) % (viewportHeight + 80)) - 40;
    const size = 1 + (index % 3);
    ctx.fillStyle = `rgba(182, 232, 255, ${0.10 + (index % 4) * 0.04})`;
    ctx.fillRect(px, py, size, size);
  }

  ctx.strokeStyle = "rgba(114, 206, 255, 0.45)";
  ctx.lineWidth = 2;
  setGlow(ctx, "#72ceff", 14);
  ctx.strokeRect(12, 12, viewportWidth - 24, viewportHeight - 24);
  ctx.strokeStyle = "rgba(202, 242, 255, 0.18)";
  ctx.strokeRect(6, 6, viewportWidth - 12, viewportHeight - 12);
  clearGlow(ctx);
}

function drawEnergyArc(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  setGlow(ctx, color, 10);
  ctx.beginPath();
  ctx.arc(0, 0, radius, -0.9, 0.45);
  ctx.stroke();
  clearGlow(ctx);
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: ParticleState) {
  const alpha = Math.max(0, p.ttl / p.lifetime);
  const r = p.size * (0.5 + alpha * 0.5);
  ctx.globalAlpha = alpha;
  setGlow(ctx, p.color, p.glow * alpha);

  if (p.shape === "spark") {
    const tailX = p.position.x - p.velocity.x * 0.04;
    const tailY = p.position.y - p.velocity.y * 0.04;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = r * 0.9;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(p.position.x, p.position.y);
    ctx.stroke();
  } else if (p.shape === "dot") {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.position.x, p.position.y, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    drawDiamond(ctx, p.position.x, p.position.y, r, p.color, `rgba(255,255,255,0.15)`);
  }

  clearGlow(ctx);
  ctx.globalAlpha = 1;
}

interface MiningBeamStyle {
  outerColor: string;
  coreColor: string;
  outerWidth: number;
  coreWidth: number;
  outerGlow: number;
  pulseSpeed: number;
}

const MINING_BEAM_STYLES: Record<string, MiningBeamStyle> = {
  "survey-mining-laser": {
    outerColor: "#56c8ff",
    coreColor: "#c8f0ff",
    outerWidth: 2.5,
    coreWidth: 1,
    outerGlow: 14,
    pulseSpeed: 2.2
  },
  "strip-mining-laser": {
    outerColor: "#ff9f3a",
    coreColor: "#ffe0a0",
    outerWidth: 3.5,
    coreWidth: 1.4,
    outerGlow: 20,
    pulseSpeed: 1.6
  },
  "deep-vein-reclaimer": {
    outerColor: "#c87aff",
    coreColor: "#f0d0ff",
    outerWidth: 3,
    coreWidth: 1.2,
    outerGlow: 22,
    pulseSpeed: 1.2
  },
  "field-excavator-array": {
    outerColor: "#40ffcc",
    coreColor: "#ccfff0",
    outerWidth: 4.5,
    coreWidth: 2,
    outerGlow: 28,
    pulseSpeed: 2.8
  }
};

const DEFAULT_BEAM_STYLE: MiningBeamStyle = {
  outerColor: "#56c8ff",
  coreColor: "#c8f0ff",
  outerWidth: 2.5,
  coreWidth: 1,
  outerGlow: 14,
  pulseSpeed: 2.2
};

function drawStraightBeam(
  ctx: CanvasRenderingContext2D,
  start: Vec2,
  end: Vec2,
  style: MiningBeamStyle,
  t: number
) {
  // Pulse the glow intensity
  const pulse = 0.8 + Math.sin(t * style.pulseSpeed * Math.PI * 2) * 0.2;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // Outer glow pass
  setGlow(ctx, style.outerColor, style.outerGlow * pulse);
  ctx.strokeStyle = style.outerColor;
  ctx.lineWidth = style.outerWidth * pulse;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Bright core pass
  setGlow(ctx, "#ffffff", 5);
  ctx.strokeStyle = style.coreColor;
  ctx.lineWidth = style.coreWidth;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Impact dot at asteroid
  setGlow(ctx, style.outerColor, style.outerGlow * 1.4 * pulse);
  ctx.fillStyle = style.coreColor;
  ctx.beginPath();
  ctx.arc(end.x, end.y, style.outerWidth * 1.2 * pulse, 0, Math.PI * 2);
  ctx.fill();

  clearGlow(ctx);
  ctx.restore();
}

function drawMiningBeam(ctx: CanvasRenderingContext2D, world: GameWorld) {
  const player = world.player;
  const allModules = [
    ...player.modules.weapon,
    ...player.modules.utility,
    ...player.modules.defense
  ];
  const activeMiningRuntime = allModules.find((m) => m.moduleId && m.active && moduleById[m.moduleId]?.kind === "mining_laser");
  if (!activeMiningRuntime?.moduleId) return;

  const moduleDef = moduleById[activeMiningRuntime.moduleId];
  if (!moduleDef) return;

  const style = MINING_BEAM_STYLES[activeMiningRuntime.moduleId] ?? DEFAULT_BEAM_STYLE;
  const t = world.elapsedTime;
  const sector = world.sectors[world.currentSectorId];

  if (moduleDef.minesAllInRange && moduleDef.range) {
    // Field Excavator Array: beam to every asteroid in range
    for (const asteroid of sector.asteroids) {
      const dx = asteroid.position.x - player.position.x;
      const dy = asteroid.position.y - player.position.y;
      if (Math.sqrt(dx * dx + dy * dy) <= moduleDef.range && asteroid.oreRemaining > 0) {
        drawStraightBeam(ctx, player.position, asteroid.position, style, t);
      }
    }
  } else {
    // Single-target: beam to active target asteroid
    if (world.activeTarget?.type !== "asteroid") return;
    const targetAsteroid = sector.asteroids.find((a) => a.id === world.activeTarget?.id);
    if (!targetAsteroid) return;
    drawStraightBeam(ctx, player.position, targetAsteroid.position, style, t);
  }
}

export function renderSector(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  world: GameWorld,
  zoom: number
) {
  const viewportWidth = canvas.clientWidth;
  const viewportHeight = canvas.clientHeight;
  const sectorDef = sectorById[world.currentSectorId];
  const sector = world.sectors[world.currentSectorId];
  const playerHull = playerShipById[world.player.hullId];
  const derived = computeDerivedStats(world.player);
  const destinations = getSystemDestinations(world.currentSectorId);
  const viewWidth = viewportWidth / zoom;
  const viewHeight = viewportHeight / zoom;
  const cameraX = world.player.position.x - viewWidth / 2;
  const cameraY = world.player.position.y - viewHeight / 2;

  ctx.clearRect(0, 0, viewportWidth, viewportHeight);
  drawArenaBackdrop(ctx, viewportWidth, viewportHeight, world, zoom, cameraX, cameraY);

  if (world.player.navigation.mode === "warping") {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    setGlow(ctx, "#6ed7ff", 12);
    for (let index = 0; index < 48; index += 1) {
      const x = ((index * 47 + world.elapsedTime * 920) % (viewportWidth + 220)) - 110;
      ctx.fillStyle = "rgba(122, 224, 255, 0.22)";
      ctx.fillRect(x, 0, 2, viewportHeight);
    }
    clearGlow(ctx);
    ctx.restore();
  }

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-cameraX, -cameraY);

  destinations.filter((entry) => entry.kind === "belt").forEach((belt) => {
    ctx.strokeStyle = "rgba(110, 245, 255, 0.36)";
    ctx.lineWidth = 1.6;
    setGlow(ctx, "#77ecff", 9);
    ctx.beginPath();
    ctx.arc(belt.position.x, belt.position.y, 116, 0, Math.PI * 2);
    ctx.stroke();
    clearGlow(ctx);
    drawDiamond(ctx, belt.position.x, belt.position.y, 8, "#b8ffff", "rgba(118, 241, 255, 0.28)");
  });

  destinations.filter((entry) => entry.kind === "station").forEach((station) => {
    ctx.save();
    ctx.translate(station.position.x, station.position.y);
    setGlow(ctx, "#84e8ff", 18);
    ctx.strokeStyle = "#cefbff";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(world.elapsedTime * 0.18);
    drawDiamond(ctx, 0, 0, 18, "#ffffff", "rgba(114, 235, 255, 0.24)");
    clearGlow(ctx);
    ctx.restore();
  });

  destinations.filter((entry) => entry.kind === "gate").forEach((gate) => {
    ctx.save();
    ctx.translate(gate.position.x, gate.position.y);
    const pulse = 1 + Math.sin(world.elapsedTime * 2.8 + gate.position.x * 0.01) * 0.08;
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = "#ff9d6a";
    ctx.lineWidth = 3;
    setGlow(ctx, "#ff8c63", 18);
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 169, 110, 0.42)";
    ctx.lineWidth = 6;
    ctx.stroke();
    clearGlow(ctx);
    ctx.restore();
  });

  destinations
    .filter((entry) => entry.kind === "beacon" || entry.kind === "anomaly" || entry.kind === "outpost" || entry.kind === "wreck")
    .forEach((entry) => {
      if (entry.kind === "anomaly" && entry.anomalyField) {
        const radius = entry.anomalyField.radius;
        const tint = entry.anomalyField.tint ?? "#ff7b7b";
        const pulse = 1 + Math.sin(world.elapsedTime * 1.8 + entry.position.x * 0.01) * 0.04;
        ctx.save();
        ctx.translate(entry.position.x, entry.position.y);
        ctx.scale(pulse, pulse);
        ctx.strokeStyle = tint;
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 0.2;
        setGlow(ctx, tint, 18);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.76, 0, Math.PI * 2);
        ctx.stroke();
        clearGlow(ctx);
        const debrisCount = entry.anomalyField.debrisCount ?? 10;
        for (let index = 0; index < debrisCount; index += 1) {
          const seed = index * 1.73 + entry.position.x * 0.003 + entry.position.y * 0.002;
          const angle = world.elapsedTime * (entry.anomalyField.effect === "pull" ? -0.45 : 0.52) + seed;
          const orbit = radius * (0.24 + ((index * 17) % 9) * 0.065);
          const x = Math.cos(angle) * orbit;
          const y = Math.sin(angle) * orbit;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle * 1.8);
          ctx.fillStyle = entry.anomalyField.effect === "pull" ? "rgba(215, 187, 255, 0.48)" : "rgba(255, 166, 120, 0.46)";
          ctx.fillRect(-2.5, -1.2, 5, 2.4);
          ctx.restore();
        }
        ctx.restore();
      }
      const stroke =
        entry.kind === "anomaly"
          ? entry.anomalyField?.tint ?? "#ff7b7b"
          : entry.kind === "wreck"
            ? "#d5c7a1"
            : "#8de6ff";
      const fill =
        entry.kind === "anomaly"
          ? "rgba(255, 116, 116, 0.26)"
          : entry.kind === "wreck"
            ? "rgba(218, 200, 149, 0.18)"
            : "rgba(112, 233, 255, 0.20)";
      setGlow(ctx, stroke, 10);
      drawDiamond(ctx, entry.position.x, entry.position.y, entry.kind === "anomaly" ? 12 : 9, stroke, fill);
      clearGlow(ctx);
    });

  sector.asteroids.forEach((asteroid, index) => {
    const stroke =
      asteroid.resource === "ferrite"
        ? "#86e0ff"
        : asteroid.resource === "ember-crystal"
          ? "#ff9f6d"
          : "#bc99ff";
    const fill =
      asteroid.resource === "ferrite"
        ? "rgba(120, 224, 255, 0.14)"
        : asteroid.resource === "ember-crystal"
          ? "rgba(255, 149, 108, 0.14)"
          : "rgba(178, 138, 255, 0.14)";
    const radius = asteroid.radius * (0.7 + (index % 3) * 0.08);
    setGlow(ctx, stroke, 12);
    drawDiamond(ctx, asteroid.position.x, asteroid.position.y, radius, stroke, fill);
    clearGlow(ctx);
  });

  sector.loot.forEach((drop, index) => {
    const angle = world.elapsedTime * 1.8 + index * 0.4;
    ctx.save();
    ctx.translate(drop.position.x, drop.position.y);
    ctx.rotate(angle);
    setGlow(ctx, "#77ffe2", 12);
    drawDiamond(ctx, 0, 0, 8, "#cbfff4", "rgba(117, 255, 226, 0.24)");
    clearGlow(ctx);
    ctx.restore();
  });

  sector.wrecks.forEach((wreck, index) => {
    ctx.save();
    ctx.translate(wreck.position.x, wreck.position.y);
    ctx.rotate(world.elapsedTime * 0.2 + index * 0.15);
    setGlow(ctx, "#ffe2a2", 8);
    ctx.strokeStyle = "#ffe2a2";
    ctx.lineWidth = 1.8;
    ctx.strokeRect(-10, -10, 20, 20);
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-8, -8, 16, 16);
    clearGlow(ctx);
    ctx.restore();
  });

  sector.projectiles.forEach((projectile, index) => {
    const color =
      projectile.moduleId.includes("missile")
        ? "#ffb265"
        : projectile.owner === "player"
          ? "#6feeff"
          : "#ff846f";
    setGlow(ctx, color, 12);
    ctx.strokeStyle = color;
    ctx.lineWidth = projectile.moduleId.includes("missile") ? 2.6 : 2;
    ctx.beginPath();
    ctx.moveTo(projectile.position.x, projectile.position.y);
    ctx.lineTo(
      projectile.position.x - projectile.velocity.x * 0.035 - (index % 2) * 1.5,
      projectile.position.y - projectile.velocity.y * 0.035 - (index % 3) * 1.1
    );
    ctx.stroke();
    drawDiamond(ctx, projectile.position.x, projectile.position.y, projectile.radius + 1, color, "rgba(255,255,255,0.08)");
    clearGlow(ctx);
  });

  drawMiningBeam(ctx, world);

  sector.enemies.forEach((enemy, index) => {
    const variant = enemyVariantById[enemy.variantId];
    ctx.save();
    ctx.translate(enemy.position.x, enemy.position.y);
    ctx.rotate(enemy.rotation);
    setGlow(ctx, variant.color, 16);
    drawShipShape(ctx, variant.silhouette, "rgba(255, 96, 96, 0.18)", variant.color);
    clearGlow(ctx);
    ctx.restore();

    drawEnergyArc(ctx, enemy.position.x, enemy.position.y, 28 + (index % 3) * 2, "rgba(255, 120, 102, 0.72)", world.elapsedTime + index);

    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(enemy.position.x - 18, enemy.position.y + 18, 36, 3);
    ctx.fillStyle = "#69dfff";
    ctx.fillRect(enemy.position.x - 18, enemy.position.y + 18, 36 * (enemy.shield / variant.shield), 3);
    ctx.fillStyle = "#ff876e";
    ctx.fillRect(enemy.position.x - 18, enemy.position.y + 23, 36 * (enemy.hull / variant.hull), 3);
  });

  ctx.save();
  ctx.translate(world.player.position.x, world.player.position.y);
  ctx.rotate(world.player.rotation);
  setGlow(ctx, "#b8ff6a", 18);
  drawShipShape(ctx, playerHull.silhouette, "rgba(164, 255, 82, 0.22)", "#d8ff9b");
  clearGlow(ctx);
  ctx.restore();

  drawEnergyArc(ctx, world.player.position.x, world.player.position.y, 30, "rgba(182, 255, 112, 0.70)", -world.elapsedTime * 1.4);

  const playerScreen = worldToScreen(world.player.position, cameraX, cameraY, zoom);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const playerAura = ctx.createRadialGradient(playerScreen.x, playerScreen.y, 0, playerScreen.x, playerScreen.y, 80 * zoom);
  playerAura.addColorStop(0, "rgba(166, 255, 93, 0.14)");
  playerAura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = playerAura;
  ctx.fillRect(playerScreen.x - 90 * zoom, playerScreen.y - 90 * zoom, 180 * zoom, 180 * zoom);
  ctx.restore();

  const selectedInfo = getObjectInfo(world, world.selectedObject);
  if (selectedInfo) {
    setGlow(ctx, "#ffe082", 10);
    ctx.strokeStyle = "#ffe082";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(selectedInfo.position.x, selectedInfo.position.y, 24, 0, Math.PI * 2);
    ctx.stroke();
    clearGlow(ctx);
    ctx.fillStyle = "#fff2b8";
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.fillText(selectedInfo.name, selectedInfo.position.x + 18, selectedInfo.position.y - 18);
  }

  world.lockedTargets.forEach((ref) => {
    const info = getObjectInfo(world, ref);
    if (!info) return;
    const primary = world.activeTarget?.id === ref.id && world.activeTarget.type === ref.type;
    const color = primary ? "#ffb454" : "#75d4ff";
    setGlow(ctx, color, 10);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(info.position.x - 22, info.position.y - 22, 44, 44);
    clearGlow(ctx);
    if (primary) {
      ctx.fillStyle = "#ffd57a";
      ctx.font = '12px "Space Grotesk", sans-serif';
      ctx.fillText("PRIMARY", info.position.x - 20, info.position.y - 28);
    }
  });

  if (world.player.navigation.target) {
    const navTargetInfo = getObjectInfo(world, world.player.navigation.target);
    if (navTargetInfo) {
      ctx.strokeStyle = "rgba(170, 230, 255, 0.22)";
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(world.player.position.x, world.player.position.y);
      ctx.lineTo(navTargetInfo.position.x, navTargetInfo.position.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(210, 244, 255, 0.8)";
      ctx.font = '12px "Space Grotesk", sans-serif';
      ctx.fillText(world.player.navigation.mode.toUpperCase(), world.player.position.x + 18, world.player.position.y - 18);
    }
  }

  if (sector.particles?.length) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const p of sector.particles) {
      drawParticle(ctx, p);
    }
    ctx.restore();
  }

  sector.floatingText.forEach((entry) => {
    setGlow(ctx, entry.color, 8);
    ctx.fillStyle = entry.color;
    ctx.font = 'bold 14px "Space Grotesk", sans-serif';
    ctx.fillText(entry.text, entry.position.x, entry.position.y);
    clearGlow(ctx);
  });

  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(4, 8, 18, 0.40)";
  ctx.fillRect(16, viewportHeight - 92, 250, 60);
  ctx.strokeStyle = "rgba(116, 214, 255, 0.28)";
  ctx.strokeRect(16, viewportHeight - 92, 250, 60);
  ctx.fillStyle = "#ecf8ff";
  ctx.font = '14px "Space Grotesk", sans-serif';
  ctx.fillText(sectorDef.name, 30, viewportHeight - 58);
  ctx.fillStyle = "#96b9df";
  ctx.fillText(`Nav: ${world.player.navigation.mode}`, 30, viewportHeight - 36);

  ctx.restore();
}
