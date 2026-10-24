/**
 * The printer's own language.
 *
 * A till printer will take a picture of a page, and that is what the browser
 * sends it: every dot of an 80mm-wide bitmap. Ours refuses — the error light
 * comes on and nothing comes out, even for a single line of text. What it does
 * take, and what its own self-test prints in, is ESC/POS: letters and a few
 * short commands. That path is lighter, faster, needs no print dialog, and can
 * cut the paper at the end.
 *
 * Everything here builds bytes. Nothing here decides what a bill says.
 */

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Characters across the paper.
 *
 * Two things decide this, and both matter: how many dots wide the printer is,
 * and which of its two built-in fonts is in use. Font A is 12 dots per letter
 * and Font B is 9, so Font B fits half as many again on the same paper — which
 * is why the bill uses it. Rate and Amount then sit on the same line as the
 * dish instead of wrapping underneath it.
 *
 * The one at the counter prints 384 dots across, so Font B gives 42.
 */
export const SLIP_WIDTHS = {
  "80mm, font B": 64,
  "80mm, font A": 48,
  "58mm, font B": 42,
  "58mm, font A": 32,
};

const SWAP = {
  "₹": "Rs.", "—": "-", "–": "-", "‑": "-",
  "“": '"', "”": '"', "‘": "'", "’": "'",
  "…": "...", "·": ".", "•": "*", " ": " ",
};

/**
 * The text as the printer will actually put it on paper.
 *
 * The printer holds one byte per character, so a rupee sign has to be
 * written the way receipts have always written it. That substitution changes
 * the LENGTH — one character becomes three — which is why it happens here
 * rather than on the way out. Every column on this slip is counted in
 * characters, and counting a total as "₹1155.00" while printing it as
 * "Rs.1155.00" left every line carrying an amount two characters too long.
 * On a 42-character roll that put the last two digits of the total on the
 * line below, which is the one number on a bill nobody can afford to misread.
 */
export const printable = (s) => {
  let out = "";
  for (const ch of String(s ?? "")) {
    if (ch.codePointAt(0) < 0x80) { out += ch; continue; }
    out += SWAP[ch] ?? "?";
  }
  return out;
};

const ascii = (s) => {
  const out = [];
  for (const ch of printable(s)) out.push(ch.codePointAt(0));
  return out;
};

/**
 * The ways a thermal printer can be told to cut.
 *
 * There is no one command every printer takes. The spec offers four, the
 * oldest printers answer to a fifth that predates it, and a printer that does
 * not know the one it is sent simply does nothing — the roll comes out as one
 * long strip with every ticket on it and no sign of what went wrong.
 *
 * So the machine is asked which one its printer takes, and the Settings
 * screen prints two slips so the answer can be seen rather than guessed.
 *
 * `feed` is how much paper to push through first: the blade sits a couple of
 * centimetres above the print head, so without it the cut lands in the middle
 * of the last line.
 *
 * The two "to cutting position" commands work that out for themselves, so
 * they ask for none at all. They used to ask for four lines anyway, and those
 * four were pure waste: the printer then fed its own couple of centimetres on
 * top of them, and every slip came off with a hand's width of blank paper
 * under it. On a counter doing two hundred tickets a day that is a roll a
 * week, and a slip that looks half unprinted.
 *
 * The others cut where the paper stands, so for them the feed is the only
 * thing keeping the blade out of the last line, and it stays.
 *
 * `tail` is the margin under the slip, in dots, and it exists because of
 * where the blade is. It sits about a centimetre further along the paper
 * than the print head, so the paper lying between the two at the moment of a
 * cut has nothing on it — and after the cut it is the first centimetre of
 * the next slip. That is the white band above every ticket, on every thermal
 * printer ever made, and no command removes it: the paper cannot go
 * backwards.
 *
 * So the margin above is a given, and the only thing that can be done is to
 * give the one below it the same. Cutting to position alone leaves nothing
 * underneath at all, which is tidy in the wrong way — the slip reads as
 * though it was torn off mid-sentence, with a hand's width of blank above it
 * and none below. This is that band's height, so the two match.
 */
