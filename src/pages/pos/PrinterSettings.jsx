import React, { useEffect, useState } from "react";
import { useT } from "../../i18n";
import { useNotification } from "../../hooks/useNotification";
import {
  readPrinterSettings,
  writePrinterSettings,
  listPrinters,
  findHelper,
  sendToPrinter,
  counterStyle,
  kitchenStyle,
} from "../../utils/printSlip";
import { useFeatures } from "../../hooks/useFeatures";
import { kotSlip } from "../../utils/kotSlip";
import { Slip, centred, CUT_STYLES } from "../../utils/escpos";
import { clearLedger } from "../../utils/kotLedger";
import { beginKitchenPrinting } from "../../utils/kotStation";
import { useAuthStore } from "../../store/useAuthStore";
import { readTillSettings, writeTillSettings, MAX_KOT_COPIES } from "../../utils/tillSettings";

/**
 * How this machine is set up: its printers, and what it does with a sale.
 *
 * All of it stays on the device. The same account is signed in at an
 * ice-cream counter and in a dining room across town, standing at different
 * printers and wanting different things out of the same bill — only the
 * machine itself knows which one it is.
 *
 * One screen rather than two. The kitchen's ticket alone is decided by four
 * things in three places, and a second screen for the rest would have left
 * somebody hunting for which switch they had missed.
 *
 * The one setting here that is not about this machine alone is the kitchen
 * station: exactly one machine in the shop prints the kitchen's tickets, and
 * turning it on in two places prints every round twice.
 */

/**
 * The roll, not the character count.
 *
 * A character count is arithmetic nobody should be asked for, and the list
 * that asked for it had 42 and 32 labelled as 80mm when those are the 58mm
 * figures — so a shop with the usual roll chose 42 and printed two thirds of
 * the way across its paper. The width of the paper is the one thing anybody
 * actually knows about their printer.
 */
const PAPERS = [
  { value: 80, key: "printer.paper80" },
  { value: 58, key: "printer.paper58" },
];

const Switch = ({ on, onToggle, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={onToggle}
    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
      on ? "bg-[var(--theme-primary)]" : "bg-[var(--primary-alpha-14)]"
    }`}
  >
    <span
      className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
        on ? "translate-x-[22px]" : "translate-x-[2px]"
      }`}
    />
  </button>
);

/**
 * A setting that needs the whole width to itself.
 *
 * A dropdown of printer names does not fit beside its own label in a box half
 * the page wide, so these stack: what it is on top, the control under it.
 */
const Field = ({ label, hint, children }) => (
  <div className="flex flex-col gap-1.5 border-b border-border-default px-4 py-3.5 last:border-b-0">
    <p className="text-sm font-semibold text-text-primary">{label}</p>
    {hint && <p className="-mt-1 text-xs text-text-secondary">{hint}</p>}
    {children}
  </div>
);

const Row = ({ title, hint, children }) => (
  <div className="flex items-start justify-between gap-5 border-b border-border-default px-4 py-3.5 last:border-b-0">
    <div className="min-w-0">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-text-secondary">{hint}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

/**
 * The printers, as options.
 *
 * Its own component because both dropdowns draw the same list, and because
 * the first version put the printer straight into the option — the helper
 * hands back objects, React cannot draw an object, and the whole page went
 * down the moment the list arrived. One place to get that right.
 */
export const PrinterOptions = ({ printers = [] }) =>
  printers.map((printer) => (
    <option key={printer.name} value={printer.name}>
      {printer.name}
      {printer.isDefault ? " (default)" : ""}
      {printer.offline ? " - offline" : ""}
    </option>
  ));

/** How many of the same ticket — one, two or three, and nothing else. */
const CopyPicker = ({ value, onChange, disabled }) => {
  const t = useT();
  return (
  <div className="flex items-center gap-2" role="radiogroup" aria-label={t("printer.ticketCopies")}>
    {Array.from({ length: MAX_KOT_COPIES }, (_, i) => i + 1).map((n) => {
      const chosen = value === n;
      return (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={chosen}
          aria-label={n === 1 ? t("printer.oneCopy") : t("printer.nCopies", { n })}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`tap-target h-10 w-10 rounded-lg border text-sm font-bold transition-colors disabled:opacity-40 ${
            chosen
              ? "border-transparent gf-metal-green"
              : "border-border-default bg-surface text-text-primary"
          }`}
        >
          {n}
        </button>
      );
    })}
  </div>
  );
};

