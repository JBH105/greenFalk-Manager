/**
 * Finding a dish on the menu.
 *
 * Two ways, because a counter uses both. Somebody who knows the dish types
 * its name; somebody who has worked the till a fortnight types its number.
 * A great many menus are learned as numbers — a regular asks for twenty-three
 * and so does the cook calling it through — and the number was already on
 * every dish and already on this screen. Nothing read it.
 *
 * A code that matches exactly is put first. Typing 23 would otherwise bury
 * the dish under everything whose name or code merely contains a 2 and a 3,
 * which on a long menu is most of it.
 *
 * Whole menu, never the open section: a cashier who can name the dish should
 * not have to know which section it lives in — that is the very thing they
 * are searching for.
 */
export const searchMenu = (products = [], raw = "") => {
  const query = String(raw || "").toLowerCase().trim();
  if (!query) return products;

  const codeOf = (p) => String(p?.code ?? "").toLowerCase();
  const exactCode = (p) => codeOf(p) === query;

  const found = products.filter((p) => {
    const code = codeOf(p);

    /**
     * Both names are searched, whichever one the till happens to be showing.
     *
     * A cashier who types Arabic should find the dish even on a till set to
     * English, and the other way round — the setting decides what is drawn,
     * not what can be looked for. Arabic is not lower-cased by `toLowerCase`
     * because it has no case, and the call is harmless on it.
     */
    const inName = String(p?.name ?? "").toLowerCase().includes(query);
    const inArabic = String(p?.nameAr ?? "").toLowerCase().includes(query);

    return inName || inArabic || (code && code.includes(query));
  });

  // Only reorder when there is something to lift, so the menu's own order is
  // left alone the rest of the time.
  if (!found.some(exactCode)) return found;

  return [...found].sort((a, b) => Number(exactCode(b)) - Number(exactCode(a)));
};

export default searchMenu;