export const CUT_STYLES = {
  // GS V 66 0 — feed to the cutting position, then a partial cut.
  partial: { label: "Partial cut", feed: 0, tail: 60, bytes: [GS, 0x56, 0x42, 0x00] },
  // GS V 65 0 — the same, cut all the way through.
  full: { label: "Full cut", feed: 0, tail: 60, bytes: [GS, 0x56, 0x41, 0x00] },
  // GS V 1 — partial cut where it stands, so it needs the paper fed first.
  partialSimple: { label: "Partial cut (simple)", feed: 6, bytes: [GS, 0x56, 0x01] },
  // GS V 0 — the oldest of the four, and the one most printers take.
  fullSimple: { label: "Full cut (simple)", feed: 6, bytes: [GS, 0x56, 0x00] },
  // ESC i — from before GS V existed. Some cheap printers still only take this.
  legacy: { label: "Older printers (ESC i)", feed: 6, bytes: [ESC, 0x69] },
  // For a printer with no blade: feed enough paper to tear it off by hand.
  none: { label: "No cutter - feed paper instead", feed: 8, bytes: [] },
};

/** The one to use when nobody has said, and the one that fits most printers. */
export const DEFAULT_CUT_STYLE = "partial";

export class Slip {
  constructor(width = 42, { font = "B", cut = DEFAULT_CUT_STYLE } = {}) {
    this.width = width;
    this.cutStyle = CUT_STYLES[cut] ? cut : DEFAULT_CUT_STYLE;
    this.bytes = [];
    this.push(ESC, 0x40);            // wake up in a known state
    this.push(ESC, 0x74, 0x00);      // code page 437, the one every roll assumes
    this.font(font);
  }

  push(...b) { for (const x of b) this.bytes.push(x & 0xff); return this; }

  /**
   * "A" is the printer's bigger built-in face, "B" the smaller one.
   *
   * B is the default because the bill has five columns and A does not leave
   * room for them — the price ends up wrapped onto the line below, which is
   * exactly what a guest checking their bill should not have to read.
   */
  font(which) { return this.push(ESC, 0x4d, String(which).toUpperCase() === "A" ? 0 : 1); }

  /** left | centre | right */
  align(where) {
    return this.push(ESC, 0x61, where === "center" ? 1 : where === "right" ? 2 : 0);
  }

  bold(on) { return this.push(ESC, 0x45, on ? 1 : 0); }

  /**
   * How many times normal size, in both directions. 1 to 8.
   *
   * One byte carries both: the high half is the width multiplier and the low
   * half the height, each one less than the number of times. So 2 is 0x11,
   * which is what this has always sent, and 4 is 0x33.
   *
   * It only went up to 2 before, which was enough for a heading and not for
   * a token. A guest at a counter reads their number off a slip on the
   * counter top, at arm's length, in a queue — and a number the same size as
   * the date beside it is a number they have to go and look for. Four times
   * is ten characters across a 58mm roll: a token has three at the most, so
   * there is room for it to be as big as it is useful to be.
   */
  size(n) {
    const times = Math.max(1, Math.min(8, Math.round(Number(n) || 1))) - 1;
    return this.push(GS, 0x21, (times << 4) | times);
  }

  /**
   * Twice as tall, the same width.
   *
   * This is what the total wants. Doubling the width as well halves how many
   * characters the line holds, and the one line on a bill that must never wrap
   * is the one carrying the amount — a total reading "TOTAL Rs.1155." with the
   * "00" underneath is worse than a total in small type. Height alone makes it
   * stand out and costs nothing.
   */
  tall(on) { return this.push(GS, 0x21, on ? 0x01 : 0x00); }

  underline(on) { return this.push(ESC, 0x2d, on ? 1 : 0); }

  /**
   * How far the paper moves on at the end of each line.
   *
   * The default is set for ordinary letters. Double-height ones are half as
   * tall again as that gap allows, so two of them in a row come out sitting
   * on each other — which is exactly how the two lines of a parcel heading
   * looked: centred, correct, and squashed together.
   *
   * @param dots  at 203 to the inch; omit to put the printer's default back
   */
  spacing(dots) {
    return dots === null || dots === undefined
      ? this.push(ESC, 0x32)
      : this.push(ESC, 0x33, Math.max(0, Math.min(255, dots)));
  }

