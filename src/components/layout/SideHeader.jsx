import React, { useEffect, useMemo, useState } from "react";
import { useT } from "../../i18n";
import ShortcutLabel from "../common/ShortcutLabel";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/images/greenfalk-logo.png";
import favIcon from "../../assets/images/greenfalk-mark.png";
import { useAuthStore } from "../../store/useAuthStore";
import { useResponsive } from "../../context/ResponsiveContext";
import { roleUi, canBill } from "../../utils/roleUi";
import { useFeatures } from "../../hooks/useFeatures";
import { useHoldOrderStore } from "../../store/useHoldOrderStore";
import { useParcelStore } from "../../store/useParcelStore";
import { getSocket } from "../../socket/socket";

/**
 * Says who is signed in, in the role's own colour.
 *
 * The till and the captain's tablet show the same screens, so without this the
 * two are indistinguishable at a glance.
 */
const RoleBadge = ({ role, outletName, variant }) => {
  const ui = roleUi(role);

  if (variant === "collapsed") {
    /**
     * The role, on the dark rail.
     *
     * The colour is still the role's own — that is what tells a captain's
     * tablet from the till across a room, and it has not stopped being
     * useful. What the dark rail took away was the edge of the circle
     * against it, so the ring puts one back: on green, the captain's teal
     * ended where the rail began and the badge read as a smudge.
     */
    return (
      <div
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold tracking-wide text-white shadow-sm ring-2 ring-white/25"
        style={{ backgroundColor: ui.accent }}
        title={ui.label}
      >
        {ui.short}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-1.5 py-1 max-w-full"
        title={ui.label}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full ring-1 ring-white/40"
          style={{ backgroundColor: ui.accent }}
        />
        {/* The word is dropped on a narrow phone: the coloured band along the
            top of the bar already says which role this device is, and the
            label was what pushed the row past the edge. */}
        <span className="hidden sm:inline text-[11px] font-semibold truncate text-white">
          {ui.label}
        </span>
      </div>
    );
  }

  /**
   * The same badge with the rail open, so there is room for words.
   *
   * The tint behind it is white at a tenth rather than the role's own pale
   * wash: those washes were mixed to sit on a white sidebar, and on the dark
   * green one they came out as grey smears. The dot keeps the role's colour,
   * which is the part that carries the meaning.
   */
  return (
    <div className="flex w-full items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ring-1 ring-white/25"
        style={{ backgroundColor: ui.accent }}
      >
        {ui.short}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-bold leading-tight text-white">
          {ui.label}
        </span>
        {outletName && (
          <span className="block truncate text-[11px] leading-tight text-white/60">
            {outletName}
          </span>
        )}
      </span>
    </div>
  );
};

const NavButtons = ({ name, icon, target, shortcutKey, isOpen, isMobile, badge = 0 }) => {
  const location = useLocation();
  const isActive = location.pathname === target;

  // Highlights the specific character used for the shortcut
  const renderNameWithUnderline = (name, key) => {
    if (!key) return name;
    const index = name.toLowerCase().indexOf(key.toLowerCase());
    if (index === -1) return name;

    return (
      <>
        {name.substring(0, index)}
        <span className="underline decoration-2 underline-offset-4">
          {name[index]}
        </span>
        {name.substring(index + 1)}
      </>
    );
  };

  return (
    <Link to={target} className={`block ${isMobile ? "min-w-0 flex-1" : "w-full"}`}>
      <div
        className={`group relative flex items-center rounded-2xl cursor-pointer transition-all duration-300
    ${isActive ? "pos-rail-item-active" : "pos-rail-item"}
    ${
      isMobile
        ? "flex-col justify-center min-h-[44px] py-1.5 px-1 gap-0.5 text-xs"
        : isOpen
          ? "px-4 py-3 gap-3"
          : "justify-center py-3 px-2"
    }
  `}
        title={
          !isOpen
            ? `${name}${shortcutKey ? ` (${shortcutKey.toUpperCase()})` : ""}`
            : undefined
        }
      >
        <div
          className={`relative flex-shrink-0 transition-transform duration-300 ${
            isOpen && isActive ? "scale-110" : ""
          }`}
        >
          {icon}

          {/* How many guests are waiting at the counter. Sits on the icon so it
              is still visible when the sidebar is collapsed to icons only. */}
          {badge > 0 && (
            <span
              className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--theme-secondary)] text-[var(--theme-primary-darker)] text-[10px] font-bold flex items-center justify-center shadow ring-1 ring-[var(--theme-primary-darker)]/30"
              title={`${badge} ${badge === 1 ? "table is" : "tables are"} waiting to pay`}
            >
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </div>

        {isOpen && (
          <span className="text-sm font-medium whitespace-nowrap opacity-90 group-hover:opacity-100 transition-opacity duration-200">
            {renderNameWithUnderline(name, shortcutKey)}
          </span>
        )}
      </div>
    </Link>
  );
};

