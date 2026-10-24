import { dishName as shownName, useMenuLanguage } from "../../../utils/menuLanguage";
import { useT } from "../../../i18n";
import { useEffect, useMemo, useState } from "react";
import { useHoldOrderStore } from "../../../store/useHoldOrderStore";
import { useAuthStore } from "../../../store/useAuthStore";
import { tableLabel, ticketPerson, waitingLevel } from "../../../utils/kitchen";
import { FoodMark, JainTag } from "../dashboard/FoodMark";

/**
 * The kitchen display.
 *
 * A chef stands back from the screen with their hands full, so a ticket has to
 * be readable at arm's length and actionable in one tap. Everything the kitchen
 * cannot cook from — prices, totals, discounts, tax — is left out.
 *
 * Two readings of the same service sit side by side. The rail on the left
 * totals every dish still to cook across every table, which is how a kitchen
 * batches work: eight Veg Manchurian go in one pan, not eight. The tickets on
 * the right are what actually leaves the pass, oldest first, because that table
 * has been waiting longest.
 */

/* ------------------------------ small pieces ------------------------------ */

const IcoDine = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.29v8.05zM1 21.99V21h15.03v.99c0 .55-.45 1-1.01 1H2.01c-.56 0-1.01-.45-1.01-1zm15.03-7c0-8-15.03-8-15.03 0h15.03zM1.02 17h15v2h-15z" />
  </svg>
);

const IcoParcel = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M20.5 7.28l-8-4.5a1 1 0 00-1 0l-8 4.5A1 1 0 003 8.18v7.64a1 1 0 00.5.86l8 4.5a1 1 0 001 0l8-4.5a1 1 0 00.5-.86V8.18a1 1 0 00-.5-.9zM12 4.82L18.43 8.5 16 9.89 9.57 6.21zm-1 14.36L5 15.54v-5.77l6 3.37zm1-7.23L5.57 8.5 8 7.11l6.43 3.68zM18 15.54l-6 3.64V13.5l6-3.37z" />
  </svg>
);

const IcoPerson = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" />
  </svg>
);

const IcoTick = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1 14l-4-4 1.5-1.5L11 12.5l5.5-5.5L18 8l-7 8z" />
  </svg>
);

const IcoCheck = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const IcoFlame = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M13.5 1s.5 3-1.5 5-3.5 3.2-3.5 6a5.5 5.5 0 0011 0c0-1.6-.6-2.8-1.4-3.8.2 1.2-.3 2.3-1.1 2.3-.9 0-1.3-.8-1.2-2C16 5.6 13.5 1 13.5 1zM7.6 9.9C6 11.2 5 13 5 15a7 7 0 001.9 4.8A5.9 5.9 0 016 16.5c0-2.6 1-4.4 1.6-6.6z" />
  </svg>
);

const IcoChevron = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const IcoNote = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M4 4h16v2H4zm0 5h16v2H4zm0 5h10v2H4z" />
  </svg>
);

const IcoRail = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

/* ------------------------------- the clock -------------------------------- */

