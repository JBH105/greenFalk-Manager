import { getFeatures } from "./features";

export const isCompletedCartItem = (item) =>
  String(item?.status || "").toLowerCase() === "completed";

export const getCompletedQuantity = (item) => {
  const raw =
    item?.prepared_quantity ??
    item?.completed_quantity ??
    item?.completedQuantity ??
    item?.completedQty ??
    (isCompletedCartItem(item) ? item?.quantity : 0);

  const completed = Number(raw) || 0;
  const quantity = Number(item?.quantity) || 0;

  return Math.max(0, Math.min(completed, quantity));
};

/**
 * The dishes the kitchen still owes on this bill.
 *
 * Only what was actually sent counts. A line the waiter has just added, or the
 * extra two rotis on a line that went out as three, were never asked of the
 * kitchen — holding the bill for those would strand the table on a dish nobody
 * is cooking.
 *
 * And only where there is a kitchen display at all. Every one of these tick
 * marks is put there from that screen, so a shop working off printed tickets
 * would wait for ever on a dish nobody can mark as done, and never bill a
 * table. The rule lives here rather than at each button because it was at the
 * buttons first: one of the two was taught about it and the other was not, and
 * the cashier reached a payment screen that would not take the money.
 *
 * The server settles the same question the same way; this is here so the
 * button can say so before the cashier taps it.
 */
export const dishesStillCooking = (items = []) =>
  !getFeatures().kds_enabled
    ? []
    : items
    .map((item) => {
      const sent = Number(item?.sentQuantity) || 0;
      if (sent <= 0) return null;

      const owed = Math.min(sent, Number(item?.quantity) || 0);
      const left = owed - getCompletedQuantity(item);

      return left > 0 ? { name: item?.name || "A dish", left, ordered: owed } : null;
    })
    .filter(Boolean);

/** One line for a tooltip or a toast. */
export const describeStillCooking = (pending = []) =>
  pending.map((d) => `${d.name} (${d.left} of ${d.ordered})`).join(", ");

/**
 * The dishes on this bill that the kitchen has never been asked for.
 *
 * The mirror of dishesStillCooking. That one asks what the kitchen still
 * owes; this asks what it was never told about — a line typed into the cart
 * and not sent, or the two extra rotis added to a line that went out as
 * three.
 *
 * It matters because a dine-in bill is settled after the meal. Taking money
 * for food nobody has started cooking means either the guest pays for a dish
 * that never comes, or the kitchen makes it after the table has left.
 */
export const dishesNotSentYet = (items = []) =>
  items
    .map((item) => {
      const wanted = Number(item?.quantity) || 0;
      const sent = Number(item?.sentQuantity) || 0;
      const short = wanted - sent;

      return short > 0 ? { name: item?.name || "A dish", short, wanted } : null;
    })
    .filter(Boolean);

/** One line for a tooltip or a toast. */
export const describeNotSent = (pending = []) =>
  pending
    .map((d) => (d.short === d.wanted ? d.name : `${d.name} (${d.short} more)`))
    .join(", ");

export const isEditableCartItem = (item) =>
  getCompletedQuantity(item) < (Number(item?.quantity) || 0);

/**
 * Whether the kitchen has picked this dish up.
 *
 * Up to that moment a guest may change their mind and nobody is out of
 * pocket. After it the food is in the pan, so the line stops being the
 * till's to remove — which is why the button goes rather than being left
 * to fail.
 *
 * Started means any of three things, and they do not always arrive
 * together: the cook pressed start, the cook has finished some of them, or
 * the line is marked done. The server asks the same question of the same
 * three before it will take a dish off a round.
 */
export const isKitchenStarted = (item) => {
  const status = String(item?.status || "").toUpperCase();
  return status === "PREPARING" || status === "COMPLETED" || getCompletedQuantity(item) > 0;
};

export const getCartEntryKey = (item, index) =>
  item?.cartKey ||
  item?.orderItemId ||
  item?.order_item_id ||
  item?.lineItemId ||
  item?.line_item_id ||
  item?.localItemId ||
  item?.product_item_id ||
  (index != null ? `${item?.id || item?.product_id || "item"}_${index}` : item?.id);

export const ensureCartEntryKeys = (items = []) =>
  items.map((item, index) => ({
    ...item,
    cartKey: getCartEntryKey(item, index),
  }));

export const formatCartStatus = (status) => {
  if (!status) return "";
  return String(status)
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};
