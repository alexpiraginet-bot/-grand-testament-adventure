// Controls. PC: WASD or arrows to walk, Shift to run, mouse to look (drag, or click the scene to lock the pointer),
// E to act. Phone: a joystick always shown at the lower left (joystick.ts), drag on the right side to look, the
// round action button with the hand.
import { JOY_CAPTURE_RATIO, JOY_RADIUS, stickOrigin, stickVector } from "./joystick.ts";

export class Input {
  move = { x: 0, y: 0 };          // x right, y forward, length <= 1
  run = false;
  look = { dx: 0, dy: 0 };        // accumulated pixels since the last read
  private actionQueued = false;
  readonly touch: boolean;
  private keys = new Set<string>();
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private joyRadius = JOY_RADIUS;
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private dragging = false;
  private suspended = false;
  private resetControls: () => void;

  constructor(canvas: HTMLCanvasElement, joy: HTMLElement, knob: HTMLElement, actionBtn: HTMLElement) {
    this.touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    joy.classList.toggle("rest", this.touch);           // on a phone the stick stays in view, waiting for the thumb
    const releaseStick = () => {
      this.joyId = null; this.move = { x: 0, y: 0 }; this.run = false;
      knob.style.transform = ""; joy.style.transform = ""; joy.classList.remove("on");
    };
    this.resetControls = () => {
      this.keys.clear(); this.actionQueued = false; this.dragging = false;
      this.lookId = null; this.look = { dx: 0, dy: 0 }; releaseStick();
    };
    addEventListener("keydown", (e) => {
      if (this.suspended || e.repeat || (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]"))) return;
      this.keys.add(e.code);
      if ((e.code === "KeyE" || e.code === "Enter") && !(e.target instanceof Element && e.target.closest("button, a"))) this.actionQueued = true;
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.resetControls());

    canvas.addEventListener("mousedown", (e) => { if (!this.suspended && (e.button === 0 || e.button === 2)) this.dragging = true; });
    addEventListener("mouseup", () => { this.dragging = false; });
    addEventListener("mousemove", (e) => {
      if (!this.suspended && (document.pointerLockElement === canvas || this.dragging)) { this.look.dx += e.movementX; this.look.dy += e.movementY; }
    });
    canvas.addEventListener("dblclick", () => { if (!this.suspended && !this.touch) canvas.requestPointerLock?.(); });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    const t = (e: TouchEvent) => {
      if (this.suspended) return;
      for (const p of Array.from(e.changedTouches)) {
        if (e.type === "touchstart") {
          if (p.clientX < innerWidth * 0.45 && this.joyId === null) {
            // the resting centre, read from the layout (CSS places it; safe areas and rotation move it)
            const box = joy.getBoundingClientRect();
            const rest = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
            const touchPt = { x: p.clientX, y: p.clientY };
            this.joyRadius = box.width / 2 || JOY_RADIUS;    // the drawn size sets how far the knob travels
            this.joyId = p.identifier; this.joyOrigin = stickOrigin(rest, touchPt, this.joyRadius * JOY_CAPTURE_RATIO);
            joy.style.transform = `translate(${this.joyOrigin.x - rest.x}px, ${this.joyOrigin.y - rest.y}px)`;
            joy.classList.add("on");
            this.steer(touchPt, knob);
          } else if (this.lookId === null) {
            this.lookId = p.identifier; this.lookLast = { x: p.clientX, y: p.clientY };
          }
        } else if (e.type === "touchmove") {
          if (p.identifier === this.joyId) {
            this.steer({ x: p.clientX, y: p.clientY }, knob);
          } else if (p.identifier === this.lookId) {
            this.look.dx += (p.clientX - this.lookLast.x) * 1.6; this.look.dy += (p.clientY - this.lookLast.y) * 1.6;
            this.lookLast = { x: p.clientX, y: p.clientY };
          }
        } else {
          if (p.identifier === this.joyId) releaseStick();
          if (p.identifier === this.lookId) this.lookId = null;
        }
      }
      if (e.cancelable) e.preventDefault();
    };
    for (const ev of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) canvas.addEventListener(ev, t, { passive: false });
    actionBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); this.queueAction(); });
  }

  /** The joystick writes move/run directly, and draws the knob where the thumb is (clamped to the rim). */
  private steer(touch: { x: number; y: number }, knob: HTMLElement) {
    const s = stickVector(this.joyOrigin, touch, this.joyRadius);
    knob.style.transform = `translate(${s.knob.x}px, ${s.knob.y}px)`;
    this.move = { x: s.x, y: s.y };
    this.run = s.run;
  }

  /** Reads the keyboard into move/run (the joystick writes them directly). */
  poll() {
    if (this.suspended || this.joyId !== null) return;
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

  queueAction() { if (!this.suspended) this.actionQueued = true; }

  setSuspended(suspended: boolean) { this.suspended = suspended; this.resetControls(); }

  takeLook() {
    const l = { ...this.look }; this.look.dx = 0; this.look.dy = 0; return l;
  }
}
