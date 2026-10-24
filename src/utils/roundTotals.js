import { totalsAtRate } from "./gst";
import { discountRateOf } from "./discount";

/**
 * What one round of food comes to.
 *
 * A table orders in rounds, and each round is saved with its own money. The
 * bill the cashier settles is the sum of them.
 *
 * That sum is why this exists. A round used to be saved carrying the whole
 * table's subtotal rather than its own, so the second round added the first
 * one's money all over again: a table of 990 printed as 1830 on the held bill
 * and 990 on the invoice, and the two slips in a guest's hand disagreed by
 * 840 rupees. The dishes were right on both — only the money was counted
 * twice.
 *
 * The discount is charged once on the whole table, so a round carries its
 * share of it: a round that is a third of the food carries a third of the
 * discount. Tax follows the discounted amount, the same way it does on the
 * bill itself.
 *
 * @param roundItems   the dishes going to the kitchen on THIS round
 * @param wholeCart    every dish on the table, sent or not
 * @param discount     as the till holds it: a fraction under 1, or an amount
 */
export const roundTotals = (roundItems = [], wholeCart = [], discount = 0) => {
  const sumOf = (items) =>
    (items || []).reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
      0
    );

  const roundSubtotal = sumOf(roundItems);
  const cartSubtotal = sumOf(wholeCart);

  // The till holds a discount either way round: under 1 it is a fraction of
  // the bill, at 1 or over it is an amount off. The reading of that lives in
  // one place now, because three screens had drifted into three readings.
  const rate = discountRateOf(cartSubtotal, discount);

  // The rate is worked out on the whole table and handed over, because a
  // round that is a third of the food carries a third of the discount — not
  // the whole of it, which is what asking for the round's own rate would give.
  //
  // Whether tax is added to these prices or already inside them is the
  // country's business and not this file's; see gst.js.
  const { subtotal, discount: discountOnThisRound, taxAmount, total } =
    totalsAtRate(roundSubtotal, rate);

  return { subtotal, discount: discountOnThisRound, taxAmount, total };
};

export default roundTotals;
