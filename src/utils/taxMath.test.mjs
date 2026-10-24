/**
 * What a guest is charged, checked by running it.
 *
 * Run with `npm run test:tax` from surtiswaad-manager, or
 * `node src/utils/taxMath.test.mjs`. No test framework: taxMath.js is pure
 * arithmetic with no imports, so plain node is enough, and a check nobody
 * can run is a check nobody runs.
 *
 * The two that matter most, and the reason this file exists:
 *
 *   India must keep charging 105 for a dish on the menu at 100.
 *   The UAE must charge 105 for a dish on the menu at 105.
 *
 * Getting the second one backwards charges every guest in Dubai five per
 * cent over the advertised price, on every bill, silently.
 */
import { totalsFor, netOfTaxFactor, halves } from "./taxMath.js";

let failures = 0;
const near = (a, b, eps = 0.000001) => Math.abs(a - b) < eps;

const check = (name, got, want) => {
  const ok = near(got, want);
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name.padEnd(52)} got ${got.toFixed(4)}  want ${want.toFixed(4)}`);
};

const invariant = (name, t) => {
  const ok = near(t.subtotal - t.discount + t.taxAmount, t.total);
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}: subtotal - discount + tax === total`);
};

console.log("\n=== INDIA: 5% GST added on top of the menu price ===");
{
  const t = totalsFor(100, 0, 5, "EXCLUSIVE");
  check("food (subtotal)", t.subtotal, 100);
  check("GST", t.taxAmount, 5);
  check("guest pays", t.total, 105);
  invariant("india, no discount", t);
}
{
  // 10% off a 100 menu total: 90 of food, GST on 90.
  const t = totalsFor(100, 0.1, 5, "EXCLUSIVE");
  check("discount", t.discount, 10);
  check("GST on the discounted food", t.taxAmount, 4.5);
  check("guest pays", t.total, 94.5);
  invariant("india, 10% off", t);
}

console.log("\n=== UAE: 5% VAT already inside the menu price ===");
{
  const t = totalsFor(105, 0, 5, "INCLUSIVE");
  check("food net of VAT", t.subtotal, 100);
  check("VAT", t.taxAmount, 5);
  check("guest pays the menu price", t.total, 105);
  invariant("uae, no discount", t);
}
{
  // THE one that matters: a dish advertised at 105 must cost 105.
  const t = totalsFor(105, 0, 5, "INCLUSIVE");
  check("menu price is what is charged", t.total, 105);
}
{
  // 10% off a 105 menu total: the guest pays 94.50, and the VAT inside it
  // is 4.50 — subtotal and discount both net.
  const t = totalsFor(105, 0.1, 5, "INCLUSIVE");
  check("net subtotal", t.subtotal, 100);
  check("net discount", t.discount, 10);
  check("VAT", t.taxAmount, 4.5);
  check("guest pays", t.total, 94.5);
  invariant("uae, 10% off", t);
}

console.log("\n=== No tax charged at all (either country) ===");
for (const mode of ["EXCLUSIVE", "INCLUSIVE"]) {
  const t = totalsFor(200, 0.25, 0, mode);
  check(`${mode}: subtotal`, t.subtotal, 200);
  check(`${mode}: discount`, t.discount, 50);
  check(`${mode}: tax`, t.taxAmount, 0);
  check(`${mode}: total`, t.total, 150);
  invariant(`${mode}, untaxed`, t);
}

console.log("\n=== Lines must add up to the bill (reports read item lines) ===");
{
  // Three dishes at UAE 5% inclusive, 10% off the table.
  const lines = [52.5, 21, 31.5];
  const rate = 0.1, pct = 5, mode = "INCLUSIVE";
  const perLine = lines.map((l) => totalsFor(l, rate, pct, mode));
  const whole = totalsFor(lines.reduce((a, b) => a + b, 0), rate, pct, mode);
  check("sum of line subtotals", perLine.reduce((s, t) => s + t.subtotal, 0), whole.subtotal);
  check("sum of line VAT", perLine.reduce((s, t) => s + t.taxAmount, 0), whole.taxAmount);
  check("sum of line totals", perLine.reduce((s, t) => s + t.total, 0), whole.total);
}

console.log("\n=== net-of-tax factor ===");
check("inclusive 5%", netOfTaxFactor(5, "INCLUSIVE"), 100 / 105);
check("exclusive 5% is 1", netOfTaxFactor(5, "EXCLUSIVE"), 1);
check("no rate is 1", netOfTaxFactor(0, "INCLUSIVE"), 1);

console.log("\n=== halves add up exactly ===");
{
  const h = halves(4.57);
  check("cgst + sgst", h.cgst + h.sgst, 4.57);
}

console.log(failures === 0
  ? "\nAll checks passed.\n"
  : `\n${failures} CHECK(S) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
