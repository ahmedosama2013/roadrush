import * as THREE from "three";
import { createWorld, shakeCamera } from "./scene.js";
import { createPlayerCar, resetPlayerCar, updatePlayerCar, CAR_HALF_LENGTH, CAR_HALF_WIDTH } from "./car.js";
import { createTrack, ROAD_HALF_WIDTH } from "./track.js";
import { createInput } from "./input.js";
import { createGraphics } from "./graphics.js";

const SPEED_TO_KMH = 2.6;
const BASE_TOP_SPEED = 52;
const MAX_TOP_SPEED = 104;

function formatNumber(value) {
  return (Math.round(value) || 0).toLocaleString("en-US");
}

function currentLimits(difficulty) {
  return {
    max: Math.min(MAX_TOP_SPEED, BASE_TOP_SPEED + difficulty * 9),
    edge: ROAD_HALF_WIDTH - CAR_HALF_WIDTH - 0.2
  };
}

function createLane(canvas, layout, hud) {
  const world = createWorld(canvas, { sizeMode: "element" });
  const player = createPlayerCar(world.scene);
  const track = createTrack(world.scene);
  const graphics = createGraphics({ world });

  const input = createInput(
    {
      togglePause: () => {},
      confirm: () => {}
    },
    { layout, enableTouch: false, enableGlobalKeys: false }
  );

  const state = {
    distance: 0,
    score: 0,
    topSpeed: 0,
    spawnTimer: 0.6,
    difficulty: 0,
    shake: 0,
    crashed: false,
    active: false
  };

  function updateHud() {
    hud.score.textContent = formatNumber(state.score);
    hud.speed.textContent = formatNumber(player.speed * SPEED_TO_KMH);
  }

  function start() {
    state.distance = 0;
    state.score = 0;
    state.topSpeed = 0;
    state.spawnTimer = 0.6;
    state.difficulty = 0;
    state.shake = 0;
    state.crashed = false;
    state.active = true;
    track.reset();
    resetPlayerCar(player);
    input.releaseAll();
    world.resize();
    updateHud();
  }

  function stop() {
    state.active = false;
    input.releaseAll();
  }

  function detectContacts() {
    const px = player.x;
    for (const car of track.traffic) {
      if (!car.active) {
        continue;
      }
      const dx = Math.abs(car.group.position.x - px);
      const dz = Math.abs(car.group.position.z);
      if (dx < CAR_HALF_WIDTH * 1.85 && dz < CAR_HALF_LENGTH * 1.9) {
        state.shake = 1;
        state.crashed = true;
        state.active = false;
        return;
      }
    }
  }

  function updateCamera(dt) {
    const target = player.x * 0.62;
    world.camera.position.x += (target - world.camera.position.x) * Math.min(1, 4.4 * dt);
    world.camera.position.y += (4.6 - world.camera.position.y) * Math.min(1, 6 * dt);

    const speedRatio = THREE.MathUtils.clamp(player.speed / MAX_TOP_SPEED, 0, 1);
    const targetFov = 62 + speedRatio * 10;
    world.camera.fov += (targetFov - world.camera.fov) * Math.min(1, 5 * dt);
    world.camera.updateProjectionMatrix();
    world.camera.lookAt(player.x * 0.35, 1.5, -22);

    if (state.shake > 0.001) {
      shakeCamera(world.camera, state.shake * 0.7);
      state.shake *= 1 - Math.min(1, 4 * dt);
    }
  }

  function step(dt) {
    const limits = currentLimits(state.difficulty);
    updatePlayerCar(player, input.state, dt, limits);

    const travelled = player.speed * dt;
    state.difficulty += travelled * 0.00105;
    state.distance += travelled;
    state.score += travelled * 1.6;
    state.topSpeed = Math.max(state.topSpeed, player.speed);

    track.update(dt, player.speed);
    graphics.scroll(travelled);

    state.spawnTimer -= dt * Math.min(1, player.speed / BASE_TOP_SPEED);
    if (state.spawnTimer <= 0) {
      track.spawn(state.difficulty, limits.max);
      state.spawnTimer = Math.max(0.42, 1.5 - state.difficulty * 0.16) * (0.75 + Math.random() * 0.6);
    }

    detectContacts();
  }

  function frame(dt) {
    if (state.active) {
      step(dt);
      updateCamera(dt);
      updateHud();
    }
    world.renderer.render(world.scene, world.camera);
  }

  return { state, start, stop, frame, resize: world.resize };
}

export function createMultiplayer(dom, onFinish) {
  const laneP1 = createLane(dom.canvasP1, "wasd", dom.hudP1);
  const laneP2 = createLane(dom.canvasP2, "arrows", dom.hudP2);

  let running = false;
  let previous = 0;

  function finish() {
    running = false;
    laneP1.stop();
    laneP2.stop();
    const winner = laneP1.state.crashed ? "Player 2" : "Player 1";
    onFinish({
      winner,
      p1Score: laneP1.state.score,
      p2Score: laneP2.state.score
    });
  }

  function frame(now) {
    if (!running) {
      return;
    }
    const dt = Math.min(0.048, (now - previous) / 1000);
    previous = now;

    laneP1.frame(dt);
    laneP2.frame(dt);

    if (laneP1.state.crashed || laneP2.state.crashed) {
      finish();
      return;
    }

    window.requestAnimationFrame(frame);
  }

  return {
    start() {
      running = true;
      laneP1.resize();
      laneP2.resize();
      laneP1.start();
      laneP2.start();
      previous = performance.now();
      window.requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      laneP1.stop();
      laneP2.stop();
    }
  };
}