const SideHeader = ({ isOpen, setIsOpen, setIsLogoutClicked }) => {
  const t = useT();
  const user = useAuthStore((u) => u.user);
  /**
   * The account sheet on a phone or tablet.
   *
   * Everything the sidebar carries below its links — who is on shift, which
   * outlet, and the way out — had nowhere to live on the bottom bar, so on a
   * tablet nobody could sign out at all. That is no small thing now that an
   * account only runs on one screen: the next person to pick the tablet up
   * was asked to take the shift over from a device sitting right there.
   *
   * The role pill was already on the bar and already said whose shift it is,
   * so it becomes the way in rather than a sixth icon squeezed into the row.
   */
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();
  const { isMobile, screenWidth } = useResponsive();
  const isCompact = isMobile || screenWidth < 900;

  // How many tables are waiting at the counter to pay. Shown on the Bills
  // entry so the cashier does not have to open the screen to know.
  const holdOrders = useHoldOrderStore((s) => s.holdOrders);
  // What this outlet has been given, watched rather than read once: the
  // platform can take the parcel counter away while this screen is open.
  const features = useFeatures();

  const fetchHoldOrders = useHoldOrderStore((s) => s.fetchHoldOrders);
  const billsWaiting = useMemo(
    () => (holdOrders || []).filter((o) => o?.billRequestedAt).length,
    [holdOrders]
  );

  // Parcels the kitchen has finished and nobody has collected. A guest is
  // standing at the counter for each one of these.
  const parcels = useParcelStore((s) => s.parcels);
  const fetchParcels = useParcelStore((s) => s.fetchParcels);
  const parcelsReady = useMemo(
    () => (parcels || []).filter((p) => p?.stage === "READY").length,
    [parcels]
  );

  // The count has to be right the moment a till signs in, and stay right as
  // captains hand tables over — so load it once and follow the same live
  // event the invoice screens do.
  useEffect(() => {
    if (!canBill(user?.role?.name) || !user?.outlet_id) return;

    fetchHoldOrders(user.outlet_id);

    const socket = getSocket();
    // The count on the Bills tab is the reason a cashier walks over, so a
    // live change asks again rather than sharing an older answer.
    const refresh = () => fetchHoldOrders(user.outlet_id, { force: true });
    socket.on("holdOrderUpdated", refresh);
    return () => socket.off("holdOrderUpdated", refresh);
  }, [user?.outlet_id, user?.role?.name, fetchHoldOrders]);

  // The kitchen finishing a parcel is what puts a guest at the counter, so
  // the badge follows the same live events the parcel screen does.
  useEffect(() => {
    if (!canBill(user?.role?.name) || !user?.outlet_id) return;

    fetchParcels();

    const socket = getSocket();
    const refresh = () => fetchParcels({ force: true });
    socket.on("holdOrderUpdated", refresh);
    socket.on("parcelUpdated", refresh);
    socket.on("orderStatusUpdated", refresh);
    return () => {
      socket.off("holdOrderUpdated", refresh);
      socket.off("parcelUpdated", refresh);
      socket.off("orderStatusUpdated", refresh);
    };
  }, [user?.outlet_id, user?.role?.name, fetchParcels]);

  // Built inside the memo, because the list depends on the role and on the
  // waiting count — keeping it outside left the memo lying about its inputs.
  const filteredNavLinks = useMemo(() => {
    let navLinks = [
    { name: t("nav.home"), icon: <HomeIcon />, target: "/pos/dashboard", shortcutKey: "m" },
    {
      name: t("nav.customers"),
      icon: <CustomersIcon />,
      target: "/pos/customers",
      shortcutKey: "u",
    },
    { name: t("nav.tables"), icon: <TablesIcon />, target: "/pos/tables", shortcutKey: "a" },
    {
      name: t("nav.invoices"),
      icon: <InvoicesIcon />,
      target: "/pos/invoices",
      shortcutKey: "i",
    },
    {
      // The guest is at the counter saying "table three" — this is the screen
      // the cashier needs in one tap, not four tabs deep.
      name: t("nav.bills"),
      icon: <BillRequestIcon />,
      target: "/pos/bill-requests",
      shortcutKey: "b",
      badge: billsWaiting,
    },
    {
      // A parcel is paid for before it is cooked, so it leaves every other
      // list the moment the money is taken. Without a screen of its own
      // the cashier had to ask the kitchen whether one was ready.
      //
      // In a shop with no tables this is not the parcel counter, it is the
      // counter — every order of the day passes through here, so it is named
      // for what it holds rather than for one kind of sale.
      name: features.table_service_enabled ? t("nav.parcels") : t("nav.orders"),
      icon: <ParcelIcon />,
      target: "/pos/parcels",
      shortcutKey: "p",
      badge: parcelsReady,
    },
    {
      // Which printer is where, and what this till does with a sale. All of
      // it belongs to the machine rather than the account, so it is reached
      // from the till itself and not the owner's settings — nobody can set up
      // a cable from another building.
      name: t("nav.settings"),
      icon: <SettingsIcon />,
      target: "/pos/printer",
      // The letter has to be one the word actually contains, or the sidebar
      // underlines nothing and the shortcut is a secret.
      shortcutKey: "g",
    },
    // {
    //   name: "Promotions",
    //   icon: <PromotionsIcon />,
    //   target: "/pos/promotions",
    //   key: "r",
    // },
    // {
    //   name: "LowStock",
    //   icon: <LowStockIcon />,
    //   target: "/pos/lowstock",
    //   key: "o",
    // },
    ];

    const role = user?.role?.name;

    // The kitchen works one screen and nothing else.
    if (role === "chef") {
      return navLinks.filter((link) => link.target === "/pos/invoices");
    }

    /**
     * A counter has no floor plan, and nothing waiting on one.
     *
     * Nobody sits down, so there are no tables to lay out and no table that
     * can ask for its bill — the money is taken as the order is rung up. Both
     * screens would open on an empty room.
     */
    if (!features.table_service_enabled) {
      navLinks = navLinks.filter(
        (link) =>
          link.target !== "/pos/tables" &&
          link.target !== "/pos/bill-requests" &&
          // Nor the queue of tokens. It earns its place beside a restaurant,
          // where a parcel is the one sale that leaves every other list. A
          // counter sells nothing else — the guest is standing right there,
          // the token is on the slip in their hand, and the food comes out
          // in a minute. A screen to watch it on is one more thing to look
          // at and nothing to learn from.
          link.target !== "/pos/parcels"
      );
    }

    // An outlet with no parcel counter has no parcels screen either.
    if (!features.parcel_enabled) {
      navLinks = navLinks.filter((link) => link.target !== "/pos/parcels");
    }

    /**
     * A captain walks the floor with a tablet and no printer, so there is
     * nothing for them to set up.
     *
     * Everyone else keeps it — the owner especially. Settling a bill and
     * plugging in a printer are not the same right, and tying them together
     * hid this screen from the one person who actually sets a shop up.
     */
    if (role === "captain") {
      navLinks = navLinks.filter((link) => link.target !== "/pos/printer");
    }

    // Only whoever settles bills needs the queue of tables waiting to pay,
    // or the counter's parcels: both are the till's own work.
    if (!canBill(role)) {
      return navLinks.filter(
        (link) => link.target !== "/pos/bill-requests" && link.target !== "/pos/parcels"
      );
    }

    return navLinks;
  }, [user?.role?.name, billsWaiting, parcelsReady, features]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      const key = e.key.toLowerCase();

      const link = filteredNavLinks.find((l) => l.shortcutKey === key);
      if (link) {
        e.preventDefault();
        navigate(link.target);
        return;
      }

      if (key === "l") {
        e.preventDefault();
        setIsLogoutClicked(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, setIsLogoutClicked]);

  return (
    <div className="relative h-screen">
      {/* Sidebar */}
      {/* The band down the edge is the role's colour, so the till and the
          captain's tablet are told apart from across the room. */}
      <aside
        className={`pos-rail fixed border-[var(--theme-primary-darker)] shadow-xl transition-all duration-300
    ${
      isCompact
        ? "bottom-0 left-0 w-full pos-bottom-bar border-t flex items-center justify-around z-50"
        : `top-0 left-0 h-full border-r ease-out ${
            isOpen
              ? "w-48 translate-x-0"
              : "w-20 -translate-x-[calc(100%-80px)]"
          }`
    }
  `}
        style={
          isCompact
            ? { borderTop: `3px solid ${roleUi(user?.role?.name).accent}` }
            : { borderLeft: `3px solid ${roleUi(user?.role?.name).accent}` }
        }
      >
        <div className={`flex h-full ${isCompact ? "w-full min-w-0 flex-row items-center px-1" : "flex-col p-2"}`}>
          {/* Logo + Toggle (inside when open) */}
          {/**
           * The lockup, as drawn.
           *
           * The first version of the artwork set "Green" in deep emerald and
           * the rail is deep emerald, so half the name disappeared into the
           * background and the software looked as though it were called
           * Falk. The name was set in type here instead, as a stand-in.
           *
           * The wordmark is gold throughout now, which is the one colour in
           * this palette that carries on a dark ground, so the artwork goes
           * back to doing its own job. Collapsed, there is no room for a
           * word and the falcon stands alone.
           */}
          {!isCompact && (
            <div
              onClick={() => navigate("/pos/dashboard")}
              className="flex cursor-pointer items-center justify-center mb-7 mt-3 px-1"
              title="GreenFalk"
            >
              {/* Bounded by height, in pixels. Width alone lets the artwork
                  decide how tall it becomes — it is three to two — and a
                  figure in pixels cannot be resolved away by a parent that
                  turns out to have no height of its own. */}
              <img
                src={isOpen ? logo : favIcon}
                className={`object-contain transition-all duration-300 ${
                  isOpen ? "max-h-[72px] w-auto max-w-full" : "w-11"
                }`}
                alt="GreenFalk"
              />
            </div>
          )}

          {/* Navigation */}
          <nav
            className={`flex ${
              isCompact
                ? "w-full min-w-0 flex-row items-center justify-between gap-0.5"
                : "flex-col space-y-2 flex-1"
            }`}
          >
            {/* Keyed by where it goes rather than where it sits, so a list
                that loses an entry does not hand one button's state to the
                next. The shortcut letter travels as shortcutKey: called
                `key` it was swallowed by React as the element key, which
                both warned on every render and left the letter underlined
                on no button at all. */}
            {filteredNavLinks.map((link) => (
              <NavButtons
                key={link.target}
                {...link}
                isOpen={!isCompact && isOpen}
                isMobile={isCompact}
              />
            ))}

            {/* Who is signed in — on the phone bar there is only room for a pill */}
            {isCompact && (
              <button
                onClick={() => setAccountOpen(true)}
                title={t("nav.whoSignedIn")}
                aria-label={t("nav.account")}
                className="tap-target flex shrink-0 items-center justify-center pl-1 transition-transform active:scale-95"
              >
                <RoleBadge role={user?.role?.name} variant="compact" />
              </button>
            )}
          </nav>

          {/* Who is signed in */}
          {!isCompact && (
            <div className="mt-auto flex justify-center px-1 pb-2">
              <RoleBadge
                role={user?.role?.name}
                outletName={user?.outlet_name}
                variant={isOpen ? "full" : "collapsed"}
              />
            </div>
          )}

          {/* Logout */}
          {!isCompact && (
            <div className="mt-auto pt-2 border-t border-white/15">
              {isOpen && user && (
                <p className="text-xs text-center text-white/60 mb-3 font-medium">
                  {/* The role now has its own badge above, so this line names
                      the person on shift. */}
                  {user.first_name || user.username || ""}
                </p>
              )}

              {/* Pressed gold, the same metal as the pill above.
                  Dark letters on it: white on gold is the one pairing in
                  this palette that cannot be read at any size. */}
              <button
                onClick={() => setIsLogoutClicked(true)}
                className={`gf-metal-gold w-full flex items-center justify-center rounded-2xl group font-bold
                ${isOpen ? "px-4 py-3 gap-3" : "py-4 px-2"}`}
                title={t("nav.logout")}
              >
                <LogoutIcon />
                {isOpen && (
                  <span className="text-sm">
                    <ShortcutLabel text={t("nav.logout")} char="l" />
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* The account sheet: the sidebar's bottom half, for a bar that has no
          bottom half. It rises from the bar so the bar stays reachable. */}
      {isCompact && accountOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setAccountOpen(false)}
          />
          <div className="pos-sheet-on-bar fixed left-0 right-0 z-[61] rounded-t-2xl border-t border-border-default bg-surface p-4 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tracking-wide text-white"
                style={{ backgroundColor: roleUi(user?.role?.name).accent }}
              >
                {roleUi(user?.role?.name).short}
              </span>

              <div className="min-w-0">
                <p className="truncate text-base font-bold text-text-primary">
                  {user?.first_name || user?.username || t("nav.signedIn")}
                </p>
                <p
                  className="truncate text-xs font-semibold"
                  style={{ color: roleUi(user?.role?.name).accent }}
                >
                  {roleUi(user?.role?.name).label}
                  {user?.outlet_name ? " \u00b7 " + user.outlet_name : ""}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setAccountOpen(false);
                setIsLogoutClicked(true);
              }}
              className="tap-target flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 font-semibold text-red-600 transition-transform active:scale-[0.98]"
            >
              <LogoutIcon className="w-5 h-5 fill-red-600" />
              {t("nav.logout")}
            </button>

            <button
              onClick={() => setAccountOpen(false)}
              className="tap-target mt-2 w-full rounded-xl border border-border-default py-3 font-semibold text-text-secondary transition-transform active:scale-[0.98]"
            >
              {t("common.cancel")}
            </button>
          </div>
        </>
      )}

      {/* Floating Toggle Button – always visible, positioned at the edge */}
      {!isCompact && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          /* Pressed gold, the same as the pill marking where you are. It was
             a flat fill sitting next to a polished one, which is the pairing
             that makes the polished one look like an accident. */
          className={`gf-metal-gold fixed top-6 z-50 flex items-center justify-center w-9 h-9 rounded-full border border-[var(--theme-primary-darker)]/25 hover:scale-110 transition-transform duration-300
          ${isOpen ? "left-[172px]" : "left-[61px]"}`}
          title={isOpen ? t("nav.collapseMenu") : t("nav.expandMenu")}
        >
          {isOpen ? (
            <ChevronLeftIcon className="w-5.5 h-5.5" />
          ) : (
            <ChevronRightIcon className="w-5.5 h-5.5" />
          )}
        </button>
      )}
    </div>
  );
};

