import React, { useState, useEffect, useRef, useMemo } from "react";
import { useT } from "../../i18n";
import InvoiceList from "../../components/pos/invoice/InvoiceList";
import InvoiceForm from "../../components/pos/invoice/InvoiceForm";
import HoldInvoiceList from "../../components/pos/invoice/HoldInvoiceList";
import HoldInvoiceFrom from "../../components/pos/invoice/HoldInvoiceForm";
import ChefHoldInvoiceForm from "../../components/pos/invoice/ChefHoldInvoiceForm";
import KitchenBoard from "../../components/pos/kitchen/KitchenBoard";
import { useOrderStore } from "../../store/useOrderStore";
import { refundOrderAPI } from "../../api/refundApi";
import { useHoldOrderStore } from "../../store/useHoldOrderStore";
import { useCartStore } from "../../store/useCartStore";
import { usePaymentMethodStore } from "../../store/usePaymentMethodStore";
import { useAuthStore } from "../../store/useAuthStore";
import LoadingBar from "../../components/common/LoadingBar/LoadingBar";
import { useResponsive } from "../../context/ResponsiveContext";
import { useSocket } from "../../socket/SocketProvider";
import { useFeatures } from "../../hooks/useFeatures";
/**
 * The invoice screens.
 *
 * `only` pins the page to a single tab and hides the strip, which is how Bill
 * Requests gets its own entry in the sidebar rather than being buried behind
 * four tabs the cashier has to hunt through mid-queue.
 */
