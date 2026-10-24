import { billMoment } from "./billMoment";
import { cur } from "./currency";

/**
 * The bill, written out for WhatsApp.
 *
 * One reader, one set of field names. The order a till has just saved comes
 * back with its own spelling — `order_items` rather than `orderItems`,
 * `displayId` rather than `display_id`, a line carrying a unit price and a
 * count rather than a total — and the message was written against the other
 * spelling throughout. Every bill that went out said "Order No: undefined"
 * over the words "No items".
 *
 * So this reads the order the same forgiving way the printed slip does, and
 * works the money out the same way: what the guest is sent and what they are
 * handed have to agree, or the next argument at the counter is about which
 * one is real.
 */

const num = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const money = (value) => num(value).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** A dish as the guest would recognise it, whatever the field was called. */
export const billLines = (order) => {
  const items = order?.orderItems || order?.order_items || [];

  return items.map((item) => {
    const rate = num(item.unitPrice ?? item.price ?? item.unit_price);
    const qty = num(item.quantity ?? item.qty);
    // A line just saved carries a price and a count with no total worked out.
    const sent = parseFloat(item.subtotal ?? item.total ?? item.total_amount);

    return {
      name: item.productName || item.name || item.product_name || "Item",
      jain: item.jain === true || item.is_jain === true,
      qty,
      amount: Number.isFinite(sent) ? sent : rate * qty,
    };
  });
};

/**
 * @param order   the order the till has just saved
 * @param outlet  who is sending it — name, and anything else worth signing off with
 * @param who     the guest's name, if one was taken
 */
export const billMessage = (order, outlet = {}, who = "") => {
  const lines = billLines(order);
  const shop = outlet?.name || "Our kitchen";
  const symbol = cur();

  const billNo = order?.displayId || order?.display_id || "-";
  const when = billMoment(
    order?.order_date || order?.created_at || order?.createdAt || new Date()
  );

  const subtotal = num(order?.subtotal ?? order?.sub_total);
  const discount = num(order?.discount_amount ?? order?.discountAmount ?? order?.discount);
  const tax = num(order?.tax_amount ?? order?.taxAmount ?? order?.tax);
  const total = num(order?.total_amount ?? order?.totalAmount ?? order?.amount);

  const dishes = lines.length
    ? lines
      .map((l, i) => `${i + 1}. ${l.name}${l.jain ? " (Jain)" : ""} x ${l.qty} — ${symbol}${money(l.amount)}`)
      .join("\n")
    : "—";

  // Only the lines that carry a figure. A bill showing "Discount: 0.00" on
  // every sale teaches the reader to skip the part that sometimes matters.
  const totals = [
    `Subtotal: ${symbol}${money(subtotal)}`,
    discount > 0 ? `Discount: -${symbol}${money(discount)}` : null,
    tax > 0 ? `Tax: ${symbol}${money(tax)}` : null,
    `*Total: ${symbol}${money(total)}*`,
  ].filter(Boolean).join("\n");

  const greeting = who ? `Hello ${who},` : "Hello,";

  return [
    greeting,
    "",
    `Thank you for eating with us at *${shop}*.`,
    "",
    `Bill No: ${billNo}`,
    `Date: ${when}`,
    "",
    "*Items*",
    dishes,
    "",
    totals,
    "",
    "We hope to see you again soon.",
    `— ${shop}`,
  ].join("\n");
};

export default billMessage;