/* ────────────────────────────────────────────── Icons ────────────────────────────────────────────── */
const ChevronLeftIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2.5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2.5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const HomeIcon = () => (
  <svg
    className="w-5.5 h-5.5"
    fill="currentColor"
    viewBox="64 64 896 896"
    focusable="false"
    data-icon="home"
    aria-hidden="true"
  >
    <path d="M946.5 505L560.1 118.8l-25.9-25.9a31.5 31.5 0 00-44.4 0L77.5 505a63.9 63.9 0 00-18.8 46c.4 35.2 29.7 63.3 64.9 63.3h42.5V940h691.8V614.3h43.4c17.1 0 33.2-6.7 45.3-18.8a63.6 63.6 0 0018.7-45.3c0-17-6.7-33.1-18.8-45.2zM568 868H456V664h112v204zm217.9-325.7V868H632V640c0-22.1-17.9-40-40-40H432c-22.1 0-40 17.9-40 40v228H238.1V542.3h-96l370-369.7 23.1 23.1L882 542.3h-96.1z"></path>
  </svg>
);

// A box tied with string: what a parcel looks like on a counter.
// A till printer: paper coming out of the top, the body underneath.
const SettingsIcon = () => (
  <svg
    className="w-5.5 h-5.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    focusable="false"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
    />
  </svg>
);

