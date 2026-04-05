import { GameWorld, ParticleState, Vec2 } from "../../types/game";
import { MOVEMENT_BALANCE } from "../config/balance";
import { enemyVariantById, playerShipById } from "../data/ships";
import { moduleById } from "../data/modules";
import { sectorById } from "../data/sectors";
import { computeDerivedStats } from "../utils/stats";
import { distance } from "../utils/vector";
import { getObjectInfo } from "../world/spaceObjects";
import { getVisibleSystemDestinations } from "../world/sites";

let _lowQuality = false;

function setGlow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  if (_lowQuality) return;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function clearGlow(ctx: CanvasRenderingContext2D) {
  if (_lowQuality) return;
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

function worldToScreen(point: Vec2, cameraX: number, cameraY: number, zoom: number) {
  return {
    x: (point.x - cameraX) * zoom,
    y: (point.y - cameraY) * zoom
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getCameraFrame(
  world: GameWorld,
  canvas: HTMLCanvasElement,
  zoom: number,
  cameraOffset: Vec2
) {
  const viewportWidth = canvas.clientWidth;
  const viewportHeight = canvas.clientHeight;
  const sectorDef = sectorById[world.currentSectorId];
  const deepSpaceMargin = MOVEMENT_BALANCE.boundary.deepSpaceMargin;
  const viewWidth = viewportWidth / zoom;
  const viewHeight = viewportHeight / zoom;
  const minX = -deepSpaceMargin;
  const maxX = sectorDef.width + deepSpaceMargin;
  const minY = -deepSpaceMargin;
  const maxY = sectorDef.height + deepSpaceMargin;
  const totalWidth = maxX - minX;
  const totalHeight = maxY - minY;

  let centerX = world.player.position.x + cameraOffset.x;
  let centerY = world.player.position.y + cameraOffset.y;

  if (viewWidth >= totalWidth) {
    centerX = sectorDef.width / 2;
  } else {
    centerX = clamp(centerX, minX + viewWidth / 2, maxX - viewWidth / 2);
  }

  if (viewHeight >= totalHeight) {
    centerY = sectorDef.height / 2;
  } else {
    centerY = clamp(centerY, minY + viewHeight / 2, maxY - viewHeight / 2);
  }

  return {
    viewportWidth,
    viewportHeight,
    viewWidth,
    viewHeight,
    cameraX: centerX - viewWidth / 2,
    cameraY: centerY - viewHeight / 2,
    cameraOffset: {
      x: centerX - world.player.position.x,
      y: centerY - world.player.position.y
    }
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

let backdropCache: { width: number; height: number; canvas: HTMLCanvasElement } | null = null;

// Seeded pseudo-random so the background is deterministic per session
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function buildBackdropCache(width: number, height: number) {
  if (backdropCache && backdropCache.width === width && backdropCache.height === height) {
    return backdropCache.canvas;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const rng = seededRand(0xdeadbeef);

  // ── Deep space base ──────────────────────────────────────────────────
  ctx.fillStyle = "#020610";
  ctx.fillRect(0, 0, width, height);

  // ── Large nebula blobs (very faint, large radial gradients) ──────────
  const nebulaSeeds = [
    { cx: 0.18, cy: 0.28, r: 0.72, color: "52,94,255",  alpha: 0.18 },
    { cx: 0.72, cy: 0.60, r: 0.62, color: "200,80,255", alpha: 0.13 },
    { cx: 0.50, cy: 0.85, r: 0.55, color: "255,80,100", alpha: 0.11 },
    { cx: 0.85, cy: 0.18, r: 0.50, color: "40,200,255", alpha: 0.10 },
    { cx: 0.30, cy: 0.70, r: 0.45, color: "80,255,160", alpha: 0.07 },
  ];
  for (const n of nebulaSeeds) {
    const gx = n.cx * width;
    const gy = n.cy * height;
    const gr = n.r * Math.max(width, height);
    const grad = ctx.createRadialGradient(gx, gy, gr * 0.02, gx, gy, gr);
    grad.addColorStop(0, `rgba(${n.color},${n.alpha})`);
    grad.addColorStop(0.45, `rgba(${n.color},${n.alpha * 0.4})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // ── Low-poly Voronoi-style polygon mesh ───────────────────────────────
  // Generate a jittered grid of points
  const cellSize = Math.round(Math.min(width, height) / 11);
  const cols = Math.ceil(width / cellSize) + 2;
  const rows = Math.ceil(height / cellSize) + 2;

  const pts: { x: number; y: number }[] = [];
  for (let row = -1; row <= rows; row++) {
    for (let col = -1; col <= cols; col++) {
      pts.push({
        x: (col + rng() * 0.82 + 0.09) * cellSize,
        y: (row + rng() * 0.82 + 0.09) * cellSize,
      });
    }
  }

  // Build triangles from a simple Delaunay-like grid subdivision
  // (grid-based: each cell split into 2 triangles, with jitter applied)
  const stride = cols + 2;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * stride + col;
      const tl = pts[i];
      const tr = pts[i + 1];
      const bl = pts[i + stride];
      const br = pts[i + stride + 1];
      if (!tl || !tr || !bl || !br) continue;

      // Centroid of each triangle for color sampling
      const drawTri = (a: {x:number;y:number}, b: {x:number;y:number}, c: {x:number;y:number}) => {
        const cx = (a.x + b.x + c.x) / 3;
        const cy = (a.y + b.y + c.y) / 3;
        // Map centroid to a depth-influenced dark blue/purple hue
        const nx = cx / width;
        const ny = cy / height;
        // Perlin-like value from position
        const v = Math.sin(nx * 8.3 + 1.2) * Math.cos(ny * 6.7 - 0.8) * 0.5 + 0.5;
        const v2 = Math.sin(nx * 3.1 - ny * 5.4 + 0.4) * 0.5 + 0.5;
        // Nebula color influence — each cell picks up the nearest blob slightly
        const br_val = Math.round(4 + v * 8 + v2 * 6);    // 4–18
        const bg_val = Math.round(4 + v * 10 + v2 * 4);   // 4–18
        const bb_val = Math.round(14 + v * 28 + v2 * 16); // 14–58
        // Vary alpha for depth — dark cells recede, slightly brighter ones pop
        const base = 0.55 + v * 0.22 + rng() * 0.14;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(${br_val},${bg_val},${bb_val},${base.toFixed(3)})`;
        ctx.fill();
        // Faint edge lines for polygon wireframe look
        ctx.strokeStyle = `rgba(60,90,160,0.10)`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      };

      // Split each cell into two triangles with a slight diagonal choice
      if (rng() > 0.5) {
        drawTri(tl, tr, bl);
        drawTri(tr, br, bl);
      } else {
        drawTri(tl, tr, br);
        drawTri(tl, br, bl);
      }
    }
  }

  // ── Re-apply nebula blobs on top of polygons (softer layer) ──────────
  for (const n of nebulaSeeds) {
    const gx = n.cx * width;
    const gy = n.cy * height;
    const gr = n.r * Math.max(width, height);
    const grad = ctx.createRadialGradient(gx, gy, gr * 0.04, gx, gy, gr * 0.75);
    grad.addColorStop(0, `rgba(${n.color},${(n.alpha * 0.5).toFixed(3)})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // ── Distant star clusters (tiny points, grouped) ──────────────────────
  const clusterCount = 6;
  for (let ci = 0; ci < clusterCount; ci++) {
    const clx = rng() * width;
    const cly = rng() * height;
    const clr = 60 + rng() * 160;
    const starCount = Math.round(18 + rng() * 40);
    for (let si = 0; si < starCount; si++) {
      const ang = rng() * Math.PI * 2;
      const dist = Math.pow(rng(), 0.5) * clr;
      const sx = clx + Math.cos(ang) * dist;
      const sy = cly + Math.sin(ang) * dist;
      const sz = rng();
      const alpha = 0.18 + sz * 0.55;
      const radius = 0.4 + sz * 0.9;
      const hue = ci % 2 === 0 ? `rgba(180,210,255,${alpha.toFixed(2)})` : `rgba(255,220,180,${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = hue;
      ctx.fill();
    }
  }

  // ── Scattered individual background stars ────────────────────────────
  const starCount = Math.round((width * height) / 2800);
  for (let i = 0; i < starCount; i++) {
    const sx = rng() * width;
    const sy = rng() * height;
    const sz = rng();
    const alpha = 0.12 + sz * 0.65;
    const r = 0.35 + sz * 0.85;
    const warm = rng() > 0.65;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = warm
      ? `rgba(255,230,190,${alpha.toFixed(2)})`
      : `rgba(190,215,255,${alpha.toFixed(2)})`;
    ctx.fill();
  }

  // ── A handful of bright foreground stars with small cross-flare ──────
  const brightCount = Math.round((width * height) / 28000);
  for (let i = 0; i < brightCount; i++) {
    const sx = rng() * width;
    const sy = rng() * height;
    const sr = 1.1 + rng() * 1.2;
    const sa = 0.7 + rng() * 0.3;
    const sc = rng() > 0.5 ? `rgba(200,225,255,${sa.toFixed(2)})` : `rgba(255,240,210,${sa.toFixed(2)})`;
    // Glow halo
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 5);
    grad.addColorStop(0, sc);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
    // Core dot
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    // Cross flare
    ctx.strokeStyle = `rgba(200,225,255,${(sa * 0.35).toFixed(2)})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(sx - sr * 6, sy); ctx.lineTo(sx + sr * 6, sy);
    ctx.moveTo(sx, sy - sr * 6); ctx.lineTo(sx, sy + sr * 6);
    ctx.stroke();
  }

  // ── Subtle vignette to push edges into deep space ────────────────────
  const vignette = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.28,
    width / 2, height / 2, Math.max(width, height) * 0.76
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,2,8,0.72)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  backdropCache = { width, height, canvas };
  return canvas;
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
  ctx.drawImage(buildBackdropCache(viewportWidth, viewportHeight), 0, 0);
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

const SALVAGE_BEAM_STYLE: MiningBeamStyle = {
  outerColor: "#96ffd4",
  coreColor: "#f2fffa",
  outerWidth: 2.8,
  coreWidth: 1.1,
  outerGlow: 16,
  pulseSpeed: 1.9
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

function drawSalvageBeam(ctx: CanvasRenderingContext2D, world: GameWorld) {
  const player = world.player;
  const allModules = [
    ...player.modules.weapon,
    ...player.modules.utility,
    ...player.modules.defense
  ];
  const activeSalvagerRuntime = allModules.find((m) => m.moduleId && m.active && moduleById[m.moduleId]?.kind === "salvager");
  if (!activeSalvagerRuntime?.moduleId) return;
  if (world.activeTarget?.type !== "wreck") return;

  const moduleDef = moduleById[activeSalvagerRuntime.moduleId];
  if (!moduleDef?.range) return;

  const sector = world.sectors[world.currentSectorId];
  const targetWreck = sector.wrecks.find((wreck) => wreck.id === world.activeTarget?.id);
  if (!targetWreck) return;
  if (distance(player.position, targetWreck.position) > moduleDef.range) return;

  drawStraightBeam(ctx, player.position, targetWreck.position, SALVAGE_BEAM_STYLE, world.elapsedTime);
}

export function renderSector(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  world: GameWorld,
  zoom: number,
  cameraOffset: Vec2,
  lowQuality = false
) {
  _lowQuality = lowQuality;
  const frame = getCameraFrame(world, canvas, zoom, cameraOffset);
  const { viewportWidth, viewportHeight, cameraX, cameraY, viewWidth, viewHeight } = frame;
  const sectorDef = sectorById[world.currentSectorId];
  const sector = world.sectors[world.currentSectorId];
  const playerHull = playerShipById[world.player.hullId];
  const derived = computeDerivedStats(world.player);
  const destinations = getVisibleSystemDestinations(world);

  ctx.clearRect(0, 0, viewportWidth, viewportHeight);
  drawArenaBackdrop(ctx, viewportWidth, viewportHeight, world, zoom, cameraX, cameraY);

  if (sector.playerHitFlash && sector.playerHitFlash > 0) {
    const flashAlpha = Math.min(0.45, sector.playerHitFlash * 2.2);
    ctx.save();
    ctx.fillStyle = `rgba(255, 28, 28, ${flashAlpha})`;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    ctx.restore();
  }

  if (world.player.navigation.mode === "warping" && !lowQuality) {
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

  const shakeAmt = sector.cameraShake ?? 0;
  const shakeX = shakeAmt > 0 ? Math.sin(world.elapsedTime * 74) * shakeAmt : 0;
  const shakeY = shakeAmt > 0 ? Math.cos(world.elapsedTime * 67) * shakeAmt : 0;

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-(cameraX + shakeX), -(cameraY + shakeY));

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
        const tint =
          entry.anomalyField.tint ??
          (entry.anomalyField.effect === "pull"
            ? "#c8a6ff"
            : entry.anomalyField.effect === "push"
              ? "#ff9a74"
              : entry.anomalyField.effect === "drag"
                ? "#8cd6c1"
                : entry.anomalyField.effect === "ion"
                  ? "#8fd7ff"
                  : "#a9ffcf");
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
          const angle =
            world.elapsedTime *
              (entry.anomalyField.effect === "pull"
                ? -0.45
                : entry.anomalyField.effect === "drag"
                  ? 0.18
                  : entry.anomalyField.effect === "ion"
                    ? 0.9
                    : 0.52) +
            seed;
          const orbit = radius * (0.24 + ((index * 17) % 9) * 0.065);
          const x = Math.cos(angle) * orbit;
          const y = Math.sin(angle) * orbit;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle * 1.8);
          ctx.fillStyle =
            entry.anomalyField.effect === "pull"
              ? "rgba(215, 187, 255, 0.48)"
              : entry.anomalyField.effect === "drag"
                ? "rgba(140, 214, 193, 0.42)"
                : entry.anomalyField.effect === "ion"
                  ? "rgba(143, 215, 255, 0.46)"
                  : entry.anomalyField.effect === "slipstream"
                    ? "rgba(169, 255, 207, 0.4)"
                    : "rgba(255, 166, 120, 0.46)";
          ctx.fillRect(-2.5, -1.2, 5, 2.4);
          ctx.restore();
        }
        ctx.restore();
      }
      const stroke =
        entry.kind === "anomaly"
          ? entry.anomalyField?.tint ??
            (entry.anomalyField?.effect === "pull"
              ? "#c8a6ff"
              : entry.anomalyField?.effect === "push"
                ? "#ff9a74"
                : entry.anomalyField?.effect === "drag"
                  ? "#8cd6c1"
                  : entry.anomalyField?.effect === "ion"
                    ? "#8fd7ff"
                    : "#a9ffcf")
          : entry.kind === "wreck"
            ? "#d5c7a1"
            : "#8de6ff";
      const fill =
        entry.kind === "anomaly"
          ? entry.anomalyField?.effect === "pull"
            ? "rgba(200, 166, 255, 0.22)"
            : entry.anomalyField?.effect === "drag"
              ? "rgba(140, 214, 193, 0.2)"
              : entry.anomalyField?.effect === "ion"
                ? "rgba(143, 215, 255, 0.2)"
                : entry.anomalyField?.effect === "slipstream"
                  ? "rgba(169, 255, 207, 0.18)"
                  : "rgba(255, 116, 116, 0.26)"
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
    const isMissile = projectile.moduleId.includes("missile");
    const color =
      isMissile
        ? "#ffb265"
        : projectile.owner === "player"
          ? "#6feeff"
          : "#ff846f";
    const trailLen = isMissile ? 0.075 : 0.055;
    const lineW = isMissile ? 3.2 : projectile.moduleId.includes("rail") ? 2.8 : 2.2;
    // Outer glow pass
    setGlow(ctx, color, 20);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW + 1.5;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(projectile.position.x, projectile.position.y);
    ctx.lineTo(
      projectile.position.x - projectile.velocity.x * trailLen,
      projectile.position.y - projectile.velocity.y * trailLen
    );
    ctx.stroke();
    // Bright core
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = lineW * 0.45;
    ctx.beginPath();
    ctx.moveTo(projectile.position.x, projectile.position.y);
    ctx.lineTo(
      projectile.position.x - projectile.velocity.x * trailLen * 0.45,
      projectile.position.y - projectile.velocity.y * trailLen * 0.45
    );
    ctx.stroke();
    // Colored trail
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(
      projectile.position.x - projectile.velocity.x * trailLen * 0.45,
      projectile.position.y - projectile.velocity.y * trailLen * 0.45
    );
    ctx.lineTo(
      projectile.position.x - projectile.velocity.x * trailLen,
      projectile.position.y - projectile.velocity.y * trailLen
    );
    ctx.stroke();
    drawDiamond(ctx, projectile.position.x, projectile.position.y, projectile.radius + 2, color, "rgba(255,255,255,0.18)");
    clearGlow(ctx);
    ctx.globalAlpha = 1;
  });

  drawMiningBeam(ctx, world);
  drawSalvageBeam(ctx, world);

  sector.enemies.forEach((enemy, index) => {
    const variant = enemyVariantById[enemy.variantId];
    ctx.save();
    ctx.translate(enemy.position.x, enemy.position.y);
    ctx.rotate(enemy.rotation);
    setGlow(ctx, variant.color, 16);
    drawShipShape(ctx, variant.silhouette, "rgba(255, 96, 96, 0.18)", variant.color);
    clearGlow(ctx);
    ctx.restore();

    if (!lowQuality) drawEnergyArc(ctx, enemy.position.x, enemy.position.y, 28 + (index % 3) * 2, "rgba(255, 120, 102, 0.72)", world.elapsedTime + index);

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

  if (!lowQuality) {
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
  }

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
  ctx.fillText(`Site: ${world.localSite.label}`, 30, viewportHeight - 36);

  ctx.restore();
}
