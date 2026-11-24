/** Shared mutable door state (id -> open). Read inside useFrame so doors swing without re-rendering React. Set by the "door" message in Game.tsx. */
export const doorOpen: Record<string, boolean> = {};
/** Doors that are locked until someone solves a question (id -> locked). Set by the "lock" message in Game.tsx. */
export const doorLocked: Record<string, boolean> = {};