/**
 * @param accent  drawn in the shop's own colour, for the two that are a
 *                printer. The page has four boxes and two of them are the
 *                thing it is about; a plain grey edge on all four left them
 *                reading as one long list again.
 */
const Card = ({ title, hint, accent = false, children }) => (
  <section
    className={`overflow-hidden rounded-2xl bg-surface ${
      accent
        ? "border-2 border-[var(--primary-alpha-30)] shadow-[0_2px_12px_var(--primary-alpha-12)]"
        : "border border-border-default"
    }`}
  >
    <header
      className={`border-b px-4 py-3 ${
        accent
          ? "border-[var(--primary-alpha-20)] bg-[var(--primary-alpha-8)]"
          : "border-border-default bg-[var(--primary-alpha-4)]"
      }`}
    >
      <h2
        className={`font-bold ${
          accent ? "text-base text-[var(--theme-primary)]" : "text-sm text-text-primary"
        }`}
      >
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-xs text-text-secondary">{hint}</p>}
    </header>
    {children}
  </section>
);

/** A sample round, so the test ticket looks like a real one. */
const SAMPLE_ORDER = {
  serverId: "sample",
  timestamp: Date.now(),
  kotNumber: 2,
  cashierName: "Test",
  cartData: {
    table: { tableNumber: "4" },
    orderType: "DINE_IN",
    orderItems: [
      { name: "Paneer Tikka", quantity: 2, categoryName: "Starters", jain: true },
      { name: "Veg Manchurian Dry", quantity: 1, categoryName: "Starters", note: "less spicy" },
      { name: "Butter Roti", quantity: 4, categoryName: "Breads" },
    ],
  },
};

