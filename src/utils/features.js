import { onceAtATime } from "./onceAtATime";
import { getAuth } from "./authSession";

/**
 * What this outlet has been given.
 *
 * Not every restaurant buys the same thing. One runs a screen in the kitchen;
 * the next has no screen and wants the round on paper. One has captains
 * walking the floor; the next is a counter and a cook. The platform decides
 * that per outlet, and this is how the till finds out.
 *
 * Read exactly the way GST is read, and for the same reasons: it arrives with
 * the login response so the first screen is already drawn correctly, it is
 * fetched again once the till is up because the platform can change it in the
 * middle of a shift, and it is cached so a reload does not lose it.
 */

const FEATURES_KEY = "pos-outlet-features";

/**
 * What a till assumes when it has not been told.
 *
 * Everything the app could do before any of this existed. A till that cannot
 * reach the server, or is signed in to an outlet nobody has decided about, has
 * to keep working — and being wrong in this direction leaves a screen showing
 * something it need not, rather than a restaurant unable to serve.
 */
export const DEFAULT_FEATURES = {
  kds_enabled: true,
  kot_print_enabled: false,
  parcel_enabled: true,
  captain_enabled: true,
  table_service_enabled: true,
};

const normalise = (raw) => {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FEATURES };

  const seatsPeople = raw.table_service_enabled !== false;

  return {
    kds_enabled: raw.kds_enabled !== false,
    // The one that has to be asked for rather than assumed: a till that
    // guessed wrong here would print a ticket for every round all service.
    kot_print_enabled: raw.kot_print_enabled === true,

    /**
     * A counter is a counter all the way down.
     *
     * The server settles these two the same way, and the till settles them
     * again rather than trusting the answer it was handed — an old login
     * response cached before this existed, or a reply from a server mid
     * deploy, would otherwise leave a shop with no tables still offering a
     * Dine-in button and a captain's screen.
     */
    parcel_enabled: seatsPeople ? raw.parcel_enabled !== false : true,
    captain_enabled: seatsPeople ? raw.captain_enabled !== false : false,
    table_service_enabled: seatsPeople,
  };
};

/** Pulls the current switches from the server and caches them. */
export const refreshOutletFeatures = async (api, outletId, { force = false } = {}) =>
  onceAtATime(
    "features:" + (outletId || "none"),
    () => reallyRefreshOutletFeatures(api, outletId),
    { force }
  );

const reallyRefreshOutletFeatures = async (api, outletId) => {
  try {
    const res = await api.get("/outlet-feature", {
      params: outletId ? { outlet_id: outletId } : undefined,
    });
    const features = res?.data?.data;
    // Through applyOutletFeatures so the screens hear about it. Writing
    // storage alone leaves every screen showing what it was told at sign-in.
    if (features) applyOutletFeatures(features);
  } catch (err) {
    // Keep what is cached. A till mid-service must not lose a screen because
    // one request timed out.
  }
};

/** Clear on sign-out so the next outlet does not inherit these. */
export const clearOutletFeatures = () => {
  try {
    localStorage.removeItem(FEATURES_KEY);
  } catch (err) {
    // ignore
  }
};

/** What this outlet may do. Safe to call during render. */
export const getFeatures = () => {
  try {
    // The fetched copy first: the platform may have changed something since
    // this till signed in, and the session copy would be stale.
    const fresh = localStorage.getItem(FEATURES_KEY);
    if (fresh) return normalise(JSON.parse(fresh));

    return normalise(getAuth()?.user?.features);
  } catch (err) {
    return { ...DEFAULT_FEATURES };
  }
};

/** One switch, by name. */
export const hasFeature = (key) => getFeatures()[key] !== false;

/* ── Telling the screens when this changes ─────────────────────────────────
 *
 * The platform can turn something on while a till is in the middle of
 * service. Writing the new answer into storage is not enough on its own:
 * nothing re-reads storage by itself, so the screens would go on showing what
 * they were told at sign-in until somebody reloaded. That is exactly how a
 * switch flipped at head office looks broken to the shop.
 */

const watchers = new Set();

/** Called whenever the answer to "what may this outlet do" changes. */
export const onFeaturesChanged = (fn) => {
  watchers.add(fn);
  return () => watchers.delete(fn);
};

const tellWatchers = () => {
  for (const fn of watchers) {
    try {
      fn();
    } catch {
      /* one screen failing must not stop the others hearing */
    }
  }
};

/**
 * Takes the switches straight from a live update, without asking the server.
 * The push already carries them, so a round-trip would only add a delay.
 */
export const applyOutletFeatures = (raw) => {
  const next = normalise(raw);
  const before = JSON.stringify(getFeatures());
  if (JSON.stringify(next) === before) return false;

  try {
    localStorage.setItem(FEATURES_KEY, JSON.stringify(next));
  } catch {
    /* nothing to remember it with; the screens still get told below */
  }
  tellWatchers();
  return true;
};
