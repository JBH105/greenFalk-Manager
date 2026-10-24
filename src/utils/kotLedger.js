/**
 * What this till has already sent to the kitchen printer.
 *
 * A round arrives as "something changed at this outlet", not as "here is a new
 * round", so the station reads the kitchen's list and works out what is new.
 * Without a memory it would reprint the whole list every time anything changed
 * — a dish marked as cooking, a table paying — and the kitchen would be buried
 * in paper within a minute.
 *
 * Kept on the device rather than the server, because it answers a question
 * about this one machine: another till reading the same list has its own
 * printer and its own answer.
 */

const LEDGER_KEY = "pos-kot-printed";

/**
 * Whether this machine has taken up the job at all.
 *
 * Kept apart from the list of what has been printed, because an empty list
 * has two meanings and they lead opposite ways: a machine that has never
 * started, and a machine that started when the kitchen happened to have
 * nothing open. Reading the empty list as the first left a quiet shop stuck
 * — it treated every round as the moment it began, and so printed none of
 * them.
 */
const STARTED_KEY = "pos-kot-started";

/** Enough to cover a long service; older ids can never come round again. */
const KEEP = 400;

const read = () => {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.map(String) : [];
  } catch {
    return [];
  }
};

const write = (ids) => {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ids.slice(-KEEP)));
  } catch {
    /* a till with storage turned off reprints rather than stops */
  }
};

/** Everything this machine has printed, newest last. */
export const printedIds = () => read();

export const wasPrinted = (id) => (id ? read().includes(String(id)) : false);

export const markPrinted = (id) => {
  if (!id) return;
  const ids = read();
  if (ids.includes(String(id))) return;
  write([...ids, String(id)]);
};

/** Whether this machine has already taken up the job. */
export const hasStarted = () => {
  try {
    return localStorage.getItem(STARTED_KEY) === "1";
  } catch {
    // Without storage every load looks like the first, so rather than
    // printing the kitchen's whole evening on each one, say it has started.
    return true;
  }
};

/**
 * Everything on the list counts as printed, without printing any of it.
 *
 * Used the first time a machine is made the kitchen's printer. Whatever is
 * already open belongs to a kitchen that has been working from a screen, or
 * from tickets another machine printed — starting by printing all of it again
 * is the one way to make the feature useless on the day it is switched on.
 *
 * Marks the machine as started even when the list is empty, which is the
 * whole reason that is recorded separately: a kitchen with nothing open is
 * the easiest moment to switch this on, and it must not be the one moment
 * that leaves it switched on and silent.
 */
export const markAllPrinted = (ids = []) => {
  const known = read();
  const next = [...known];
  for (const id of ids) {
    const key = String(id);
    if (key && !next.includes(key)) next.push(key);
  }
  write(next);
  try {
    localStorage.setItem(STARTED_KEY, "1");
  } catch {
    /* the round after this one prints; nothing is lost twice */
  }
};

/** Which of these have not been printed here yet, oldest first. */
export const unprinted = (orders = []) => {
  const known = new Set(read());
  return orders.filter((o) => {
    const id = String(o?.serverId || o?.localId || "");
    return id && !known.has(id);
  });
};

/** On sign-out: the next shift on this machine starts its own ledger. */
export const clearLedger = () => {
  try {
    localStorage.removeItem(LEDGER_KEY);
    localStorage.removeItem(STARTED_KEY);
  } catch {
    /* ignore */
  }
};
