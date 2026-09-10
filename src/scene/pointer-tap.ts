/** Tell a tap apart from an orbit, a pinch, a pan, or a canceled touch. */
export class PointerTap {
  private active = new Map<number, {x: number; y: number; slop: number}>();
  private blocked = false;

  down(id: number, x: number, y: number, slop: number) {
    if (this.active.size === 0) this.blocked = false;
    this.active.set(id, {x, y, slop});
    if (this.active.size > 1) this.blocked = true;
  }

  move(id: number, x: number, y: number) {
    const start = this.active.get(id);
    if (start && Math.hypot(x - start.x, y - start.y) > start.slop) this.blocked = true;
  }

  up(id: number, x: number, y: number) {
    this.move(id, x, y);
    const tap = this.active.has(id) && this.active.size === 1 && !this.blocked;
    this.active.delete(id);
    return tap;
  }

  cancel(id: number) {
    this.active.delete(id);
    this.blocked = true;
  }
}
