/**
 * Table numbers are stored inconsistently — some outlets save "T1", others
 * save "1". Screens used to print a hard-coded "T" in front, which turned
 * "T1" into "TT1". Normalise first, then let the caller add one "T".
 */
export const tableLabel = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return `T${raw.replace(/^t\s*/i, "")}`;
};

/**
 * How long a ticket has been waiting in the kitchen, in whole minutes.
 * Returns null when there is no usable timestamp.
 */
export const minutesWaiting = (timestamp, now = Date.now()) => {
  if (!timestamp) return null;
  const started = new Date(timestamp).getTime();
  if (Number.isNaN(started)) return null;
  return Math.max(0, Math.floor((now - started) / 60000));
};

/** "just now" / "7 min" / "1h 05m" — short enough for a ticket header. */
export const waitingLabel = (timestamp, now = Date.now()) => {
  const mins = minutesWaiting(timestamp, now);
  if (mins === null) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${String(mins % 60).padStart(2, "0")}m`;
};

/**
 * How urgent a ticket looks. The thresholds are deliberately modest — a
 * kitchen cares about the difference between "just came in" and "this has
 * been sitting", not about exact minutes.
 */
export const waitingLevel = (timestamp, now = Date.now()) => {
  const mins = minutesWaiting(timestamp, now);
  if (mins === null) return "none";
  if (mins >= 20) return "late";
  if (mins >= 10) return "warn";
  return "fresh";
};

/**
 * Who a ticket is for, and where that name came from.
 *
 * The name stored on a round is a copy taken when it was sent, so it can be
 * stale, empty, or the "Guest" placeholder. The customer attached to the bill
 * is the truth, and when a table really was opened without asking anyone's
 * name the ticket says who sent it instead — a kitchen can act on "Captain
 * Surti", never on "Guest".
 */
/**
 * Names that are not names.
 *
 * "Parcel" and "Order" are on this list for the same reason "Guest" is: the
 * till has to put something in the field and nobody was asked, so it writes
 * what kind of sale it was. Printed under a heading that already says PARCEL
 * in letters twice the size, it says nothing twice — and on a ticket, a line
 * that is the same on every ticket teaches the eye to skip the block it sits
 * in, taking the lines that do matter with it.
 */
const PLACEHOLDER_NAMES = new Set([
  "guest", "unnamed", "walk in", "walk-in", "customer", "-",
  "parcel", "order", "counter", "takeaway", "take away", "take-away",
]);

const isPlaceholder = (name) =>
  !name || PLACEHOLDER_NAMES.has(String(name).trim().toLowerCase());

export const ticketPerson = (order) => {
  const c = order?.cartData?.customer;
  const fromCustomer = `${c?.firstName || ""} ${c?.lastName || ""}`.trim();
  if (!isPlaceholder(fromCustomer)) {
    return { name: fromCustomer, kind: "customer", phone: c?.phoneNumber || c?.phone || "" };
  }

  const stored = String(order?.note || "").trim();
  if (!isPlaceholder(stored)) {
    return { name: stored, kind: "customer", phone: c?.phoneNumber || c?.phone || "" };
  }

  const staff = String(order?.cashierName || "").trim();
  if (staff) return { name: staff, kind: "staff", phone: "" };

  return { name: "", kind: "none", phone: "" };
};

/**
 * What still has to go to the kitchen.
 *
 * A resumed bill carries items the kitchen already has, stamped with
 * `sentQuantity`. Sending the whole cart again would make the kitchen cook the
 * table twice, so a new KOT carries only the difference: brand-new lines in
 * full, and the extra quantity on lines the waiter topped up.
 */
export const pendingKotItems = (cartItems = []) =>
  cartItems
    .map((item) => {
      const wanted = Number(item.quantity) || 0;
      const already = Number(item.sentQuantity) || 0;
      const delta = wanted - already;
      return delta > 0 ? { ...item, quantity: delta } : null;
    })
    .filter(Boolean);
