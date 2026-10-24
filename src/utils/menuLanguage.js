import { useSyncExternalStore } from "react";

/**
 * Which name a dish is called by on this till.
 *
 * One setting for the whole restaurant, chosen by the owner, read by every
 * screen that writes a dish's name: the menu, the cart, the kitchen ticket,
 * the bill. A guest and the cashier serving them are never looking at the
 * same dish under two different names.
 *
 * Cached the way the tax settings are, and for the same reason: a screen in
 * the middle of a render cannot wait for the network, and an owner who
 * changes this mid-shift should not have to make every till sign in again.
 */

const KEY = "menu_language";

/** English only — what every restaurant has until it says otherwise. */
const DEFAULT = "EN";

const VALID = ["EN", "AR", "BOTH"];

const clean = (value) => {
  const asked = String(value ?? "").toUpperCase();
  return VALID.includes(asked) ? asked : DEFAULT;
};

/**
 * Held in memory as well as in storage, and watched.
 *
 * The owner can change this in the middle of a service, and every till is
 * told at once over the socket. Reading storage during render would not be
 * enough on its own: a dish card is memoised, so nothing would redraw and
 * the change would appear to have been ignored until somebody signed out.
 *
 * So the value lives here, screens subscribe to it, and a change redraws
 * every one of them.
 */
let current = (() => {
  try {
    return clean(localStorage.getItem(KEY));
  } catch {
    return DEFAULT;
  }
})();

const watchers = new Set();

/**
 * The setting, safe to call during render.
 *
 * Anything unreadable — private mode, no session yet, a value saved by an
 * older version — comes back as English. A till that cannot read its
 * settings still has a service to run, and English is the safe thing to be
 * wrong with: every dish has an English name, and not every dish has an
 * Arabic one.
 */
export const getMenuLanguage = () => current;

/**
 * Takes a new value, writes it down, and tells every screen.
 *
 * Does nothing when the value has not actually changed — the socket can
 * deliver the same message twice, and a needless redraw of the whole menu in
 * the middle of an order is not free.
 */
export const applyMenuLanguage = (value) => {
  const mode = clean(value);
  if (mode === current) return current;

  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* Storage is only the copy that survives a reload; the running till
       works from the value above either way. */
  }

  watchers.forEach((notify) => notify());
  return mode;
};

/** For `useSyncExternalStore`. */
const subscribe = (notify) => {
  watchers.add(notify);
  return () => watchers.delete(notify);
};

/**
 * The setting, for a component that must redraw when it changes.
 *
 * Anything that writes a dish's name uses this rather than reading the value
 * directly, so one switch in the owner's screen reaches every card, every
 * cart line and every kitchen ticket without a reload.
 */
export const useMenuLanguage = () =>
  useSyncExternalStore(subscribe, getMenuLanguage, getMenuLanguage);

/** Pulls it from the server. Called after sign-in. */
export const refreshMenuLanguage = async (api) => {
  try {
    const res = await api.get("/tenant/settings/menu-language");
    return applyMenuLanguage(res?.data?.data?.menu_language);
  } catch {
    /* Keep whatever was cached rather than dropping a restaurant that runs
       in Arabic back into English because one request failed. */
    return current;
  }
};

/** Clear on logout, so the next tenant does not inherit this one's choice. */
export const clearMenuLanguage = () => {
  current = DEFAULT;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  watchers.forEach((notify) => notify());
};

/**
 * The two lines a dish is written on.
 *
 * Returns `{ primary, secondary }`. `secondary` is null whenever there is
 * only one line to draw, which is most of the time — so a caller can render
 * it without asking which mode it is in.
 *
 * The rule that matters: **a dish always has a name.** A menu of two hundred
 * dishes is translated over weeks, so in Arabic mode a dish with no Arabic
 * name shows its English one rather than a blank space on the till. Nothing
 * here can return empty while the dish has any name at all.
 */
export const dishName = (name, nameAr, mode = getMenuLanguage()) => {
  const en = String(name ?? "").trim();
  const ar = String(nameAr ?? "").trim();

  if (mode === "AR") {
    /* Arabic if we have it, English if we do not. Never nothing. */
    return { primary: ar || en, secondary: null, primaryIsArabic: Boolean(ar) };
  }

  if (mode === "BOTH" && ar) {
    return { primary: en, secondary: ar, primaryIsArabic: false };
  }

  /* EN, or BOTH on a dish nobody has translated yet — one line, English. */
  return { primary: en, secondary: null, primaryIsArabic: false };
};

/**
 * The same thing where only one line fits — a kitchen ticket, a printed slip
 * column, a search result. Both names on one line when both exist and both
 * are wanted, so nothing is lost where a second line is not possible.
 */
export const dishNameOneLine = (name, nameAr, mode = getMenuLanguage()) => {
  const { primary, secondary } = dishName(name, nameAr, mode);
  return secondary ? `${primary} · ${secondary}` : primary;
};
