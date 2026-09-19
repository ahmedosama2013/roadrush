import * as THREE from "three";

export const CAR_HALF_WIDTH = 0.95;
export const CAR_HALF_LENGTH = 2.1;

const GEOMETRY = {
  wheel: new THREE.CylinderGeometry(0.42, 0.42, 0.34, 16),
  chassis: new THREE.BoxGeometry(1.9, 0.56, 4.2),
  skirt: new THREE.BoxGeometry(1.98, 0.26, 3.6),
  cabin: new THREE.BoxGeometry(1.56, 0.52, 2.1),
  windshield: new THREE.BoxGeometry(1.46, 0.42, 2.16),
  spoiler: new THREE.BoxGeometry(1.7, 0.1, 0.42),
  lamp: new THREE.BoxGeometry(0.42, 0.14, 0.1)
};

const WHEEL_MATERIAL = new THREE.MeshStandardMaterial({ color: "#0c0d11", roughness: 0.85 });
const GLASS_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#0f1723",
  roughness: 0.12,
  metalness: 0.5,
  transparent: true,
  opacity: 0.92
});

const paintCache = new Map();
const trimCache = new Map();
const lampCache = new Map();

function cached(store, key, build) {
  if (!store.has(key)) {
    store.set(key, build());
  }
  return store.get(key);
}

function paintMaterial(color) {
  return cached(paintCache, color, () =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.62 })
  );
}

function trimMaterial(color) {
  return cached(trimCache, color, () =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.4 })
  );
}

function lampMaterialFor(color) {
  return cached(lampCache, color, () =>
    new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 1.6,
      roughness: 0.3
    })
  );
}

function wheel(x, z, castShadow) {
  const mesh = new THREE.Mesh(GEOMETRY.wheel, WHEEL_MATERIAL);
  mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, 0.42, z);
  mesh.castShadow = castShadow;
  return mesh;
}

export function buildCarMesh(options) {
  const paint = paintMaterial(options.body);
  const trim = trimMaterial(options.trim);
  const detailedShadows = options.shadows === "full";

  const car = new THREE.Group();

  const chassis = new THREE.Mesh(GEOMETRY.chassis, paint);
  chassis.position.y = 0.72;
  chassis.castShadow = true;
  car.add(chassis);

  const skirt = new THREE.Mesh(GEOMETRY.skirt, trim);
  skirt.position.y = 0.46;
  car.add(skirt);

  const cabin = new THREE.Mesh(GEOMETRY.cabin, paint);
  cabin.position.set(0, 1.22, -0.12);
  cabin.castShadow = detailedShadows;
  car.add(cabin);

  const windshield = new THREE.Mesh(GEOMETRY.windshield, GLASS_MATERIAL);
  windshield.position.set(0, 1.24, -0.1);
  car.add(windshield);

  const spoiler = new THREE.Mesh(GEOMETRY.spoiler, trim);
  spoiler.position.set(0, 1.12, 1.94);
  car.add(spoiler);

  const wheels = [
    wheel(-0.96, -1.32, detailedShadows),
    wheel(0.96, -1.32, detailedShadows),
    wheel(-0.96, 1.42, detailedShadows),
    wheel(0.96, 1.42, detailedShadows)
  ];
  wheels.forEach((item) => car.add(item));

  const lampMaterial = lampMaterialFor(options.lamp);
  const lampZ = options.facing === "away" ? 2.12 : -2.12;
  const lampLeft = new THREE.Mesh(GEOMETRY.lamp, lampMaterial);
  lampLeft.position.set(-0.6, 0.82, lampZ);
  const lampRight = lampLeft.clone();
  lampRight.position.x = 0.6;
  car.add(lampLeft, lampRight);

  return { group: car, wheels, lampMaterial, paint };
}

export function createPlayerCar(scene) {
  const built = buildCarMesh({
    body: "#f4f6fb",
    trim: "#1b2030",
    lamp: "#fff2c4",
    facing: "forward",
    shadows: "full"
  });
  const car = built.group;

  const glowGeometry = new THREE.BoxGeometry(0.5, 0.16, 0.1);
  const brakeMaterial = new THREE.MeshStandardMaterial({
    color: "#ff3b4a",
    emissive: new THREE.Color("#ff2436"),
    emissiveIntensity: 0.9
  });
  const brakeLeft = new THREE.Mesh(glowGeometry, brakeMaterial);
  brakeLeft.position.set(-0.62, 0.86, 2.12);
  const brakeRight = brakeLeft.clone();
  brakeRight.position.x = 0.62;
  car.add(brakeLeft, brakeRight);

  const headlight = new THREE.SpotLight("#ffe6b0", 4.2, 90, 0.42, 0.5, 1.2);
  headlight.position.set(0, 1.1, -2);
  headlight.target.position.set(0, 0, -40);
  car.add(headlight, headlight.target);

  scene.add(car);

  return {
    group: car,
    wheels: built.wheels,
    brakeMaterial,
    x: 0,
    vx: 0,
    speed: 0,
    tilt: 0
  };
}

export function resetPlayerCar(player) {
  player.x = 0;
  player.vx = 0;
  player.speed = 0;
  player.tilt = 0;
  player.group.position.set(0, 0, 0);
  player.group.rotation.set(0, 0, 0);
}

const ACCELERATION = 16; // speed units per second while W is held
const COAST_DECEL = 5; // gentle slow-down when no key is held
const BRAKE_DECEL = 44; // S key
const FULL_STEER_SPEED = 12; // below this the car steers less (none at a standstill)

export function updatePlayerCar(player, input, dt, limits) {
  if (input.brake) {
    player.speed -= BRAKE_DECEL * dt;
  } else if (input.accelerate) {
    player.speed += ACCELERATION * dt;
  } else {
    player.speed -= COAST_DECEL * dt;
  }
  player.speed = THREE.MathUtils.clamp(player.speed, 0, limits.max);

  const steer = input.right - input.left;
  const steerAuthority = THREE.MathUtils.clamp(player.speed / FULL_STEER_SPEED, 0, 1);
  const grip = 26;
  const drag = 7.5;

  player.vx += steer * steerAuthority * grip * dt;
  player.vx -= player.vx * drag * dt;
  player.vx = THREE.MathUtils.clamp(player.vx, -16, 16);
  player.x += player.vx * dt;

  if (player.x < -limits.edge) {
    player.x = -limits.edge;
    player.vx *= -0.28;
  }
  if (player.x > limits.edge) {
    player.x = limits.edge;
    player.vx *= -0.28;
  }

  player.tilt += (-player.vx * 0.035 - player.tilt) * Math.min(1, 8 * dt);

  player.group.position.x = player.x;
  player.group.position.y = Math.sin(performance.now() * 0.006) * 0.015;
  player.group.rotation.z = player.tilt;
  player.group.rotation.y = -player.vx * 0.018;

  const spin = player.speed * dt * 2.4;
  player.wheels.forEach((item) => {
    item.rotation.x -= spin;
  });

  player.brakeMaterial.emissiveIntensity = input.brake ? 3.4 : 0.9;
}
