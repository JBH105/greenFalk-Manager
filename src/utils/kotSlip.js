/**
 * The kitchen's copy of a round, on paper.
 *
 * A restaurant without a screen in the kitchen still has to know what to cook.
 * This is that: one ticket per round, printed the moment the round is sent.
 *
 * Nothing about money is on it, and that is deliberate rather than an omission.
 * A cook needs the table, the dishes and the specials; a price on the ticket is
 * one more thing to read past, and a ticket that looks like a bill is a ticket
 * that ends up handed to a guest.
 *
 * It reads as a list, not as a menu. The first version printed each dish under
 * its section — STARTERS, BREADS, DESSERTS — which is how the menu is arranged
 * and not how a ticket is read: three dishes became nine lines, and the cook
 * had to look past six headings to find them. So the sections are gone and
 * what is left is the two things being asked for, in two columns, with the
 * name, the date and the time above them.
 *
 * Built straight into the printer's language rather than read back off a
 * rendered slip, as the bill is. The bill is printed from three different
 * screens and must come out identical from each, so it has one layout they all
 * render. This has exactly one source and no screen at all — it is printed by a
 * till with nothing on display — so a hidden page to read it back from would be
 * a copy nobody ever looks at.
 */

import { Slip, wrap, printable, twoUp } from "./escpos";
import { tableLabel, ticketPerson } from "./kitchen";
import { money } from "./currency";

/**
 * Room enough for a line of double-height letters, in printer dots.
 *
 * A normal line is about thirty and a double-height letter is about
 * thirty-four, so the default leaves them touching. This is that height
 * with air, which is what makes the heading read as two lines rather
 * than one smudge.
 */
const BIG_LINE = 64;

/**
 * And a blank line between them, kept short.
 *
 * The spacing above should be enough on its own. It is not trusted to be:
 * this printer has already refused one thing it was told to do, and a
 * printer that quietly ignores the line-spacing command prints PARCEL and
 * its token on top of each other — which is exactly what came out. An
 * empty line is not an instruction about spacing, it is paper moving, and
 * a printer that ignores the short setting simply feeds a whole line
 * instead. Wrong in the roomy direction, which is the one to be wrong in.
 */
const GAP_LINE = 16;


/**
 * Columns for a slip that carries money, in characters.
 *
 * The amount has no currency on it, which is what makes it fit: the column
 * is headed once and `Rs.` on every row costs three characters of dish name
 * forty times a day. The total underneath carries the symbol, because that
 * is the one number read on its own.
 */
const QTY_ROOM = 3;
const AMOUNT_ROOM = 8;

const at = (timestamp) => {
  const when = timestamp ? new Date(timestamp) : new Date();
  return Number.isNaN(when.getTime()) ? new Date() : when;
};

