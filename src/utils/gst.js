import { onceAtATime } from "./onceAtATime";
import { discountRateOf } from "./discount";
import { halves, netOfTaxFactor, totalsFor } from "./taxMath";
/**
 * Tax for the bill.
 *
 * Tax used to be carried per product. It is now a single rate set by the
 * tenant and applied to the whole bill, which is how a restaurant actually
 * charges it. The rate arrives with the login response and is cached in the
 * auth session, so a reload does not drop the rate mid-shift.
 *
 * What is DONE with that rate depends on the country, and there are two
 * differences that matter.
 *
 * The first is where the tax sits. In India a menu price is tax-exclusive:
 * the menu says 100, GST is added, the guest pays 105. In the UAE a price
 * shown to a consumer must already include VAT: the menu says 105, the guest
 * pays 105, and 5 of that is VAT. So one country adds the rate on and the
 * other takes it out, and getting it backwards does not merely mislabel a
 * line on a slip — it charges the guest the wrong money.
 *
 * The second is whether it splits. India halves GST on an intra-state sale
 * into CGST (central) and SGST (state), so the halves are derived here and
 * never entered, which makes an uneven split impossible. The UAE does not
 * split VAT at all, and a Dubai bill carrying CGST and SGST lines is not a
 * valid tax invoice.
 *
 * Both answers come from the server with the rate, so no screen decides them.
 * A till that has not heard otherwise behaves as India did before any of this
 * existed.
 */

// Read through getAuth for the same reason the token is: this window’s
// session, not whatever the browser last stored.
import { getAuth } from "./authSession";

// Settings fetched after login live here. The copy inside the auth session is
// only a starting point — the owner can change the rate while a till is
// signed in, and the till must not need a re-login to pick that up.
const GST_KEY = "pos-gst-settings";

const OFF = {
  enabled: false,
  percentage: 0,
  cgstPercentage: 0,
  sgstPercentage: 0,
  label: "GST",
  mode: "EXCLUSIVE",
  split: true,
  registrationLabel: "GSTIN",
  invoiceTitle: "Tax Invoice",
};

/**
 * Turns a raw settings object into the shape the till uses.
 *
 * Every default here is India's, deliberately. A till holding settings cached
 * before the server knew about countries has none of the new keys, and the
 * only safe reading of that silence is the behaviour the till already had.
 */
const normalise = (gst) => {
  const shared = {
    label: gst?.tax_label || "GST",
    mode: gst?.tax_mode === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
    split: gst?.tax_split === undefined ? true : gst.tax_split === true,
    registrationLabel: gst?.registration_label || "GSTIN",
    invoiceTitle: gst?.invoice_title || "Tax Invoice",
  };

  if (!gst?.gst_enabled) return { ...OFF, ...shared };

  const percentage = Number(gst.gst_percentage) || 0;
  if (percentage <= 0) return { ...OFF, ...shared };

  return {
    ...shared,
    enabled: true,
    percentage,
    cgstPercentage: shared.split ? percentage / 2 : 0,
    sgstPercentage: shared.split ? percentage / 2 : 0,
  };
};

/**
 * Pulls the current tax settings from the server and caches them, so a rate
 * the owner changes mid-shift reaches the till without a re-login.
 */
export const refreshGstSettings = async (api, outletId, { force = false } = {}) =>
  onceAtATime(
    "gst:" + (outletId || "none"),
    () => reallyRefreshGstSettings(api, outletId),
    { force }
  );

const reallyRefreshGstSettings = async (api, outletId) => {
  try {
    // The rate follows the outlet: one branch may charge 18% where another
    // charges 5%, or none at all. Without the outlet the server would hand
    // back the restaurant default, which is not what this till charges.
    const res = await api.get("/tenant/settings/gst", {
      params: outletId ? { outlet_id: outletId } : undefined,
    });
    const gst = res?.data?.data;
    if (gst) localStorage.setItem(GST_KEY, JSON.stringify(gst));
  } catch (err) {
    // keep the cached value rather than silently dropping to no-GST
  }
};

/** Clear on logout so the next tenant does not inherit these. */
export const clearGstSettings = () => {
  try {
    localStorage.removeItem(GST_KEY);
  } catch (err) {
    // ignore
  }
};

/** The tenant's tax settings. Safe to call during render. */
export const getGst = () => {
  try {
    // Prefer the copy fetched after sign-in: the owner may have changed the
    // rate since this till logged in, and the session copy would be stale.
    const fresh = localStorage.getItem(GST_KEY);
    if (fresh) return normalise(JSON.parse(fresh));

    const raw = getAuth() ? JSON.stringify(getAuth()) : null;
    if (!raw) return OFF;

    return normalise(JSON.parse(raw)?.user?.gst);
  } catch (err) {
    // private mode, or no session yet — charge nothing rather than guess
    return OFF;
  }
};

/** Whether the menu price already contains the tax. */
export const taxIsInsidePrice = () => getGst().mode === "INCLUSIVE";

/**
 * The factor that turns a menu price into the food underneath it.
 *
 * One where the tax is added on top, so a caller can multiply by it without
 * asking which country it is in.
 */
export const netOfTax = () => {
  const tax = getGst();
  return netOfTaxFactor(tax.enabled ? tax.percentage : 0, tax.mode);
};

/** What the bill calls the tax: GST, VAT. */
export const taxLabel = () => getGst().label;