const Invoices = ({ only = null }) => {
  const t = useT();

  const features = useFeatures();
  const seatsPeople = features.table_service_enabled;

  // A counter holds nothing: every sale is paid as it is rung up. So the
  // screen opens on what it does have — the bills taken today.
  const [activeBtn, setActiveBtn] = useState(
    only || (seatsPeople ? "holdInvoiceBTN" : "invoiceBTN")
  );
  const { setCartFromHold } = useCartStore();
  const [isLoading, setIsLoading] = useState(false);
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const [showForm, setShowForm] = useState(false);
  const holdOrders = useHoldOrderStore(state => state.holdOrders);
  const fetchHoldOrders = useHoldOrderStore(state => state.fetchHoldOrders);
  const fetchChefHoldOrders = useHoldOrderStore(state => state.fetchChefHoldOrders);
  // Only the warm-up is wanted here: the list itself was read by the credit
  // tab, which is gone. The payment screen loads it for itself when needed.
  const { ensureLoaded: hydratePaymentMethods } = usePaymentMethodStore();
  const user = useAuthStore((state) => state.user);
  const orders = useOrderStore(state => state.orders);
  const fetchOrders = useOrderStore(state => state.fetchOrders);
  const setOrders = useOrderStore(state => state.setOrders);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const socket = useSocket();

  // 🔹 Step 1: Hydrate payment methods once on mount
  useEffect(() => {
    hydratePaymentMethods();
  }, []);

  // Initial load, straight from the server.
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        // Together, not one after the other.
        //
        // Waiting for the past invoices before asking for the open bills
        // cost this screen two waits end to end — and by the time the second
        // went out, the side bar had already asked for the very same list and
        // been answered, so the till fetched it twice. Asked at the same
        // moment they share one request and one wait.
        await Promise.all([
          fetchOrders(),
          user?.outlet_id
            ? user?.role?.name === "chef"
              ? fetchChefHoldOrders(user.outlet_id)
              : fetchHoldOrders(user.outlet_id)
            : Promise.resolve(),
        ]);
      } catch (err) {
        console.error("Failed to load invoices on mount:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [fetchOrders, fetchHoldOrders, fetchChefHoldOrders, user?.outlet_id, user?.role?.name]);


  useEffect(() => {
  if (!socket) return;

  const handleHoldOrderUpdate = async (data) => {

    // Optional filter
    if (data?.outlet_id !== user?.outlet_id) return;

    try {
      setIsLoading(true);

      if (user?.role?.name === "chef") {
        await fetchChefHoldOrders(user.outlet_id);
      }

      if (user?.role?.name === "cashier" || user?.role?.name === "captain") {
        await fetchHoldOrders(user.outlet_id);
      }

    } catch (err) {
      console.error("Hold order refresh failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  socket.on("holdOrderUpdated", handleHoldOrderUpdate);

  return () => {
    socket.off("holdOrderUpdated", handleHoldOrderUpdate);
  };
  // The handler reads the outlet off the user, so it has to be rebound when
  // that changes — a till that switched outlet was still filtering events
  // against the outlet it had left.
}, [socket, user?.role?.name, user?.outlet_id, fetchChefHoldOrders, fetchHoldOrders]);

  // useEffect(() => {
  //   if (orders.length && !selectedOrderId) {
  //     setSelectedOrderId(orders[0].localId);
  //   }
  // }, [orders]);
  // const uiOrders = orders.map(order => ({
  //   id: order.localId,
  //   orderId: order.serverOrderId || order.localId,
  //   customerId: order.customerId,
  //   tableId: order.tableId,
  //   amount: order.totals?.total || 0,
  //   subtotal: order.totals?.subtotal || 0,
  //   paymentMethod: order.paymentMethods?.[0]?.method || "N/A",
  //   orderItems: order.cartData || [],
  //   status: order.isSynced ? "SYNCED" : "OFFLINE",
  //   createdAt: order.createdAt,
  // }));
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedHoldOrder, setSelectedHoldOrder] = useState(null);

  // Newest ticket first, for every role. This used to be an async comparator
  // with no return: it always resolved to a Promise (truthy), so the order was
  // arbitrary and the auto-selected ticket was whichever landed first.
  const sortedHoldOrders = [...holdOrders].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Tables the captain has handed over: they have finished eating and the
  // guest is on their way to the counter. Longest wait first, because that is
  // the person standing there.
  const billRequestedOrders = sortedHoldOrders
    .filter((o) => o?.billRequestedAt)
    .sort((a, b) => new Date(a.billRequestedAt) - new Date(b.billRequestedAt));

  // ── New-ticket alert (kitchen only) ───────────────────────────────────
  // A chef is not watching the screen; a ticket that arrives silently gets
  // missed. Chime once when a ticket id turns up that was not in the previous
  // list. The very first load is not an arrival, so it seeds quietly.
  const isKitchen = user?.role?.name === "chef";
  const seenTicketIds = useRef(null);
  const [kitchenMuted, setKitchenMuted] = useState(false);

  useEffect(() => {
    if (!isKitchen) return;

    const ids = new Set(sortedHoldOrders.map(o => o.localId));

    if (seenTicketIds.current === null) {
      seenTicketIds.current = ids;   // first paint — nothing has "arrived" yet
      return;
    }

    const arrived = [...ids].some(id => !seenTicketIds.current.has(id));
    seenTicketIds.current = ids;
    if (!arrived) return;

    if (!kitchenMuted) {
      try {
        const chime = new Audio("/sounds/beep.wav");
        chime.volume = 0.6;
        // Browsers block audio until the page has been interacted with.
        // Failing silently is fine — the waiting timers still show the ticket.
        chime.play().catch(() => {});
      } catch {
        // No audio available on this device.
      }
    }

  }, [sortedHoldOrders, isKitchen, kitchenMuted]);


  const orderKey = (o) => o?.localId || o?.orderId || o?.serverOrderId;
  // const selectedOrderData = selectedOrder ? orders.find(o => orderKey(o) === orderKey(selectedOrder)) || null : null;
  const selectedOrderData = selectedOrder
    ? orders.find(o => orderKey(o) === orderKey(selectedOrder))
    : null;

  // The bill-request tab is the same list of held bills, just narrowed, so it
  // uses the held-bill layout too.
  const isHoldInvoice =
    activeBtn === "holdInvoiceBTN" || activeBtn === "billRequestBTN";
  const isChef = user?.role?.name === "chef";
  const isCaptain = user?.role?.name === "captain";

  const getBtnClass = (btnKey) => {
    let responsiveStyle = "";

    if (isMobile) {
      responsiveStyle = "text-[12px] sm:text-[12px] px-0.5 py-1";
    } else if (isTablet) {
      responsiveStyle = "text-[11px] lg:text-xs px-1 lg:px-2 py-1.5";
    } else {
      responsiveStyle = "text-sm px-3 py-2";
    }

    /**
     * Which list is showing.
     *
     * The chosen tab was a gradient running from gold into green, which is
     * two metals welded together: on screen it came out a flat olive that
     * belongs to neither half of the brand. The same mistake was on the
     * table button, and it is the one this palette invites — gold and green
     * are both brand colours, so blending them looks like a decision.
     *
     * It is the polished emerald now, the same as every other "you are
     * here" on the till.
     */
    return `w-full ${responsiveStyle} h-[44px] flex items-center justify-center text-center rounded-xl border transition-all duration-300 font-bold whitespace-nowrap overflow-hidden
   ${activeBtn === btnKey
        ? "gf-metal-green border-transparent"
        : "pos-key text-text-secondary hover:text-[var(--theme-primary)] focus:outline-none"
      }`;
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [holdSearchTerm, setHoldSearchTerm] = useState("");

  const currentOrders =
    activeBtn === "holdInvoiceBTN" ? sortedHoldOrders :
      activeBtn === "billRequestBTN" ? billRequestedOrders :
          orders;


  const filteredOrders = currentOrders.filter((order) => {
    if (!order) return false;

    // --- 1. DATE FILTERING LOGIC ---
    const orderDate = new Date(order.createdAt || order.orderDate);
    const now = new Date();

    if (activeBtn === "invoiceBTN") {
      // Today, asked at the moment of asking. It used to be a date fixed when
      // the screen first loaded and never set again, so a till left running
      // over midnight still called yesterday "today".
      const startOfDay = new Date(now).setHours(0, 0, 0, 0);
      const endOfDay = new Date(now).setHours(23, 59, 59, 999);

      if (orderDate < startOfDay || orderDate > endOfDay) return false;
    }

    // --- 2. SEARCH FILTERING LOGIC ---
    const search = searchTerm.trim().toLowerCase();
    const holdSearch = holdSearchTerm.trim().toLowerCase();

    if (isHoldInvoice) {
      const firstName = order?.cartData?.customer?.firstName;
      const phoneNumber = order?.cartData?.customer?.phoneNumber;
      const note = order?.note;

      if (holdSearch === "") return true;

      return (
        (firstName && String(firstName).toLowerCase().includes(holdSearch)) ||
        (phoneNumber && String(phoneNumber).includes(holdSearch)) ||
        (note && String(note).toLowerCase().includes(holdSearch))
      );
    } else {
      if (search === "") return true;
      const customerName = order?.customerName;
      const customerPhone = order?.customerPhone;
      const userId = order?.userId;
      const displayId = order?.display_id || order.displayId;

      return (
        (customerName && String(customerName).toLowerCase().includes(search)) ||
        (customerPhone && String(customerPhone).includes(search)) ||
        (userId && String(userId).toLowerCase().includes(search)) ||
        (displayId && String(displayId).toLowerCase().includes(search))
      );
    }
  });

  // Whatever list this tab is showing decides what is selected. Held bills are
  // newest first, Bill Requests is longest-wait first — the person actually
  // standing at the counter — so each tab opens on its own first row rather
  // than on something that is not in the list at all.
  //
  // Keyed on the ids rather than the array: the array is rebuilt on every
  // render, and depending on it directly would re-run this forever.
  const shownHoldKeys = isHoldInvoice
    ? filteredOrders.map((o) => o?.localId).join(",")
    : "";

  useEffect(() => {
    if (!isHoldInvoice) return;

    if (!filteredOrders.length) {
      setSelectedHoldOrder(null);
      return;
    }

    const stillOnScreen =
      selectedHoldOrder &&
      filteredOrders.some((o) => o?.localId === selectedHoldOrder.localId);

    if (!stillOnScreen) setSelectedHoldOrder(filteredOrders[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownHoldKeys, isHoldInvoice]);
  // const handleRefundAction = (refundData, refundValue, totalRefundSubtotal) => {
  //   setOrders(prevOrders => prevOrders.map(order => {
  //     if (order.orderId === refundData.orderId) {
  //       return {
  //         ...order,
  //         // Update the amount field
  //         totalAmountRefunded: (Number(order.totalAmountRefunded) || 0) + refundValue,
  //         // Add the history field
  //         refundHistory: [...(order.refundHistory || []), refundData],
  //         subtotal: (Number(order.subtotal) || 0) - totalRefundSubtotal
  //       };
  //     }
  //     return order;
  //   }));
  // };

  const handleRefundAction = async (
    refundData,
    refundValue,
    totalRefundSubtotal
  ) => {
    if (!refundData?.order_id) {
      throw new Error("Missing order_id for refund");
    }
    setIsLoading(true);
    try {
      // 1️⃣ Call backend refund API
      await refundOrderAPI(refundData);

      // 2. Re-read the affected orders from the server.
      await fetchOrders();
    } catch (error) {
      // Let RefundPopup handle the error message.
      throw error;
    } finally {
      setIsLoading(false);
    }
  }


  useEffect(() => {
    if (user?.role?.name === "chef") {
      setActiveBtn("holdInvoiceBTN");
    }
  }, [user]);

  useEffect(() => {
  if (!selectedHoldOrder) return;

  const updated = holdOrders.find(
    (o) => orderKey(o) === orderKey(selectedHoldOrder)
  );

  if (updated) {
    setSelectedHoldOrder(updated);
  } else {
    setSelectedHoldOrder(null);
  }
}, [holdOrders]);

  return (
    <div className="flex w-full h-full  overflow-hidden bg-background">
      <LoadingBar isLoading={isLoading} />

      {/* Main Content Area */}
      <div className={`flex flex-col flex-grow min-w-0 transition-all duration-300 ${!isMobile && (selectedOrderData || selectedHoldOrder) ? 'lg:mr-0' : ''}`}>
        {/* Navigation Header */}
        <div
          className={`bg-surface border-b border-border-default px-1 sm:px-2 py-3 sticky top-0 shadow-sm w-full z-10 ${
            isChef ? "hidden" : ""
          }`}
        >
          {/* Pinned to one tab (Bill Requests from the sidebar), so there is
              nothing to switch between. */}
          <div
            className={`grid gap-2 w-full ${
              only || !seatsPeople ? "hidden" : isChef || isCaptain ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {[
              {
                id: "holdInvoiceBTN",
                label: isChef ? t("invoice.kitchenOrders") : t("invoice.onHold"),
                shortLabel: isChef ? "Kitchen" : "Hold",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              },
              {
                // Tables the captain has finished with. The guest walks up and
                // says "table 3" — the cashier picks it straight off this tab.
                id: "billRequestBTN",
                label: t("nav.billRequests"),
                shortLabel: "Bills",
                count: billRequestedOrders.length,
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4m1 8H8a2 2 0 01-2-2V6a2 2 0 012-2h5l5 5v9a2 2 0 01-2 2z" />
                  </svg>
                )
              },
              {
                id: "invoiceBTN",
                label: t("invoice.todays"),
                shortLabel: "Today",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )
              },
            ]
            .filter((btn) => {
              // The kitchen and the floor only ever work the running orders —
              // past invoices are the till's business, and showing them was a
              // row of tabs of noise on a captain's tablet.
              if (isChef || isCaptain) return btn.id === "holdInvoiceBTN";

              // Nothing is ever held at a counter — the money is taken as the
              // order is rung up — so that tab could only ever be empty.
              if (!seatsPeople) return btn.id === "invoiceBTN";

              // Bill Requests has its own place in the sidebar now, so it is
              // not repeated here.
              return btn.id !== "billRequestBTN";
            })
            .map((btn) => (
              <button
                key={btn.id}
                className={getBtnClass(btn.id)}
                onClick={() => setActiveBtn(btn.id)}
                title={btn.label}
              >
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 px-0.5">
                  <span className="shrink-0">{btn.icon}</span>
                  <span className="truncate">
                    {isMobile || isTablet ? btn.shortLabel : btn.label}
                  </span>
                  {/* How many guests are waiting at the counter right now. */}
                  {btn.count > 0 && (
                    <span
                      className={`shrink-0 text-[10px] font-bold rounded-full px-1.5 py-[1px] ${
                        activeBtn === btn.id
                          ? "bg-white/25 text-text-inverted"
                          : "gf-metal-gold"
                      }`}
                    >
                      {btn.count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-grow overflow-hidden flex flex-col min-h-0">
          {/* Bill requests are held bills too, so they use the held-bill list —
              the past-invoice list cannot read them and showed NaN. */}
          {isHoldInvoice ? (
            isChef && !features.kds_enabled ? (
              /**
               * The screen was taken away while this chef was standing at it.
               *
               * A kitchen account cannot sign in at an outlet with no display
               * — that is refused at the door. But the platform can turn the
               * display off in the middle of a shift, and whoever was already
               * signed in went on reading a board the shop no longer runs on.
               * The rounds are going to the printer now, and the ticks made
               * here would be ticks nobody asked for.
               */
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="max-w-sm text-center">
                  <p className="text-base font-bold text-text-secondary">
                    {t("invoice.printedTickets")}
                  </p>
                  <p className="mt-2 text-sm text-text-muted">
                    {t("invoice.printedTicketsHint")}
                  </p>
                </div>
              </div>
            ) : isChef ? (
              /* One card per round, with its own buttons. The kitchen used to
                 pick a ticket from a list and act on it in a side panel, which
                 meant two taps and half the screen for one order; a chef needs
                 every waiting ticket in front of them at once. */
              <KitchenBoard
                orders={filteredOrders}
                searchTerm={holdSearchTerm}
                setSearchTerm={setHoldSearchTerm}
                muted={kitchenMuted}
                onToggleMute={() => setKitchenMuted((m) => !m)}
              />
            ) : (
              <HoldInvoiceList
                searchTerm={holdSearchTerm}
                setSearchTerm={setHoldSearchTerm}
                orders={filteredOrders}
                selectedHoldOrder={selectedHoldOrder}
                setSelectedHoldOrder={setSelectedHoldOrder}
                role={user?.role?.name}
              />
            )
          ) : (
            <InvoiceList
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              orders={filteredOrders}
              selectedOrder={selectedOrder}
              setSelectedOrder={setSelectedOrder}
            />
          )}
        </div>
      </div>

      {/* Desktop/Tablet Sidebar — the kitchen board needs no companion panel. */}
      {!isMobile && !isChef && (
        <div className="hidden md:block w-[380px] lg:w-[420px] xl:w-[450px] h-full bg-surface border-l border-border-default shadow-[-4px_0_15px_var(--overlay-black-2)] overflow-hidden flex-shrink-0">
          <div className="h-full overflow-y-auto custom-scrollbar">
            {!isHoldInvoice ? (
              <InvoiceForm
                selectedOrder={selectedOrderData}
                onRefund={handleRefundAction}
              />
            ) : isChef ? (
              <ChefHoldInvoiceForm selectedHoldOrder={selectedHoldOrder} />
            ) : (
              <HoldInvoiceFrom
                selectedHoldOrder={selectedHoldOrder}
                onAddToCart={(cartData) => {
                  setCartFromHold(cartData);
                }}
                onDelete={() => { setSelectedHoldOrder(null); }}
                role={user?.role?.name}
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile: Floating Details Toggle Button */}
      {isMobile && !isChef && (selectedOrder || (isHoldInvoice && selectedHoldOrder)) && (
        <div className="fixed pos-above-bar left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => setShowForm(true)}
            className="group relative flex items-center gap-3 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-2xl border border-white/20 backdrop-blur-xl active:scale-[0.98] transition-all duration-300 ease-out hover:shadow-[0_20px_40px_var(--secondary-alpha-50)] hover:border-white/30 min-w-[180px] whitespace-nowrap bg-gradient-to-br from-primary via-[var(--theme-secondary)] to-secondary before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 animate-pulse-slow"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/50 to-secondary/50 blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>

            {/* Icon with animation */}
            <div className="relative flex items-center justify-center">
              <span className="text-xl relative z-10 transition-transform duration-300 group-hover:scale-110">📋</span>
            </div>

            <span className="relative z-10 tracking-wide">
              {isHoldInvoice ? t("invoice.viewHold") : t("invoice.viewInvoice")}
            </span>

            {/* Shimmer effect */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
            </div>
          </button>
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      {isMobile && showForm && (
        <div className="pos-sheet-on-bar fixed inset-0 z-[60] flex flex-col justify-end">
          {/* pos-sheet-on-bar, not a number: the bar knows how tall it is, and
              a hard 13.5 here was the height it used to be. When the bar grew
              to keep clear of the phone's gesture line, this drawer stayed
              where it was and sat across the icons, cutting them in half. */}
          {/* Dark overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative bg-surface rounded-t-xl h-[97%] sm:h-[90%] flex flex-col animate-slide-up">
            {/* Header */}
            <div className="px-4 py-4 border-b border-primary/10 flex justify-between items-center text-primary">
              <h2 className="font-bold text-xl">
                {isHoldInvoice
                  ? isChef
                    ? t("invoice.kitchenDetails")
                    : t("invoice.holdDetails")
                  : t("invoice.details")}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors font-bold cursor-pointer"
                aria-label={t("common.close")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto w-full max-h-full">
              {!isHoldInvoice ? (
                <InvoiceForm
                  selectedOrder={selectedOrderData}
                  onRefund={handleRefundAction}
                />
              ) : isChef ? (
                <ChefHoldInvoiceForm selectedHoldOrder={selectedHoldOrder} />
              ) : (
                <HoldInvoiceFrom
                  selectedHoldOrder={selectedHoldOrder}
                  onAddToCart={(cartData) => {
                    setCartFromHold(cartData);
                    setShowForm(false);
                  }}
                  onDelete={() => {
                    setSelectedHoldOrder(null);
                    setShowForm(false);
                  }}
                  role={user?.role?.name}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
