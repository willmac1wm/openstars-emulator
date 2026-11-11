/**
 * Ensures one clearance Issue produces exactly one command.
 * Guards against Enter + button double-fire and rapid re-entry.
 */

export interface TapIssueGate {
  /** Returns true if the command was forwarded. */
  tryIssue: (command: string | null | undefined) => boolean;
  /** True while cooldown is active. */
  isLocked: () => boolean;
  /** Test helper — clear lock immediately. */
  reset: () => void;
}

export function createTapIssueGate(
  onIssue: (command: string) => void,
  cooldownMs = 450,
): TapIssueGate {
  let locked = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastCommand: string | null = null;

  const unlock = () => {
    locked = false;
    lastCommand = null;
    timer = null;
  };

  return {
    tryIssue(command) {
      const cmd = (command ?? '').trim();
      if (!cmd) return false;
      // Never emit the classic north-as-zero typo.
      if (/\bH000\b/i.test(cmd)) return false;
      if (locked) return false;
      // Same command within the cooldown window is a double-fire.
      if (lastCommand && lastCommand === cmd) return false;
      locked = true;
      lastCommand = cmd;
      onIssue(cmd);
      if (timer) clearTimeout(timer);
      timer = setTimeout(unlock, cooldownMs);
      return true;
    },
    isLocked: () => locked,
    reset() {
      if (timer) clearTimeout(timer);
      unlock();
    },
  };
}
