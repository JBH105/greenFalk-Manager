/**
 * Getting a slip onto paper.
 *
 * A page in a browser cannot reach a printer cable, so a small helper runs on
 * the till itself and does that part. This asks the helper first and falls back
 * to the browser's own print dialog when there is no helper — a captain's
 * tablet has no printer attached and nothing should break there.
 *
 * The fallback is the old path, untouched, so a till that was working on the
 * day this shipped keeps working.
 */

const HELPER = "http://127.0.0.1:9110";
import { CUT_STYLES, DEFAULT_CUT_STYLE } from "./escpos";

/**
 * How many characters fit across a roll.
 *
 * Not a preference — arithmetic. A thermal printer puts 8 dots to the
 * millimetre, an 80mm roll prints 72mm of that (576 dots) and a 58mm roll
 * 48mm (384). Font A is 12 dots wide and Font B is 9, so the four numbers
 * below are the only four there are.
 *
 * It used to be asked for directly, as a list of character counts whose
 * labels had 42 and 32 down as 80mm when they are the 58mm figures. A shop
 * with an 80mm roll read "80mm", chose 42, and printed two thirds of the way
 * across its paper with a hand's width of white down one side. Nobody can be
 * expected to catch that; the paper is what somebody actually knows, so the
 * paper is what is asked for and this works the rest out.
 */
export const PAPER_WIDTHS = {
  80: { A: 48, B: 64 },
  58: { A: 32, B: 42 },
};

/** The roll this many characters belongs to — for a till set up before the
 *  paper was asked for, so nothing has to be chosen again. */
const paperFromChars = (chars) => (Number(chars) >= 48 ? 80 : 58);

export const charsAcross = (paper, font) =>
  (PAPER_WIDTHS[paper] || PAPER_WIDTHS[80])[font === "A" ? "A" : "B"];

/**
 * What a slip should look like on each of the two printers.
 *
 * A shop with a printer at each end did not buy them on the same day. The
 * counter can be on an 80mm roll and the kitchen on a 58mm one, and until
 * now a single paper setting was handed to both — so whichever of them was
 * not the one somebody set up printed either two thirds of the way across
 * its paper or wrapped every line.
 *
 * The kitchen's settings fall back to the counter's rather than carrying
 * their own defaults, so a shop with one printer, or two of the same, never
 * has to fill the second half in.
 */
export const counterStyle = (s) => ({
  paper: s.paper,
  font: s.font,
  width: charsAcross(s.paper, s.font),
  cut: s.cutStyle,
});

export const kitchenStyle = (s) => {
  const paper = PAPER_WIDTHS[s.kitchenPaper] ? Number(s.kitchenPaper) : s.paper;
  const font = s.kitchenFont === "A" || s.kitchenFont === "B" ? s.kitchenFont : s.font;
  return {
    paper,
    font,
    width: charsAcross(paper, font),
    cut: CUT_STYLES[s.kitchenCut] ? s.kitchenCut : s.cutStyle,
  };
};

const SETTINGS_KEY = "slipPrinter";

/**
 * How many characters fit across the roll, which face to print in, and where
 * each slip is sent.
 *
 * Two printers rather than one, because a bill and a kitchen ticket go to
 * different people standing in different rooms. A shop with one printer
 * leaves the kitchen one empty and both come off the same machine.
 *
 * This lives on the device, not on the server, because it describes a cable.
 * The same account signed in at the counter and in the kitchen is at two
 * different printers, and only the machine itself knows which.
 */
export const readPrinterSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const font = s.font === "A" ? "A" : "B";
      // A till set up before the paper was asked for has only a character
      // count; which roll that was is plain enough from the number.
      const paper = PAPER_WIDTHS[s.paper] ? Number(s.paper) : paperFromChars(s.width);
      return {
        paper,
        // Worked out rather than stored, so the two can never disagree —
        // the font is changed far more often than the roll is.
        width: charsAcross(paper, font),
        font,
        printer: s.printer || "",
        // Empty means the kitchen ticket comes off the counter printer too,
        // which is what a one-printer shop wants.
        kitchenPrinter: s.kitchenPrinter || "",
        // Empty means the kitchen prints the way the counter does, which is
        // what a shop with one printer — or two alike — wants.
        kitchenPaper: PAPER_WIDTHS[s.kitchenPaper] ? Number(s.kitchenPaper) : null,
        kitchenFont: s.kitchenFont === "A" || s.kitchenFont === "B" ? s.kitchenFont : null,
        kitchenCut: CUT_STYLES[s.kitchenCut] ? s.kitchenCut : null,
        // A shop with a printer at each end wants the same ticket out of both:
        // the cook needs to know what to make, and the guest standing at the
        // counter needs the number they will be called by. Off by default,
        // because a shop with one printer would otherwise print everything
        // twice on it.
        kotAtCounter: s.kotAtCounter === true,
        // Exactly one machine in the shop prints the kitchen's tickets. Off
        // everywhere by default: with it on by default, a captain's tablet
        // and the till would each print the same round.
        kotStation: s.kotStation === true,
        // Which of the several cut commands this printer answers to. There is
        // no safe guess: a printer that does not know the one it is sent does
        // nothing at all, and the roll comes out as one strip.
        cutStyle: CUT_STYLES[s.cutStyle] ? s.cutStyle : DEFAULT_CUT_STYLE,
        openDrawer: s.openDrawer === true,
        enabled: s.enabled !== false,
      };
    }
  } catch { /* a till with storage turned off still prints */ }
  return {
    paper: 80,
    width: charsAcross(80, "B"),
    font: "B",
    printer: "",
    kitchenPrinter: "",
    kitchenPaper: null,
    kitchenFont: null,
    kitchenCut: null,
    kotAtCounter: false,
    kotStation: false,
    openDrawer: false,
    enabled: true,
    cutStyle: DEFAULT_CUT_STYLE,
  };
};

