/**
 * How a slip looks on paper — the bill and the kitchen ticket both.
 *
 * Written once here because the two used to carry their own copy of the same
 * stylesheet, and a fix to one silently left the other wrong.
 *
 * The rule this follows: NOTHING is measured in millimetres. A till printer
 * hands the page a width of its own — 72mm on the one at the counter, 80mm on
 * another, 58mm on the little ones a captain carries — and a slip built for a
 * fixed 80mm loses its last two columns on anything narrower. Rate and Amount
 * are the two columns furthest right, so the first thing to fall off the edge
 * is the price, which makes the bill worse than useless.
 *
 * So the page takes whatever width it is given and the columns divide it up in
 * percentages. The type steps down on narrow paper, because 48 characters do
 * not fit across 58mm at the size they fit across 80mm.
 */

export const RECEIPT_PRINT_CSS = `
  @media print {
    /* 'auto' means the paper the printer says it has. Naming a size here is
       what cut the old bills off. */
    @page { margin: 0; size: auto; }
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  body {
    font-family: 'Courier New', Courier, monospace;
    /* No fixed width and no auto margin: auto centring is what pushed the old
       slip sideways when the page turned out wider than it expected. */
    margin: 0;
    padding: 3mm 1.5mm 8mm 1.5mm;
    color: #000;
    font-size: 10.5px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  /* A thermal head draws a lot of current across a solid black run and shuts
     itself off mid-slip, so there are no filled blocks anywhere below. */

  /* HEADER */
  .shop-name { font-size: 14px; font-weight: 900; text-transform: uppercase; text-align: center; letter-spacing: 0.04em; margin-bottom: 1px; }
  .center { text-align: center; font-size: 9.5px; line-height: 1.5; }
  /* The owner's own words. Given air on both sides so they read as a line
     of their own rather than as part of the address. */
  .shop-tagline { margin: 1.5px 0 2.5px; font-style: italic; letter-spacing: 0.02em; }
  .doc-title { font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: center;
               margin: 6px 0 0; letter-spacing: 0.22em; padding: 2px 0;
               border-top: 1px solid #000; border-bottom: 1px solid #000; }

  /* DIVIDERS */
  .dash  { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .solid { border: none; border-top: 1.5px solid #000; margin: 4px 0; }
  .double-solid { border: none; border-top: 2.5px double #000; margin: 4px 0; }

  /* META ROWS (key: value pairs) */
  .meta { display: flex; justify-content: space-between; gap: 4px; font-size: 9.5px; line-height: 1.65; }
  .meta .k { color: #222; flex: 0 0 auto; }
  .meta .v { font-weight: 600; text-align: right; min-width: 0; }

  /* ITEMS TABLE
     table-layout: fixed keeps the columns at the widths asked for instead of
     letting a long dish name push Amount off the paper. */
  table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 4px; }
  thead tr { border-top: 1px solid #000; border-bottom: 1px solid #000; }
  thead th {
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 0;
    text-align: left;
  }
  thead th.r { text-align: right; }
  thead th.c { text-align: center; }

  tbody td { font-size: 9.5px; padding: 2px 0; vertical-align: top; }
  tbody td.r { text-align: right; }
  tbody td.c { text-align: center; }
  tbody td.bold { font-weight: 700; }

  .item-name { font-size: 9.5px; font-weight: 600; overflow-wrap: anywhere; }
  .item-sub  { font-size: 8.5px; color: #444; }
  .item-tag  { font-size: 8px; font-weight: 700; padding: 0 2px; border: 1px solid #000; border-radius: 2px; margin-left: 2px; white-space: nowrap; }
  .tag-ret { }
  .tag-new { }

  /* COL WIDTHS — shares of the paper, never millimetres */
  .col-sr   { width: 7%; }
  .col-name { width: 39%; }
  .col-qty  { width: 11%; text-align: center; }
  .col-rate { width: 19%; text-align: right; }
  .col-amt  { width: 24%; text-align: right; }

  /* TOTALS */
  tfoot td { font-size: 9.5px; padding: 1px 0; }
  tfoot td.r { text-align: right; font-weight: 600; }
  tfoot tr.grand td {
    font-size: 12px;
    font-weight: 900;
    padding: 3px 0;
    border-top: 1.5px solid #000;
    border-bottom: 1.5px solid #000;
  }
  tfoot tr.grand td.r { font-size: 12px; }

  /* TAX BOX */
  .tax-box { margin-top: 4px; }
  .tax-box .tax-title { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
  .tax-row { display: flex; justify-content: space-between; gap: 4px; font-size: 9.5px; line-height: 1.65; }

  /* PAYMENT */
  .pay-row { display: flex; justify-content: space-between; gap: 4px; font-size: 9.5px; line-height: 1.65; }

  /* FOOTER */
  .footer-items  { text-align: center; font-size: 8.5px; color: #333; margin-top: 5px; }
  .footer-thanks { text-align: center; font-size: 11px; font-weight: 700; margin-top: 3px; letter-spacing: 0.03em; }
  .footer-inv    { text-align: center; font-size: 8px; color: #555; margin-top: 1px; }

  /* Narrow rolls. The page box is the width the printer gave us, so these
     answer the paper rather than the screen. */
  @media (max-width: 68mm) {
    body { font-size: 9.5px; padding: 3mm 1mm 8mm 1mm; }
    .shop-name { font-size: 12.5px; letter-spacing: 0; }
    .doc-title { font-size: 10px; letter-spacing: 0.12em; }
    thead th { font-size: 8px; letter-spacing: 0; }
    tbody td, .item-name, .meta, .tax-row, .pay-row, tfoot td { font-size: 8.5px; }
    tfoot tr.grand td, tfoot tr.grand td.r { font-size: 11px; }
    .col-sr { width: 7%; } .col-name { width: 37%; }
    .col-qty { width: 11%; } .col-rate { width: 20%; } .col-amt { width: 25%; }
  }

  @media (max-width: 54mm) {
    body { font-size: 8.5px; }
    .shop-name { font-size: 11px; }
    .doc-title { font-size: 9px; letter-spacing: 0.06em; }
    thead th { font-size: 7.5px; }
    tbody td, .item-name, .meta, .tax-row, .pay-row, tfoot td { font-size: 8px; }
    .item-sub, .item-tag, .footer-inv { font-size: 7px; }
    tfoot tr.grand td, tfoot tr.grand td.r { font-size: 10px; }
  }
`;

export default RECEIPT_PRINT_CSS;
