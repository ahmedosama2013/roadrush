import * as THREE from "three";
import { createWorld, shakeCamera } from "./scene.js";
import { createPlayerCar, resetPlayerCar, updatePlayerCar, CAR_HALF_LENGTH, CAR_HALF_WIDTH } from "./car.js";
import { createTrack, ROAD_HALF_WIDTH } from "./track.js";
import { createInput } from "./input.js";

const STORAGE_KEY = "roadrush.best";
const SPEED_TO_KMH = 2.6;
const BASE_TOP_SPEED = 52;
const MAX_TOP_SPEED = 104;

const dom = {
  hud: document.getElementById("hud"),
  distance: document.getElementById("hud-distance"),
  score: document.getElementById("hud-score"),
  best: document.getElementById("hud-best"),
  speed: document.getElementById("hud-speed"),
  speedFill: document.getElementById("speedo-fill"),
  touch: document.getElementById("touch-controls"),
  startBest: document.getElementById("start-best"),
  screens: {
    start: document.getElementById("screen-start"),
    pause: document.getElementById("screen-pause"),
    over: document.getElementById("screen-over"),
    credits: document.getElementById("screen-credits")
  },
  over: {
    eyebrow: document.getElementById("over-eyebrow"),
    title: document.getElementById("over-title"),
    distance: document.getElementById("over-distance"),
    score: document.getElementById("over-score"),
    speed: document.getElementById("over-speed")
  }
};

const world = createWorld(document.getElementById("stage"));
const player = createPlayerCar(world.scene);
const track = createTrack(world.scene);

const run = {
  mode: "menu",
  distance: 0,
  score: 0,
  topSpeed: 0,
  spawnTimer: 0,
  difficulty: 0,
  shake: 0
};

let best = readBest();

function readBest() {
  const stored = Number(window.localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(stored) ? stored : 0;
}

function writeBest(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.round(value)));
  } catch (error) {
    console.warn("RoadRush could not save your best run", error);
  }
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("en-US");
}

const input = createInput({
  togglePause: () => {
    if (run.mode === "driving") {
      pause();
    } else if (run.mode === "paused") {
      resume();
    }
  },
  confirm: () => {
    if (run.mode === "menu" || run.mode === "over") {
      startRun();
    } else if (run.mode === "paused") {
      resume();
    }
  }
});

function showScreen(name) {
  Object.entries(dom.screens).forEach(([key, element]) => {
    element.dataset.state = key === name ? "visible" : "hidden";
  });
}

function setHudVisible(visible) {
  dom.hud.dataset.state = visible ? "visible" : "hidden";
  dom.touch.dataset.state = visible && input.state.usingTouch ? "visible" : "hidden";
  dom.touch.setAttribute("aria-hidden", visible ? "false" : "true");
  document.body.classList.toggle("is-driving", visible);
}

function currentLimits() {
  return {
    max: Math.min(MAX_TOP_SPEED, BASE_TOP_SPEED + run.difficulty * 9),
    edge: ROAD_HALF_WIDTH - CAR_HALF_WIDTH - 0.2
  };
}

function startRun() {
  run.mode = "driving";
  run.distance = 0;
  run.score = 0;
  run.topSpeed = 0;
  run.spawnTimer = 0.6;
  run.difficulty = 0;
  run.shake = 0;

  track.reset();
  resetPlayerCar(player);
  input.releaseAll();
  showScreen("none");
  setHudVisible(true);
  updateHud();
}

function pause() {
  run.mode = "paused";
  input.releaseAll();
  showScreen("pause");
}

function resume() {
  run.mode = "driving";
  showScreen("none");
}

function endRun(crashed) {
  run.mode = "over";
  input.releaseAll();
  setHudVisible(false);

  const record = run.score > best;
  if (record) {
    best = run.score;
    writeBest(best);
  }

  dom.over.eyebrow.textContent = record ? "New record" : "Run ended";
  if (record) {
    dom.over.title.textContent = "That is your best drive!";
  } else {
    dom.over.title.textContent = crashed ? "You crashed." : "Run Ended";
  }
  dom.over.distance.textContent = `${formatNumber(run.distance)} m`;
  dom.over.score.textContent = formatNumber(run.score);
  dom.over.speed.textContent = `${formatNumber(run.topSpeed * SPEED_TO_KMH)} km/h`;
  dom.startBest.textContent = formatNumber(best);
  showScreen("over");
}

