// Controls. PC: WASD or arrows to walk, Shift to run, mouse to look (drag, or click the scene to lock the pointer),
// E to act. Phone: virtual joystick on the left half, drag on the right half to look, the action button.

export class Input {
  move = { x: 0, y: 0 };          // x right, y forward, length <= 1
  run = false;
  look = { dx: 0, dy: 0 };        // accumulated pixels since the last read
  private actionQueued = false;
  readonly touch: boolean;
  private keys = new Set<string>();
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private dragging = false;

  constructor(canvas: HTMLCanvasElement, joy: HTMLElement, knob: HTMLElement, actionBtn: HTMLElement) {
    this.touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === "KeyE" || e.code === "Enter") this.actionQueued = true;
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());

    canvas.addEventListener("mousedown", (e) => { if (e.button === 0 || e.button === 2) this.dragging = true; });
    addEventListener("mouseup", () => { this.dragging = false; });
    addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === canvas || this.dragging) { this.look.dx += e.movementX; this.look.dy += e.movementY; }
    });
    canvas.addEventListener("dblclick", () => { if (!this.touch) canvas.requestPointerLock?.(); });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    const t = (e: TouchEvent) => {
      for (const p of Array.from(e.changedTouches)) {
        if (e.type === "touchstart") {
          if (p.clientX < innerWidth * 0.45 && this.joyId === null) {
            this.joyId = p.identifier; this.joyOrigin = { x: p.clientX, y: p.clientY };
            joy.style.left = `${p.clientX}px`; joy.style.top = `${p.clientY}px`; joy.classList.add("on");
          } else if (this.lookId === null) {
            this.lookId = p.identifier; this.lookLast = { x: p.clientX, y: p.clientY };
          }
        } else if (e.type === "touchmove") {
          if (p.identifier === this.joyId) {
            const R = 56; let dx = p.clientX - this.joyOrigin.x, dy = p.clientY - this.joyOrigin.y;
            const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
            this.move = { x: dx / R, y: -dy / R };
            this.run = l > R * 0.95;
          } else if (p.identifier === this.lookId) {
            this.look.dx += (p.clientX - this.lookLast.x) * 1.6; this.look.dy += (p.clientY - this.lookLast.y) * 1.6;
            this.lookLast = { x: p.clientX, y: p.clientY };
          }
        } else {
          if (p.identifier === this.joyId) {
            this.joyId = null; this.move = { x: 0, y: 0 }; this.run = false;
            knob.style.transform = ""; joy.classList.remove("on");
          }
          if (p.identifier === this.lookId) this.lookId = null;
        }
      }
      if (e.cancelable) e.preventDefault();
    };
    for (const ev of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) canvas.addEventListener(ev, t, { passive: false });
    actionBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); this.actionQueued = true; });
  }

  /** Reads the keyboard into move/run (the joystick writes them directly). */
  poll() {
    if (this.joyId !== null) return;
    const k = this.keys;
    const x = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    const y = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const l = Math.hypot(x, y) || 1;
    this.move = { x: x / l, y: y / l };
    this.run = k.has("ShiftLeft") || k.has("ShiftRight");
  }

  takeAction(): boolean {
    const a = this.actionQueued; this.actionQueued = false; return a;
  }

  queueAction() { this.actionQueued = true; }

  takeLook() {
    const l = { ...this.look }; this.look.dx = 0; this.look.dy = 0; return l;
  }
}
