import * as THREE from "three";
import { LANE_CENTERS, ROAD_HALF_WIDTH } from "./track.js";

const LIGHT = [98, 104, 116];
const DARK = [10, 11, 14];
const WHEEL_TRACK_OFFSET = 0.85;
const WHEEL_TRACK_HALF_WIDTH = 0.3;

function rgba(color, alpha) {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext("2d") };
}

function scatter(count, make) {
  return Array.from({ length: count }, make);
}

function fillGrain(ctx, width, height, rng, options) {
  const { base, spread, lightChance, lightBoost, darkChance, darkDrop } = options;
  const image = ctx.createImageData(width, height);
  const data = image.data;
  let bits = Math.floor(rng() * 4294967295) + 1;
  for (let i = 0; i < data.length; i += 4) {
    bits ^= bits << 13;
    bits ^= bits >>> 17;
    bits ^= bits << 5;
    let shift = (((bits & 255) + ((bits >>> 8) & 255)) / 255 - 1) * spread;
    const roll = ((bits >>> 16) & 255) / 255;
    const strength = 0.4 + (((bits >>> 24) & 255) / 255) * 0.6;
    if (roll < lightChance) {
      shift += lightBoost * strength;
    } else if (roll > 1 - darkChance) {
      shift -= darkDrop * strength;
    }
    data[i] = base[0] + shift;
    data[i + 1] = base[1] + shift;
    data[i + 2] = base[2] + shift * 1.05;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

function wrapped(ctx, width, height, wrapX, wrapY, draw) {
  const xs = wrapX ? [-width, 0, width] : [0];
  const ys = wrapY ? [-height, 0, height] : [0];
  xs.forEach((dx) => {
    ys.forEach((dy) => {
      ctx.save();
      ctx.translate(dx, dy);
      draw();
      ctx.restore();
    });
  });
}

function paintBlob(ctx, blob) {
  const gradient = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.radius);
  gradient.addColorStop(0, rgba(blob.color, blob.alpha));
  gradient.addColorStop(1, rgba(blob.color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(blob.x - blob.radius, blob.y - blob.radius, blob.radius * 2, blob.radius * 2);
}

function paintDot(ctx, dot) {
  ctx.fillStyle = rgba(dot.color, dot.alpha);
  ctx.beginPath();
  ctx.ellipse(dot.x, dot.y, dot.radius, dot.radius * dot.squash, dot.angle, 0, Math.PI * 2);
  ctx.fill();
}

function makeBlobs(rng, count, width, height, minRadius, maxRadius, lightColor, darkColor, minAlpha, maxAlpha) {
  return scatter(count, () => ({
    x: rng() * width,
    y: rng() * height,
    radius: minRadius + rng() * (maxRadius - minRadius),
    color: rng() < 0.5 ? lightColor : darkColor,
    alpha: minAlpha + rng() * (maxAlpha - minAlpha)
  }));
}

function makeDots(rng, count, width, height, minRadius, maxRadius, lightColor, darkColor, minAlpha, maxAlpha) {
  return scatter(count, () => ({
    x: rng() * width,
    y: rng() * height,
    radius: minRadius + rng() * (maxRadius - minRadius),
    squash: 0.5 + rng() * 0.5,
    angle: rng() * Math.PI,
    color: rng() < 0.5 ? lightColor : darkColor,
    alpha: minAlpha + rng() * (maxAlpha - minAlpha)
  }));
}

function buildCrack(rng, x, y, heading, steps, stepLength, lineWidth, list, depth) {
  const points = [{ x, y }];
  let cx = x;
  let cy = y;
  let angle = heading;
  for (let i = 0; i < steps; i += 1) {
    angle += (rng() - 0.5) * 0.3;
    cx += Math.cos(angle) * stepLength * (0.6 + rng() * 0.8);
    cy += Math.sin(angle) * stepLength * (0.6 + rng() * 0.8);
    points.push({ x: cx, y: cy });
    if (depth < 1 && rng() < 0.03) {
      const turn = (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.6);
      buildCrack(rng, cx, cy, angle + turn, Math.floor(steps * 0.4), stepLength, lineWidth * 0.6, list, depth + 1);
    }
  }
  list.push({ points, lineWidth });
}

function paintCracks(ctx, cracks, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  cracks.forEach((crack) => {
    ctx.lineWidth = crack.lineWidth;
    ctx.beginPath();
    crack.points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
  });
}

function paintAsphalt() {
  const rng = createRng(1187);
  const width = 1024;
  const height = 2048;
  const { canvas, ctx } = makeCanvas(width, height);
  const roadWidth = ROAD_HALF_WIDTH * 2;

  fillGrain(ctx, width, height, rng, {
    base: [36, 39, 46],
    spread: 11,
    lightChance: 0.05,
    lightBoost: 58,
    darkChance: 0.04,
    darkDrop: 22
  });

  const blotches = makeBlobs(rng, 120, width, height, 50, 260, LIGHT, DARK, 0.05, 0.13);
  const aggregate = makeDots(rng, 900, width, height, 1, 2.6, LIGHT, DARK, 0.35, 0.65);
  wrapped(ctx, width, height, false, true, () => {
    blotches.forEach((blob) => paintBlob(ctx, blob));
    aggregate.forEach((dot) => paintDot(ctx, dot));
  });

  const trackHalf = (WHEEL_TRACK_HALF_WIDTH / roadWidth) * width;
  LANE_CENTERS.forEach((center) => {
    [-WHEEL_TRACK_OFFSET, WHEEL_TRACK_OFFSET].forEach((offset) => {
      const x = ((center + offset + ROAD_HALF_WIDTH) / roadWidth) * width;
      const gradient = ctx.createLinearGradient(x - trackHalf, 0, x + trackHalf, 0);
      gradient.addColorStop(0, rgba(DARK, 0));
      gradient.addColorStop(0.5, rgba(DARK, 0.3));
      gradient.addColorStop(1, rgba(DARK, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(x - trackHalf, 0, trackHalf * 2, height);
    });
  });

  const stains = scatter(18, () => {
    const lane = LANE_CENTERS[Math.floor(rng() * LANE_CENTERS.length)];
    const side = rng() < 0.5 ? -WHEEL_TRACK_OFFSET : WHEEL_TRACK_OFFSET;
    return {
      x: ((lane + side + ROAD_HALF_WIDTH) / roadWidth) * width + (rng() - 0.5) * 20,
      y: rng() * height,
      radius: 14 + rng() * 36,
      color: DARK,
      alpha: 0.35
    };
  });
  wrapped(ctx, width, height, false, true, () => stains.forEach((blob) => paintBlob(ctx, blob)));

  const patches = scatter(6, () => ({
    x: rng() * (width - 300),
    y: rng() * height,
    w: 120 + rng() * 180,
    h: 200 + rng() * 420
  }));
  wrapped(ctx, width, height, false, true, () => {
    patches.forEach((patch) => {
      ctx.fillStyle = rgba([24, 26, 31], 0.24);
      ctx.fillRect(patch.x, patch.y, patch.w, patch.h);
      ctx.strokeStyle = rgba(LIGHT, 0.14);
      ctx.lineWidth = 2;
      ctx.strokeRect(patch.x, patch.y, patch.w, patch.h);
    });
  });

  const cracks = [];
  for (let i = 0; i < 9; i += 1) {
    const along = rng() < 0.6;
    const heading = along ? Math.PI / 2 + (rng() - 0.5) * 0.5 : (rng() - 0.5) * 0.4;
    buildCrack(rng, rng() * width, rng() * height, heading, 25 + Math.floor(rng() * 40), 8, 1.1 + rng() * 1.1, cracks, 0);
  }
  wrapped(ctx, width, height, false, true, () => paintCracks(ctx, cracks, rgba([6, 6, 8], 0.85)));

  const edgeWidth = width * 0.06;
  const left = ctx.createLinearGradient(0, 0, edgeWidth, 0);
  left.addColorStop(0, rgba(DARK, 0.35));
  left.addColorStop(1, rgba(DARK, 0));
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, edgeWidth, height);
  const right = ctx.createLinearGradient(width, 0, width - edgeWidth, 0);
  right.addColorStop(0, rgba(DARK, 0.35));
  right.addColorStop(1, rgba(DARK, 0));
  ctx.fillStyle = right;
  ctx.fillRect(width - edgeWidth, 0, edgeWidth, height);

  return canvas;
}

function paintGravel() {
  const rng = createRng(4421);
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);

  fillGrain(ctx, size, size, rng, {
    base: [46, 49, 57],
    spread: 16,
    lightChance: 0.08,
    lightBoost: 45,
    darkChance: 0.07,
    darkDrop: 24
  });

  const blotches = makeBlobs(rng, 12, size, size, 30, 90, LIGHT, DARK, 0.05, 0.1);
  const stones = makeDots(rng, 90, size, size, 1.5, 4.5, LIGHT, DARK, 0.4, 0.7);
  wrapped(ctx, size, size, true, true, () => {
    blotches.forEach((blob) => paintBlob(ctx, blob));
    stones.forEach((dot) => paintDot(ctx, dot));
  });

  return canvas;
}

function paintGround() {
  const rng = createRng(9013);
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);

  fillGrain(ctx, size, size, rng, {
    base: [17, 21, 29],
    spread: 6,
    lightChance: 0.04,
    lightBoost: 18,
    darkChance: 0.04,
    darkDrop: 8
  });

  const blotches = makeBlobs(rng, 70, size, size, 40, 170, [34, 42, 54], [8, 10, 14], 0.06, 0.14);
  const pebbles = makeDots(rng, 420, size, size, 1, 3, [40, 46, 58], [6, 8, 11], 0.35, 0.6);
  wrapped(ctx, size, size, true, true, () => {
    blotches.forEach((blob) => paintBlob(ctx, blob));
    pebbles.forEach((dot) => paintDot(ctx, dot));
  });

  return canvas;
}

function paintRock() {
  const rng = createRng(7351);
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);

  fillGrain(ctx, size, size, rng, {
    base: [27, 34, 54],
    spread: 7,
    lightChance: 0.05,
    lightBoost: 22,
    darkChance: 0.05,
    darkDrop: 10
  });

  const strata = scatter(26, () => ({
    y: rng() * size,
    lineWidth: 1.5 + rng() * 3.5,
    color: rng() < 0.5 ? [70, 82, 118] : [8, 10, 18],
    alpha: 0.1 + rng() * 0.12,
    wobble: scatter(size / 16 + 1, () => (rng() - 0.5) * 8)
  }));
  const blotches = makeBlobs(rng, 14, size, size, 30, 90, [60, 72, 104], [8, 10, 18], 0.06, 0.12);
  wrapped(ctx, size, size, true, true, () => {
    blotches.forEach((blob) => paintBlob(ctx, blob));
    strata.forEach((line) => {
      ctx.strokeStyle = rgba(line.color, line.alpha);
      ctx.lineWidth = line.lineWidth;
      ctx.beginPath();
      line.wobble.forEach((offset, index) => {
        if (index === 0) {
          ctx.moveTo(0, line.y + offset);
        } else {
          ctx.lineTo(index * 16, line.y + offset);
        }
      });
      ctx.stroke();
    });
  });

  return canvas;
}

function paintWear() {
  const rng = createRng(2609);
  const width = 32;
  const height = 512;
  const { canvas, ctx } = makeCanvas(width, height);

  fillGrain(ctx, width, height, rng, {
    base: [233, 236, 243],
    spread: 5,
    lightChance: 0.02,
    lightBoost: 12,
    darkChance: 0.05,
    darkDrop: 30
  });

  const chips = scatter(90, () => ({
    x: rng() * width,
    y: rng() * height,
    w: 2 + rng() * 8,
    h: 3 + rng() * 15,
    alpha: 0.5 + rng() * 0.4
  }));
  wrapped(ctx, width, height, false, true, () => {
    chips.forEach((chip) => {
      ctx.fillStyle = rgba([148, 152, 162], chip.alpha);
      ctx.fillRect(chip.x, chip.y, chip.w, chip.h);
    });
  });

  const edge = width * 0.22;
  const left = ctx.createLinearGradient(0, 0, edge, 0);
  left.addColorStop(0, rgba([110, 114, 124], 0.4));
  left.addColorStop(1, rgba([110, 114, 124], 0));
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, edge, height);
  const right = ctx.createLinearGradient(width, 0, width - edge, 0);
  right.addColorStop(0, rgba([110, 114, 124], 0.4));
  right.addColorStop(1, rgba([110, 114, 124], 0));
  ctx.fillStyle = right;
  ctx.fillRect(width - edge, 0, edge, height);

  return canvas;
}

