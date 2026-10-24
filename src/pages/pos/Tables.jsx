import React, { useState, useEffect, useMemo } from "react";
import { useT, useLanguage } from "../../i18n";
import ManageTables from "../../components/pos/table/ManageTables";
import { useNotification } from "./../../hooks/useNotification";
import { useTableStore } from "../../store/useTableStore";
import { useCartStore } from "../../store/useCartStore";
import { useNavigate } from "react-router-dom";
import { useHoldOrderStore } from "../../store/useHoldOrderStore";
import { useAuthStore } from "../../store/useAuthStore";
import LoadingBar from "../../components/common/LoadingBar/LoadingBar";
import { useResponsive } from "../../context/ResponsiveContext";
import { getSocket } from "../../socket/socket";
import { tableLabel } from "../../utils/kitchen";
import { canBill } from "../../utils/roleUi";
import { useFeatures } from "../../hooks/useFeatures";

/* ─── SVG Icon Primitives ────────────────────────────────────────────── */
const Svg = ({ size, children, vb = "0 0 24 24" }) => (
  <svg
    width={size}
    height={size}
    viewBox={vb}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, display: "block" }}
  >
    {children}
  </svg>
);
const IcoGrid = ({ s = 16 }) => <Svg size={s}><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><rect x="14" y="14" width="7" height="7" rx="1.2" /></Svg>;
const IcoPlus = ({ s = 14 }) => <Svg size={s}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>;
const IcoSearch = ({ s = 14 }) => <Svg size={s}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Svg>;
const IcoUsers = ({ s = 11 }) => <Svg size={s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></Svg>;
const IcoSettings = ({ s = 13 }) => <Svg size={s}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></Svg>;

/* ─── Keyframe & Font Injection ─────────────────────────────────────── */
const KEYFRAMES = `
* { font-family: 'Outfit', sans-serif; box-sizing: border-box; }

@keyframes tFadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes tPulse    { 0%,100%{opacity:1} 50%{opacity:0.35} }
@keyframes tGlow     { 0%,100%{box-shadow:0 6px 20px var(--secondary-alpha-35)} 50%{box-shadow:0 6px 28px var(--secondary-alpha-60)} }
@keyframes tShimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes tSelGlow  { 0%,100%{box-shadow:0 6px 22px var(--primary-alpha-38)} 50%{box-shadow:0 6px 30px var(--primary-alpha-58)} }

.anim-fade-up   { animation: tFadeUp 0.32s ease both; }
.anim-pulse-dot { animation: tPulse 2s ease infinite; }
.anim-glow-occ  { animation: tGlow 3s ease infinite; }
.anim-glow-sel  { animation: tSelGlow 3s ease infinite; }
.anim-shimmer   {
  background: linear-gradient(90deg, var(--theme-primary) 0%, var(--theme-secondary) 40%, var(--theme-primary) 70%, var(--theme-secondary) 100%);
  background-size: 300% 100%;
  animation: tShimmer 5s linear infinite;
}

/* Custom scrollbar */
.custom-scroll::-webkit-scrollbar       { width: 3px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--primary-alpha-22); border-radius: 99px; }

/* Mono font utility */
.font-mono-jet { font-family: 'JetBrains Mono', monospace; }
`;

/* ─── Dynamic Chair Helpers ─────────────────────────────────────────── */
/** Splits N seats evenly across top / bottom / left / right. */
const distributeChairs = (seats) => {
  const n = Math.max(0, Number(seats) || 0);
  // 2 or fewer seats: leave empty space around the table — no chair indicators
  if (n <= 2) return { top: 0, bottom: 0, left: 0, right: 0 };
  const base = Math.floor(n / 4);
  const extra = n % 4;
  return {
    top: base + (extra > 0 ? 1 : 0),
    bottom: base + (extra > 1 ? 1 : 0),
    left: base + (extra > 2 ? 1 : 0),
    right: base,
  };
};

/** Renders individual chair spans around all 4 sides. */
const renderChairs = (dist, bg) => {
  const els = [];
  // ── horizontal sides (top / bottom) ──
  ["top", "bottom"].forEach(side => {
    const count = dist[side];
    if (!count) return;
    // Each chair occupies equal share of ~80% of the table width
    const chairW = Math.max(6, Math.floor(72 / count));
    Array.from({ length: count }).forEach((_, i) => {
      const frac = (i + 1) / (count + 1); // even spacing 0→1
      els.push(
        <span
          key={`${side}-${i}`}
          style={{
            position: "absolute",
            [side]: "-7px",
            left: `${frac * 100}%`,
            transform: "translateX(-50%)",
            width: `${chairW}%`,
            height: "6px",
            borderRadius: "5px",
            background: bg,
          }}
        />
      );
    });
  });
  // ── vertical sides (left / right) ──
  ["left", "right"].forEach(side => {
    const count = dist[side];
    if (!count) return;
    const chairH = Math.max(6, Math.floor(72 / count));
    Array.from({ length: count }).forEach((_, i) => {
      const frac = (i + 1) / (count + 1);
      els.push(
        <span
          key={`${side}-${i}`}
          style={{
            position: "absolute",
            [side]: "-7px",
            top: `${frac * 100}%`,
            transform: "translateY(-50%)",
            width: "6px",
            height: `${chairH}%`,
            borderRadius: "5px",
            background: bg,
          }}
        />
      );
    });
  });
  return els;
};

/* ─── TableCard (with responsive adjustments) ───────────────────────── */
/**
 * A table on the floor plan.
 *
 * Four states, each its own colour, so the floor reads at a glance:
 *   vacant    — pale, waiting
 *   selected  — the table this till is ringing up, in the brand purple
 *   running   — guests seated with an order open, in the deep red
 *   billing   — the captain has sent the bill to the till; it stays amber
 *               until the money is taken, then the table falls back to vacant
 *
 * There is one button, not two: "Open Order" and "Resume Order" both did the
 * same thing, so what is left is a single eye — look at what this table has.
 * Deleting a table moved to Manage Tables, out of thumb's reach of a guest
 * being seated.
 */
/** How long this table has been sitting. Minutes are what matter here. */
const sittingFor = (since, now) => {
  if (!since) return null;
  const started = new Date(since).getTime();
  if (Number.isNaN(started)) return null;
  const mins = Math.max(0, Math.floor((now - started) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
};

const TableCard = ({ item, index, isSelected, isOnHold, billRequested, matchedHoldOrder, claimedBy, onSet, onResume, now }) => {
  const t = useT();
  /* The chairs drawn round the tile: pale on a filled table, and a tint of
     the brand green on an empty one. On the gold tile they go dark for the
     same reason its letters do. */
  const chairBg = billRequested
    ? "rgba(2, 44, 34, 0.28)"
    : isOnHold || Boolean(claimedBy)
      ? "var(--overlay-white-25)"
      : "var(--primary-alpha-11)";

  // Distribute seat count across the 4 sides for visual chair rendering
  const chairDist = distributeChairs(item.seats);

  // The whole tile is the control now, so the state has to read from the tile
  // itself rather than from a button underneath it.
  const shell =
    "tap-target group relative w-full rounded-[14px] border border-solid p-[7px] cursor-pointer text-left " +
    "transition-all duration-200 ease-out anim-fade-up active:scale-[0.97] " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]";
  /**
   * Someone else has this table open and is writing the order on it.
   *
   * It comes after an open bill in this list, not before: a table that is
   * already eating is a stronger fact than a table someone is standing at,
   * and the two happen together every time a captain adds a second round.
   */
  const beingTaken = Boolean(claimedBy) && !isSelected && !isOnHold;

  /**
   * The frame round the table top.
   *
   * Selection is a gold ring laid over whatever the table already is,
   * rather than a fifth colour replacing the state. A cashier needs to know
   * two things at once — what is happening at that table, and whether it is
   * the one on their screen — and a colour can only answer one of them.
   */
  const shellState = [
    billRequested
      ? "border-[var(--warning-main)]/45 bg-[var(--warning-main)]/[0.06]"
      : isOnHold
        ? "border-[var(--primary-alpha-18)] bg-surface"
        : beingTaken
          ? "border-[var(--info-main)]/40 bg-[var(--info-main)]/5"
          : "border-[var(--primary-alpha-11)] bg-surface hover:border-[var(--primary-alpha-26)] hover:-translate-y-[2px] hover:shadow-[0_8px_22px_var(--primary-alpha-12)]",
    isSelected
      ? "!border-[var(--theme-secondary)] shadow-[0_0_0_3px_var(--secondary-alpha-25)]"
      : "",
  ].join(" ");

  const surface =
    "w-full aspect-[1.1] rounded-[10px] relative flex flex-col items-center justify-center gap-[1px] transition-all duration-200";
  /**
   * The table top itself, in whichever metal says what is happening at it.
   *
   * The order of these matters more than the colours do, and it was wrong.
   * Gold went to a table with an order running on it — which, through a
   * whole service, is nearly every table. A floor of eight gold tiles is a
   * floor with nothing on it worth finding, and gold spent on the ordinary
   * case has nothing left for the urgent one.
   *
   * So: emerald is the working state, because most tables are working.
   * Gold is kept for the one table that has asked for its bill and is
   * waiting on a human — the rare thing, the thing that needs somebody to
   * move. Slate is a table another device is already writing on.
   *
   * A vacant table is deliberately the opposite of all of them — set INTO
   * the page rather than raised off it. Empty tables are most of the floor
   * for most of a night, and if they shone too there would be nothing left
   * to find.
   */
  const surfaceState = billRequested
    ? "gf-metal-gold anim-glow-occ"
    : isOnHold
      ? "gf-metal-green anim-glow-occ"
      : beingTaken
        ? "gf-metal-slate anim-glow-occ"
        : "pos-inset-quiet";

  const filled = isOnHold || billRequested || beingTaken;

  /**
   * Dark letters on the gold one, white on the rest.
   *
   * White on gold is the one pairing in this palette that cannot be read at
   * any size, and the table waiting for its bill is precisely the tile that
   * has to be read from across a room.
   */
  const numberTone = billRequested
    ? "text-[var(--theme-primary-darker)]"
    : filled
      ? "text-white"
      : "text-[var(--theme-primary)]";

  const seatTone = billRequested
    ? "text-[var(--theme-primary-darker)]/70"
    : filled
      ? "text-[var(--overlay-white-76)]"
      : "text-[var(--primary-alpha-60)]";

  const sitting = isOnHold ? sittingFor(matchedHoldOrder?.timestamp, now) : null;

  return (
    <button
      type="button"
      onClick={() => (isOnHold ? onResume(matchedHoldOrder) : onSet(item, isSelected))}
      title={
        isOnHold
          ? billRequested
            ? `${tableLabel(item.tableNumber)} — waiting to pay`
            : `${tableLabel(item.tableNumber)} — open order`
          : beingTaken
            ? `${tableLabel(item.tableNumber)} — ${claimedBy?.name || "someone"} is taking the order`
            : `${tableLabel(item.tableNumber)} — free`
      }
      className={`${shell} ${shellState}`}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.5)}s` }}
    >
      <div className={`${surface} ${surfaceState}`}>
        {/* one shape per seat, around all four sides */}
        {renderChairs(chairDist, chairBg)}

        <div className={`text-[clamp(13px,2vw,17px)] font-extrabold tracking-[-0.035em] leading-none ${numberTone}`}>
          {/* A table saved as "T1" was printed as "TT1" here, because the
              T was pasted on regardless of what the name already had. */}
          {tableLabel(item.tableNumber)}
        </div>

        <div className={`flex items-center gap-[3px] text-[11px] font-medium font-mono-jet ${seatTone}`}>
          <IcoUsers s={10} />
          {item.seats}
        </div>

        {/* How long they have been sitting. A captain crossing the room can
            see which table has been waiting without opening anything.

            Just the figure: it sat in a pill with a little clock beside it,
            which put three things in a space the size of a fingernail and left
            the number — the only part anyone reads — the smallest of them. The
            colour of the tile already says whether this table is eating or
            waiting to pay, so the icon was saying it twice. */}
        {sitting && (
          <div className="mt-[4px] text-[13px] font-bold leading-none tracking-[0.01em] text-white tabular-nums">
            {sitting}
          </div>
        )}

        {/* The name, not just the colour: "taken" tells the cashier to leave
            it alone, and the name tells them who to ask. */}
        {beingTaken && (
          <div className="mt-[4px] max-w-full truncate px-[6px] text-[11px] font-bold leading-none text-white">
            {claimedBy?.name || t("tables.takingOrder")}
          </div>
        )}
      </div>
    </button>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────── */
const Tables = () => {
  const t = useT();
  /* The floor plan's headings follow the staff's language, not the menu's. */
  const language = useLanguage();

  const { tables, hydrate, hydrated, addTable, updateTable, deleteTable, fetchTablesFromAPI } = useTableStore();
  const [manageOpen, setManageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const { selectedTable, setSelectedTable } = useCartStore();
  const { notifyError, notifySuccess } = useNotification();
  const navigate = useNavigate();
  const holdOrders = useHoldOrderStore(s => s.holdOrders);
  const fetchHoldOrders = useHoldOrderStore(s => s.fetchHoldOrders);
  const user = useAuthStore(s => s.user);
  const { setCartFromHold, setActiveHoldOrder } = useCartStore();
  const { isMobile, isTablet, screenWidth } = useResponsive();
  const features = useFeatures();

  /**
   * A counter has no floor to draw.
   *
   * The side bar already leaves this out, but the address is still an address
   * — a bookmark from before the shop changed, or a tablet left on this screen
   * — and an empty room with an Add Table button is not what should answer.
   */
  useEffect(() => {
    if (!features.table_service_enabled) navigate("/pos/dashboard", { replace: true });
  }, [features.table_service_enabled, navigate]);

  // Responsive grid columns based on screen size
  // The sitting time on a busy table, refreshed once a minute — that is the
  // resolution it is shown at, and a floor of twenty tables has no business
  // re-rendering every second.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const gridCols = useMemo(() => {
    // Smaller again now that the tile is the control and carries no button
    // row: a floor of twenty tables fits on one screen rather than being
    // scrolled through during service.
    if (isMobile) return "minmax(88px, 1fr)";
    if (isTablet) return "minmax(100px, 1fr)";
    return "minmax(106px, 1fr)";
  }, [isMobile, isTablet]);

  useEffect(() => {
    if (user?.outlet_id) fetchHoldOrders(user.outlet_id);
  }, [fetchHoldOrders, user?.outlet_id]);

  // A table can be taken or freed on another till or a captain's tablet, so
  // refresh when the server says this outlet's tables changed.
  useEffect(() => {
    const socket = getSocket();

    const refresh = async () => {
      await hydrate();
      if (user?.outlet_id) await fetchHoldOrders(user.outlet_id);
    };

    socket.on("table:refresh", refresh);
    socket.on("holdOrderUpdated", refresh);

    return () => {
      socket.off("table:refresh", refresh);
      socket.off("holdOrderUpdated", refresh);
    };
  }, [hydrate, fetchHoldOrders, user?.outlet_id]);

  /**
   * Which tables somebody is standing at right now.
   *
   * The whole list arrives each time rather than one change at a time, so a
   * screen that missed an event while the wifi was out cannot end up showing
   * a table as taken by someone who walked away ten minutes ago.
   *
   * This device's own claim is dropped: the table it is on already shows as
   * selected, and telling the captain that the captain is at the table is
   * not news.
   */
  const [claims, setClaims] = useState({});

  useEffect(() => {
    const socket = getSocket();

    const onClaims = (payload) => {
      // No list at all is not the same as an empty one. Only the server
      // sends this, and it always sends the list.
      if (!Array.isArray(payload?.claims)) return;
      if (payload?.outlet_id && user?.outlet_id && payload.outlet_id !== user.outlet_id) return;

      const mine = user?.id;
      const next = {};
      for (const claim of payload?.claims || []) {
        if (!claim?.table_id) continue;
        if (mine && claim.user_id === mine) continue;
        next[claim.table_id] = claim;
      }
      setClaims(next);
    };

    socket.on("table:claims", onClaims);
    return () => socket.off("table:claims", onClaims);
  }, [user?.outlet_id, user?.id]);

  // Every id a table answers to. A held order carries the raw table id under
  // all three names; the table list keeps it as serverId and prefixes its own
  // localId with "server-". Only real values are collected — matching on a
  // missing one would make a takeaway, which belongs to no table, look like it
  // belonged to all of them.
  const tableKeys = (t) =>
    [
      t?.serverId,
      t?.id,
      t?.localId,
      typeof t?.localId === "string" ? t.localId.replace(/^server-/, "") : null,
    ].filter(Boolean);

  const sameTable = (a, b) => {
    const keys = new Set(tableKeys(a));
    return keys.size > 0 && tableKeys(b).some((k) => keys.has(k));
  };

  const holdOrderTableIds = holdOrders?.flatMap(o => {
    const t = o.cartData?.table;
    return t ? tableKeys(t) : [];
  }) || [];

  // The server owns table status, so every till and tablet agrees on which
  // tables are busy. The local held-order list is kept only as an immediate
  // fallback for the table this device just acted on, before the refetch lands.
  const isTableOccupied = (t) =>
    Boolean(
      t?.occupied ||
      holdOrderTableIds.includes(t?.localId) ||
      holdOrderTableIds.includes(t?.serverId)
    );

  // Tables whose captain has already sent the bill to the till. They stay in
  // this state until the payment is taken, at which point the held order is
  // closed and the table drops back to vacant on its own.
  const billRequestedTableIds = holdOrders?.flatMap(o => {
    if (!o.billRequestedAt) return [];
    const t = o.cartData?.table;
    return t ? tableKeys(t) : [];
  }) || [];

  const isBillRequested = (t) =>
    Boolean(
      billRequestedTableIds.includes(t?.localId) ||
      billRequestedTableIds.includes(t?.serverId)
    );

  useEffect(() => { hydrate(); }, [hydrate]);
  if (!hydrated) return null;

  // Why a table could not be made is the whole message. It used to be caught
  // and replaced with t("common.tryAgain"), which told the owner nothing —
  // least of all that the outlet had simply run out of its allowance.
  const handleAddTableSave = async ({ tableNumber, seats, zoneId = null }) => {
    if (tables.some(t => t.tableNumber == tableNumber)) {
      throw new Error(`Table ${tableNumber} already exists in this outlet.`);
    }
    // The room comes from wherever the button was pressed. The server puts a
    // table with no room into the main one, so this is never required — only
    // better, because the table lands where somebody meant it to.
    await addTable({ tableNumber, seats, zoneId });
    notifySuccess(t("tables.added"));
  };

  const handleUpdateTable = async (localId, { tableNumber, seats }) => {
    const clash = tables.some(
      t => t.localId !== localId && t.tableNumber == tableNumber
    );
    if (clash) {
      throw new Error(`Table ${tableNumber} already exists in this outlet.`);
    }
    await updateTable(localId, { tableNumber, seats });
    notifySuccess(t("tables.updated"));
  };

  const handleDeleteTable = async localId => {
    try {
      await deleteTable(localId);
      notifySuccess(t("tables.deleted"));
      if (selectedTable?.localId === localId) setSelectedTable({});
    }
    catch (err) {
      notifyError(err?.response?.data?.message || t("common.tryAgain"));
    }
  };

  const handleSetTable = (item, isSelected) => {
    if (!isSelected) { setSelectedTable(item); navigate("/pos/dashboard"); }
    else setSelectedTable({});
  };

  const handleResume = async order => {
    // Already handed to the counter. Opening it again would put the table
    // back in this tablet's hands, and the cashier standing at the till
    // would be told the table is somebody else's and be unable to take
    // the money — which is exactly what the guest is waiting on.
    if (order?.billRequestedAt && !canBill(user?.role?.name)) {
      const label = tableLabel(order?.cartData?.table?.tableNumber);
      notifyError(`${label} is with the counter now — it is being paid for`);
      return;
    }

    if (!order) {
      // The server says this table is busy but its bill has not reached this
      // device yet — pull it rather than leaving the tap doing nothing.
      notifyError(t("tables.loadingOrder"));
      if (user?.outlet_id) await fetchHoldOrders(user.outlet_id);
      return;
    }

    setCartFromHold(order.cartData);
    setActiveHoldOrder(order);
    navigate("/pos/dashboard");
  };

  const filteredTableList = [...tables]
    .sort((a, b) => (Number(a.tableNumber) || 0) - (Number(b.tableNumber) || 0))
    .filter(item => {
      const occ =
        item.localId === selectedTable?.localId || isTableOccupied(item);
      if (filter === "occupied") return occ;
      if (filter === "vacant") return !occ;
      return true;
    })
    .filter(item => item.tableNumber?.toString().includes(searchQuery));

  /**
   * The floor, grouped into the parts of the restaurant it is walked
   * through in.
   *
   * The order is the one somebody set on the Manage Tables screen — the
   * main hall before the terrace, because that is how a person moves
   * through the building.
   *
   * A plain computation, not a useMemo. It was one, and that was wrong
   * twice over. It sat below `if (!hydrated) return null`, so the first
   * render called forty-nine hooks and the next called fifty — which is
   * the one thing React cannot survive, and it took the whole screen down.
   *
   * And memoising it bought nothing even where it ran: `filteredTableList`
   * is rebuilt on every render, so the dependency never matched and the
   * body ran every time regardless. A hook that always recomputes is a
   * hook that only adds a rule to break.
   *
   * Grouping a few dozen tables costs nothing, and this screen already
   * re-renders once a second to move the clocks on its tiles.
   */
  const zonedFloor = (() => {
    const groups = new Map();

    for (const table of filteredTableList) {
      // Every table has a room now — the server puts one that arrives
      // without it into the main one. The fallback below is only for the
      // moment between a table being created and the floor being re-read.
      const key = table.zoneId || "__unplaced";
      if (!groups.has(key)) {
        /**
         * Which language the headings are in follows the interface, not the
         * menu.
         *
         * A dish's name is read by the guest — it is on the menu board and
         * on the bill — so it follows the menu setting. "Terrace" is read by
         * nobody but the staff: it is a heading on the floor plan and it
         * never leaves this screen. So it belongs with the software's own
         * words, and turns Arabic when the till does.
         *
         * English wherever no Arabic name has been typed, so a floor plan
         * never has a blank above a row of tables.
         */
        const arabicHeadings = language === "ar";
        const zoneName = arabicHeadings
          ? table.zoneNameAr || table.zoneName
          : table.zoneName;

        groups.set(key, {
          key,
          name: zoneName || t("tables.mainHall"),
          isArabic: Boolean(arabicHeadings && table.zoneNameAr),
          sequence: table.zoneId ? (table.zoneSequence ?? 9998) : 9999,
          tables: [],
        });
      }
      groups.get(key).tables.push(table);
    }

    return [...groups.values()].sort(
      (a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name)
    );
  })();

  const totalTables = tables.length;
  const occupiedCount = tables.filter(
    t => t.localId === selectedTable?.localId || isTableOccupied(t)
  ).length;
  const vacantCount = totalTables - occupiedCount;

  /**
   * Which tables to show, as three pills.
   *
   * All three go the same deep green when chosen, and the dot beside the
   * word is what says which state it is. They used to be three different
   * colours — one of them gold under white type, which could not be read at
   * all — and three coloured pills in a row left nothing to say which was
   * actually selected. The colour now means "this one", and the dot carries
   * the meaning it was carrying before.
   */
  const pillActive =
    "bg-[var(--theme-primary)] text-white border-transparent";

  const PILLS = [
    { key: "all", label: t("tables.all"), count: totalTables, activeCls: pillActive, dot: "bg-[var(--theme-primary)]" },
    { key: "occupied", label: t("tables.occupied"), count: occupiedCount, activeCls: pillActive, dot: "bg-[var(--theme-secondary)] anim-pulse-dot shadow-[0_0_6px_var(--secondary-alpha-55)]" },
    { key: "vacant", label: t("tables.vacant"), count: vacantCount, activeCls: pillActive, dot: "bg-[var(--theme-primary-lightest)]" },
  ];

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className="flex flex-col h-full overflow-hidden"
        /* Cream, flat. The wash under this was a pale green fading into a
           pale gold, which on the new palette made the floor plan the only
           page in the till that was not the same colour as the others. */
        style={{ background: "var(--bg-main)" }}
      >
        <LoadingBar isLoading={!hydrated} />

        {/* ────────── HEADER (Responsive) ────────── */}
        <div className="bg-white border-b border-[var(--primary-alpha-11)] shadow-[0_2px_20px_var(--primary-alpha-7)] flex-shrink-0 px-3 sm:px-5 pt-3 pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* Filter Pills - Scrollable on mobile */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 custom-scroll">
              {PILLS.map(p => {
                const isActive = filter === p.key;
                return (
                  <button
                    key={p.key}
                    className={`tap-target flex items-center gap-[6px] px-3 py-[6px] rounded-full text-[11px] sm:text-[12px] font-bold tracking-[0.025em] cursor-pointer transition-all duration-200 whitespace-nowrap border-[1.5px] flex-shrink-0
                      ${isActive ? p.activeCls : "bg-[var(--primary-alpha-5)] text-[var(--theme-primary)] border-[var(--primary-alpha-16)] hover:bg-[var(--primary-alpha-11)] hover:border-[var(--primary-alpha-28)]"}`}
                    onClick={() => setFilter(p.key)}
                  >
                    {!isActive && <span className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${p.dot}`} />}
                    {p.label}
                    <span className={`text-[10px] font-extrabold font-mono-jet px-[5px] py-[1px] rounded-full leading-none ${isActive
                      ? "bg-[var(--overlay-white-22)] text-white"
                      : "bg-[var(--primary-alpha-10)] text-[var(--theme-primary)]"
                      }`}>{p.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Search + Stats + Add Button */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[130px] sm:min-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--primary-alpha-42)] pointer-events-none flex">
                  <IcoSearch s={14} />
                </span>
                <input
                  className="w-full h-[36px] sm:h-[38px] pl-9 pr-10 rounded-[10px] border-[1.5px] border-[var(--primary-alpha-11)] bg-[var(--primary-alpha-4)] text-[var(--theme-primary-darker)] text-[12px] sm:text-[13px] font-normal outline-none transition-all placeholder:text-[var(--primary-alpha-42)] focus:border-[var(--theme-primary)] focus:bg-[var(--primary-alpha-7)]"
                  placeholder={isMobile ? "Search..." : t("tables.search")}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-[var(--primary-alpha-10)] text-[var(--theme-primary)] text-[10px] font-bold px-[7px] py-[2px] rounded-full font-mono-jet">
                    {filteredTableList.length}
                  </span>
                )}
              </div>

              {/* Stat chips removed – counts are now shown inside the filter pills */}

              {/* Adding, renaming and removing tables all live behind here. */}
              <button
                className="tap-target flex items-center gap-[6px] sm:gap-[7px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-[10px] sm:rounded-[11px] text-[11px] sm:text-[12px] font-bold tracking-[0.03em] cursor-pointer transition-all border-[1.5px] border-[var(--theme-primary)] bg-transparent text-[var(--theme-primary)] whitespace-nowrap hover:bg-[var(--theme-primary)] hover:text-white hover:shadow-[0_4px_16px_var(--primary-alpha-35)]"
                onClick={() => setManageOpen(true)}
              >
                <IcoSettings s={13} />
                <span className="hidden sm:inline">{t("tables.manage")}</span>
                <span className="sm:hidden">{t("tables.title")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ────────── GRID / EMPTY (Responsive Grid) ────────── */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {filteredTableList.length > 0 ? (
            /**
             * The floor, walked through a room at a time.
             *
             * A restaurant is not a flat list of numbers. It is an
             * air-conditioned room, a terrace, a family section — and a
             * cashier told "table four" needs to know which four, in a
             * building that may well have two.
             *
             * A restaurant that has never divided its floor sees exactly
             * what it saw before: one unbroken grid with no headings at
             * all, because a single heading over everything is a line of
             * furniture that tells nobody anything.
             */
            <div className="custom-scroll flex-1 overflow-y-auto p-3 sm:p-5">
              {zonedFloor.map((zone) => (
                <section key={zone.key} className="mb-5 last:mb-0">
                  {zonedFloor.length > 1 && (
                    <div className="mb-2.5 flex items-center gap-3">
                      {/* `label-caps` forces upper case, which Arabic does
                          not have — it leaves the letters alone but the
                          tracking it adds for capitals pulls the joins
                          apart, so an Arabic heading drops it. */}
                      <h2
                        className={
                          zone.isArabic
                            ? "font-arabic shrink-0 text-[12px] font-bold text-[var(--theme-primary)]"
                            : "label-caps !text-[11px] !text-[var(--theme-primary)] shrink-0"
                        }
                      >
                        {zone.name}
                      </h2>
                      <span className="pos-chip pos-chip-quiet shrink-0">
                        {zone.tables.length}
                      </span>
                      {/* A gold rule, running out of the heading and fading.
                          It is the one gold thing on this screen that is not
                          a table asking to be paid. */}
                      <hr className="pos-rule-gold min-w-0 flex-1" />
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(auto-fill, ${gridCols})`,
                      gap: isMobile ? "12px" : "14px",
                      alignContent: "start",
                    }}
                  >
                    {zone.tables.map((item, idx) => {
                      const isSelected = selectedTable?.localId === item?.localId;
                      const isOnHold = isTableOccupied(item);
                      const billRequested = isBillRequested(item);
                      // A takeaway has no table, so it can never be this card's.
                      const matchedHoldOrder = holdOrders?.find(
                        o => o.cartData?.table && sameTable(o.cartData.table, item)
                      );
                      return (
                        <TableCard
                          key={item.localId}
                          item={item}
                          index={idx}
                          isSelected={isSelected}
                          isOnHold={isOnHold}
                          billRequested={billRequested}
                          matchedHoldOrder={matchedHoldOrder}
                          claimedBy={
                            claims[item.serverId] || claims[item.localId] || claims[item.id] || null
                          }
                          onSet={handleSetTable}
                          onResume={handleResume}
                          now={now}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 px-5 py-12 text-center">
              <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-[var(--primary-alpha-7)] to-[var(--primary-alpha-14)] flex items-center justify-center text-[var(--primary-alpha-30)] border-[1.5px] border-dashed border-[var(--primary-alpha-20)]">
                <IcoGrid s={28} />
              </div>
              <div className="text-[14px] sm:text-[15px] font-extrabold text-[var(--theme-primary)] tracking-[-0.02em]">
                {searchQuery ? t("tables.noneFound") : t("tables.noneYet")}
              </div>
              <div className="text-[11px] sm:text-[12px] text-[var(--primary-alpha-42)] max-w-[210px] leading-relaxed">
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : t("tables.addFirst")}
              </div>
              {/* {!searchQuery && (
                <button
                  className="flex items-center gap-[6px] px-4 py-2 mt-1 rounded-[11px] text-[11px] sm:text-[12px] font-bold tracking-[0.03em] cursor-pointer transition-all border-[1.5px] border-[var(--theme-secondary)] bg-transparent text-[var(--theme-secondary)] hover:bg-[var(--theme-secondary)] hover:text-[var(--theme-primary-darker)] hover:shadow-[0_4px_16px_var(--secondary-alpha-38)]"
                  onClick={() => setAddNewModal(true)}
                >
                  <IcoPlus s={12} />{t("tables.add")}
                </button>
              )} */}
            </div>
          )}
        </div>

        {manageOpen && (
          <ManageTables
            tables={tables}
            isOccupied={isTableOccupied}
            onClose={() => setManageOpen(false)}
            onCreate={handleAddTableSave}
            onUpdate={handleUpdateTable}
            onDelete={handleDeleteTable}
            onRefreshTables={() => fetchTablesFromAPI({ force: true })}
          />
        )}
      </div>
    </>
  );
};

export default Tables;