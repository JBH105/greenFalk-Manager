/**
 * The arithmetic of a bill, and nothing else.
 *
 * No session, no storage, no country lookup — those live in gst.js, which
 * reads them and calls in here. Kept apart on purpose: this is the part that
 * decides what a guest is charged, and the part that decides what a guest is
 * charged should be testable by running it, not by reading it.
 *
 * Two countries' worth of rules, which come to two differences.
 *
 * EXCLUSIVE is India. The menu says 100, the rate goes on top, the guest pays
 * 105. The food is 100.
 *
 * INCLUSIVE is the UAE, where a price shown to a consumer must already have
 * the tax in it. The menu says 105, the guest pays 105, and 5 of that is the
 * tax. The food is 100. Add the rate here instead of taking it out and the
 * guest is charged 110.25 for a dish advertised at 105.
 *
 * Whatever the country, what comes back satisfies
 *
 *     subtotal − discount + taxAmount === total
 *
 * which is not tidiness. Every report the owner reads is built on it, so
 * `subtotal` is always the food NET of tax, and where the menu price carried
 * the tax the discount is net of it too. The guest still pays `total`.
 */

/**
 * @param lineTotal      menu price × quantity, summed, exactly as the menu reads
 * @param rate           share of the food the discount takes off, 0 to 1
 * @param taxPercentage  the rate charged, e.g. 5. Zero or less charges nothing
 * @param mode           "INCLUSIVE" where the menu price carries the tax
 */
export const totalsFor = (lineTotal, rate = 0, taxPercentage = 0, mode = "EXCLUSIVE") => {
  const gross = Number(lineTotal) || 0;
  const share = Math.min(Math.max(Number(rate) || 0, 0), 1);
  const percentage = Number(taxPercentage) || 0;

  const grossDiscount = gross * share;

  // Charging nothing is not a country's business: an outlet may simply not
  // charge tax, and then there is nothing to take out or put on.
  if (percentage <= 0) {
    return { subtotal: gross, discount: grossDiscount, taxAmount: 0, total: gross - grossDiscount };
  }

  if (mode === "INCLUSIVE") {
    // The tax comes out of the price rather than going on top of it.
    const net = 100 / (100 + percentage);
    const subtotal = gross * net;
    const discount = grossDiscount * net;
    const taxAmount = (subtotal - discount) * (percentage / 100);
    return { subtotal, discount, taxAmount, total: subtotal - discount + taxAmount };
  }

  // Tax on what is left after the discount — the order the two must happen in.
  const taxable = gross - grossDiscount;
  const taxAmount = taxable * (percentage / 100);
  return { subtotal: gross, discount: grossDiscount, taxAmount, total: taxable + taxAmount };
};

/**
 * The factor that turns a price carrying tax into the food underneath it.
 *
 * One where the tax is added on top, so a caller can multiply by it
 * unconditionally and not have to ask which country it is in.
 */
export const netOfTaxFactor = (taxPercentage = 0, mode = "EXCLUSIVE") => {
  const percentage = Number(taxPercentage) || 0;
  if (mode !== "INCLUSIVE" || percentage <= 0) return 1;
  return 100 / (100 + percentage);
};

/**
 * Two equal halves, where the country has them.
 *
 * Halved from the total rather than taxed twice, so the two lines add up to
 * it exactly and no rounding drifts between them.
 */
export const halves = (taxAmount) => {
  const total = Number(taxAmount) || 0;
  const first = total / 2;
  return { cgst: first, sgst: total - first };
};