  /**
   * A gap shorter than a whole blank line.
   *
   * Text mode has no half-lines: an empty line is a whole line of air, which
   * around a one-line slogan is more space than the slogan is worth. Dropping
   * the line spacing for the length of one newline gives a breath instead of a
   * paragraph, then puts it back. A printer that ignores the command simply
   * prints no gap, which errs the way we want.
   *
   * @param dots  at 203 dots to the inch; a full line is about 30
   */
  thinGap(dots = 12) {
    return this.push(ESC, 0x33, dots & 0xff).push(0x0a).push(ESC, 0x32);
  }

  text(s) { return this.push(...ascii(s)); }

  line(s = "") { return this.text(s).push(0x0a); }

  /** A row of dashes the full width of the paper. */
  rule(ch = "-") { return this.line(ch.repeat(this.width)); }

  feed(n = 1) { return this.push(ESC, 0x64, Math.max(0, Math.min(255, n))); }

  /**
   * The same, but in dots rather than whole lines.
   *
   * A line is about four millimetres, and the margin under a slip wants
   * setting closer than that — a line too few cuts into the last rule, a
   * line too many and the slip has a thumb's width of nothing under it.
   * At 203 dots to the inch this moves the paper eight dots per millimetre.
   */
  feedDots(n = 0) { return this.push(ESC, 0x4a, Math.max(0, Math.min(255, n))); }

  /**
   * Cut, in whichever of the several ways this printer understands — see
   * CUT_STYLES. The paper is fed first either way, so a printer with no
   * blade at all still gives enough to tear off by hand.
   */
  cut() {
    const style = CUT_STYLES[this.cutStyle] || CUT_STYLES[DEFAULT_CUT_STYLE];
    // Not sent at all when there is none to ask for: ESC d 0 is a command
    // that moves no paper, and a printer that reads it loosely may still
    // treat it as one line.
    if (style.feed > 0) this.feed(style.feed);
    // The margin under the slip, which only the cuts that feed to the
    // cutting position need: the others are already feeding whole lines
    // past the last one, and that overshoot is their margin.
    if (style.tail > 0) this.feedDots(style.tail);
    return style.bytes.length ? this.push(...style.bytes) : this;
  }

  /** Opens the till drawer, if one is plugged into the printer. */
  openDrawer() { return this.push(ESC, 0x70, 0x00, 0x19, 0xfa); }

  toBytes() { return Uint8Array.from(this.bytes); }

  toBase64() {
    let s = "";
    for (const b of this.bytes) s += String.fromCharCode(b);
    return typeof btoa === "function" ? btoa(s) : Buffer.from(this.bytes).toString("base64");
  }
}

/**
 * Two things on one line, one pushed to each edge.
 *
 * When they will not both fit the value keeps its place and the label gives way,
 * because a bill that shows "Grand Tot..." is still readable and one that shows
 * the wrong number is not.
 */
export const twoUp = (left, right, width) => {
  const r = String(right ?? "");
  const l = String(left ?? "");
  const room = width - r.length - 1;
  if (room < 1) return r.slice(-width);
  const cut = l.length > room ? l.slice(0, room) : l;
  return cut + " ".repeat(width - cut.length - r.length) + r;
};

/** Centres within the paper without letting a long line wrap oddly. */
export const centred = (s, width) => {
  const t = String(s ?? "").trim();
  if (t.length >= width) return t.slice(0, width);
  return " ".repeat(Math.floor((width - t.length) / 2)) + t;
};

/** Breaks a long dish name onto as many lines as it needs. */
export const wrap = (s, width) => {
  const words = String(s ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = "";
  for (const w of words) {
    if (!line.length) { line = w; }
    else if (line.length + 1 + w.length <= width) { line += " " + w; }
    else { lines.push(line); line = w; }
    while (line.length > width) { lines.push(line.slice(0, width)); line = line.slice(width); }
  }
  if (line.length) lines.push(line);
  return lines;
};

export default Slip;