const ParcelIcon = () => (
  <svg
    className="w-5.5 h-5.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    focusable="false"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 12 12l9-4.5M12 12v9" />
  </svg>
);
const CustomersIcon = () => (
  <svg
    className="w-5.5 h-5.5"
    fill="currentColor"
    viewBox="64 64 896 896"
    focusable="false"
    data-icon="team"
    aria-hidden="true"
  >
    <path d="M824.2 699.9a301.55 301.55 0 00-86.4-60.4C783.1 602.8 812 546.8 812 484c0-110.8-92.4-201.7-203.2-200-109.1 1.7-197 90.6-197 200 0 62.8 29 118.8 74.2 155.5a300.95 300.95 0 00-86.4 60.4C345 754.6 314 826.8 312 903.8a8 8 0 008 8.2h56c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5A226.62 226.62 0 01612 684c60.9 0 118.2 23.7 161.3 66.8C814.5 792 838 846.3 840 904.3c.1 4.3 3.7 7.7 8 7.7h56a8 8 0 008-8.2c-2-77-33-149.2-87.8-203.9zM612 612c-34.2 0-66.4-13.3-90.5-37.5a126.86 126.86 0 01-37.5-91.8c.3-32.8 13.4-64.5 36.3-88 24-24.6 56.1-38.3 90.4-38.7 33.9-.3 66.8 12.9 91 36.6 24.8 24.3 38.4 56.8 38.4 91.4 0 34.2-13.3 66.3-37.5 90.5A127.3 127.3 0 01612 612zM361.5 510.4c-.9-8.7-1.4-17.5-1.4-26.4 0-15.9 1.5-31.4 4.3-46.5.7-3.6-1.2-7.3-4.5-8.8-13.6-6.1-26.1-14.5-36.9-25.1a127.54 127.54 0 01-38.7-95.4c.9-32.1 13.8-62.6 36.3-85.6 24.7-25.3 57.9-39.1 93.2-38.7 31.9.3 62.7 12.6 86 34.4 7.9 7.4 14.7 15.6 20.4 24.4 2 3.1 5.9 4.4 9.3 3.2 17.6-6.1 36.2-10.4 55.3-12.4 5.6-.6 8.8-6.6 6.3-11.6-32.5-64.3-98.9-108.7-175.7-109.9-110.9-1.7-203.3 89.2-203.3 199.9 0 62.8 28.9 118.8 74.2 155.5-31.8 14.7-61.1 35-86.5 60.4-54.8 54.7-85.8 126.9-87.8 204a8 8 0 008 8.2h56.1c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5 29.4-29.4 65.4-49.8 104.7-59.7 3.9-1 6.5-4.7 6-8.7z"></path>
  </svg>
);