function toTexture(canvas, repeatX, repeatY, anisotropy) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.repeat.set(repeatX, repeatY);
  return texture;
}

export function createSurfaceTextures(renderer, sizes) {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const result = {};

  if (sizes.asphalt) {
    const { width, height } = sizes.asphalt;
    result.asphalt = {
      texture: toTexture(paintAsphalt(), 1, height / (width * 2), anisotropy),
      scrollLength: width * 2
    };
  }

  if (sizes.shoulder) {
    const { width, height } = sizes.shoulder;
    result.shoulder = {
      texture: toTexture(paintGravel(), 1, height / width, anisotropy),
      scrollLength: width
    };
  }

  if (sizes.dash || sizes.edge) {
    const wear = paintWear();
    const tile = sizes.dash ? sizes.dash.height : 4.4;
    if (sizes.dash) {
      result.dash = { texture: toTexture(wear, 1, 1, anisotropy), scrollLength: 0 };
    }
    if (sizes.edge) {
      result.edge = {
        texture: toTexture(wear, 1, sizes.edge.height / tile, anisotropy),
        scrollLength: tile
      };
    }
  }

  if (sizes.ground) {
    const tile = 16;
    result.ground = {
      texture: toTexture(paintGround(), sizes.ground.width / tile, sizes.ground.height / tile, anisotropy),
      scrollLength: tile
    };
  }

  result.ridge = { texture: toTexture(paintRock(), 3, 1, anisotropy), scrollLength: 0 };

  return result;
}