/** Time of day as the kitchen reads it off a clock on the wall. */
export const kotTime = (timestamp) => {
  const when = at(timestamp);
  const h = when.getHours();
  const m = String(when.getMinutes()).padStart(2, "0");
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m} ${suffix}`;
};

/** The day, written the way it is written here rather than the way a machine stores it. */
export const kotDate = (timestamp) => {
  const when = at(timestamp);
  const d = String(when.getDate()).padStart(2, "0");
  const m = String(when.getMonth() + 1).padStart(2, "0");
  return `${d}-${m}-${when.getFullYear()}`;
};

/**
 * What this ticket is for, in the two or three characters the cook looks at.
 *
 * `seatsPeople` false is a shop with no tables at all — an ice-cream counter
 * or a takeaway window. There, every ticket is the same kind of ticket and
 * calling it a PARCEL says nothing: the guest is standing at the counter
 * waiting, not collecting something wrapped. The token underneath is what
 * actually tells the two tickets apart.
 */
export const kotHeading = (order, { seatsPeople = true } = {}) => {
  const type = String(order?.cartData?.orderType || order?.order_type || "").toUpperCase();
  const table = order?.cartData?.table?.tableNumber;

  // A counter sells two things, and whoever is making it has to know which:
  // one is eaten standing at the counter, the other goes into a bag.
  if (!seatsPeople) return type === "PARCEL" ? "PARCEL" : "ORDER";

  if (type === "PARCEL" || (!table && type)) return "PARCEL";
  return table ? tableLabel(table) : "COUNTER";
};

/**
 * The dishes, in the order they were rung up.
 *
 * Jain belongs on the dish's own line rather than under it: it is part of what
 * to cook, not a footnote, and a ticket that keeps it beside the name stays a
 * line shorter for every such dish.
 */
export const kotDishes = (items = []) =>
  items
    .map((item) => {
      const qty = Number(item?.quantity) || 0;
      if (qty <= 0) return null;

      const name = String(item?.name || item?.product_name || "Item").trim();
      const jain = item?.jain === true || item?.is_jain === true;

      // What this line came to. The rate is not printed — a slip wide
      // enough for both leaves the dish name too narrow to read — and this
      // is the figure that adds up to the total underneath.
      const rate = Number(item?.price ?? item?.unitPrice ?? 0) || 0;

      return {
        qty,
        name: jain ? `${name} (Jain)` : name,
        note: String(item?.note || "").trim(),
        amount: rate * qty,
      };
    })
    .filter(Boolean);

/**
 * What the slip comes to.
 *
 * The bill's own figure where there is one, since that is what was charged
 * and it carries whatever discount was given. Added up from the lines only
 * when there is not — a round sent before this existed, or one written by
 * hand — so a slip never shows nothing where a number belongs.
 */
export const kotTotal = (order, dishes = []) => {
  const stored = Number(order?.cartData?.totalAmountToPay ?? 0);
  if (stored > 0) return stored;
  return dishes.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
};

/** How many plates are on the ticket, which is what the cook counts back. */
export const kotItemCount = (items = []) =>
  items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);

/**
 * A big line, put in the middle of the paper by counting.
 *
 * Double-size letters are twice as wide, so half as many fit across the
 * roll — which is why the middle is worked out in half-widths and then
 * written in double-width spaces.
 *
 * Counted here rather than left to the printer's own centring, and that is
 * the point. This printer has already refused one thing it was supposed to
 * do; a heading whose position depends on it agreeing about how wide a
 * double letter is can come out anywhere. Every column is now decided in
 * the bytes, so the paper can only show what was sent.
 */
const middle = (text, width, times = 2) => {
  const t = printable(text).trim();
  const room = Math.floor(width / times);
  if (t.length >= room) return t.slice(0, room);

  /**
   * Rounded, not floored — and on a single huge digit that is the whole
   * difference between centred and visibly off to the left.
   *
   * The padding is made of spaces as wide as the letters they are pushing,
   * so a token at four times size can only be placed in steps of four
   * characters. Half a step lost to rounding down is two characters of
   * paper, which on a 58mm roll is a couple of millimetres of a number
   * that is the biggest thing on the slip. Rounding up costs nothing: the
   * step is there either way.
   */
  return " ".repeat(Math.round((room - t.length) / 2)) + t;
};

/**
 * A dish, how many, and what they come to — three columns on one line.
 *
 * The name gives way rather than the figures: a cook reading "Butterscotch
 * Co..." knows the dish, and a guest reading a cut-off amount does not know
 * the price.
 */
const moneyRow = (name, qty, amount, width) => {
  const room = width - QTY_ROOM - AMOUNT_ROOM - 2;
  const n = printable(name ?? "");
  const left = n.length > room ? n.slice(0, room) : n.padEnd(room, " ");
  return (
    left + " " +
    printable(qty ?? "").padStart(QTY_ROOM, " ") + " " +
    printable(amount ?? "").padStart(AMOUNT_ROOM, " ")
  );
};

/** Two things on one line, one pushed to each edge. */
const pad = (left, right, width) => {
  const l = printable(left ?? "");
  const r = printable(right ?? "");
  const room = width - r.length - 1;
  if (room < 1) return r.slice(-width);
  const cut = l.length > room ? l.slice(0, room) : l;
  return cut + " ".repeat(width - cut.length - r.length) + r;
};

/**
 * @param order  one held order — one round
 * @param width  characters across the roll
 * @param font   the printer's bigger ("A") or smaller ("B") built-in face
 */
export const kotSlip = (order, { width = 42, font = "B", seatsPeople = true, cut } = {}) => {
  const slip = new Slip(width, { font, cut });

  const items = order?.cartData?.orderItems || [];
  const dishes = kotDishes(items);
  const heading = kotHeading(order, { seatsPeople });
  const person = ticketPerson(order);
  const round = Number(order?.kotNumber) || 1;
  const token = order?.tokenNo ?? null;
  const hasToken = token !== null && token !== undefined && String(token).length > 0;

  /**
   * Money, but only on a slip somebody is waiting with.
   *
   * A token means a guest standing at a counter holding this. They paid a
   * moment ago and it is the only piece of paper they have, so what they paid
   * for belongs on it — and the slip doubles as their receipt without anybody
   * printing a second one.
   *
   * A table's round has no token. It goes to the kitchen and nowhere else,
   * the bill comes later and in full, and a price on a cook's ticket is one
   * more thing to read past on the way to the dish.
   */
  const showMoney = hasToken;
  const stamp = order?.timestamp || order?.createdAt;

  /* ── WHERE IT GOES ──────────────────────────────────────────────────────
     Twice the size and alone on its line. A cook reads this across a hot
     kitchen from a spike of tickets, and everything else on the slip is
     detail by comparison.

     Centred once, by counting. It was being centred twice — padded with
     ordinary-width spaces here and then centred again by the printer in
     double-width ones — which pushed it right, and pushed the two lines of
     a parcel heading by different amounts so they no longer lined up with
     each other. The printer is now told nothing about where to put it and
     simply prints what it is given. */
  slip.rule("=");
  slip.thinGap(8);

  // Room for letters twice as tall. Without it the two lines of a parcel
  // heading print on top of one another.
  slip.spacing(BIG_LINE).align("left").size(2).bold(true);
  slip.line(middle(heading, width));

  // The number a waiting guest is called by. A parcel has one; a table is
  // its own number. It belongs in the same big block: at the counter it is
  // read from further away than anything else on the slip.
  if (hasToken) {
    /**
     * On one line, at the same size as the heading above it.
     *
     * It was tried four times over, the word small and the number enormous,
     * and on paper it was too much: a single digit the height of a thumb
     * pushed everything else down the slip and made the thing it was on look
     * like a raffle ticket rather than a receipt. Twice the size is already
     * the biggest thing here and is read across a counter perfectly well.
     *
     * Out of double size for the blank line, so the gap is a gap and not
     * another tall empty row, then back into it for the number itself.
     */
    slip.size(1).spacing(GAP_LINE).line("").spacing(BIG_LINE).size(2);
    slip.line(middle(`TOKEN ${token}`, width));
  }

  slip.size(1).bold(false).spacing(null);
  slip.thinGap(8);
  slip.rule("=");

  /* ── WHEN, AND WHOSE ─────────────────────────────────────────────────────
     Labelled and pushed to the edges, so the eye finds a value by looking
     down one side rather than reading each line through. */
  /**
   * The day at one edge and the clock at the other, on one line.
   *
   * Two lines, each with a label, for two halves of the same moment: the
   * labels said nothing a date and a time do not say for themselves, and
   * three lines of header above four lines of food is a slip that is mostly
   * header.
   */
  slip.line(pad(kotDate(stamp), kotTime(stamp), width));
  // Only a real one. "Parcel" is what the till writes when nobody was asked,
  // and it is now read as the placeholder it is — so this line appears when
  // somebody's name is actually on the bill, at a counter as much as at a
  // table, and not otherwise.
  if (person?.name) slip.line(pad("Name", printable(person.name), width));

  // Only from the second round on. The first round of a table is new by
  // definition, and saying so on every ticket teaches the cook to skip the line.
  if (round > 1) slip.line(pad("Round", String(round), width));

  /* ── WHAT TO COOK ───────────────────────────────────────────────────────
     Two columns and a heading over them. The count sits hard against the
     right edge, on its own, because reading three as one is the single
     mistake a printed ticket invites. */
  const nameRoom = showMoney
    ? width - QTY_ROOM - AMOUNT_ROOM - 2
    : width - 4 - 1;

  slip.rule("-");
  slip.bold(true);
  slip.line(showMoney ? moneyRow("ITEM", "QTY", "AMOUNT", width) : pad("ITEM", "QTY", width));
  slip.bold(false);
  slip.rule("-");

  for (const dish of dishes) {
    const lines = wrap(printable(dish.name), nameRoom);

    slip.bold(true);
    slip.line(
      showMoney
        ? moneyRow(lines[0] ?? "", String(dish.qty), dish.amount.toFixed(2), width)
        : pad(lines[0] ?? "", String(dish.qty), width)
    );
    slip.bold(false);
    for (const extra of lines.slice(1)) slip.line("  " + extra);

    if (dish.note) {
      for (const bit of wrap(printable(dish.note), nameRoom - 4)) {
        slip.line("  - " + bit);
      }
    }
  }

  /* ── HOW MANY PLATES ────────────────────────────────────────────────── */
  slip.rule("-");

  /**
   * How many plates, for the cook and nobody else.
   *
   * It is what a kitchen counts back against the ticket before the food
   * leaves the pass. A guest at a counter has the food in front of them and
   * can see there are four things in the bag; under a line already saying
   * what they paid, it is a number that answers nothing.
   */
  if (!showMoney) {
    slip.bold(true).line(pad("Total items", String(kotItemCount(items)), width)).bold(false);
  }

  /**
   * What it came to, taller than everything around it.
   *
   * Height alone and not width: doubling the width halves how many characters
   * the line holds, and the one line that must never wrap is the one carrying
   * the amount. A total reading "Rs.1155." with the "00" underneath is worse
   * than a total in ordinary type.
   */
  if (showMoney) {
    slip.bold(true).tall(true);
    slip.line(twoUp("TOTAL", printable(money(kotTotal(order, dishes))), width));
    slip.tall(false).bold(false);
  }

  slip.rule("=");

  slip.cut();
  return slip;
};

export default kotSlip;