const TablesIcon = () => (
  <svg
    className="w-5.5 h-5.5"
    fill="currentColor"
    version="1.1"
    id="Capa_1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 214.539 214.539"
  >
    <g>
      <g>
        <path d="M121.164,154.578h-6.625V89.14h38.937c4.014,0,7.269-3.254,7.269-7.269s-3.254-7.269-7.269-7.269h-92.41 c-4.014,0-7.269,3.254-7.269,7.269s3.254,7.269,7.269,7.269h38.936v65.438h-6.625c-4.014,0-7.269,3.254-7.269,7.27 c0,4.015,3.254,7.269,7.269,7.269h27.787c4.015,0,7.27-3.254,7.27-7.269C128.433,157.832,125.179,154.578,121.164,154.578z"></path>
        <path d="M73.783,120.777c0-4.014-3.254-7.269-7.269-7.269H54.833H34.219c-11.08,0-13.41-16.14-13.509-16.869l-6.239-45.122 c-0.55-3.977-4.217-6.748-8.196-6.205c-3.976,0.55-6.754,4.219-6.205,8.196l6.229,45.053c0.831,6.47,4.167,16.593,11.367,23.133 l-7.485,38.956c-0.758,3.942,1.824,7.752,5.766,8.509c3.946,0.761,7.752-1.825,8.509-5.766l6.792-35.349h17.579l6.792,35.349 c0.668,3.479,3.714,5.897,7.13,5.897c0.455,0,0.916-0.043,1.379-0.132c3.942-0.757,6.524-4.566,5.766-8.509l-6.265-32.605h2.883 C70.527,128.046,73.783,124.791,73.783,120.777z"></path>
        <path d="M208.267,45.313c-3.975-0.543-7.646,2.229-8.196,6.205l-6.244,45.165c-0.094,0.687-2.424,16.827-13.504,16.827h-20.614 h-11.681c-4.014,0-7.27,3.254-7.27,7.269s3.255,7.269,7.27,7.269h2.883l-6.265,32.605c-0.758,3.942,1.824,7.752,5.766,8.509 c3.946,0.761,7.752-1.825,8.509-5.766l6.792-35.349h17.579l6.792,35.349c0.668,3.479,3.714,5.897,7.13,5.897 c0.455,0,0.916-0.043,1.38-0.132c3.941-0.757,6.523-4.566,5.766-8.509l-7.485-38.953c7.198-6.534,10.532-16.64,11.357-23.065 l6.238-45.123C215.021,49.533,212.242,45.863,208.267,45.313z"></path>
      </g>
    </g>
  </svg>
);