const PrinterSettings = () => {
  const t = useT();
  const { notifySuccess, notifyError } = useNotification();

  const [settings, setSettings] = useState(readPrinterSettings);
  const [till, setTill] = useState(readTillSettings);
  const [printers, setPrinters] = useState([]);
  const [helper, setHelper] = useState(null);
  const [checking, setChecking] = useState(true);

  const features = useFeatures();
  const outletId = useAuthStore((s) => s.user?.outlet_id);

  const check = async () => {
    setChecking(true);
    const found = await findHelper({ force: true });
    setHelper(found);
    setPrinters(found ? await listPrinters() : []);
    setChecking(false);
  };

  useEffect(() => {
    check();
  }, []);

  /** Written as it is changed: a settings page with a Save button gets left unsaved. */
  const change = (patch) => {
    writePrinterSettings(patch);
    setSettings(readPrinterSettings());
  };

  /** The same, for what the till does with a sale rather than with a cable. */
  const changeTill = (patch) => {
    writeTillSettings(patch);
    setTill(readTillSettings());
  };

  /**
   * Whether a round sent right now would come out of a printer.
   *
   * Four separate things have to be true, set in three different places —
   * head office, this page, and a program running on this machine. Leaving
   * the person to work out which one is missing from four switches on two
   * screens is how a working feature gets reported as broken.
   */
  const kitchenStatus = !features.kot_print_enabled
    ? { ok: false, text: t("printer.statusNoFeature") }
    : !settings.kotStation
      ? { ok: false, text: t("printer.statusNotStation") }
      : !settings.enabled
        ? { ok: false, text: t("printer.statusDisabled") }
        : !helper
          ? { ok: false, text: t("printer.statusNoHelper") }
          : {
              ok: true,
              text: t("printer.statusReady", {
                printer:
                  settings.kitchenPrinter ||
                  settings.printer ||
                  t("printer.windowsDefaultPlain"),
              }),
            };

  /**
   * A test that shows how a printer is set, rather than saying so.
   *
   * Two slips, always. One proves nothing about the cut — whatever comes out,
   * the roll still has to be torn off by hand and the paper looks the same
   * either way. Two answer it at a glance: two pieces, or one strip with both
   * on it.
   *
   * The ruler on the first one answers the other half. It runs the full
   * width, so it stops short of the paper's edge when the roll is set
   * narrower than it is, and wraps when it is set wider. A roll set to 42 on
   * 80mm paper printed perfectly happy slips down two thirds of the page for
   * weeks, because nothing on them said what they should have reached.
   */
  const rulerSlip = (style, where) => {
    const s = new Slip(style.width, { font: style.font, cut: style.cut });
    s.align("center").size(2).bold(true).line("TEST").size(1).bold(false).align("left");
    s.rule("=");
    s.line(centred(`This is the ${where} printer.`, style.width));
    s.line(centred(`${style.paper}mm roll, ${style.font === "A" ? "large" : "small"} letters`, style.width));
    s.rule("-");

    // Every tenth character numbered, so the last one printed is the width.
    const ruler = Array.from({ length: style.width }, (_, i) =>
      (i + 1) % 10 === 0 ? String(((i + 1) / 10) % 10) : "."
    ).join("");
    s.line(ruler);
    s.line(`${style.width} characters, edge to edge`);
    s.rule("=");
    s.cut();
    return s;
  };

  const secondSlip = (style) => {
    const s = new Slip(style.width, { font: style.font, cut: style.cut });
    s.align("center").size(2).bold(true).line("SECOND").size(1).bold(false);
    s.line("If this came out joined to the");
    s.line("first one, change Cutting above.");
    s.align("left");
    s.cut();
    return s;
  };

  /**
   * Whether the kitchen's ticket would actually come off a second machine.
   *
   * Not "has a kitchen printer been named" — a shop can name the same
   * printer in both boxes, which is what a one-printer shop that filled the
   * form in carefully looks like. The printing code already works that out
   * and sends one ticket; this makes the screen say the same thing, rather
   * than offering a switch that turns on and does nothing.
   */
  const hasTwoPrinters =
    (settings.kitchenPrinter || settings.printer) !== settings.printer;

  /**
   * Both slips, to whichever printer is being tried.
   *
   * The kitchen's sample is a real ticket rather than a ruler — a cook's
   * ticket is laid out quite differently from a bill, and the thing worth
   * seeing is that one of those fits.
   */
  const testOn = async (which) => {
    if (!helper) {
      notifyError(t("printer.helperNotRunning"));
      return;
    }

    const isKitchen = which === "kitchen";
    const style = isKitchen ? kitchenStyle(settings) : counterStyle(settings);
    const target = isKitchen ? settings.kitchenPrinter || settings.printer : settings.printer;

    const first = isKitchen
      ? kotSlip(SAMPLE_ORDER, {
          width: style.width,
          font: style.font,
          cut: style.cut,
          seatsPeople: features.table_service_enabled,
        })
      : rulerSlip(style, "counter");

    const sent = await sendToPrinter(first.toBase64(), { printer: target });
    if (!sent) {
      notifyError(t("printer.refused"));
      return;
    }

    // The second one is only there to show whether the first was cut off.
    const also = await sendToPrinter(secondSlip(style).toBase64(), { printer: target });
    if (also) notifySuccess(t("printer.twoSlipsSent"));
    else notifyError(t("printer.secondFailed"));
  };

  const counter = counterStyle(settings);
  const kitchen = kitchenStyle(settings);

  /** The paper rows, drawn the same way in both boxes. */
  const paperRows = (which) => {
    const style = which === "kitchen" ? kitchen : counter;
    const follows = which === "kitchen" && !hasTwoPrinters;

    const set = (patch) =>
      change(
        which === "kitchen"
          ? {
              kitchenPaper: "paper" in patch ? patch.paper : settings.kitchenPaper,
              kitchenFont: "font" in patch ? patch.font : settings.kitchenFont,
              kitchenCut: "cutStyle" in patch ? patch.cutStyle : settings.kitchenCut,
            }
          : patch
      );

    return (
      <>
        <Field
          label={t("printer.paperWidth")}
          hint={follows ? t("printer.paperFollows") : t("printer.paperHint")}
        >
          <select
            value={style.paper}
            disabled={follows}
            onChange={(e) => set({ paper: Number(e.target.value) })}
            className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm disabled:opacity-40"
          >
            {PAPERS.map((p) => (
              <option key={p.value} value={p.value}>{t(p.key)}</option>
            ))}
          </select>
        </Field>

        <Field
          label={t("printer.letterSize")}
          hint={t("printer.letterSizeHint", { n: style.width })}
        >
          <select
            value={style.font}
            disabled={follows}
            onChange={(e) => set({ font: e.target.value })}
            className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm disabled:opacity-40"
          >
            <option value="B">{t("printer.small")}</option>
            <option value="A">{t("printer.large")}</option>
          </select>
        </Field>

        <Field
          label={t("printer.cutting")}
          hint={t("printer.cuttingHint")}
        >
          <select
            value={style.cut}
            disabled={follows}
            onChange={(e) => set({ cutStyle: e.target.value })}
            className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm disabled:opacity-40"
          >
            {Object.keys(CUT_STYLES).map((key) => (
              <option key={key} value={key}>{t(`printer.cut.${key}`)}</option>
            ))}
          </select>
        </Field>
      </>
    );
  };

  return (
    <div className="h-full overflow-y-auto custom-scroll bg-background px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <header>
          <h1 className="text-xl font-bold text-text-primary">{t("printer.title")}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {t("printer.subtitle")}
          </p>
        </header>

        {/* Whether anything can print at all, said in one line rather than a
            card of its own — it is a yes or a no, and the rest of the page is
            what it is about. */}
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 ${
            helper
              ? "border-[var(--success-main)]/40 bg-[var(--success-main)]/10"
              : "border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10"
          }`}
        >
          <p className="text-xs font-semibold text-text-primary">
            {checking
              ? t("printer.looking")
              : helper
                ? t("printer.helperRunning")
                : t("printer.helperMissing")}
          </p>
          <button
            type="button"
            onClick={check}
            className="tap-target shrink-0 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary"
          >
            {t("printer.checkAgain")}
          </button>
        </div>

        {/* ── THE TWO PRINTERS, SIDE BY SIDE ──
            A shop has at most two: the one the guest's bill comes off, and the
            one the cook reads. Each is set up whole, paper and all — the two
            were not bought on the same day, and one roll setting handed to
            both left whichever had not been set up printing across two thirds
            of its paper or wrapping every line. */}
        <div className="grid gap-4 lg:grid-cols-2">

          {/* ── COUNTER ── */}
          <Card accent title={t("printer.counter")} hint={t("printer.counterHint")}>
            <Field label={t("printer.printerLabel")} hint={helper ? "" : t("printer.startHelper")}>
              <select
                value={settings.printer}
                disabled={!helper}
                onChange={(e) => change({ printer: e.target.value })}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm disabled:opacity-40"
              >
                <option value="">{t("printer.windowsDefault")}</option>
                <PrinterOptions printers={printers} />
              </select>
            </Field>

            {paperRows("counter")}

            <Row title={t("printer.openDrawer")} hint={t("printer.drawerHint")}>
              <Switch
                on={settings.openDrawer}
                label={t("printer.openDrawer")}
                onToggle={() => change({ openDrawer: !settings.openDrawer })}
              />
            </Row>

            <Row title={t("printer.printBillsHere")} hint={t("printer.printBillsHint")}>
              <Switch
                on={settings.enabled}
                label={t("printer.printBillsHere")}
                onToggle={() => change({ enabled: !settings.enabled })}
              />
            </Row>

            {/* The guest's token, on the guest's own printer. It belongs here
                rather than with the kitchen's settings: what it decides is
                whether this printer prints one, and nobody looks for that
                under the cook's heading. */}
            <Row
              title={t("printer.kotAtCounter")}
              hint={
                hasTwoPrinters
                  ? t("printer.kotAtCounterHint")
                  : t("printer.kotAtCounterOne")
              }
            >
              <Switch
                on={settings.kotAtCounter}
                disabled={!features.kot_print_enabled || !hasTwoPrinters}
                label={t("printer.kotAtCounter")}
                onToggle={() => change({ kotAtCounter: !settings.kotAtCounter })}
              />
            </Row>

            <Row title={t("printer.tryIt")} hint={t("printer.tryCounterHint")}>
              <button
                type="button"
                onClick={() => testOn("counter")}
                disabled={!helper}
                className="tap-target rounded-lg bg-[var(--theme-primary)] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {t("printer.test")}
              </button>
            </Row>
          </Card>

          {/* ── KITCHEN ── */}
          <Card accent title={t("printer.kitchen")} hint={t("printer.kitchenHint")}>
            <div
              className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${
                kitchenStatus.ok
                  ? "border-[var(--success-main)]/40 bg-[var(--success-main)]/10 text-[var(--success-main)]"
                  : "border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10 text-[var(--warning-dark)]"
              }`}
            >
              {kitchenStatus.text}
            </div>

            <Row
              title={t("printer.printTicketsHere")}
              hint={t("printer.ticketsHereHint")}
            >
              <Switch
                on={settings.kotStation}
                disabled={!features.kot_print_enabled}
                label={t("printer.printTicketsHere")}
                onToggle={async () => {
                  const next = !settings.kotStation;
                  clearLedger();
                  change({ kotStation: next });

                  if (!next) {
                    notifySuccess(t("printer.stationOff"));
                    return;
                  }

                  // Whatever the kitchen has open right now is written off as
                  // the starting line, here rather than when the next order
                  // arrives — otherwise the very first one after setting this
                  // up would be the one that drew the line, and print nothing.
                  await beginKitchenPrinting(outletId);
                  notifySuccess(t("printer.stationOn"));
                }}
              />
            </Row>

            <Field label={t("printer.printerLabel")} hint={t("printer.kitchenPrinterHint")}>
              <select
                value={settings.kitchenPrinter}
                disabled={!helper || !features.kot_print_enabled}
                onChange={(e) => change({ kitchenPrinter: e.target.value })}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm disabled:opacity-40"
              >
                <option value="">{t("printer.sameAsCounter")}</option>
                <PrinterOptions printers={printers} />
              </select>
            </Field>

            {paperRows("kitchen")}

            <Row
              title={t("printer.howMany")}
              hint={t("printer.howManyHint")}
            >
              <CopyPicker
                value={till.kotCopies}
                disabled={!features.kot_print_enabled || !settings.kotStation}
                onChange={(n) => changeTill({ kotCopies: n })}
              />
            </Row>

            <Row title={t("printer.tryIt")} hint={t("printer.tryKitchenHint")}>
              <button
                type="button"
                onClick={() => testOn("kitchen")}
                disabled={!helper || !features.kot_print_enabled}
                className="tap-target rounded-lg bg-[var(--theme-primary)] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {t("printer.test")}
              </button>
            </Row>
          </Card>
        </div>

        {/* ── AND WHAT THE TILL ASKS FOR ── */}
        <Card title={t("printer.whenBillMade")} hint={t("printer.whenBillMadeHint")}>
          <Row
            title={t("printer.askCustomerName")}
            hint={
              features.table_service_enabled
                ? t("printer.askNameTable")
                : t("printer.askNameCounter")
            }
          >
            <Switch
              on={till.askCustomerName}
              disabled={!features.table_service_enabled}
              label={t("printer.askCustomerName")}
              onToggle={() => changeTill({ askCustomerName: !till.askCustomerName })}
            />
          </Row>

          <Row
            title={t("printer.showAfter")}
            hint={t("printer.showAfterHint")}
          >
            <Switch
              on={till.showPrintPopup}
              label={t("printer.showAfter")}
              onToggle={() => changeTill({ showPrintPopup: !till.showPrintPopup })}
            />
          </Row>
        </Card>
      </div>
    </div>
  );
};

export default PrinterSettings;
