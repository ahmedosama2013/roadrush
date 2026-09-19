const KEY_MAP = {
  KeyA: "left",
  KeyD: "right",
  KeyW: "accelerate",
  KeyS: "brake"
};

export function createInput(handlers) {
  const keys = { left: false, right: false, accelerate: false, brake: false };
  const pads = { left: false, right: false, accelerate: false, brake: false };

  const state = {
    left: 0,
    right: 0,
    accelerate: false,
    brake: false,
    usingTouch: false
  };

  function sync() {
    state.left = keys.left || pads.left ? 1 : 0;
    state.right = keys.right || pads.right ? 1 : 0;
    state.accelerate = keys.accelerate || pads.accelerate;
    state.brake = keys.brake || pads.brake;
  }

  function onKeyDown(event) {
    if (event.repeat) {
      return;
    }
    if (event.code === "KeyP" || event.code === "Escape") {
      handlers.togglePause();
      return;
    }
    if (event.code === "Enter") {
      handlers.confirm();
      return;
    }
    const action = KEY_MAP[event.code];
    if (!action) {
      return;
    }
    event.preventDefault();
    keys[action] = true;
    sync();
  }

  function onKeyUp(event) {
    const action = KEY_MAP[event.code];
    if (!action) {
      return;
    }
    event.preventDefault();
    keys[action] = false;
    sync();
  }

  function bindPad(element, action) {
    if (!element) {
      return;
    }
    const press = (event) => {
      event.preventDefault();
      state.usingTouch = true;
      pads[action] = true;
      sync();
    };
    const release = (event) => {
      event.preventDefault();
      pads[action] = false;
      sync();
    };
    element.addEventListener("pointerdown", press);
    element.addEventListener("pointerup", release);
    element.addEventListener("pointerleave", release);
    element.addEventListener("pointercancel", release);
  }

  function releaseAll() {
    Object.keys(keys).forEach((key) => {
      keys[key] = false;
    });
    Object.keys(pads).forEach((key) => {
      pads[key] = false;
    });
    sync();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseAll);

  bindPad(document.getElementById("pad-left"), "left");
  bindPad(document.getElementById("pad-right"), "right");
  bindPad(document.getElementById("pad-gas"), "accelerate");
  bindPad(document.getElementById("pad-brake"), "brake");

  window.addEventListener(
    "touchstart",
    () => {
      state.usingTouch = true;
    },
    { once: true, passive: true }
  );

  return { state, releaseAll };
}
