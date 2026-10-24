/**
 * Turns the bill that is already built into lines the printer can take.
 *
 * The obvious way to print in the printer's own language would be to build the
 * bill a second time, from the order, in text. That second copy would drift:
 * someone adds the Jain mark, or a refund line, or changes how a discount is
 * shown, in the one they can see — and the printed bill quietly keeps saying
 * the old thing. Every restaurant that has two copies of its bill layout ends
 * up with two different bills.
 *
 * So this reads the slip the components already render, through the class names
 * they already use, and writes it out as characters. One layout, two ways out.
 */

import { Slip, twoUp, centred, wrap, printable } from "./escpos";

/** The item table's columns, measured in characters rather than millimetres. */
const columns = (width) => {
  // qty, rate and amount are what a guest checks, so they keep their room and
  // the dish name takes what is left.
  const qty = width >= 42 ? 4 : 3;
  const rate = width >= 42 ? 8 : 6;
  const amt = width >= 42 ? 9 : 8;
  const sr = width >= 42 ? 3 : 2;
  const name = width - sr - qty - rate - amt;
  return { sr, name, qty, rate, amt };
};

const right = (s, n) => {
  const t = String(s ?? "");
  return t.length >= n ? t.slice(-n) : " ".repeat(n - t.length) + t;
};
const left = (s, n) => {
  const t = String(s ?? "");
  return t.length >= n ? t.slice(0, n) : t + " ".repeat(n - t.length);
};
const middle = (s, n) => {
  const t = String(s ?? "");
  if (t.length >= n) return t.slice(0, n);
  const pad = n - t.length;
  return " ".repeat(Math.floor(pad / 2)) + t + " ".repeat(Math.ceil(pad / 2));
};

// Read as the printer will print it, so every width counted below is the
// width the paper will actually show.
const textOf = (el) => printable((el?.textContent || "").replace(/\s+/g, " ").trim());

/**
 * @param root   the hidden node the slip is rendered into
 * @param width  characters across the paper
 * @param font   "A" is the printer’s bigger face, "B" the smaller one that
 *               fits the five columns without wrapping
 * @param cut    which cut command this printer answers to - see CUT_STYLES
 */
