/**
 * Haptics wrapper – silently no-ops where unsupported or when disabled.
 */

let enabled = () => true;

export function configureVibration(isEnabled: () => boolean): void {
  enabled = isEnabled;
}

export function vibrate(pattern: number | number[]): void {
  try {
    if (!enabled()) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}