/** What the seller's registration number on the bill is called: GSTIN, TRN. */
export const registrationLabel = () => getGst().registrationLabel;

/**
 * What to head a bill with.
 *
 * The words "Tax Invoice" are what make a slip a tax invoice rather than a
 * receipt, and in the UAE they are required on it. They are equally true of
 * an Indian bill that charges GST under a printed GSTIN, so the only bill
 * headed plainly is one with no tax charged on it at all.
 */
export const billHeading = () => (getGst().enabled ? getGst().invoiceTitle : "Invoice");

/**
 * The line that tells a guest the tax is already in the prices above.
 *
 * Empty where it is not, so a screen can print this unconditionally.
 */
export const taxIncludedNote = () => {
  const tax = getGst();
  if (!tax.enabled || tax.mode !== "INCLUSIVE") return "";
  return `Prices include ${tax.label} at ${tax.percentage}%`;
};

/**
 * What a bill comes to, worked out from the prices on the menu.
 *
 * The one place the arithmetic lives. Three screens used to do this
 * themselves — the cart, the dashboard and the round that goes to the
 * kitchen — and three copies of a sum is three chances for a guest to be
 * handed two slips that disagree.
 *
 * Whatever the country, what comes back satisfies
 *
 *     subtotal − discount + taxAmount === total
 *
 * and that is not a tidiness: every report on the owner's dashboard is built
 * on it. `subtotal` is therefore always the food NET of tax, and in a country
 * where the menu price includes the tax the discount is net of it too. The
 * guest still pays `total`, which in that country is exactly the menu prices
 * less the discount — nothing is added at the till.
 *
 * @param lineTotal  the sum of menu price × quantity, exactly as the menu reads
 * @param discount   as the till holds it: a fraction under 1, or an amount off
 */
export const billTotals = (lineTotal, discount = 0) =>
  totalsAtRate(lineTotal, discountRateOf(lineTotal, discount));

/**
 * The same sum, where the share to take off has already been worked out.
 *
 * A table ordering in rounds needs this: the discount is agreed once on the
 * whole table, so a round that is a third of the food carries a third of the
 * discount. Working the rate out from the round's own subtotal instead would
 * give every round the full discount.
 *
 * @param lineTotal  menu price × quantity for the part being totalled
 * @param rate       the share of the food to take off, 0 to 1
 */
export const totalsAtRate = (lineTotal, rate = 0) => {
  const tax = getGst();

  // The arithmetic itself is in taxMath.js, with no session or storage
  // anywhere near it, so that the part deciding what a guest is charged can
  // be tested by running it.
  const sums = totalsFor(
    lineTotal,
    rate,
    tax.enabled ? tax.percentage : 0,
    tax.mode
  );

  const split = tax.enabled && tax.split ? halves(sums.taxAmount) : { cgst: 0, sgst: 0 };

  return {
    ...sums,
    percentage: tax.enabled ? tax.percentage : 0,
    label: tax.label,
    mode: tax.mode,
    split: tax.split,
    // Zero where the country does not split, so a screen printing these two
    // shows nothing rather than half a rate under a name that means nothing.
    ...split,
    cgstPercentage: tax.cgstPercentage,
    sgstPercentage: tax.sgstPercentage,
  };
};

/**
 * Tax on an amount that is already net of tax and net of discount.
 *
 * The old way in, kept for the screens that hold a taxable figure and want
 * nothing but the tax on it. It cannot be used where the menu price carries
 * the tax, because an amount alone does not say whether the tax is in it —
 * `billTotals` is the one that knows, so use that.
 */
export const calculateGst = (taxableAmount) => {
  const gst = getGst();
  const base = Number(taxableAmount) || 0;

  if (!gst.enabled || base <= 0) {
    return {
      total: 0, cgst: 0, sgst: 0, percentage: 0,
      cgstPercentage: 0, sgstPercentage: 0,
      label: gst.label, split: gst.split,
    };
  }

  const total = (base * gst.percentage) / 100;
  // Halve the computed total rather than taxing twice, so the two lines always
  // add up to the total exactly, with no rounding drift.
  const cgst = gst.split ? total / 2 : 0;

  return {
    total,
    cgst,
    sgst: gst.split ? total - cgst : 0,
    percentage: gst.percentage,
    cgstPercentage: gst.cgstPercentage,
    sgstPercentage: gst.sgstPercentage,
    label: gst.label,
    split: gst.split,
  };
};

/**
 * Splits the tax already stored on a saved bill, for reprints.
 *
 * The rate recorded on the order is preferred over the current setting, so an
 * old invoice still prints the rate it was charged at. Whether to show it as
 * one line or two follows the country as it stands now — a restaurant does
 * not move, and a bill reprinted in Dubai was never a CGST bill.
 */
export const splitStoredTax = (taxAmount, storedPercentage) => {
  const gst = getGst();
  const total = Number(taxAmount) || 0;
  const percentage = Number(storedPercentage) || gst.percentage || 0;
  const cgst = gst.split ? total / 2 : 0;

  return {
    total,
    cgst,
    sgst: gst.split ? total - cgst : 0,
    percentage,
    cgstPercentage: gst.split ? percentage / 2 : 0,
    sgstPercentage: gst.split ? percentage / 2 : 0,
    label: gst.label,
    split: gst.split,
    mode: gst.mode,
  };
};
