import * as THREE from "three";

const HORIZON = new THREE.Color("#2b1c3a");
const ZENITH = new THREE.Color("#05070d");
const GLOW = new THREE.Color("#ff7a3c");

function createSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, `#${ZENITH.getHexString()}`);
  gradient.addColorStop(0.55, "#10111d");
  gradient.addColorStop(0.82, `#${HORIZON.getHexString()}`);
  gradient.addColorStop(0.95, `#${GLOW.getHexString()}`);
  gradient.addColorStop(1, "#ffb066");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSky() {
  const geometry = new THREE.SphereGeometry(900, 32, 24);
  const material = new THREE.MeshBasicMaterial({
    map: createSkyTexture(),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.rotation.y = Math.PI;
  return sky;
}

function createStars() {
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = 600 + Math.random() * 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * 0.42 * Math.PI;
    positions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    positions[i * 3 + 1] = Math.cos(phi) * radius * 0.9 + 40;
    positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: "#cfd8ff",
    size: 1.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
    fog: false
  });
  return new THREE.Points(geometry, material);
}

function createTerrain() {
  const group = new THREE.Group();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 2400),
    new THREE.MeshStandardMaterial({ color: "#0d1119", roughness: 1, metalness: 0 })
  );
  ground.name = "ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.12, -900);
  ground.receiveShadow = true;
  group.add(ground);

  const ridgeMaterial = new THREE.MeshStandardMaterial({
    color: "#141a2b",
    roughness: 1,
    metalness: 0,
    flatShading: true
  });

  for (let i = 0; i < 26; i += 1) {
    const height = 36 + Math.random() * 90;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(52 + Math.random() * 60, height, 5), ridgeMaterial);
    const side = i % 2 === 0 ? -1 : 1;
    peak.position.set(side * (150 + Math.random() * 320), height / 2 - 6, -420 - Math.random() * 900);
    peak.name = "ridge";
    peak.rotation.y = Math.random() * Math.PI;
    group.add(peak);
  }

  return group;
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: window.devicePixelRatio < 2,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#1a1426", 90, 420);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);
  camera.position.set(0, 4.6, 9.5);
  camera.lookAt(0, 1.4, -18);

  const hemi = new THREE.HemisphereLight("#8f9dff", "#141019", 0.55);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight("#cbd6ff", 0.85);
  moon.position.set(-60, 90, -40);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 10;
  moon.shadow.camera.far = 220;
  moon.shadow.camera.left = -40;
  moon.shadow.camera.right = 40;
  moon.shadow.camera.top = 40;
  moon.shadow.camera.bottom = -60;
  moon.shadow.bias = -0.0012;
  scene.add(moon);

  const sunset = new THREE.DirectionalLight("#ff8a4c", 0.6);
  sunset.position.set(20, 12, -160);
  scene.add(sunset);

  scene.add(createSky());
  scene.add(createStars());
  scene.add(createTerrain());

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener("resize", resize);

  return { renderer, scene, camera, resize };
}

export function shakeCamera(camera, amount) {
  camera.position.x += (Math.random() - 0.5) * amount;
  camera.position.y += (Math.random() - 0.5) * amount * 0.6;
}
