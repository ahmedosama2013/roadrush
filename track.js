import * as THREE from "three";
import { buildCarMesh } from "./car.js";

export const LANE_WIDTH = 3.6;
export const LANE_CENTERS = [-5.4, -1.8, 1.8, 5.4];
export const ROAD_HALF_WIDTH = 7.2;
export const RECYCLE_Z = 26;
export const SPAWN_Z = -320;

const DASH_SPACING = 14;
const DASH_COUNT_PER_LINE = 26;
const POST_SPACING = 18;
const POST_COUNT_PER_SIDE = 22;
const LAMP_SPACING = 62;
const LAMP_COUNT_PER_SIDE = 7;
const TRAFFIC_POOL = 16;

const TRAFFIC_PAINTS = [
  { body: "#2f6df6", trim: "#16203a", lamp: "#ff4b52" },
  { body: "#e94b5a", trim: "#2a1016", lamp: "#ff4b52" },
  { body: "#f2b13c", trim: "#2b1e08", lamp: "#ff4b52" },
  { body: "#35c39a", trim: "#0e2a23", lamp: "#ff4b52" },
  { body: "#8b6bf2", trim: "#1c1533", lamp: "#ff4b52" },
  { body: "#d8dee9", trim: "#1d222c", lamp: "#ff4b52" }
];

function createRoadSurface() {
  const group = new THREE.Group();

  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, 1600),
    new THREE.MeshStandardMaterial({ color: "#191c22", roughness: 0.78, metalness: 0.08 })
  );
  asphalt.name = "asphalt";
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.z = -700;
  asphalt.receiveShadow = true;
  group.add(asphalt);

  const shoulderMaterial = new THREE.MeshStandardMaterial({ color: "#23262e", roughness: 0.95 });
  [-1, 1].forEach((side) => {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1600), shoulderMaterial);
    shoulder.name = "road-shoulder";
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(side * (ROAD_HALF_WIDTH + 1.3), -0.01, -700);
    group.add(shoulder);
  });

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: "#f3f5fa",
    emissive: new THREE.Color("#555a66"),
    emissiveIntensity: 0.25,
    roughness: 0.6
  });
  [-1, 1].forEach((side) => {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 1600), edgeMaterial);
    edge.name = "road-edge";
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(side * (ROAD_HALF_WIDTH - 0.32), 0.012, -700);
    group.add(edge);
  });

  return group;
}

function createDashField() {
  const geometry = new THREE.PlaneGeometry(0.2, 4.4);
  const material = new THREE.MeshStandardMaterial({
    color: "#e8ebf2",
    emissive: new THREE.Color("#4a4f5c"),
    emissiveIntensity: 0.3,
    roughness: 0.7
  });
  const boundaries = [-LANE_WIDTH, 0, LANE_WIDTH];
  const total = boundaries.length * DASH_COUNT_PER_LINE;
  const mesh = new THREE.InstancedMesh(geometry, material, total);
  mesh.name = "lane-dash";
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;

  const slots = [];
  let index = 0;
  boundaries.forEach((x) => {
    for (let i = 0; i < DASH_COUNT_PER_LINE; i += 1) {
      slots.push({ index, x, z: RECYCLE_Z - i * DASH_SPACING });
      index += 1;
    }
  });

  return { mesh, slots, span: DASH_COUNT_PER_LINE * DASH_SPACING };
}

function createPostField() {
  const geometry = new THREE.BoxGeometry(0.16, 1.1, 0.16);
  const material = new THREE.MeshStandardMaterial({
    color: "#9aa3b5",
    emissive: new THREE.Color("#ff9f43"),
    emissiveIntensity: 0.4,
    roughness: 0.6
  });
  const total = POST_COUNT_PER_SIDE * 2;
  const mesh = new THREE.InstancedMesh(geometry, material, total);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;

  const slots = [];
  let index = 0;
  [-1, 1].forEach((side) => {
    for (let i = 0; i < POST_COUNT_PER_SIDE; i += 1) {
      slots.push({ index, x: side * (ROAD_HALF_WIDTH + 2.4), z: RECYCLE_Z - i * POST_SPACING });
      index += 1;
    }
  });

  return { mesh, slots, span: POST_COUNT_PER_SIDE * POST_SPACING };
}

function createLamp(side) {
  const group = new THREE.Group();
  const poleMaterial = new THREE.MeshStandardMaterial({ color: "#2b303b", roughness: 0.7, metalness: 0.3 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8.4, 10), poleMaterial);
  pole.position.y = 4.2;
  group.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.16), poleMaterial);
  arm.position.set(side * -1.3, 8.3, 0);
  group.add(arm);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.22, 0.5),
    new THREE.MeshStandardMaterial({
      color: "#ffd9a0",
      emissive: new THREE.Color("#ffb055"),
      emissiveIntensity: 2.4
    })
  );
  head.position.set(side * -2.4, 8.16, 0);
  group.add(head);

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(5.2, 20),
    new THREE.MeshBasicMaterial({ color: "#ffb055", transparent: true, opacity: 0.07, depthWrite: false })
  );
  pool.name = "lamp-pool";
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(side * -3.6, 0.02, 0);
  group.add(pool);

  group.position.x = side * (ROAD_HALF_WIDTH + 4.2);
  return group;
}

