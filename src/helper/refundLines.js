/**
 * What can still be sent back on a paid bill, and what the refund is worth.
 *
 * A guest pays, leaves, then comes back: "I never ate that one." The cashier
 * opens the bill and takes that dish off. Two things have to be right for the
 * money to come out straight — which line of the bill is being sent back, and
 * how much that line alone is worth.
 */

const money = (n) => Number((Number(n) || 0).toFixed(2));

/**
 * One row per line of the bill, with what is left to send back.
 *
 * Refunds used to borrow the exchange list, which groups the bill by product.
 * A bill can carry the same dish on two lines — three paneer tikka as they
 * come and two made Jain, or a second round ordered later — and grouping them
 * collapsed the two into one row of five while keeping only one of the two
 * order-item ids. Sending five back then named a line that only had three, and
 * the server refused the refund outright.
 *
 * A RETURN row is the record of a refund already made, not something that can
 * be sent back again, so it is not offered.
 */
export const refundableLines = (orderItems = []) =>
  (orderItems || [])
    .filter((item) => item?.orderItemId && item?.type !== "RETURN")
    .map((item) => {
      const sold = Number(item.quantity) || 0;
      const alreadyBack = Number(item.refundQuantity) || 0;

      return {
        ...item,
        soldQuantity: sold,
        refundedQuantity: alreadyBack,
        remainingQuantity: Math.max(0, sold - alreadyBack),
      };
    })
    .filter((item) => item.remainingQuantity > 0);

/** What one line is worth when this many of it go back. */
export const refundLineAmounts = (line, quantity) => {
  const qty = Math.max(0, Number(quantity) || 0);
  const subtotal = money(qty * (Number(line?.unitPrice) || 0));
  const taxPercentage = Number(line?.taxPercentagePerProduct) || 0;
  const tax = money((subtotal * taxPercentage) / 100);

  return { subtotal, tax, total: money(subtotal + tax), taxPercentage };
};

/**
 * The payload the server is sent: one entry per line, each carrying its own
 * money.
 *
 * Every entry used to be stamped with the total of the whole refund. Sending
 * one dish back was right by accident — one line, so the line was the total —
 * but sending two back at once wrote the full amount against each of them, and
 * the server adds the rows up. A guest owed 520 was refunded 1040, and the
 * wrong figure went on to the bill, the drawer and the owner's report.
 */
export const buildRefundItems = (lines = []) =>
  (lines || [])
    .filter((line) => Number(line?.refundQty) > 0)
    .map((line) => {
      const qty = Number(line.refundQty) || 0;
      const { subtotal, tax, total, taxPercentage } = refundLineAmounts(line, qty);

      return {
        order_item_id: line.orderItemId,
        quantity: qty,
        unit_price: Number(line.unitPrice) || 0,
        refund_subtotal: subtotal,
        refund_tax: tax,
        refund_total: total,
        discount_percentage: 0,
        // Stored as nought before, whatever the dish was actually taxed at.
        tax_percentage: taxPercentage,
      };
    });

/** What the cashier is about to hand over, all lines together. */
export const refundTotals = (lines = []) =>
  buildRefundItems(lines).reduce(
    (sum, item) => ({
      subtotal: money(sum.subtotal + item.refund_subtotal),
      tax: money(sum.tax + item.refund_tax),
      total: money(sum.total + item.refund_total),
    }),
    { subtotal: 0, tax: 0, total: 0 }
  );