/** A bill waiting to be settled — a document with a tick. */
const BillRequestIcon = () => (
  <svg
    className="w-5.5 h-5.5"
    stroke="currentColor"
    fill="none"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 14l2 2 4-4M16 20H8a2 2 0 01-2-2V6a2 2 0 012-2h5l5 5v9a2 2 0 01-2 2z"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const InvoicesIcon = () => (
  <svg
    className="w-5.5 h-5.5"
    stroke="currentColor"
    fill="none"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 9H18M6 13H18M6 17H12"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    ></path>
    <path
      d="M4 4H20V20H4V4Z"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    ></path>
  </svg>
);

const PromotionsIcon = () => (
  <svg
    className="w-5.5 h-5.5"
    stroke="currentColor"
    fill="none"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    ></path>
    <path d="M16 5L19 3" strokeWidth={2} strokeLinecap="round"></path>
    <path d="M8 5L5 3" strokeWidth={2} strokeLinecap="round"></path>
  </svg>
);

const LowStockIcon = () => (
  <svg
    className="w-5.5 h-5.5"
    fill="currentColor"
    viewBox="64 64 896 896"
    focusable="false"
    data-icon="shopping"
    aria-hidden="true"
  >
    <path d="M832 312H696v-16c0-101.6-82.4-184-184-184s-184 82.4-184 184v16H192c-17.7 0-32 14.3-32 32v536c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V344c0-17.7-14.3-32-32-32zm-432-16c0-61.9 50.1-112 112-112s112 50.1 112 112v16H400v-16zm392 544H232V384h96v88c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8v-88h224v88c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8v-88h96v456z"></path>
  </svg>
);

