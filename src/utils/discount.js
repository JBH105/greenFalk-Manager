/**
 * What a discount actually takes off a bill.
 *
 * The till holds a discount in one of two ways, and has since long before
 * this file: a number under 1 is a fraction of the food, anything from 1 up
 * is a straight amount off. Every screen that shows or sends a discount has
 * to read that the same way.
 *
 * They did not. The cart and the bill took the fraction off the food; the
 * payment screen took it off the food *and the tax*, so on a 600 bill with
 * 10% off the guest was charged 567 — sixty rupees off — while the screen
 * in front of them said the discount was 62.70. The money taken was right
 * and the figure beside it was wrong, which is the worst way round for
 * something a guest reads over the cashier's shoulder.
 *
 * So the rule lives here now, once, and the screens ask rather than repeat.
 *
 * Discount comes off the food, never off the tax: the tax is then charged on
 * what is left, which is the order the two have to happen in.
 */

/** The fraction of the food this discount removes — always 0 to 1. */
export const discountRateOf = (subtotal, discount) => {
  const held = Number(discount) || 0;
  const food = Number(subtotal) || 0;

  if (held <= 0) return 0;
  if (held < 1) return held;

  // An amount off, expressed as the share of the food it eats. An amount
  // larger than the bill would otherwise hand back a rate above 1 and turn
  // the total negative.
  if (food <= 0) return 0;
  return Math.min(held / food, 1);
};

/** The money this discount takes off, in rupees. */
export const discountAmountOf = (subtotal, discount) =>
  (Number(subtotal) || 0) * discountRateOf(subtotal, discount);