export const writePrinterSettings = (next) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...readPrinterSettings(), ...next }));
  } catch { /* nothing to remember it with */ }
};

/** Cached so a busy till does not ask on every bill. */
let helperSeen = null;
let helperAskedAt = 0;

export const findHelper = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && helperSeen !== null && now - helperAskedAt < 30000) return helperSeen;
  helperAskedAt = now;
  try {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 1200);
    const res = await fetch(HELPER + "/health", { signal: stop.signal });
    clearTimeout(timer);
    helperSeen = res.ok ? await res.json() : false;
  } catch {
    helperSeen = false;
  }
  return helperSeen;
};

/**
 * The printers this machine has, each as { name, isDefault, offline }.
 *
 * The helper answers with objects carrying more than the name, and an older
 * one answered with plain strings. Both are turned into the same shape here
 * rather than left for each screen to work out — one screen dropped an object
 * straight into a dropdown and took the whole page down with it.
 */
export const listPrinters = async () => {
  try {
    const res = await fetch(HELPER + "/printers");
    if (!res.ok) return [];
    const body = await res.json();
    return asPrinterList(body?.printers);
  } catch {
    return [];
  }
};

/** Exported for the screens to reuse, and so it can be tested on its own. */
export const asPrinterList = (raw) => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (typeof entry === "string") return { name: entry, isDefault: false, offline: false };
      const name = entry?.name;
      if (!name) return null;
      return {
        name: String(name),
        isDefault: entry.isDefault === true,
        offline: entry.offline === true,
      };
    })
    .filter(Boolean);
};

/**
 * @param bytesBase64  the slip, already in the printer's language
 * @returns true when the helper took it
 */
export const sendToPrinter = async (bytesBase64, { printer, copies = 1 } = {}) => {
  try {
    const res = await fetch(HELPER + "/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printer: printer || undefined, base64: bytesBase64, copies }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.ok === true;
  } catch {
    return false;
  }
};

/**
 * A kitchen ticket, to every printer that should have one.
 *
 * The cook needs to know what to make. The guest standing at the counter
 * needs the number they will be called by, and walking to the kitchen for it
 * is the whole problem — so a shop with a printer at each end gets the same
 * ticket out of both.
 *
 * The counter copy is only sent where the two are genuinely different
 * machines. With one printer the kitchen's target already is the counter's,
 * and sending twice would print every round twice on it.
 *
 * What comes back is whether the KITCHEN got it, and only that. A counter
 * copy that failed is a guest without a slip in their hand; a kitchen copy
 * printed twice is food cooked twice — so the kitchen's answer is the one
 * that decides whether this round counts as printed.
 *
 * Rendered once for each of them rather than once in all. The two printers
 * can be on different rolls, and a ticket laid out for 64 characters comes
 * off a 58mm machine with every line wrapped — so each is given the ticket
 * drawn to its own paper.
 *
 * @param render    ({ width, font, cut }) => the ticket as base64
 * @param settings  this machine's printer settings
 * @param copies    how many the kitchen gets; the counter always gets one
 * @param onTrouble told when the counter copy did not go
 */
export const sendKitchenTicket = async (
  render,
  settings,
  { copies = 1, onTrouble } = {}
) => {
  const kitchen = settings.kitchenPrinter || settings.printer;

  const sent = await sendToPrinter(render(kitchenStyle(settings)), {
    printer: kitchen,
    copies,
  });

  if (settings.kotAtCounter && settings.printer !== kitchen) {
    const alsoSent = await sendToPrinter(render(counterStyle(settings)), {
      printer: settings.printer,
      copies: 1,
    });
    if (!alsoSent) onTrouble?.("the counter printer would not take its copy of this round");
  }

  return sent;
};

/**
 * Print the slip that has been rendered into `node`.
 *
 * @param node      the hidden element holding the bill
 * @param fallback  what to do when there is no helper — the browser dialog
 */
export const printSlip = async (node, fallback) => {
  const settings = readPrinterSettings();

  if (settings.enabled && node) {
    const helper = await findHelper();
    if (helper) {
      try {
        const { slipFromDom } = await import("./slipToText");
        const slip = slipFromDom(node, settings.width, settings.font, settings.cutStyle);
        if (settings.openDrawer) slip.openDrawer();
        const sent = await sendToPrinter(slip.toBase64(), { printer: settings.printer });
        if (sent) return "printer";
      } catch (e) {
        // Fall through to the dialog rather than leaving the cashier with
        // nothing while a guest waits at the counter.
        console.warn("the till printer refused the slip, using the browser instead", e);
      }
    }
  }

  if (typeof fallback === "function") { fallback(); return "browser"; }
  return "none";
};

export default printSlip;