export const slipFromDom = (root, width = 42, font = "B", cut) => {
  const slip = new Slip(width, { font, cut });
  const col = columns(width);

  const writeRow = (cells, { bold = false } = {}) => {
    const [sr, name, qty, rate, amt] = cells;
    const names = wrap(name, col.name - 1);
    slip.bold(bold);
    slip.line(
      right(sr, col.sr) +
      " " + left(names[0] ?? "", col.name - 1) +
      middle(qty, col.qty) +
      right(rate, col.rate) +
      right(amt, col.amt)
    );
    // A long dish name runs on under itself, with the numbers left alone.
    for (const extra of names.slice(1)) {
      slip.line((" ".repeat(col.sr + 1) + extra).replace(/\s+$/, ""));
    }
    slip.bold(false);
  };

  for (const el of root.children) {
    const cls = el.classList;

    if (cls.contains("shop-name")) {
      slip.align("center").size(2).bold(true).line(textOf(el)).bold(false).size(1).align("left");
      continue;
    }

    // The owner's own words, set apart from the name above and the address
    // below. Printed they were pressed against both and read as neither.
    if (cls.contains("shop-tagline")) {
      slip.thinGap();
      for (const bit of wrap(textOf(el), width)) slip.line(centred(bit, width));
      slip.thinGap();
      continue;
    }

    if (cls.contains("center")) {
      slip.line(centred(textOf(el), width));
      continue;
    }

    if (cls.contains("doc-title")) {
      slip.rule("=");
      slip.bold(true).line(centred(textOf(el), width)).bold(false);
      slip.rule("=");
      continue;
    }

    if (el.tagName === "HR") {
      slip.rule(cls.contains("solid") || cls.contains("double-solid") ? "=" : "-");
      continue;
    }

    if (cls.contains("meta") || cls.contains("tax-row") || cls.contains("pay-row")) {
      const k = textOf(el.children[0]);
      const v = textOf(el.children[1]);
      slip.line(twoUp(k, v, width));
      continue;
    }

    if (cls.contains("tax-box")) {
      for (const inner of el.children) {
        if (inner.tagName === "HR") { slip.rule("-"); continue; }
        if (inner.classList.contains("tax-title")) {
          slip.bold(true).line(textOf(inner)).bold(false);
          continue;
        }
        if (inner.classList.contains("tax-row")) {
          slip.line(twoUp(textOf(inner.children[0]), textOf(inner.children[1]), width));
          continue;
        }
        const t = textOf(inner);
        if (t) slip.line(t);
      }
      continue;
    }

    if (el.tagName === "TABLE") {
      const head = el.querySelector("thead tr");
      if (head) {
        const c = head.children;
        slip.rule("-");
        writeRow(
          [textOf(c[0]), textOf(c[1]), textOf(c[2]), textOf(c[3]), textOf(c[4])],
          { bold: true }
        );
        slip.rule("-");
      }

      for (const tr of el.querySelectorAll("tbody tr")) {
        const c = tr.children;

        // the EXCHANGES banner is one cell spanning the row
        if (c.length === 1) {
          slip.rule("-");
          slip.bold(true).line(centred(textOf(c[0]), width)).bold(false);
          slip.rule("-");
          continue;
        }

        const nameCell = c[1];
        const dish = textOf(nameCell.querySelector(".item-name")) || textOf(nameCell);
        // JAIN, RET and NEW are their own small line under the dish
        const marks = [...nameCell.children]
          .filter((n) => !n.classList.contains("item-name"))
          .map(textOf)
          .filter(Boolean);
        const tags = [...nameCell.querySelectorAll(".item-tag")].map(textOf).filter(Boolean);

        writeRow([textOf(c[0]), dish, textOf(c[2]), textOf(c[3]), textOf(c[4])]);
        for (const m of [...marks, ...tags]) {
          if (dish.includes(m)) continue;
          slip.line(" ".repeat(col.sr + 1) + "* " + m);
        }
      }

      for (const tr of el.querySelectorAll("tfoot tr")) {
        const cells = [...tr.children];
        const label = cells.map(textOf).filter(Boolean);
        if (!label.length) continue;
        const value = label[label.length - 1];
        const name = label.slice(0, -1).join(" ");

        if (tr.classList.contains("grand")) {
          slip.rule("=");
          // The amount keeps its size whatever it costs, because this is the
          // number the guest checks and a total set in the same type as the
          // dish list does not read as the total.
          //
          // Big letters are twice as wide as well as twice as tall, so this
          // line holds half as many. When the label and the amount will not
          // share that half, the label goes on a line of its own and the
          // amount keeps the next one to itself — still large, still whole.
          // Shrinking it to make it fit, or letting it wrap, both end with a
          // guest reading the wrong number.
          const label = name || "TOTAL";
          const half = Math.floor(width / 2);

          if (label.length + 1 + value.length <= half) {
            slip.bold(true).size(2).line(twoUp(label, value, half)).size(1).bold(false);
          } else if (value.length <= half) {
            slip.bold(true).size(2)
              .line(label)
              .line(twoUp("", value, half))
              .size(1).bold(false);
          } else {
            // Longer than the paper can hold in big type at all — a total this
            // size has never been rung up, but it prints rather than wraps.
            slip.bold(true).tall(true).line(twoUp(label, value, width)).tall(false).bold(false);
          }
          slip.rule("=");
          continue;
        }
        slip.line(twoUp(name, value, width));
      }
      continue;
    }

    if (cls.contains("footer-thanks")) {
      slip.bold(true).line(centred(textOf(el), width)).bold(false);
      continue;
    }

    if (cls.contains("footer-items") || cls.contains("footer-inv")) {
      for (const bit of wrap(textOf(el), width)) slip.line(centred(bit, width));
      continue;
    }

    const plain = textOf(el);
    if (plain) for (const bit of wrap(plain, width)) slip.line(bit);
  }

  slip.cut();
  return slip;
};

export default slipFromDom;
