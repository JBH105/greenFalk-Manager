/**
 * The tenant's currency symbol.
 *
 * It arrives with the login response (from tenant_settings) and is cached in
 * the auth session, so it is available offline and on a hard refresh. The till
 * used to print a hardcoded "P", which was wrong for every tenant that is not
 * on Pula.
 */

/**
 * Nothing, where there is no session to ask.
 *
 * It used to be a rupee sign, which was right for every restaurant on this
 * system and wrong the moment one opened in Dubai. A bare number is read
 * correctly by everybody; a number behind the wrong country's sign is read
 * confidently and wrongly. This only ever shows before sign-in, where no
 * money is on screen anyway.
 */
const FALLBACK = "";
// Read through getAuth: the session belongs to this window, not to the
// browser, and two windows can be signed in as different people.
import { getAuth } from "./authSession";

let cached = null;

/** Symbol for the signed-in tenant, e.g. "₹". Safe to call during render. */
export const cur = () => {
  if (cached) return cached;

  try {
    const session = getAuth();
    if (session) {
      const symbol = session?.user?.currency_symbol;
      if (symbol) {
        cached = symbol;
        return cached;
      }
    }
  } catch (err) {
    // private mode / SSR — fall through to the default
  }

  return FALLBACK;
};

/** Call on logout, or when switching tenant, so the next login re-reads it. */
export const resetCurrency = () => {
  cached = null;
};

/** `money(12.5)` → "₹12.50" */
export const money = (value, decimals = 2) =>
  `${cur()}${Number(value || 0).toFixed(decimals)}`;