const LogoutIcon = ({ className = "w-5.5 h-5.5 fill-gray-700 transition-colors" }) => (
  <svg
    className={className}
    viewBox="64 64 896 896"
    focusable="false"
    data-icon="logout"
    aria-hidden="true"
  >
    <path d="M868 732h-70.3c-4.8 0-9.3 2.1-12.3 5.8-7 8.5-14.5 16.7-22.4 24.5a353.84 353.84 0 01-112.7 75.9A352.8 352.8 0 01512.4 866c-47.9 0-94.3-9.4-137.9-27.8a353.84 353.84 0 01-112.7-75.9 353.28 353.28 0 01-76-112.5C167.3 606.2 158 559.9 158 512s9.4-94.2 27.8-137.8c17.8-42.1 43.4-80 76-112.5s70.5-58.1 112.7-75.9c43.6-18.4 90-27.8 137.9-27.8 47.9 0 94.3 9.3 137.9 27.8 42.2 17.8 80.1 43.4 112.7 75.9 7.9 7.9 15.3 16.1 22.4 24.5 3 3.7 7.6 5.8 12.3 5.8H868c6.3 0 10.2-7 6.7-12.3C798 160.5 663.8 81.6 511.3 82 271.7 82.6 79.6 277.1 82 516.4 84.4 751.9 276.2 942 512.4 942c152.1 0 285.7-78.8 362.3-197.7 3.4-5.3-.4-12.3-6.7-12.3zm88.9-226.3L815 393.7c-5.3-4.2-13-.4-13 6.3v76H488c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h314v76c0 6.7 7.8 10.5 13 6.3l141.9-112a8 8 0 000-12.6z"></path>
  </svg>
);

export default SideHeader;
