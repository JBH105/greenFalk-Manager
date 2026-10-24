import { useSyncExternalStore } from "react";
import { en } from "./en";
import { ar } from "./ar";

/**
 * The till's own words, in English or Arabic.
 *
 * No library. Two languages, flat keys, no plural rules to speak of — an i18n
 * framework would be more code than this and one more thing to upgrade. What
 * it would buy us we do not need; what we need is here.
 *
 * Separate from the menu language on purpose. A restaurant may well run its
 * screens in English while printing both names on the bill, or the other way
 * round: one setting is about the people working the till, the other about
 * the people eating.
 */

const KEY = "ui_language";
const DEFAULT = "en";

const DICTIONARIES = { en, ar };

const clean = (value) => {
  const asked = String(value ?? "").toLowerCase();
  return asked === "ar" ? "ar" : DEFAULT;
};

let current = (() => {
  try {
    return clean(localStorage.getItem(KEY));
  } catch {
    return DEFAULT;
  }
})();

const watchers = new Set();

/** The language, safe to call during render and outside React. */
export const getLanguage = () => current;

/**
 * True when the page is actually mirrored.
 *
 * Not the same as "the language is Arabic": the layout only turns round when
 * the flag below says so. Anything that positions something has to ask this
 * rather than the language, or it will mirror while the page around it does
 * not.
 */
export const isRtl = () => RTL_LAYOUT && current === "ar";

/**
 * Whether an Arabic till also mirrors its layout.
 *
 * Off, and off on purpose.
 *
 * Setting `dir` on the document turns the whole interface round, and the
 * parts of it built on flex and grid obey at once — the cart changes sides,
 * the category column changes sides, every row reverses. The parts built on
 * physical values do not: the rail is `left-0` and the page clears it with a
 * left margin, both of which stay exactly where they were. The result is a
 * screen that is half mirrored, which reads as broken rather than as Arabic.
 *
 * Doing it properly means going through every screen and replacing left and
 * right with start and end — margins, padding, absolute positions, text
 * alignment, the lot — and then looking at all of them again. That is its own
 * piece of work, not a side effect of translating the words.
 *
 * Meanwhile Arabic reads correctly inside a left-to-right page: the
 * characters are strongly right-to-left in their own right, so a label, a
 * button or a heading comes out in the proper order wherever it sits. It is
 * not ideal typography. It is a great deal better than half a mirror.
 *
 * To turn it on later: flip this to true. Everything else is already here.
 */
const RTL_LAYOUT = false;

/**
 * Takes a new language, writes it down, and tells every screen.
 *
 * `lang` is always set — screen readers, spell-checking and the font stack
 * all read it, and none of them move anything on the page. `dir` is the one
 * that rearranges, so it is held behind the flag above.
 */
export const applyLanguage = (value) => {
  const next = clean(value);
  if (next === current) return current;

  current = next;

  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* Storage is only the copy that survives a reload. */
  }

  try {
    document.documentElement.lang = next;
    document.documentElement.dir =
      RTL_LAYOUT && next === "ar" ? "rtl" : "ltr";
  } catch {
    // no document, in a test
  }

  watchers.forEach((notify) => notify());
  return next;
};

/**
 * Called once at start-up, so a reload comes back in the right language.
 *
 * Sets the document attributes itself rather than going through
 * `applyLanguage`, which returns early when the value has not changed — and
 * at boot it never has, because it was read from storage a moment ago. Left
 * to that path, an Arabic till reloaded with `lang` unset and the font stack
 * picking whatever it liked.
 */
export const bootLanguage = () => {
  try {
    document.documentElement.lang = current;
    document.documentElement.dir =
      RTL_LAYOUT && current === "ar" ? "rtl" : "ltr";
  } catch {
    // no document, in a test
  }
  return current;
};

const subscribe = (notify) => {
  watchers.add(notify);
  return () => watchers.delete(notify);
};

/** Pulls it from the server. Called after sign-in. */
export const refreshLanguage = async (api) => {
  try {
    const res = await api.get("/tenant/settings/ui-language");
    return applyLanguage(res?.data?.data?.language);
  } catch {
    /* Keep what was cached rather than dropping a restaurant that runs in
       Arabic back into English because one request failed. */
    return current;
  }
};

/** Clear on logout, so the next tenant does not inherit this one's choice. */
export const clearLanguage = () => {
  applyLanguage(DEFAULT);
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};

/**
 * One phrase.
 *
 * A key with no Arabic falls back to the English, never to the key itself: a
 * screen showing `cart.empty` is worse than a screen showing English on a
 * till set to Arabic, and a translation added later needs no code change.
 *
 * `vars` fills `{name}`-style holes. Kept deliberately plain — the few places
 * that need a number put it in themselves.
 */
export const t = (key, vars) => {
  const dict = DICTIONARIES[current] || en;
  let text = dict[key];

  if (text === undefined) text = en[key];
  if (text === undefined) {
    /* Loud in development, harmless in a restaurant: a missing key shows the
       last part of itself rather than an empty space on the screen. */
    if (import.meta.env?.DEV) console.warn(`[i18n] no phrase for "${key}"`);
    return String(key).split(".").pop();
  }

  if (!vars) return text;

  return Object.keys(vars).reduce(
    (out, name) => out.split(`{${name}}`).join(String(vars[name])),
    text,
  );
};

/**
 * The same, for a component that must redraw when the language changes.
 *
 * Returns `t` itself, so a component reads `const t = useT();` and then uses
 * it exactly as the plain function. Subscribing is the whole point: the owner
 * can switch language mid-service and every screen follows without a reload.
 */
export const useT = () => {
  useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return t;
};

/** For a component that needs the direction rather than the words. */
export const useLanguage = () =>
  useSyncExternalStore(subscribe, getLanguage, getLanguage);
