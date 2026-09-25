import { createSurfaceTextures } from "./textures.js";

const STORAGE_KEY = "roadrush.graphics";
const DEFAULT_LEVEL = "medium";

const PRESETS = {
  low: {
    maxPixelRatio: 1,
    shadows: false,
    shadowMapSize: 1024,
    headlight: false,
    stars: false,
    lampGlow: false,
    textures: false,
    description: "Fastest. Lower resolution, no shadows, headlight beam, stars or lamp glow."
  },
  medium: {
    maxPixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    headlight: true,
    stars: true,
    lampGlow: true,
    textures: false,
    description: "Balanced. Shadows, headlight beam, stars and lamp glow at a good resolution."
  },
  high: {
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    headlight: true,
    stars: true,
    lampGlow: true,
    textures: true,
    description: "Best looking. Textured road and ground, worn lane paint, sharper shadows, full resolution."
  }
};

export const GRAPHICS_LEVELS = Object.keys(PRESETS);

const SURFACE_BY_NAME = new Map([
  ["asphalt", "asphalt"],
  ["road-shoulder", "shoulder"],
  ["road-edge", "edge"],
  ["lane-dash", "dash"],
  ["ground", "ground"],
  ["ridge", "ridge"]
]);
const SURFACE_KEYS = Array.from(SURFACE_BY_NAME.values());
const SCROLLING_SURFACES = ["asphalt", "shoulder", "edge", "ground"];

function readSavedLevel() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return GRAPHICS_LEVELS.includes(stored) ? stored : DEFAULT_LEVEL;
  } catch (error) {
    return DEFAULT_LEVEL;
  }
}

function writeSavedLevel(level) {
  try {
    window.localStorage.setItem(STORAGE_KEY, level);
  } catch (error) {
    console.warn("RoadRush could not save your graphics setting", error);
  }
}

export function createGraphics({ world }) {
  const { renderer, scene } = world;

  let moon = null;
  let headlight = null;
  const stars = [];
  const lampGlow = [];
  const surfaces = {};
  SURFACE_KEYS.forEach((key) => {
    surfaces[key] = { meshes: [], materials: new Set() };
  });

  scene.traverse((object) => {
    if (object.isDirectionalLight && object.castShadow && !moon) {
      moon = object;
    } else if (object.isSpotLight && !headlight) {
      headlight = object;
    } else if (object.isPoints) {
      stars.push(object);
    } else if (object.name === "lamp-pool") {
      lampGlow.push(object);
    } else if (SURFACE_BY_NAME.has(object.name)) {
      const surface = surfaces[SURFACE_BY_NAME.get(object.name)];
      surface.meshes.push(object);
      surface.materials.add(object.material);
    }
  });

  const originalColors = new Map();
  let surfaceTextures = null;
  let textured = false;
  let current = DEFAULT_LEVEL;

  function planeSize(key) {
    const mesh = surfaces[key].meshes[0];
    const parameters = mesh && mesh.geometry ? mesh.geometry.parameters : null;
    return parameters ? { width: parameters.width, height: parameters.height } : null;
  }

  function setTextured(enabled) {
    if (enabled === textured) {
      return;
    }

    if (enabled && !surfaceTextures) {
      surfaceTextures = createSurfaceTextures(renderer, {
        asphalt: planeSize("asphalt"),
        shoulder: planeSize("shoulder"),
        edge: planeSize("edge"),
        dash: planeSize("dash"),
        ground: planeSize("ground")
      });
    }

    SURFACE_KEYS.forEach((key) => {
      const entry = surfaceTextures ? surfaceTextures[key] : null;
      if (!entry) {
        return;
      }
      surfaces[key].materials.forEach((material) => {
        if (enabled) {
          if (!originalColors.has(material)) {
            originalColors.set(material, material.color.clone());
          }
          material.color.set(0xffffff);
          material.map = entry.texture;
        } else {
          const original = originalColors.get(material);
          if (original) {
            material.color.copy(original);
          }
          material.map = null;
        }
        material.needsUpdate = true;
      });
      if (!enabled) {
        entry.texture.dispose();
      }
    });

    textured = enabled;
  }

  function apply(level) {
    const preset = PRESETS[level];

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.maxPixelRatio));

    if (moon) {
      moon.castShadow = preset.shadows;
      const shadow = moon.shadow;
      if (shadow.mapSize.x !== preset.shadowMapSize) {
        shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
        if (shadow.map) {
          shadow.map.dispose();
          shadow.map = null;
        }
      }
    }

    if (headlight) {
      headlight.visible = preset.headlight;
    }

    stars.forEach((item) => {
      item.visible = preset.stars;
    });

    lampGlow.forEach((item) => {
      item.visible = preset.lampGlow;
    });

    setTextured(preset.textures);

    document.documentElement.dataset.graphics = level;
    current = level;
  }

  function scroll(distance) {
    if (!textured) {
      return;
    }
    SCROLLING_SURFACES.forEach((key) => {
      const entry = surfaceTextures[key];
      if (entry && entry.scrollLength) {
        const offset = entry.texture.offset;
        offset.y = (offset.y + distance / entry.scrollLength) % 1;
      }
    });
  }

  apply(readSavedLevel());

  return {
    get level() {
      return current;
    },
    describe(level = current) {
      return PRESETS[level].description;
    },
    setQuality(level) {
      if (!GRAPHICS_LEVELS.includes(level)) {
        return;
      }
      apply(level);
      writeSavedLevel(level);
    },
    refresh() {
      apply(readSavedLevel());
    },
    scroll
  };
}
