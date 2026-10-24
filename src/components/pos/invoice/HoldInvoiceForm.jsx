import { taxLabel } from "../../../utils/gst";
import { useT } from "../../../i18n";
import { tableLabel, waitingLabel } from "../../../utils/kitchen";
import { canBill, canPrintHold, canVoidHold } from "../../../utils/roleUi";
import { useFeatures } from "../../../hooks/useFeatures";
import { cur } from "../../../utils/currency";
import defaultImg from "./../../../assets/images/Default_Product_Img.png";
import { useHoldOrderStore } from "../../../store/useHoldOrderStore";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import PrintOrder from "../dashboard/PrintOrder";
import { useCartStore } from "../../../store/useCartStore";

const HoldInvoiceFrom = ({
  selectedHoldOrder,
  onAddToCart,
  onDelete,
  role,
}) => {
  const t = useT();

  const navigate = useNavigate();
  const { setActiveHoldOrder } = useCartStore();
  const [isPrinting, setIsPrinting] = useState(false);
  const [qtyMap, setQtyMap] = useState({});
  // Above the early return below, with the rest of them: React counts the
  // hooks on every pass and a screen that renders both ways would go blank.
  // Held as the order's own name rather than a yes or no, so that moving to
  // another table drops the question instead of carrying it across.
  const [confirmDeleteFor, setConfirmDeleteFor] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // const tax = selectedHoldOrder.orderItems.reduce((acc, item) => {
  //   const itemTax = item.taxPercentagePerProduct
  //     ? (item.itemSubtotal * item.taxPercentagePerProduct) / 100
  //     : 0;
  //   return acc + itemTax;
  // }, 0);
  const handlePrint = async () => {
    // The button is not shown to the floor; this is the same answer for any
    // other way of reaching here.
    if (!canPrintHold(role)) return;
    if (isPrinting) return;
    setIsPrinting(true);
  };

  const removeHoldOrder = useHoldOrderStore((state) => state.removeHoldOrder);
  const updateHoldOrderStatus = useHoldOrderStore(
    (state) => state.updateHoldOrderStatus,
  );

  /**
   * Above the early return, because a hook that sits below one is a hook
   * that runs on some renders and not others.
   *
   * With nothing selected this component returns early, so React counted a
   * different number of hooks each time the cashier picked a bill — and
   * refused to render at all. The Bill Requests screen went blank in
   * production with nothing on it but a minified error number.
   */
  const features = useFeatures();

  if (!selectedHoldOrder) {
    return (
      <div className="flex h-full text-[var(--theme-primary)] p-6 text-sm font-bold items-center justify-center">
        {t("invoice.selectHold")}
      </div>
    );
  }

  // const discountValue = selectedHoldOrder?.cartData?.discount?.value === "FIXED" ?
  //   selectedHoldOrder.cartData.discount.value :
  //   (parseFloat(selectedHoldOrder?.cartData?.subtotal)?.toFixed(2) * (parseFloat(selectedHoldOrder.cartData.discount.value)?.toFixed(2) / 100) || 0.00);
  const discountValue =
    parseFloat(selectedHoldOrder?.cartData?.subtotal)?.toFixed(2) *
      (parseFloat(selectedHoldOrder.cartData.discount.value)?.toFixed(2) /
        100) || 0.0;
  const orderItems = selectedHoldOrder?.cartData?.orderItems || [];

  // The server returns the rounds of a bill under `kots`. A parcel, or a bill
  // that has only been ordered once, has just the one.
  const rounds = selectedHoldOrder?.kots || [];
  const isItemCompleted = (item) => {
    const status = String(item?.status || "").toLowerCase();
    const quantity = Number(item?.quantity || 0);
    const preparedQuantity = Number(item?.prepared_quantity || 0);

    return status === "completed" || (quantity > 0 && preparedQuantity >= quantity);
  };
  const allItemsCompleted =
    orderItems.length > 0 && orderItems.every((item) => isItemCompleted(item));

  /**
   * Normally the till waits for the kitchen to tick every item off before it
   * will take money, so food that never reached the table cannot be charged
   * for.
   *
   * Two things end that wait early.
   *
   * A bill the captain has asked for: they have stood at the table and seen
   * the guests finish, which is a firmer signal than the tick marks a busy
   * kitchen often never gets round to — and the guest is already at the
   * counter, so refusing to bill them strands the cashier.
   *
   * And an outlet with no kitchen display, where the wait never begins at
   * all: the ticks only exist on that screen, so without one this table
   * could never be billed. Its cook works from the printed ticket, and the
   * plate arriving is the only signal there is.
   */
  const billRequested = Boolean(selectedHoldOrder?.billRequestedAt);
  const readyToSettle = !features.kds_enabled || allItemsCompleted || billRequested;

  const handleAddToCart = async () => {
    // 1️⃣ Restore cart
    onAddToCart(selectedHoldOrder.cartData);

    // 2️⃣ Remove hold order (IndexedDB + backend)
    // await resumeHoldOrder(selectedHoldOrder);
    // navigate("/pos");
    setActiveHoldOrder(selectedHoldOrder);
    navigate("/pos/dashboard");
  };

  const handleProceedToPay = () => {
    onAddToCart(selectedHoldOrder.cartData);
    setActiveHoldOrder(selectedHoldOrder);
    navigate("/pos/dashboard", { state: { payToProceed: true } });
  };

  /**
   * What this screen offers depends on who is holding it.
   *
   * Resume is the floor's whole job — open the table's running order and add
   * to it. Delete throws the order away, kitchen ticket and all; Print puts a
   * bill slip in someone's hand. Both of those answer to the till, and on a
   * captain's tablet they sat one thumb away from Resume with nothing between
   * them.
   */
  const mayVoid = canVoidHold(role);
  const mayPrint = canPrintHold(role);
  // Tailwind is read at build time, so the count cannot be spliced into the
  // class name — a gap where a button used to be is the whole complaint.
  const actionColumns =
    ["", "grid-cols-1", "grid-cols-2", "grid-cols-3"][
      1 + (mayVoid ? 1 : 0) + (mayPrint ? 1 : 0)
    ];

  /**
   * Delete asks first.
   *
   * It wipes a table that may already have food on the pass, it cannot be
   * undone, and it used to go on the first tap — in a room where the screen
   * is held in one hand and a tray in the other.
   */
  const holdKey = selectedHoldOrder?.serverId || selectedHoldOrder?.localId;
  const confirmingDelete = Boolean(holdKey) && confirmDeleteFor === holdKey;

  const handleDelete = async () => {
    if (!mayVoid || deleting) return;

    if (!confirmingDelete) {
      setConfirmDeleteFor(holdKey);
      return;
    }

    setDeleting(true);
    try {
      await removeHoldOrder(selectedHoldOrder);
      onDelete();
    } finally {
      setDeleting(false);
      setConfirmDeleteFor(null);
    }
  };

  return (
    <div className="pt-2 px-4 pb-2 flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 px-2 flex-wrap">
        {/* What this bill is. Once the captain has asked for the bill the
            chip beside this says more, so only one of the two is ever shown. */}
        {/* Gold with dark letters, the way every gold chip in the till reads.
            White on gold is the one pairing in this palette that does not
            carry. */}
        {!billRequested && role !== "chef" && (
          <div className="bg-[var(--theme-secondary)] text-[var(--theme-primary-darker)] font-bold text-[12px] py-1 px-3 rounded-full shadow-[0_3px_12px_var(--secondary-alpha-30)] tracking-[0.04em] uppercase">
            {t("invoice.holdOrder")}
          </div>
        )}

        {/* Tells the cashier the captain has already closed this table off. */}
        {billRequested && role !== "chef" && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/30 text-success font-bold text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {t("invoice.billRequested")}
          </div>
        )}

        {/* Table number */}
        {selectedHoldOrder?.cartData?.table?.tableNumber && (
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--primary-alpha-5)] border border-[var(--primary-alpha-12)] text-[var(--theme-primary)] font-bold ${
              role === "chef" ? "text-base" : "text-[12px]"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 10h18M3 14h18M10 3v18M14 3v18"
              />
            </svg>
            <span>{tableLabel(selectedHoldOrder?.cartData?.table?.tableNumber)}</span>
          </div>
        )}

        {/* Customer name */}
        {role !== "chef" && (
          <>
            {selectedHoldOrder?.cartData?.customer && (
              <div className="flex items-center gap-1.5 ml-auto px-2 py-1 rounded-lg bg-[var(--primary-alpha-5)] border border-[var(--primary-alpha-12)] text-[var(--theme-primary)] text-[12px] font-bold">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-3.5 h-3.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="truncate max-w-[90px]">
                  {selectedHoldOrder?.cartData?.customer?.firstName}{" "}
                  {selectedHoldOrder?.cartData?.customer?.lastName}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Items section header */}
      <div className="flex items-center justify-between px-2 pb-[6px] border-b border-[var(--primary-alpha-11)]">
        <h2 className="text-[11px] font-extrabold text-[var(--theme-primary)] tracking-[0.06em] uppercase">
          {t("invoice.cartItems")}
        </h2>
        {rounds.length > 1 && (
          <span className="text-[10px] font-bold text-[var(--primary-alpha-60)]">
            {rounds.length} rounds
          </span>
        )}
      </div>

      {/* Which round each line was sent in. Only worth showing once a table has
          ordered more than once. */}
      {rounds.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-2 pt-2">
          {rounds.map((r) => (
            <span
              key={r.id || r.kot_number}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-dark-muted)] border border-[var(--border-default)]"
              title={new Date(r.createdAt).toLocaleString()}
            >
              KOT #{r.kot_number}
              <span className="font-medium text-[var(--text-muted)]">
                {r.items?.length || 0} item{(r.items?.length || 0) === 1 ? "" : "s"}
              </span>
              <span className="font-medium text-[var(--text-muted)]">
                {waitingLabel(r.createdAt)}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Items List */}
      <div className="flex flex-col mt-2 overflow-auto custom-scroll text-sm pr-1 flex-1 min-h-0">
        {selectedHoldOrder?.cartData?.orderItems?.map((item, index) => {
          const remainingQty = item.quantity - item.prepared_quantity;
          const qty = qtyMap[item.id] || 0;
          return (
            // The name goes on the row React actually keeps, and it is the
            // line's own. It sat on the inner box, reading a field these
            // lines do not carry — so every row of the list answered to
            // "undefined", and a ticket arriving from the kitchen could hand
            // one row's opened-out state to another.
            <div
              className="items-center"
              key={item.line_id || item.product_id || item.id || index}
            >
              <div
                className={`flex items-center justify-between gap-3 p-2.5 rounded-[12px] transition-all duration-150 mb-1.5 border border-transparent
                ${index % 2 === 0 ? "bg-white/80" : "bg-[var(--primary-alpha-3)]"} hover:bg-white hover:border-[var(--primary-alpha-11)] hover:shadow-[0_2px_10px_var(--primary-alpha-6)]`}
              >
                {/* Left: image + details */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* <div className="w-10 h-10 min-w-[40px] rounded-[10px] overflow-hidden border border-[rgba(81,28,106,0.11)] bg-white/50">
                    <img
                      src={item.image_url || item.img || defaultImg}
                      alt={t("invoice.productImage")}
                      className="w-full h-full object-cover"
                    />
                  </div> */}
                  <div className="flex flex-col gap-[2px] min-w-0">
                    {/* Product Name */}
                    <p
                      className={`text-[13px] text-[var(--theme-primary-dark)] font-bold ${
                        role === "chef"
                          ? "whitespace-normal break-words leading-snug max-w-[230px]"
                          : "truncate max-w-[140px] sm:max-w-[200px]"
                      }`}
                    >
                      {item.product_name || item.name}
                    </p>

                    {/* Product Note */}
                    {item.note && (
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-semibold text-[var(--theme-secondary-dark)] bg-[var(--secondary-alpha-6)] border border-[var(--secondary-alpha-25)]/80 px-2 py-0.5 rounded-md w-fit shadow-xs">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--theme-secondary-dark)]">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        <span className="font-bold">{t("cart.note")}</span>
                        <span>{item.note}</span>
                      </div>
                    )}

                    {/* Price × Quantity + Status */}
                    <div className="flex flex-wrap items-center gap-2 text-[var(--primary-alpha-60)] text-[11px] font-medium">
                      {role !== "chef" && (
                        <>
                          <span>{cur()}{item.price?.toFixed(2) ?? "0.00"}</span>
                          <span>×</span>
                          <span>{item.quantity ?? 0}</span>
                        </>
                      )}

                      {/* Status Badge */}
                      <span
                        className={`${role === "chef" ? "text-[12px]" : "text-[11px]"} px-2 py-[2px] rounded-full font-semibold
                        ${item.status === "NEW" ? "bg-gray-200 text-gray-700" : ""}
                        ${item.status === "PREPARING" ? "bg-[var(--secondary-alpha-13)] text-[var(--theme-secondary-dark)]" : ""}
                        ${item.status === "COMPLETED" ? "bg-green-100 text-green-600" : ""}
                      `}
                      >
                        {item.status === "NEW" && "New"}
                        {item.status === "PREPARING" && t("invoice.preparing")}
                        {item.status === "COMPLETED" && "Completed"}
                      </span>
                    </div>

                    {/* Quantity Details */}
                    <div
                      className={`flex gap-3 font-medium ${
                        role === "chef" ? "text-[12px]" : "text-[11px]"
                      }`}
                    >
                      <span className="text-green-600">
                        Done: {item.prepared_quantity ?? 0}
                      </span>
                      <span className="text-red-500">
                        Pending: {remainingQty ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: subtotal */}
                {role === "chef" ? (
                  <div className="shrink-0 rounded-lg bg-[var(--primary-alpha-8)] px-3 py-1.5 text-right text-[18px] font-extrabold leading-none text-[var(--theme-primary-dark)]">
                    Qty {item.quantity ?? 0}
                  </div>
                ) : (
                  <div className="text-[13px] font-extrabold text-[var(--theme-secondary-dark)] whitespace-nowrap">
                    {cur()}{(item.price * item.quantity).toFixed(2)}
                  </div>
                )}
              </div>
              {role === "chef" && (
                <>
                  {item.status === "NEW" && (
                    <button
                      className="h-[42px] mb-2 group flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3 rounded-xl font-bold text-[12px] transition-all duration-300 active:scale-[0.97] whitespace-nowrap overflow-hidden w-full gf-metal-green text-white shadow-md hover:shadow-lg border-transparent"
                      onClick={() =>
                        updateHoldOrderStatus(
                          selectedHoldOrder.serverId,
                          item,
                          {
                            action: "START",
                          },
                        )
                      }
                      title={t("invoice.preparing")}
                    >
                      <span className="shrink-0 transition-transform duration-300 group-hover:scale-110">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2a5 5 0 00-5 5c0 .34.03.67.1 1H7a3 3 0 00-3 3v2h16v-2a3 3 0 00-3-3h-.1c.07-.33.1-.66.1-1a5 5 0 00-5-5zM4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3H4z" />
                        </svg>
                      </span>
                      <span className="truncate">{t("invoice.startPreparing")}</span>
                    </button>
                  )}

                  {/* quantity related button */}
                  {/* {item.status === "PREPARING" && (
                    <div className="flex items-center gap-2 mb-2 w-full">
                      <div className="flex h-full items-center bg-surface border border-primary/20 rounded-lg h-8 overflow-hidden shadow-sm">
                        // ➖ Minus Button
                        <button
                          disabled={qty === 0}
                          className={`px-2 py-1.5 w-8 text-lg font-bold shrink-0 flex items-center justify-center h-full text-secondary text-center transition-colors ${
                            qty === 0
                              ? "bg-secondary/10 cursor-not-allowed"
                              : "bg-secondary/20 hover:bg-secondary/25 "
                          }`}
                          onClick={() =>
                            setQtyMap((prev) => ({
                              ...prev,
                              [item.id]: Math.max((prev[item.id] || 0) - 1, 0),
                            }))
                          }
                        >
                          -
                        </button>

                        // Quantity Display
                        <span className="text-sm w-8 text-center font-semibold text-primary outline-none bg-transparent">
                          {qty}
                        </span>

                        // ➕ Plus Button
                        <button
                          disabled={qty >= remainingQty}
                          className={`px-2 py-1.5 w-8 text-lg font-bold shrink-0 flex items-center justify-center h-full text-primary transition-colors ${
                            qty >= remainingQty
                              ? "bg-primary/10 cursor-not-allowed"
                              : "bg-primary/20 hover:bg-primary/25 "
                          }`}
                          onClick={() =>
                            setQtyMap((prev) => ({
                              ...prev,
                              [item.id]: Math.min(
                                (prev[item.id] || 0) + 1,
                                remainingQty,
                              ),
                            }))
                          }
                        >
                          +
                        </button>
                      </div>
                      // ✅ Mark as Ready Button
                      <button
                        disabled={qty === 0}
                        className={`flex-1 h-[42px] rounded-xl flex font-bold text-[12px] items-center group justify-center gap-1 sm:gap-1.5 px-2 shadow-md ${
                          qty === 0
                            ? "bg-gradient-to-r from-secondary/90 to-primary/90 text-white cursor-not-allowed"
                            : "gf-metal-green text-white"
                        }`}
                        onClick={() =>
                          updateHoldOrderStatus(
                            selectedHoldOrder.serverId,
                            item,
                            {
                              completedQty: qty,
                            },
                          )
                        }
                      >
                        <span className="shrink-0 transition-transform duration-300 group-hover:scale-110">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1 14l-4-4 1.5-1.5L11 12.5l5.5-5.5L18 8l-7 8z" />
                          </svg>
                        </span>
                        <span className="truncate">{t("invoice.markReady")}</span>
                      </button>
                    </div>
                  )} */}

                  {item.status === "PREPARING" && (
                    <div className="flex items-center gap-2 mb-2 w-full">
                      {/* ✅ Mark as Ready Button - completes full remaining qty */}
                      <button
                        className="flex-1 h-[42px] rounded-xl flex font-bold text-[12px] items-center group justify-center gap-1 sm:gap-1.5 px-2 shadow-md gf-metal-green text-white"
                        onClick={() =>
                          updateHoldOrderStatus(selectedHoldOrder.serverId, item, {
                            completedQty: remainingQty,
                          })
                        }
                      >
                        <span className="shrink-0 transition-transform duration-300 group-hover:scale-110">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1 14l-4-4 1.5-1.5L11 12.5l5.5-5.5L18 8l-7 8z" />
                          </svg>
                        </span>
                        <span className="truncate">{t("invoice.markReady")}</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-3 border-t border-[var(--primary-alpha-11)] text-sm sticky bottom-0 bg-white/70 backdrop-blur-md pb-2">
        {/* Totals grid */}
        {role !== "chef" && (
          <div className="text-[var(--primary-alpha-70)] font-bold grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] sm:text-[12px] bg-[var(--primary-alpha-3)] p-3 rounded-[12px] border border-[var(--primary-alpha-8)] mb-3">
            <div className="flex justify-between items-center">
              <p>{t("cart.subtotal")}</p>
              <span className="text-[var(--theme-primary-dark)]">
                {cur()}{selectedHoldOrder?.cartData?.subtotal?.toFixed(2)}
              </span>
            </div>
            {/* Two decimals, like every other figure here. This one line
                was printing the raw number, so a tax of 23 showed as "23"
                beside a subtotal of "460.00" — the only money on the till
                that did not look like money. */}
            <div className="flex justify-between items-center">
              <p>{taxLabel()}</p>
              <span className="text-[var(--theme-primary-dark)] tabular-nums">
                {cur()}{(Number(selectedHoldOrder?.cartData?.taxAmount) || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[var(--theme-secondary)] bg-[var(--secondary-alpha-6)] px-2 py-0.5 rounded-md">
              <p>{t("cart.discount")}</p>
              <span>-{cur()}{parseFloat(discountValue)?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-[var(--theme-primary)] font-extrabold text-[13px] bg-[var(--primary-alpha-8)] px-2 py-0.5 rounded-md border border-[var(--primary-alpha-14)]">
              <p>{t("invoice.total")}</p>
              <span>
                {cur()}{selectedHoldOrder?.cartData?.totalAmountToPay?.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* The guest is named once, in the header — it used to be repeated
            here as well, labelled t("cart.noNote") when there was nobody named. */}

        {/* ACTION BUTTONS */}
        {role !== "chef" && (
          <div className={`grid ${actionColumns} gap-1.5 sm:gap-2 w-full`}>
            {/* DELETE */}
            {mayVoid && (
            <button
              className={`h-[42px] group flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3 rounded-xl border font-bold text-[10px] sm:text-xs transition-all duration-300 active:scale-[0.97] whitespace-nowrap overflow-hidden w-full ${
                confirmingDelete
                  ? "border-red-600 bg-red-600 text-white shadow-md"
                  : "border-[var(--overlay-red-35)] bg-[var(--overlay-red-5)] text-red-600 hover:bg-red-600 hover:text-white hover:shadow-md"
              } ${deleting ? "opacity-60 cursor-not-allowed" : ""}`}
              onClick={handleDelete}
              disabled={deleting}
              title={
                confirmingDelete
                  ? t("invoice.deleteAgain")
                  : t("invoice.deleteHold")
              }
            >
              <span className="shrink-0 transition-transform duration-300 group-hover:scale-110">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </span>
              <span className="truncate">
                {deleting ? "Deleting…" : confirmingDelete ? "Sure?" : "Delete"}
              </span>
            </button>
            )}

            {/* PRINT */}
            {mayPrint && (
            <button
              className={`pos-key h-[42px] group flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3 text-text-secondary font-bold text-[10px] sm:text-xs hover:text-[var(--theme-primary)] active:scale-[0.97] whitespace-nowrap overflow-hidden w-full ${isPrinting ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={isPrinting}
              onClick={handlePrint}
              title={t("invoice.printHoldOrder")}
            >
              <span className="shrink-0 transition-transform duration-300 group-hover:scale-110">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
              </span>
              <span className="truncate">{t("invoice.print")}</span>
            </button>
            )}

            {/* RESUME / ADD TO CART — on the floor this is the only way in, so
                it is given the whole row and says what it will do. */}
            <button
              /* Polished gold: this is the one action on the panel that
                 opens a table back up, and gold is what the till keeps for
                 the thing somebody is looking for. It was a gradient from
                 gold into green — two metals welded together, which reads
                 as neither. */
              className={`gf-metal-gold group flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3 rounded-xl font-bold transition-all duration-300 active:scale-[0.97] whitespace-nowrap overflow-hidden w-full border-transparent ${
                mayVoid || mayPrint
                  ? "h-[42px] text-[10px] sm:text-xs"
                  : "h-[46px] text-xs sm:text-sm"
              }`}
              onClick={handleAddToCart}
              title={t("invoice.resumeAdd")}
            >
              <span className="shrink-0 transition-transform duration-300 group-hover:scale-110">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </span>
              <span className="truncate">
                {mayVoid || mayPrint ? t("invoice.resume") : t("invoice.resumeAddItems")}
              </span>
            </button>
          </div>
        )}

        {/* Settling the bill is the till's job. The captain takes orders and
            sends them to the kitchen; the Cart already closes the Pay button to
            them, and this second way in is closed here too. */}
        {canBill(role) && readyToSettle && (
          <button
            type="button"
            onClick={handleProceedToPay}
            className="mt-3 w-full flex justify-between items-center text-text-inverted px-4 py-3 rounded-xl shadow-md transition-all duration-200 cursor-pointer gf-metal-green hover:opacity-95 active:scale-[0.98] shadow-[0_4px_15px_var(--overlay-black-20)]"
            title={t("cart.proceedToPay")}
          >
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-bold leading-tight">
                {t("cart.proceedToPay")}
              </span>
              <span className="text-[11px] text-white/70 mt-0.5">
                {orderItems.length} {orderItems.length === 1 ? "Item" : "Items"}
              </span>
            </div>
            <div className="flex gap-2 items-center shrink-0">
              <span className="text-base font-bold">
                {/* Was a stray literal "P", which printed "P460.00" where every
                    other total on the screen shows the currency symbol. */}
                {cur()}
                {Number(
                  selectedHoldOrder?.cartData?.totalAmountToPay || 0,
                ).toFixed(2)}
              </span>
              <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                <svg
                  viewBox="64 64 896 896"
                  focusable="false"
                  data-icon="double-right"
                  width="16"
                  height="16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M533.2 492.3L277.9 166.1c-3-3.9-7.7-6.1-12.6-6.1H188c-6.7 0-10.4 7.7-6.3 12.9L447.1 512 181.7 851.1A7.98 7.98 0 00188 864h77.3c4.9 0 9.6-2.3 12.6-6.1l255.3-326.1c9.1-11.7 9.1-27.9 0-39.5zm304 0L581.9 166.1c-3-3.9-7.7-6.1-12.6-6.1H492c-6.7 0-10.4 7.7-6.3 12.9L751.1 512 485.7 851.1A7.98 7.98 0 00492 864h77.3c4.9 0 9.6-2.3 12.6-6.1l255.3-326.1c9.1-11.7 9.1-27.9 0-39.5z" />
                </svg>
              </span>
            </div>
          </button>
        )}
      </div>

      {isPrinting && (
        <PrintOrder
          show={isPrinting}
          setShow={setIsPrinting}
          finalOrderData={selectedHoldOrder?.cartData}
          isHold={true}
        />
      )}
    </div>
  );
};

export default HoldInvoiceFrom;