function createTrafficCar() {
  const paint = TRAFFIC_PAINTS[Math.floor(Math.random() * TRAFFIC_PAINTS.length)];
  const built = buildCarMesh({ ...paint, facing: "away" });
  built.group.visible = false;
  return {
    group: built.group,
    wheels: built.wheels,
    paint: built.paint,
    lane: 0,
    speed: 0,
    active: false,
    counted: false
  };
}

export function createTrack(scene) {
  const road = createRoadSurface();
  scene.add(road);

  const dashes = createDashField();
  scene.add(dashes.mesh);

  const posts = createPostField();
  scene.add(posts.mesh);

  const lamps = [];
  [-1, 1].forEach((side) => {
    for (let i = 0; i < LAMP_COUNT_PER_SIDE; i += 1) {
      const lamp = createLamp(side);
      lamp.position.z = RECYCLE_Z - i * LAMP_SPACING - (side === 1 ? LAMP_SPACING / 2 : 0);
      scene.add(lamp);
      lamps.push(lamp);
    }
  });
  const lampSpan = LAMP_COUNT_PER_SIDE * LAMP_SPACING;

  const traffic = [];
  for (let i = 0; i < TRAFFIC_POOL; i += 1) {
    const car = createTrafficCar();
    scene.add(car.group);
    traffic.push(car);
  }

  const matrix = new THREE.Matrix4();
  const laidFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const upright = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const position = new THREE.Vector3();

  function writeInstances(field, flat) {
    field.slots.forEach((slot) => {
      position.set(slot.x, flat ? 0.014 : 0.56, slot.z);
      matrix.compose(position, flat ? laidFlat : upright, scale);
      field.mesh.setMatrixAt(slot.index, matrix);
    });
    field.mesh.instanceMatrix.needsUpdate = true;
  }

  function advanceField(field, delta, flat) {
    field.slots.forEach((slot) => {
      slot.z += delta;
      if (slot.z > RECYCLE_Z) {
        slot.z -= field.span;
      }
    });
    writeInstances(field, flat);
  }

  function laneIsFree(lane, z, gap) {
    return !traffic.some((car) => car.active && car.lane === lane && Math.abs(car.group.position.z - z) < gap);
  }

  function spawn(difficulty, cruise) {
    const idle = traffic.find((car) => !car.active);
    if (!idle) {
      return;
    }

    const openLanes = LANE_CENTERS.map((value, index) => index).filter((lane) =>
      laneIsFree(lane, SPAWN_Z, 46)
    );
    if (openLanes.length <= 1) {
      return;
    }

    const lane = openLanes[Math.floor(Math.random() * openLanes.length)];
    idle.lane = lane;
    idle.speed = Math.min(cruise - 10, 26 + Math.random() * 22 + difficulty * 6);
    idle.active = true;
    idle.counted = false;
    idle.group.visible = true;
    idle.group.position.set(LANE_CENTERS[lane], 0, SPAWN_Z - Math.random() * 60);
    idle.group.rotation.set(0, 0, 0);
  }

  function prime() {
    traffic.forEach((car, index) => {
      car.group.visible = true;
      car.group.position.set(LANE_CENTERS[index % LANE_CENTERS.length], 0, -232 - index * 5);
    });
  }

  function reset() {
    traffic.forEach((car) => {
      car.active = false;
      car.group.visible = false;
      car.group.position.z = SPAWN_Z;
    });
  }

  function update(dt, playerSpeed) {
    const delta = playerSpeed * dt;
    advanceField(dashes, delta, true);
    advanceField(posts, delta, false);

    lamps.forEach((lamp) => {
      lamp.position.z += delta;
      if (lamp.position.z > RECYCLE_Z + 10) {
        lamp.position.z -= lampSpan;
      }
    });

    traffic.forEach((car) => {
      if (!car.active) {
        return;
      }
      const closing = playerSpeed - car.speed;
      car.group.position.z += closing * dt;
      const spin = car.speed * dt * 2.4;
      car.wheels.forEach((item) => {
        item.rotation.x -= spin;
      });
      if (car.group.position.z > RECYCLE_Z + 16 || car.group.position.z < SPAWN_Z - 140) {
        car.active = false;
        car.group.visible = false;
      }
    });
  }

  writeInstances(dashes, true);
  writeInstances(posts, false);

  return { update, spawn, reset, prime, traffic };
}