/** mm:ss since the round reached the kitchen; h:mm:ss once it runs past an hour. */
const elapsed = (timestamp, now) => {
  if (!timestamp) return "--:--";
  const started = new Date(timestamp).getTime();
  if (Number.isNaN(started)) return "--:--";
  const secs = Math.max(0, Math.floor((now - started) / 1000));
  const s = String(secs % 60).padStart(2, "0");
  const m = Math.floor(secs / 60);
  if (m < 60) return `${String(m).padStart(2, "0")}:${s}`;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${s}`;
};

/* How long a ticket has waited, said in colour rather than in words. */
const CLOCK_TONE = {
  fresh: "text-success",
  warn: "text-warning",
  late: "text-error",
  none: "text-text-muted",
};

/**
 * One second hand for the whole board.
 *
 * The board used to hold the time in its own state and hand it down to
 * every ticket, so each tick re-drew the rail, every ticket and everything
 * inside them. On a kitchen tablet that came to eleven seconds of frozen
 * screen out of every fifteen, with nobody touching it — and a frozen
 * screen is a chef tapping Food Ready and watching nothing happen.
 *
 * The second now belongs to the one line of text that shows it. Every
 * clock on the board shares a single interval, and it stops itself when the
 * last one leaves, so an idle board costs a few text nodes a second.
 */
const clockWatchers = new Set();
let clockTimer = null;

const useSecond = () => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    clockWatchers.add(setNow);

    if (!clockTimer) {
      clockTimer = setInterval(() => {
        const tick = Date.now();
        clockWatchers.forEach((tell) => tell(tick));
      }, 1000);
    }

    return () => {
      clockWatchers.delete(setNow);
      if (clockWatchers.size === 0 && clockTimer) {
        clearInterval(clockTimer);
        clockTimer = null;
      }
    };
  }, []);

  return now;
};

/** How long this ticket has waited: the only thing that changes each second. */
const TicketClock = ({ timestamp }) => {
  const now = useSecond();
  const level = waitingLevel(timestamp, now);

  return (
    <p className={`text-[15px] font-black tabular-nums ${CLOCK_TONE[level] || CLOCK_TONE.none}`}>
      {elapsed(timestamp, now)}
    </p>
  );
};

const pendingOf = (order) =>
  (order?.cartData?.orderItems || []).filter(
    (i) => (Number(i.quantity) || 0) > (Number(i.prepared_quantity) || 0)
  );

const leftOf = (item) => (Number(item.quantity) || 0) - (Number(item.prepared_quantity) || 0);

/**
 * What a ticket calls a dish.
 *
 * "Item" is the floor, not a fallback anybody should see: a line that reached
 * the kitchen with no name at all is a fault, and an empty space on a ticket
 * is worse than a word that says something went wrong.
 */
const dishName = (item) => item?.name || item?.product_name || "Item";

/**
 * The same dish, in Arabic, where the restaurant asked for it.
 *
 * Returned separately rather than joined, because a ticket is read across a
 * hot kitchen and the two names belong on two lines — not run together on
 * one that then wraps wherever it happens to run out.
 */
const dishArabic = (item, mode) =>
  shownName(dishName(item), item?.nameAr || item?.name_ar, mode).secondary;

/* --------------------------- the rail on the left ------------------------- */

const DishRail = ({ sections, selected, onSelect, collapsed, onToggle, className = "" }) => {
  const t = useT();

  return (
  <aside className={`flex flex-col gap-3 overflow-y-auto custom-scrollbar pb-4 ${className}`}>
    {sections.length === 0 ? (
      <p className="text-[12px] text-text-muted px-2 py-4">{t("kitchen.nothingWaiting")}</p>
    ) : (
      sections.map((section) => {
        const isOpen = !collapsed[section.name];
        return (
          <div key={section.name} className="rounded-xl border border-border-default bg-surface overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => onToggle(section.name)}
              className="tap-target w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-primary/5 hover:bg-primary/10 transition"
            >
              <span className="text-[12px] font-black uppercase tracking-wider text-text-muted truncate">
                {section.name}
              </span>
              <IcoChevron
                width="15"
                height="15"
                className={`shrink-0 text-text-muted transition-transform ${isOpen ? "" : "-rotate-90"}`}
              />
            </button>

            {isOpen && (
              <ul>
                {section.dishes.map((d) => {
                  const isOn = selected === d.name;
                  return (
                    <li key={d.name}>
                      <button
                        type="button"
                        onClick={() => onSelect(isOn ? null : d.name)}
                        title={isOn ? t("kitchen.showEvery") : t("kitchen.showOnly")}
                        className={`tap-target w-full flex items-center gap-2 px-3 py-2 border-t border-border-default text-left transition ${
                          isOn ? "bg-primary/10" : "hover:bg-primary/5"
                        }`}
                      >
                        <span
                          className={`flex-1 min-w-0 truncate text-[13px] font-semibold ${
                            isOn ? "text-primary" : "text-text-secondary"
                          }`}
                        >
                          {d.name}
                        </span>
                        <span
                          className={`shrink-0 min-w-[26px] h-[22px] px-1.5 rounded-full text-[12px] font-black leading-[22px] text-center tabular-nums ${
                            isOn ? "bg-primary text-white" : "bg-primary/10 text-text-secondary"
                          }`}
                        >
                          {d.count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })
    )}
  </aside>
  );
};

/* ------------------------------- one ticket ------------------------------- */

const Ticket = ({ order, onReady, onAllReady, busyKey, highlight }) => {
  const t = useT();

  /* Subscribed, so a change the owner makes mid-service redraws every open
     ticket rather than waiting for the next sign-in. */
  const menuMode = useMenuLanguage();

  const isParcel = order?.cartData?.orderType === "PARCEL";
  const tableNum =
    order?.cartData?.table?.tableNumber ||
    order?.cartData?.table?.name ||
    order?.cartData?.table?.table_number;

  const person = ticketPerson(order);

  // What is left to cook — what the one button at the top clears, and what
  // the rail counts. The ticket itself shows every line, done or not.
  const pending = pendingOf(order);
  const lines = order?.cartData?.orderItems || [];
  const clearing = busyKey === `${order.serverId}:all`;

  /**
   * What a ticket is for, in colour.
   *
   * A cook works a spike of these from across a hot kitchen, and a parcel
   * is a different job from a table: it is bagged, not plated, and somebody
   * is standing at the counter for it. Every ticket looked the same, so the
   * only way to tell was to read the words at the top of each one.
   *
   * The whole card changes, not just a badge — the ground, the edge, the
   * band across the top — because what has to carry is the count of parcels
   * waiting, seen at a glance and from a distance.
   *
   * Both looks are written out together so they cannot drift apart, and
   * both are built from theme tokens: the outlet picks one of seven, and a
   * colour of our own would be wrong in six of them.
   */
  const tone = isParcel
    ? {
      /* Gold, because the brand has exactly two colours and the other one
         is already the table's. `info` was a blue borrowed from the status
         palette — it told a cook "parcel" well enough, but it belonged to
         no part of this kitchen, and on a board that is nothing but these
         two kinds of ticket it was the only thing on screen that was not
         ours.
         Gold is also the furthest thing from the dine-in green, which is
         what the colour is for: counting the parcels waiting, from across
         a hot kitchen, without reading a word. */
      card: "border-[var(--theme-secondary)]/55 bg-[var(--secondary-alpha-7)]",
      edge: "bg-gradient-to-b from-[var(--theme-secondary-light)] to-[var(--theme-secondary-dark)]",
      header: "gf-metal-gold",
      strip: "bg-[var(--secondary-alpha-13)]",
      /* White on gold is the one pairing in this palette that cannot be
         read — the note below on the dine-in side was written after it
         swallowed a table number. So the gold ticket writes in the dark
         green instead, the same way the till's gold keys do. */
      text: "text-[var(--theme-primary-darker)]",
      sub: "text-[var(--theme-primary-darker)]/75",
      divide: "border-[var(--theme-primary-darker)]/25",
    }
    : {
      card: "border-border-default bg-surface",
      /* The gold stays on the edge, where it is a stripe and carries no
         words. The header went solid green when the palette changed: it
         had been a green-to-gold gradient under white type, and white on
         gold is the one pairing in this palette that cannot be read — the
         table number, which is the whole point of a ticket, faded out
         towards the right-hand end of its own bar. */
      edge: "bg-gradient-to-b from-[var(--theme-primary)] to-[var(--theme-primary-light)]",
      header: "gf-metal-green",
      strip: "bg-primary/5",
      text: "text-text-inverted",
      sub: "text-white/90",
      divide: "border-white/30",
    };

  return (
    <article
      data-role="ticket"
      data-kind={isParcel ? "parcel" : "dine-in"}
      className={`relative flex flex-col rounded-xl border shadow-[0_1px_5px_rgba(0,0,0,0.09)] overflow-hidden ${tone.card}`}
    >
      {/* The edge is what the eye picks up first down a column of tickets. */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[5px] ${tone.edge}`} />
      {/* Which table this is, and the one button that clears the whole ticket. */}
      <header className={`flex items-stretch pl-[5px] ${tone.text} ${tone.header}`}>
        <div className="flex-1 min-w-0 px-3 py-1.5 leading-tight">
          <p className="text-[17px] font-black truncate tracking-tight">
            {isParcel ? t("kitchen.pickUp") : tableNum ? tableLabel(tableNum) : "Dine-in"}
          </p>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${tone.sub} flex items-center gap-1`}>
            {isParcel ? <IcoParcel width="11" height="11" /> : <IcoDine width="11" height="11" />}
            {isParcel ? "Takeaway" : t("kitchen.dineIn")}
          </p>
        </div>

        <button
          type="button"
          disabled={clearing}
          onClick={() => onAllReady(order, pending)}
          title={t("kitchen.allCooked")}
          className={`tap-target shrink-0 w-[98px] flex flex-col items-center justify-center gap-0.5 bg-surface/20 hover:bg-surface/30 active:scale-[0.98] transition disabled:opacity-50 border-l ${tone.divide}`}
        >
          <IcoTick width="17" height="17" />
          <span className="text-[11px] font-black uppercase tracking-wide leading-none">
            {clearing ? "..." : t("kitchen.foodReady")}
          </span>
        </button>
      </header>

      {/* The token to call, how long it has waited, and who sent it. */}
      <div className={`flex items-stretch border-b border-border-default pl-[5px] text-text-secondary ${tone.strip}`}>
        <div className="px-2.5 py-1.5 leading-tight border-r border-border-default text-center">
          <p className="text-[15px] font-black tabular-nums" data-role="token">
            {order?.tokenNo ?? order?.kotNumber ?? "-"}
          </p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{t("order.tokenNo")}</p>
        </div>

        <div className="px-2.5 py-1.5 leading-tight border-r border-border-default text-center">
          <TicketClock timestamp={order?.timestamp} />
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{t("kitchen.mmss")}</p>
        </div>

        <div className="flex-1 min-w-0 px-2.5 py-1.5 leading-tight flex flex-col justify-center">
          {person.name ? (
            <p className="text-[11px] font-bold truncate flex items-center gap-1" title={person.name}>
              <IcoPerson width="11" height="11" className="shrink-0 opacity-50" />
              {person.name}
            </p>
          ) : (
            <p className="text-[11px] text-text-muted">—</p>
          )}
          {/* A parcel is called out by name and, when the guest is not
              waiting at the counter, rung on the number they left. */}
          {person.phone && (
            <p className="text-[11px] font-semibold tabular-nums text-text-muted truncate">
              {person.phone}
            </p>
          )}
          {order?.kotNumber > 1 && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Round {order.kotNumber}
            </p>
          )}
        </div>
      </div>

      {/* The food. */}
      <ul className="flex-1 divide-y divide-border-default">
        {lines.map((item, idx) => {
          // The line's own name first: two rows on one ticket can be the same
          // dish made two ways, and keying both on the product made React
          // treat them as one row and marked them busy together.
          const key = item.line_id || item.product_id || item.id || idx;
          const left = leftOf(item);
          const busy = busyKey === `${order.serverId}:${key}`;
          const lit = highlight && dishName(item) === highlight;
          const out = left <= 0;   // cooked and gone to the pass

          return (
            /* A dish is either still to come or it has gone out. There is no
               third state: the cook's one tap is the whole story, and a flag
               for "on the stove" was one more thing to keep up to date in a
               kitchen with no time to keep anything up to date. */
            <li
              key={key}
              data-state={out ? "out" : "waiting"}
              className={`flex items-start gap-2 px-3 py-1.5 ${
                out ? "opacity-45" : lit ? "bg-primary/5" : ""
              }`}
            >
              <span className="shrink-0 min-w-[18px] text-[15px] font-black tabular-nums text-text-secondary pt-[1px]">
                {out ? item.quantity : left}
              </span>

              <div className="flex-1 min-w-0">
                {/* The dish. Nothing to press here — the switch at the end of
                    the row is the only control on it. */}
                <p
                  className={`flex items-center gap-1.5 text-[14px] leading-snug break-words ${
                    out
                      ? "line-through text-text-muted font-semibold"
                      : lit
                        ? "font-black text-primary"
                        : "font-semibold text-text-secondary"
                  }`}
                >
                  <FoodMark type={item.foodType || item.food_type} size={12} />
                  {dishName(item)}
                </p>

                {/* Under the English, in the same size the rest of the ticket
                    whispers in. A chef reading Arabic finds it on its own
                    line rather than hunting for it inside a run-on. */}
                {dishArabic(item, menuMode) && (
                  <p
                    dir="rtl"
                    className={`font-arabic text-[13px] leading-snug ${
                      out ? "line-through text-text-muted" : "text-text-secondary"
                    }`}
                  >
                    {dishArabic(item, menuMode)}
                  </p>
                )}

                {/* The loudest thing on the ticket after the dish itself.
                    A Jain plate cooked with onion is thrown away and the guest
                    will not eat, so this is said in a word rather than a mark
                    nobody has been taught. */}
                {(item.jain === true || item.is_jain === true) && (
                  <p className="mt-1">
                    <JainTag size="big" />
                    <span className="ml-1.5 text-[11px] font-bold text-text-secondary">
                      {t("kitchen.jainExplain")}
                    </span>
                  </p>
                )}

                {/* The one thing a kitchen truly needs written down. */}
                {item.note && (
                  <p className="mt-1 flex items-start gap-1 rounded-md bg-warning/10 border border-warning/40 px-1.5 py-0.5 text-[11px] font-bold text-warning break-words">
                    <IcoNote width="11" height="11" className="mt-[3px] shrink-0" />
                    <span>{item.note}</span>
                  </p>
                )}

                {Number(item.prepared_quantity) > 0 && (
                  <p className="mt-0.5 text-[10px] font-bold text-success">
                    {item.prepared_quantity} of {item.quantity} done
                  </p>
                )}
              </div>

              {/*
                One switch per dish, flicked when it goes out.

                A switch is the one control that carries its own state without
                being mistaken for a statement: off is a dish still to come, on
                is a dish gone, and which it is can be read from across the
                kitchen by shape alone, before any colour is taken in.

                Green belongs here, and only here. It was wrong on the button
                that came before this because that button sat against a dish
                still in the pan; on a switch that is already over, green says
                what is true.

                It does not flick back. Nothing in the kitchen can un-cook a
                dish, and a switch that pretended otherwise would be offering
                the pass something it cannot have.
              */}
              <button
                type="button"
                role="switch"
                aria-checked={out}
                disabled={busy || out}
                onClick={() => onReady(order, item, left)}
                title={out ? t("kitchen.sentOut") : t("kitchen.flickOut")}
                aria-label={`${dishName(item)} — ${out ? "sent out" : "flick when it goes out"}`}
                className={`tap-target shrink-0 relative w-[52px] h-8 rounded-full transition-colors disabled:cursor-default ${
                  out ? "bg-success" : "bg-text-muted/25 hover:bg-text-muted/40"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                    out ? "left-[24px]" : "left-1"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
};

