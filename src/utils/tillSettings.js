/**
 * How this till behaves when a sale is rung up.
 *
 * All of it stays on the machine, for the same reason the printer settings
 * do: the same account is signed in at an ice-cream counter and at a sit-down
 * restaurant across town, and what one of them wants out of a bill is not
 * what the other one wants. A counter prints two kitchen tickets and asks
 * nobody their name; a restaurant asks for the name and prints one.
 *
 * Kept apart from the printer settings because those are about a cable and
 * these are about a shop. The one place they meet is the kitchen ticket,
 * which the Settings screen offers as the very same switch rather than a
 * second one of its own — two switches for one thing is how a working
 * feature gets reported as broken.
 */

const SETTINGS_KEY = "pos-till-settings";

/** The most anybody has ever wanted of one round. */
export const MAX_KOT_COPIES = 3;

/**
 * What a till does before anybody has told it otherwise: exactly what every
 * till did before this screen existed. A machine that cannot reach its
 * storage, or has never been set up, keeps working the way it always has.
 */
export const DEFAULT_TILL_SETTINGS = {
  /** How many of the same kitchen ticket come off the printer. */
  kotCopies: 1,
  /** Stop a sale that has no name on it and ask for one. */
  askCustomerName: true,
  /** Offer Print and WhatsApp once the money is taken. */
  showPrintPopup: true,
};

const clampCopies = (n) => {
  const count = Math.round(Number(n));
  if (!Number.isFinite(count)) return DEFAULT_TILL_SETTINGS.kotCopies;
  return Math.min(MAX_KOT_COPIES, Math.max(1, count));
};

export const readTillSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        kotCopies: clampCopies(s.kotCopies),
        // Read as "not switched off" rather than "switched on", so a setting
        // added after this machine was set up starts where it always was.
        askCustomerName: s.askCustomerName !== false,
        showPrintPopup: s.showPrintPopup !== false,
      };
    }
  } catch {
    /* a till with storage turned off still sells */
  }
  return { ...DEFAULT_TILL_SETTINGS };
};

export const writeTillSettings = (next) => {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...readTillSettings(), ...next })
    );
  } catch {
    /* nothing to remember it with */
  }
};