function returnToMenu() {
  run.mode = "menu";
  input.releaseAll();
  setHudVisible(false);
  track.reset();
  resetPlayerCar(player);
  dom.startBest.textContent = formatNumber(best);
  showScreen("start");
}

function updateHud() {
  dom.distance.textContent = formatNumber(run.distance);
  dom.score.textContent = formatNumber(run.score);
  dom.best.textContent = formatNumber(Math.max(best, run.score));
  dom.speed.textContent = formatNumber(player.speed * SPEED_TO_KMH);
  dom.speedFill.style.width = `${THREE.MathUtils.clamp((player.speed / MAX_TOP_SPEED) * 100, 0, 100)}%`;
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
      run.shake = 1;
      endRun(true);
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

  if (run.shake > 0.001) {
    shakeCamera(world.camera, run.shake * 0.7);
    run.shake *= 1 - Math.min(1, 4 * dt);
  }
}

function step(dt) {
  const limits = currentLimits();
  updatePlayerCar(player, input.state, dt, limits);

  const travelled = player.speed * dt;
  run.difficulty += travelled * 0.00105;
  run.distance += travelled;
  run.score += travelled * 1.6;
  run.topSpeed = Math.max(run.topSpeed, player.speed);

  track.update(dt, player.speed);

  run.spawnTimer -= dt * Math.min(1, player.speed / BASE_TOP_SPEED);
  if (run.spawnTimer <= 0) {
    track.spawn(run.difficulty, limits.max);
    run.spawnTimer = Math.max(0.42, 1.5 - run.difficulty * 0.16) * (0.75 + Math.random() * 0.6);
  }

  detectContacts();
}

let previous = performance.now();
let hudTimer = 0;

function frame(now) {
  const dt = Math.min(0.048, (now - previous) / 1000);
  previous = now;

  if (run.mode === "driving") {
    step(dt);
    updateCamera(dt);
    hudTimer += dt;
    if (hudTimer > 0.06) {
      hudTimer = 0;
      updateHud();
    }
  } else if (run.mode === "menu") {
    track.update(dt, 22);
    player.group.rotation.y = Math.sin(now * 0.0004) * 0.06;
    world.camera.position.x += (Math.sin(now * 0.0002) * 1.6 - world.camera.position.x) * Math.min(1, dt);
    world.camera.lookAt(0, 1.5, -22);
  }

  world.renderer.render(world.scene, world.camera);
  window.requestAnimationFrame(frame);
}

document.getElementById("btn-play").addEventListener("click", startRun);
document.getElementById("btn-retry").addEventListener("click", startRun);
document.getElementById("btn-menu").addEventListener("click", returnToMenu);
document.getElementById("btn-pause").addEventListener("click", pause);
document.getElementById("btn-resume").addEventListener("click", resume);
document.getElementById("btn-quit").addEventListener("click", () => endRun(false));
document.getElementById("btn-credits").addEventListener("click", () => showScreen("credits"));
document.getElementById("btn-credits-close").addEventListener("click", () => showScreen("start"));

document.addEventListener("visibilitychange", () => {
  if (document.hidden && run.mode === "driving") {
    pause();
  }
});

async function warmUp() {
  track.prime();
  await world.renderer.compileAsync(world.scene, world.camera);
  world.renderer.render(world.scene, world.camera);
  world.renderer.shadowMap.needsUpdate = true;
  world.renderer.render(world.scene, world.camera);
  track.reset();
}

function markReady() {
  const button = document.getElementById("btn-play");
  button.dataset.ready = "true";
  document.getElementById("btn-play-label").textContent = "Start driving";
  if (window.roadrush.autostart) {
    startRun();
  }
}

dom.startBest.textContent = formatNumber(best);
dom.best.textContent = formatNumber(best);
showScreen("start");
setHudVisible(false);
window.requestAnimationFrame(frame);

warmUp()
  .catch((error) => {
    console.error("RoadRush could not precompile the scene", error);
    track.reset();
  })
  .finally(markReady);