/** Explicit priorities avoid React parent/child effect ordering changing Back behavior. */
export function createBackStack() {
  const entries = new Map<symbol, { priority: number; handle: () => boolean }>();
  return {
    add(priority: number, handle: () => boolean) {
      const id = Symbol();
      entries.set(id, { priority, handle });
      return () => { entries.delete(id); };
    },
    back() {
      for (const entry of [...entries.values()].reverse().sort((a, b) => b.priority - a.priority)) {
        if (entry.handle()) return true;
      }
      return false;
    }
  };
}