/* -------------------------------- the board ------------------------------- */

const KitchenBoard = ({ orders = [], searchTerm, setSearchTerm, muted, onToggleMute }) => {
  const t = useT();

  const updateHoldOrderStatus = useHoldOrderStore((s) => s.updateHoldOrderStatus);
  const [busyKey, setBusyKey] = useState(null);
  // Whose kitchen this is. Read from the session rather than written into
  // the markup, so every restaurant sees its own name on its own wall.
  const outletName = useAuthStore((s) => s.user?.outlet_name);

  const [dish, setDish] = useState(null);          // which dish the rail is on
  const [collapsed, setCollapsed] = useState({});  // folded rail sections
  const [railOpen, setRailOpen] = useState(false); // the rail, on a small screen
  const [online, setOnline] = useState(() => navigator.onLine);

  // A kitchen screen runs unattended all service, so it has to say for itself
  // when it has stopped hearing from the till.
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Oldest first: a kitchen works down the queue, not up it.
  const queue = useMemo(
    () =>
      [...orders]
        .filter((o) => pendingOf(o).length > 0)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    [orders]
  );

  // Every dish still to cook, totalled across every table and grouped by
  // section — the batching view. Eight of one dish is one pan, not eight.
  const sections = useMemo(() => {
    const bySection = new Map();
    let total = 0;

    queue.forEach((order) =>
      pendingOf(order).forEach((item) => {
        const left = leftOf(item);
        if (left <= 0) return;
        total += left;
        const section = item.categoryName || "Other";
        if (!bySection.has(section)) bySection.set(section, new Map());
        const inSection = bySection.get(section);
        const name = dishName(item);
        inSection.set(name, (inSection.get(name) || 0) + left);
      })
    );

    return {
      total,
      list: [...bySection.entries()]
        .map(([name, items]) => ({
          name,
          dishes: [...items.entries()]
            .map(([n, count]) => ({ name: n, count }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [queue]);

  // Picking a dish on the rail leaves only the tables waiting on it.
  const shown = useMemo(
    () => (dish ? queue.filter((o) => pendingOf(o).some((i) => dishName(i) === dish)) : queue),
    [queue, dish]
  );

  const run = async (key, work) => {
    setBusyKey(key);
    try {
      await work();
    } finally {
      setBusyKey(null);
    }
  };

  const handleReady = (order, item, left) =>
    run(`${order.serverId}:${item.product_id || item.id}`, () =>
      updateHoldOrderStatus(order.serverId, item, { completedQty: left }).catch(() => {})
    );

  // Every remaining dish on the ticket, one after the other. They go in
  // sequence rather than together: each call rewrites the same order row, and
  // firing them at once lets the last write win and silently lose the rest.
  const handleAllReady = (order, pending) =>
    run(`${order.serverId}:all`, async () => {
      try {
        for (const item of pending) {
          const left = leftOf(item);
          if (left <= 0) continue;
          // Straight out. A dish that was never put on the stove was still
          // cooked — the cook simply never stopped to say so.
          await updateHoldOrderStatus(order.serverId, item, { completedQty: left });
        }
      } catch {
        // The store has already said what went wrong. Stopping here leaves the
        // rest of the ticket as it was rather than half-clearing it.
      }
    });

  const pickDish = (name) => {
    setDish(name);
    setRailOpen(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* What this screen is, and whether it is still connected. */}
      <header className="shrink-0 flex items-center gap-2 px-3 py-2 bg-surface border-b border-border-default">
        <button
          type="button"
          onClick={() => setRailOpen((v) => !v)}
          title={t("kitchen.toCook")}
          className="tap-target lg:hidden shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:bg-primary/10"
        >
          <IcoRail width="18" height="18" />
        </button>

        {/**
         * The restaurant's own name, set in the serif, and taken from the
         * outlet this screen is signed in to.
         *
         * It used to say "Surti Swaad" in the markup. That was true of the
         * first restaurant on the system and of nobody since — every other
         * kitchen in the country would have had a wall screen all evening
         * with somebody else's name across the top of it.
         *
         * A kitchen screen is left on a wall untouched for a whole service,
         * so it may as well look like it belongs to the restaurant rather
         * than to a piece of software.
         */}
        <h1 className="flex-1 min-w-0 text-center truncate">
          <span className="font-display text-[17px] sm:text-[22px] font-semibold text-primary">
            {outletName || "Kitchen"}
          </span>
          <span className="label-caps ml-2.5 align-middle">{t("kitchen.title")}</span>
        </h1>

        {/* A new ticket chimes. A kitchen with a radio on turns it off. */}
        {onToggleMute && (
          <button
            type="button"
            onClick={onToggleMute}
            title={muted ? t("kitchen.soundOff") : t("kitchen.soundOn")}
            className="tap-target shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[15px] text-text-muted hover:bg-primary/10"
          >
            {muted ? "🔇" : "🔔"}
          </button>
        )}

        <span
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            online
              ? "border-success/40 bg-success/10 text-success"
              : "border-error/40 bg-error/10 text-error"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${online ? "bg-success/100" : "bg-error/100"}`} />
          {online ? "Online" : "Offline"}
        </span>
      </header>

      {/* What is on the board right now. */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2">
        <input
          value={searchTerm ?? ""}
          onChange={(e) => setSearchTerm?.(e.target.value)}
          placeholder={t("menu.searchWide")}
          className="flex-1 min-w-[170px] h-9 rounded-lg border border-border-default bg-surface px-3 text-[13px] outline-none focus:border-primary/50"
        />
        <span className="inline-flex items-center rounded-full bg-surface border border-border-default px-2.5 py-1 text-[12px] font-bold text-text-muted">
          {shown.length} {shown.length === 1 ? "ticket" : "tickets"}
        </span>
        <span className="inline-flex items-center rounded-full bg-surface border border-border-default px-2.5 py-1 text-[12px] font-bold text-text-muted">
          {sections.total} to cook
        </span>
        {dish && (
          <button
            type="button"
            onClick={() => setDish(null)}
            title={t("order.showEveryTable")}
            className="tap-target inline-flex items-center gap-1.5 rounded-full gf-metal-green px-3 py-1 text-[12px] font-bold"
          >
            {dish} ✕
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex gap-3 px-3 pb-3">
        <DishRail
          className="hidden lg:flex w-[228px] shrink-0"
          sections={sections.list}
          selected={dish}
          onSelect={pickDish}
          collapsed={collapsed}
          onToggle={(name) => setCollapsed((c) => ({ ...c, [name]: !c[name] }))}
        />

        {shown.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-text-muted">
            <IcoFlame width="40" height="40" className="opacity-25 mb-3" />
            <p className="text-base font-bold text-text-muted">
              {dish ? t("kitchen.noTableWaiting") : t("kitchen.nothingWaitingShort")}
            </p>
            <p className="text-[13px] mt-1">
              {dish ? t("kitchen.pickAnother") : t("kitchen.allCookedHint")}
            </p>
          </div>
        ) : (
          /* Every ticket is the same size, however many are on the board, and
             each is only as tall as the food it holds. They fill left to right
             and wrap; on a phone one fills the width. */
          <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
            <div className="flex flex-wrap items-start gap-3 pb-4">
              {shown.map((order) => (
                <div key={order.serverId || order.localId} className="w-full sm:w-[276px]">
                  <Ticket
                    order={order}
                    busyKey={busyKey}
                    highlight={dish}
                    onReady={handleReady}
                    onAllReady={handleAllReady}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* On a phone or a tablet the rail slides over rather than taking a
          column the tickets need. */}
      {railOpen && (
        <div className="lg:hidden fixed inset-0 z-[9000] flex">
          <button
            type="button"
            aria-label={t("kitchen.close")}
            onClick={() => setRailOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-[260px] max-w-[82vw] h-full bg-primary/10 p-3 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between pb-2 shrink-0">
              <p className="text-[13px] font-black uppercase tracking-wider text-text-muted">
                To cook ({sections.total})
              </p>
              <button
                type="button"
                onClick={() => setRailOpen(false)}
                className="tap-target w-8 h-8 rounded-lg text-text-muted hover:bg-primary/20"
              >
                ✕
              </button>
            </div>
            <DishRail
              className="flex-1"
              sections={sections.list}
              selected={dish}
              onSelect={pickDish}
              collapsed={collapsed}
              onToggle={(name) => setCollapsed((c) => ({ ...c, [name]: !c[name] }))}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenBoard;
