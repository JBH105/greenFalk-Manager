import { getGst } from "../../../utils/gst";
import { dishName, useMenuLanguage } from "../../../utils/menuLanguage";
import { useT } from "../../../i18n";
import { cur } from "../../../utils/currency";
"use client";
import React, { useState, useRef, useEffect } from "react";
import arrowDownIcon from "../../../assets/icons/arrow_down.svg";
import keyup from "../../../assets/icons/keyup.svg";
import { useNavigate } from "react-router-dom";
import { useNotification } from "../../../hooks/useNotification";
import {
  useCartStore,
  ORDER_TYPE,
  hasSelectedTable,
  jainGroupSummary,
} from "../../../store/useCartStore";
import { pendingKotItems, tableLabel } from "../../../utils/kitchen";
import { roundTotals } from "../../../utils/roundTotals";
import { discountAmountOf } from "../../../utils/discount";
import { readTillSettings } from "../../../utils/tillSettings";
import defaultImg from "../../../assets/images/Default_Product_Img.png";
import DiscountHoldOrderPopup from "./DiscountHoldOrderPopup";
import ExchangeItemPopup from "./ExchangeItemPopup";
import { useAuthStore } from "../../../store/useAuthStore";
import { canBill } from "../../../utils/roleUi";
import Spinner from "../../common/Spinner";
import { useFeatures } from "../../../hooks/useFeatures";
import { useLocation } from "react-router-dom";
import { useHoldOrderStore } from "../../../store/useHoldOrderStore";
import { useProductStore } from "../../../store/useProductStore";
import OrderRounds from "./OrderRounds";
import { FoodMark, JainTag } from "./FoodMark";
import {
  formatCartStatus,
  getCompletedQuantity,
  dishesStillCooking,
  describeStillCooking,
  dishesNotSentYet,
  describeNotSent,
  isCompletedCartItem,
  isKitchenStarted,
} from "../../../utils/cartItemStatus";

/**
 * How many of this dish.
 *
 * It sits on the dish's own row, beside the name, rather than down in the
 * panel that opens underneath — which is where a cashier looks for it, and
 * which keeps it in the same glance as the price it changes.
 *
 * Each press counts straight away. It used to be held back until Update was
 * pressed, which was invisible while the control sat at the far end of an
 * open panel; next to the price it would have read as broken — three taps on
 * + with the line above still saying one.
 */
export /**
 * Plus and minus, drawn rather than typed.
 *
 * A font centres "+" and "−" on its MATH AXIS — about a third of the way
 * up, where an equals sign goes — and not on the middle of the em box. As
 * text they therefore sit high in their key however the key is centred.
 * A square viewBox with the stroke on its own centre line has no such
 * axis: it is in the middle because that is where it is drawn.
 */
const PlusGlyph = ({ className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" className={`block ${className}`} aria-hidden="true">
    <path d="M12 5.5v13M5.5 12h13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

const MinusGlyph = ({ className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" className={`block ${className}`} aria-hidden="true">
    <path d="M5.5 12h13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

const QuantityStepper = ({ value, min, onChange, onBelowMin, onEmpty }) => {
  const t = useT();
  const side = "w-7 h-full cursor-pointer";

  /**
   * One less than one is none, and none means the dish is off the order.
   *
   * The minus used to go dead at one, which left taking a dish off as a
   * separate thing to find — the bin at the other end of the row. Counting
   * down to nothing is what the hand expects, so that is what it does.
   *
   * It only does it where the dish could have been binned anyway: once the
   * kitchen has started, the floor is what has already been cooked, and the
   * minus stops there as it always did.
   */
  const atFloor = value <= min;
  const emptiesTheLine = atFloor && min <= 1 && typeof onEmpty === "function";

  /* The same track the menu card uses. One stepper in a till, not two. */
  return (
    <div className="pos-stepper h-7 shrink-0">
      <button
        type="button"
        disabled={atFloor && !emptiesTheLine}
        onClick={() => (emptiesTheLine ? onEmpty() : onChange(Math.max(min, value - 1)))}
        title={emptiesTheLine ? t("cart.takeOff") : undefined}
        className={`${side} ${
          atFloor && !emptiesTheLine
            ? "pos-stepper-minus cursor-not-allowed"
            : "pos-stepper-minus hover:text-[var(--theme-secondary-dark)] cursor-pointer"
        }`}
        aria-label={emptiesTheLine ? "Remove from cart" : "One less"}
      >
        <MinusGlyph />
      </button>

      {/* The browser's own up/down arrows sit on top of a number box the
          moment a mouse goes near it, which on a row this light reads as the
          control having sprouted a second pair of buttons. */}
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (next < 1) return;
          if (next < min) {
            onBelowMin?.();
            onChange(min);
            return;
          }
          onChange(next);
        }}
        className="w-8 h-full text-center text-[12px] font-extrabold tabular-nums text-[var(--theme-primary)]
          bg-transparent outline-none [appearance:textfield]
          [&::-webkit-outer-spin-button]:appearance-none
          [&::-webkit-inner-spin-button]:appearance-none"
        aria-label={t("cart.quantity")}
      />

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className={`${side} pos-stepper-plus`}
        aria-label={t("menu.oneMore")}
      >
        <PlusGlyph />
      </button>
    </div>
  );
};

/* ---------------- CART ITEM ---------------- */

export const CartProdctComponent = ({
  product,
  onRemove,
  onQuantityChange,
  onJainChange,
  jainGroup,
  isExpanded,
  onToggle,
  notifyError,
  matchBG,
}) => {
  const t = useT();
  const price = Number(product.price) || 0;
  const quantity = Number(product.quantity) || 1;
  const completedQuantity = getCompletedQuantity(product);
  const minEditableQty = Math.max(1, completedQuantity);
  const hasCompletedQuantity = completedQuantity > 0;
  const isCompleted = isCompletedCartItem(product);

  /**
   * Five paneer tikka with two of them Jain is one order written on two lines,
   * so the count is asked of the order and not of the line it is printed on.
   * It appears once, on the first line, and reads against all five. On the
   * line alone it read "0 / 3" while two more of the same dish sat right
   * underneath, each carrying a tick box of its own.
   */
  const jainTotal = jainGroup ? jainGroup.total : quantity;
  const jainCount = jainGroup
    ? jainGroup.jainCount
    : product.jain
      ? quantity
      : 0;
  const leadsJainGroup = !jainGroup || jainGroup.isLead;

  /**
   * The delete button goes the moment the kitchen picks the dish up.
   *
   * It used to go only once a plate was finished, so a dish the cook had
   * already started could still be removed at the till — off the bill, and
   * still in the pan. Now it disappears as soon as the kitchen marks it as
   * being made, which is the last moment nobody is out of pocket.
   *
   * The second line of a split is not a dish of its own either — it is the
   * Jain half of the line above, and that line's own control moves it back
   * and forth. A bin on it read as "take these two away", which left three
   * on the order when the guest had asked for five.
   */
  const hideDelete = isKitchenStarted(product) || !leadsJainGroup;
  /* The same helper the menu card uses, so the two never disagree. */
  const cartName = dishName(product.name, product.nameAr, useMenuLanguage());

  const statusLabel = formatCartStatus(product.status);

  const unitPrice = price.toFixed(2);
  const totalPrice = (price * quantity).toFixed(2);

  const [qty, setQty] = useState(quantity);
  const [itemNote, setItemNote] = useState(product.note || "");
  useEffect(() => {
    setQty(quantity);
  }, [quantity]);
  useEffect(() => {
    setItemNote(product.note || "");
  }, [product.note]);

  const onUpdateHandler = () => {
    onQuantityChange(
      product.cartKey || product.id,
      Math.max(minEditableQty, qty),
      undefined,
      itemNote,
    );
    onToggle();
  };
  // const divBG = matchBG % 2 === 0 ? "bg-bg-secondary" : "bg-surface";
  const divBG =
    isExpanded && (matchBG % 2 === 0 ? "bg-surface" : "bg-button-background");
  const expandedDivBG =
    isExpanded && (matchBG % 2 === 0 ? "bg-button-background" : "bg-surface");
  const handleImageError = (e) => {
    e.target.src = defaultImg;
  };

  return (
    <>
      {/* ── Main row ── */}
      <div
        className={`cart-product w-full px-3 py-2.5 flex justify-between items-center gap-2 group transition-colors duration-150 ${divBG}`}
      >
        {/* Left: expand toggle + name + price-per-unit */}
        <div className="product-detail flex gap-2 items-center min-w-0 flex-1">
          {/* {<img src={keyup} alt="arrow-down" onClick={()=> setIsChnage(false)}/>} */}
          {(
            <button
              onClick={onToggle}
              className="w-5 h-5 shrink-0 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <img
                src={isExpanded ? keyup : arrowDownIcon}
                alt="toggle"
                className="w-3 h-3"
              />
            </button>
          )}
          {/* {product.img ? (
            <img
              className="lg:w-14 lg:h-14 w-12 h-12 object-cover rounded"
              src={product.img}
              onError={handleImageError}
              alt={product.name}
            />
          ) : (
            <img
              className="lg:w-14 lg:h-14 w-12 h-12 object-cover rounded"
              src={defaultImg}
              alt={defaultImg}
            />
          )} */}
          {/* A column of its own, the same width on every line.
              Sized to the name rather than letting the name size it: dishes
              are called every length under the sun, and a stepper that began
              where each name happened to end left the cart looking torn down
              one side. A name longer than the column is cut; the whole of it
              is still in the title. */}
          <div className="product_heading min-w-0 basis-[120px] sm:basis-[150px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <FoodMark type={product.foodType} size={12} />
              {/* The same two lines the menu card uses, so a cashier reading
                  the cart and a guest reading the bill see the dish written
                  the same way. Only where a dish has an Arabic name and the
                  restaurant asked for both. */}
              <h2
                title={cartName.secondary ? `${cartName.primary} — ${cartName.secondary}` : cartName.primary}
                className="text-sm font-bold text-text-secondary leading-tight truncate text-left"
                dir={cartName.primaryIsArabic ? "rtl" : undefined}
              >
                <span className={cartName.primaryIsArabic ? "font-arabic" : undefined}>
                  {cartName.primary}
                </span>
              </h2>
              {product.jain && <JainTag />}
              {/* Placed after the chips rather than between name and chips:
                  the cart row is one line of flex, and a second line inside
                  it would push the quantity and the price out of alignment
                  with every other row. */}
              {statusLabel && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase leading-none ${
                    isCompleted
                      ? "bg-success/10 text-success border border-success/20"
                    : String(product.status).toLowerCase() === "preparing"
                        ? "bg-warning/10 text-[var(--warning-default)] border border-[var(--warning-default)]/20"
                        : "bg-primary/10 text-primary border border-primary/15"
                  }`}
                  title={`Status: ${statusLabel}`}
                >
                  {statusLabel}
                </span>
              )}
            </div>

            {cartName.secondary && (
              <p
                dir="rtl"
                className="font-arabic truncate text-left text-[11px] leading-[1.4] text-text-muted"
                title={cartName.secondary}
              >
                {cartName.secondary}
              </p>
            )}

            <p className="text-[11px] text-primary/60 font-medium mt-0.5">
              {unitPrice} ×{" "}
              {product.quantity || 1}{" "}
              {product.unit}
            </p>
            {product.note && (
              <p className="text-[10px] text-secondary font-medium italic mt-0.5 flex items-center gap-1">
                <span className="font-bold not-italic">{t("cart.note")}</span>{" "}
                {product.note}
              </p>
            )}
            {hasCompletedQuantity && (
              <p className="text-[10px] text-success font-semibold mt-0.5">
                Done: {completedQuantity} / {quantity}
              </p>
            )}

            {/* Only where the kitchen can actually do it, and only before the
                order has gone in — after that the food is already being made
                the way it was asked for.

                One of five paneer tikka can be Jain and the rest not, which
                is one thing the guest says and two dishes the kitchen makes.
                So the question is how many, not whether: at one it is a yes
                or no, and above one it is a count. Answering with fewer than
                all of them splits the line, and the Jain ones appear on their
                own line underneath — which carries the badge, and leaves the
                asking to the line above. */}
            {product.jainAvailable &&
              Number(product.sentQuantity || 0) === 0 &&
              leadsJainGroup && (
              jainTotal === 1 ? (
                <label className="mt-1 flex w-fit cursor-pointer items-center gap-1.5 text-[10px] font-semibold text-text-secondary">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 cursor-pointer accent-[var(--theme-primary)]"
                    checked={Boolean(product.jain)}
                    onChange={(e) =>
                      onJainChange?.(product.cartKey || product.id, e.target.checked ? 1 : 0)
                    }
                  />
                  {t("cart.makeItJain")}
                </label>
              ) : (
                <div className="mt-1 flex w-fit items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-1.5 py-0.5">
                  <span className="text-[10px] font-bold text-text-secondary">{t("cart.jain")}</span>

                  <button
                    type="button"
                    aria-label={t("cart.oneFewerJain")}
                    disabled={jainCount <= 0}
                    onClick={() => onJainChange?.(product.cartKey || product.id, jainCount - 1)}
                    className="h-5 w-5 flex items-center justify-center rounded-md bg-surface text-primary shadow-sm disabled:opacity-30"
                  >
                    <MinusGlyph className="h-3 w-3" />
                  </button>

                  <span className="min-w-[26px] text-center text-[11px] font-black tabular-nums text-primary">
                    {jainCount} / {jainTotal}
                  </span>

                  <button
                    type="button"
                    aria-label={t("cart.oneMoreJain")}
                    disabled={jainCount >= jainTotal}
                    onClick={() => onJainChange?.(product.cartKey || product.id, jainCount + 1)}
                    className="h-5 w-5 flex items-center justify-center rounded-md bg-surface text-primary shadow-sm disabled:opacity-30"
                  >
                    <PlusGlyph className="h-3 w-3" />
                  </button>
                </div>
              )
            )}
          </div>

          {/* Right after the name, and there whether the dish is open or not.
              Changing how many is the commonest thing anyone does to a cart,
              and it should not be behind a tap first.

              The one line that does not get it is the Jain half of a split:
              the line above counts how many of the order are Jain and moves
              them across, so a second count here would argue with it. That is
              the same reason the bin is kept off it. */}
          {leadsJainGroup && (
            <QuantityStepper
              value={qty}
              min={minEditableQty}
              onChange={(next) =>
                onQuantityChange(product.cartKey || product.id, next, undefined, itemNote)
              }
              onBelowMin={() =>
                notifyError(
                  `Quantity cannot be less than completed quantity ${completedQuantity}`
                )
              }
              /* Down to nothing takes the dish off, by exactly the route the
                 bin takes — which refuses a dish the kitchen has started,
                 gives a held round back to the server, and carries the Jain
                 half away with it. Where there is no bin there is no zero. */
              onEmpty={hideDelete ? undefined : onRemove}
            />
          )}
        </div>

        {/* Right: total + delete */}
        <div className="product-amount flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-secondary leading-tight">{totalPrice}</span>
            <span className="text-[10px] text-primary/40 font-medium">(exc.tax)</span>
          </div>
          {!hideDelete && (
            <button
              className="delete-btn w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-secondary hover:bg-secondary/10 transition-all duration-150"
              onClick={onRemove}
              aria-label={t("cart.removeItem")}
            >
              <svg
                viewBox="64 64 896 896"
                focusable="false"
                data-icon="delete"
                width="14"
                height="14"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M360 184h-8c4.4 0 8-3.6 8-8v8h304v-8c0 4.4 3.6 8 8 8h-8v72h72v-80c0-35.3-28.7-64-64-64H352c-35.3 0-64 28.7-64 64v80h72v-72zm504 72H160c-17.7 0-32 14.3-32 32v32c0 4.4 3.6 8 8 8h60.4l24.7 523c1.6 34.1 29.8 61 63.9 61h454c34.2 0 62.3-26.8 63.9-61l24.7-523H888c4.4 0 8-3.6 8-8v-32c0-17.7-14.3-32-32-32zM731.3 840H292.7l-24.2-512h487l-24.2 512z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded controls ──

          This opens for one reason: to tell the kitchen something about this
          dish. Discount and Price used to sit here too, but both were
          read-only text — the price is already on the row above — so they were
          clutter around the one field that does any work.

          The chips are here because this gets typed on a tablet, mid-service,
          standing at a table. "Jain" is a handful of taps on a touch keyboard
          and one here. */}
      {isExpanded && (
        <div className={`flex flex-col gap-2 px-3 pt-2.5 pb-3 border-t border-primary/5 ${expandedDivBG}`}>
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[10px] font-semibold text-primary/60 uppercase tracking-wide">
              {t("cart.noteForKitchen")}
            </label>
            <input
              type="text"
              value={itemNote}
              onChange={(e) => setItemNote(e.target.value)}
              onBlur={(e) => {
                const val = e.target.value;
                onQuantityChange(
                  product.cartKey || product.id,
                  Math.max(minEditableQty, qty),
                  undefined,
                  val
                );
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.target.blur();
                }
              }}
              placeholder={t("cart.notePlaceholder")}
              className="w-full h-9 px-3 text-[12px] bg-surface border border-primary/20 rounded-lg text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-primary/40 font-medium"
            />

            <div className="flex flex-wrap gap-1.5">
              {KITCHEN_NOTES.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setItemNote(appendNote(itemNote, chip))}
                  className="px-2.5 h-6 rounded-full text-[10.5px] font-semibold border border-primary/15 bg-surface text-primary/70 cursor-pointer transition-all hover:bg-primary hover:text-white hover:border-transparent active:scale-95"
                >
                  {chip}
                </button>
              ))}
              {itemNote && (
                <button
                  type="button"
                  onClick={() => setItemNote("")}
                  className="px-2.5 h-6 rounded-full text-[10.5px] font-semibold border border-secondary/20 bg-secondary/5 text-secondary cursor-pointer transition-all hover:bg-secondary hover:text-[var(--theme-primary-darker)] hover:border-transparent active:scale-95"
                >
                  {t("common.clear")}
                </button>
              )}
            </div>
          </div>

          {/* The quantity moved up beside the name; what is left down here
              is the one thing this panel opened for. */}
          <button
            className="w-full h-9 text-[12px] rounded-lg text-text-inverted font-bold
                 gf-metal-green cursor-pointer
                 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-sm"
            onClick={onUpdateHandler}
          >
            {t("cart.update")}
          </button>
        </div>
      )}
    </>
  );
};

/* The instructions a kitchen actually gets asked for, one tap each. */
const KITCHEN_NOTES = ["Less spicy", "Extra spicy", "No onion", "No garlic", "Jain", "Less oil"];

/** Adds a chip to the note without repeating one that is already in there. */
const appendNote = (note, chip) => {
  const parts = String(note || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.some((x) => x.toLowerCase() === chip.toLowerCase())) return parts.join(", ");
  return [...parts, chip].join(", ");
};

/* ---------------- HELPER FOR UNDERLINING ---------------- */
const ShortcutLabel = ({ text, char }) => {
  const index = text.toLowerCase().indexOf(char.toLowerCase());
  if (index === -1) return <span>{text}</span>;

  return (
    <span>
      {text.substring(0, index)}
      <span className="underline decoration-1 underline-offset-2">
        {text[index]}
      </span>
      {text.substring(index + 1)}
    </span>
  );
};


const buildHoldCartData = () => ({
  customer: selectedCustomer,
  table: selectedTable,
  orderItems: cartData,
  subtotal,
  taxAmount: tax,
  discount: {
    type: discount < 1 ? "PERCENT" : "FIXED",
    value:
      discount < 1
        ? parseFloat((discount * 100).toFixed(2))
        : parseFloat(discount.toFixed(2)),
  },
  totalAmountToPay: total,
});

/* ---------------- CART ---------------- */

/**
 * `discountAmount` and `tax` arrive already worked out rather than being
 * recomputed here.
 *
 * They used to be worked out again from `subtotal`, which was the same answer
 * for as long as the menu price was the food and nothing else. Where the menu
 * price carries the tax it is not: taking a flat 50 off a net subtotal takes
 * 50 off the food, when what the owner meant was 50 off the bill the guest
 * pays — a difference the cashier would read on one screen and not the other.
 * One sum, in one place, handed down.
 */
const Cart = ({ setPayToProceed, payToProceed, subtotal, tax, discount, discountAmount: discountGiven, total }) => {
  /* Subscribed, so the owner switching language mid-service redraws the
     cart rather than leaving it in the language it opened in. */
  const t = useT();

  let matchBG = 0;
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useNotification();
  const [activeModal, setActiveModal] = useState(null);

  /**
   * A round is on its way to the kitchen.
   *
   * On a busy night the server takes a second or two to answer, and a
   * captain who sees nothing happen presses again — and again. Each press
   * was a whole new round, so the kitchen got the same table's food two and
   * three times over and cooked all of it.
   */
  const [placing, setPlacing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const activeHoldOrder = useCartStore((state) => state.activeHoldOrder);
  const fromHoldResume = activeHoldOrder?.isResume;
  const customerName = activeHoldOrder?.customerName;
  const { createHoldOrder, requestBill, removeHeldItem } = useHoldOrderStore();
  const holdOrders = useHoldOrderStore((s) => s.holdOrders);

  const {
    cartData,
    removeFromCart,
    updateQuantity,
    setJainCount,
    resetCart,
    selectedCustomer,
    selectedTable,
    orderType,
    setOrderType,
    clearActiveHoldOrder,
    setCartFromHold,
  } = useCartStore();
  const allProducts = useProductStore((s) => s.products);
  const user = useAuthStore((u) => u.user);
  // Who may settle a bill is decided in one place, so the Cart and the hold
  // invoice screen cannot drift apart.
  const mayBill = canBill(user?.role?.name);

  // Watched, not read once, so a counter that loses its parcel screen loses
  // the Parcel button in the same moment rather than at the next reload.
  const features = useFeatures();

  // The bill already open on this table, if any. It carries the earlier rounds
  // and tells us whether its bill has been asked for.
  //
  // A table reaches the cart from two places — picked on the Tables screen, or
  // restored from a held bill — and those two shapes name the server id
  // differently, so match on whichever is present.
  const tableKey = (t) => t?.serverId || t?.id || null;
  const selectedTableKey = tableKey(selectedTable);
  const openBill = selectedTableKey
    ? holdOrders?.find((o) => tableKey(o?.cartData?.table) === selectedTableKey)
    : null;

  const billAlreadyRequested = Boolean(openBill?.billRequestedAt);

  // Nothing goes to the counter while food is still on the pass. The captain
  // sends this and walks away, so by the time the till acts on it the table
  // would be closed with the kitchen still cooking for it.
  // What the kitchen still owes on this table. Empty in a shop with no
  // kitchen display, which dishesStillCooking decides for every screen at
  // once rather than each one remembering to ask.
  const stillCooking = dishesStillCooking(cartData);
  const waitingOnKitchen = stillCooking.length > 0;

  /**
   * Food in the cart that the kitchen has never been told about.
   *
   * A dine-in bill is settled after the meal, so Proceed to Pay standing
   * ready the moment a dish is tapped was wrong in the plainest way: the
   * bill could be taken and closed while the kitchen had never heard of the
   * order and the guest had eaten nothing. The food goes in first — Place
   * Order — and only then is there a meal to charge for.
   *
   * A parcel is the exception and always was: there is no table to come back
   * to, so its one button takes the money and sends the food together.
   */
  const notSentYet = dishesNotSentYet(cartData);

  // The captain can hand a table to the till, but only once the table actually
  // has a bill open — there is nothing to settle otherwise.
  const canRequestBill =
    !mayBill &&
    Boolean(openBill) &&
    !billAlreadyRequested &&
    !waitingOnKitchen &&
    notSentYet.length === 0;

  // Swapping a dish at a table that is still eating. There has to be an open
  // order on the table for there to be anything to swap — a cart nobody has
  // sent to the kitchen yet can simply be edited.
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const exchangeItem = useHoldOrderStore((s) => s.exchangeItem);
  const fetchHoldOrders = useHoldOrderStore((s) => s.fetchHoldOrders);
  const openBillId = openBill?.serverId || openBill?.localId || activeHoldOrder?.id || null;

  const handleExchange = async (payload) => {
    const result = await exchangeItem(openBillId, payload);
    // The table's rounds have changed, so take the cart from the server copy
    // rather than patching it here and hoping the two agree.
    const fresh = useHoldOrderStore
      .getState()
      .holdOrders.find((o) => (o.serverId || o.localId) === openBillId);
    if (fresh?.cartData) setCartFromHold(fresh.cartData);
    notifySuccess(
      `${result?.old_product_name ?? "Item"} exchanged for ${result?.new_product_name ?? "another"}`
    );
    return result;
  };
  const currentOrderType =
    orderType === ORDER_TYPE.PARCEL ? ORDER_TYPE.PARCEL : ORDER_TYPE.DINE_IN;
  const isDineIn = currentOrderType === ORDER_TYPE.DINE_IN;

  /** Whether this shop seats anyone at all. */
  const seatsPeople = features.table_service_enabled;

  /**
   * Paid for before it is cooked, and waited for under a token.
   *
   * A parcel at a restaurant works this way: someone orders, pays and waits —
   * there is no table to come back to, so there is nothing to hold and nothing
   * to settle later. One tap takes the money and sends the food. A parcel
   * resumed from the old two-step flow still behaves the old way, which is why
   * an open bill rules this out.
   *
   * Everything sold over a counter works this way too, both kinds of it. A
   * shop with no tables still sells two different things — someone eats their
   * ice cream standing at the counter, someone else takes theirs away in a bag
   * — and both pay first and both wait for a token. What differs is only which
   * of the two the kitchen and the bill are told about.
   */
  const isParcelSale = mayBill && !activeHoldOrder?.id && (!isDineIn || !seatsPeople);

  /**
   * Whether this bill is waiting on food nobody has ordered yet.
   *
   * Declared here rather than beside notSentYet, which is where it reads more
   * naturally: it needs isParcelSale, and isParcelSale is declared below that
   * point. Putting it up there threw before the menu had finished drawing and
   * took the whole screen with it.
   */
  const nothingSentYet = !isParcelSale && notSentYet.length > 0;

  // Some outlets were never given a parcel counter at all. Where there is
  // one, only the till takes parcels: a captain who could pick one would be
  // starting a bill they are not allowed to finish.
  const parcelsAllowed = features.parcel_enabled;

  /**
   * The choice stays on a counter — only the words for it change.
   *
   * At a restaurant it is Dine-in or Parcel: eat at a table, or take it away.
   * At a counter nobody has a table, so the first of those is simply an Order
   * — eaten standing there — and the second is still a Parcel, bagged to go.
   * The counter staff need to know which, and so does whoever packs it.
   */
  const mayTakeParcels = mayBill && parcelsAllowed;
  const dineInLabel = seatsPeople ? t("order.dineIn") : t("order.order");

  useEffect(() => {
    if (!mayTakeParcels && !isDineIn) setOrderType(ORDER_TYPE.DINE_IN);
  }, [mayTakeParcels, isDineIn, setOrderType]);

  /**
   * Taking a dish back off the order.
   *
   * A line that has not been sent only exists in this browser, so it just
   * goes. One that has been sent is on the kitchen's ticket, and the
   * kitchen reads that from the server — so the server is told first, and
   * the till only lets go of the line once it has agreed. Doing it the
   * other way round takes the dish off the bill and leaves the cook
   * making it.
   */
  const handleRemoveItem = async (item) => {
    if (isKitchenStarted(item)) {
      notifyError(
        `The kitchen has already started ${item?.name || "this dish"} — it cannot be taken off now`
      );
      return;
    }

    if (item?.holdOrderId) {
      const done = await removeHeldItem(item);
      if (!done) return;
    }

    // The Jain half has no bin of its own, so it would be left standing on
    // the order for a dish nobody had asked to keep.
    const group = jainGroupSummary(cartData, item);
    const halves = (group?.memberKeys || []).filter(
      (key) => key !== (item.cartKey || item.id),
    );

    removeFromCart(item.id, item.cartKey);
    halves.forEach((key) => removeFromCart(item.id, key));
    handleToggleExpand(-1);
  };

  const openModal = (modalName) => {
    setActiveModal(modalName);
  };
  // const [expandedId, setExpandedId] = useState(null);

  const cartEndRef = useRef(null);

  const totalItems = cartData.reduce(
    (sum, p) => sum + (Number(p.quantity) || 1),
    0,
  );
  const [expandedProductId, setExpandedProductId] = useState(null);

  const handleToggleExpand = (index) => {
    setExpandedProductId((prev) => {
      const nextIndex = prev === index ? -1 : index;

      // If we are expanding (not closing), scroll to that item
      if (nextIndex !== -1) {
        setTimeout(() => {
          // Find the element by index and scroll it into view
          const elements = document.querySelectorAll(".cart-item-container");
          elements[index]?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 100); // Small timeout to wait for the expanded div to render
      }

      return nextIndex;
    });
  };
  /**
   * Jump to the newest line — but only when there is a new line.
   *
   * This used to run on every change to the cart, smoothly. That cost two
   * things. The animation is hundreds of milliseconds of main-thread work on
   * a tablet, which is felt as the whole till going stiff. And the cart now
   * changes on its own whenever the kitchen marks a dish done, so the list
   * slid away under the cashier while they were reading it.
   *
   * block: "nearest" keeps the jump inside the cart's own list rather than
   * scrolling whatever the cart happens to sit in.
   */
  const lineCount = cartData.length;
  const lineCountBefore = useRef(lineCount);

  useEffect(() => {
    const gotALine = lineCount > lineCountBefore.current;
    lineCountBefore.current = lineCount;

    if (gotALine) {
      cartEndRef.current?.scrollIntoView({ block: "nearest" });
    }

    handleToggleExpand(-1);
  }, [cartData]);

  // this is to change the status offline instantly when the user goes offline or online without needing to refresh the page
  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
    };
    window.addEventListener("online", handleStatusChange);
    window.addEventListener("offline", handleStatusChange);
    return () => {
      window.removeEventListener("online", handleStatusChange);
      window.removeEventListener("offline", handleStatusChange);
    };
  }, []);

  /**
   * The captain's end of a meal: tell the till this table wants its bill. The
   * table stays open — only the cashier can actually close it.
   */
  const handleRequestBill = async () => {
    if (billAlreadyRequested) {
      notifySuccess(t("cart.billAlreadySent"));
      return;
    }

    // The bill this table already has open. It normally comes from the
    // list the Tables screen loaded, but a captain who reached the cart
    // another way can be looking at a table whose bill this screen has
    // never seen — so ask the server before telling them there isn't one.
    let bill = openBill;

    if (!bill) {
      const outletId = user?.outlet_id;
      if (outletId) {
        try {
          await fetchHoldOrders(outletId, { force: true });
          const fresh = useHoldOrderStore.getState().holdOrders || [];
          bill =
            fresh.find((o) => tableKey(o?.cartData?.table) === selectedTableKey) ||
            fresh.find((o) => (o.serverId || o.localId) === activeHoldOrder?.id) ||
            null;
        } catch {
          /* the message below covers it */
        }
      }
    }

    if (!bill) {
      notifyError(t("cart.noOpenBill"));
      return;
    }

    if (notSentYet.length > 0) {
      notifyError(
        `Send the order to the kitchen first — ${describeNotSent(notSentYet)} has not been placed`
      );
      return;
    }

    if (waitingOnKitchen) {
      notifyError(`The kitchen is still cooking ${describeStillCooking(stillCooking)}`);
      return;
    }

    const done = await requestBill(bill);
    if (done) {
      // The table belongs to the counter now. Letting go of it here does
      // two things: it clears the captain's screen, which otherwise still
      // shows a bill they have already handed over, and it releases the
      // hold this tablet has on the table. Without that the cashier who
      // opens it is told the table is with the captain, and cannot take
      // the money.
      resetCart();
      setPayToProceed(false);
      notifySuccess(t("cart.billSent"));
      navigate("/pos/tables");
    } else {
      notifyError(t("cart.billSendFailed"));
    }
  };

  const handleProceed = () => {
    if (totalItems === 0) {
      notifyError(t("cart.addItems"));
      return;
    }
    // A table is asked for only where there are tables. On a counter an
    // Order is eaten standing there, so there is nothing to seat it at.
    if (seatsPeople && isDineIn && !hasSelectedTable(selectedTable)) {
      notifyError(t("cart.pickTable"));
      navigate("/pos/tables");
      return;
    }
    // A parcel pays and cooks in the same tap, so it is never short.
    if (!isParcelSale && notSentYet.length > 0) {
      notifyError(
        `Send the order to the kitchen first — ${describeNotSent(notSentYet)} has not been placed`
      );
      return;
    }
    if (waitingOnKitchen) {
      notifyError(`The kitchen is still cooking ${describeStillCooking(stillCooking)}`);
      return;
    }

    /**
     * Every bill carries a name and a number: it is printed on the receipt
     * and called out in the kitchen. A table usually gave one when its first
     * round went in, so this only stops a sale that has none yet — which is
     * every parcel, since a parcel never goes through Place Order.
     *
     * Not at a counter. Somebody buying a ten-rupee ice cream is not going to
     * give their name for it, and a queue of people waiting while the cashier
     * types one is the fastest way to lose the queue. The token is the name
     * there: it is what is printed, and what is called out.
     */
    if (
      seatsPeople &&
      readTillSettings().askCustomerName &&
      !selectedCustomer?.firstName
    ) {
      openModal("customerBeforePay");
      return;
    }

    setPayToProceed(true);
  };

  // // Handle "Enter" key globally for Proceed to Pay
  // useEffect(() => {
  //   const handleGlobalKeyDown = (e) => {
  //     // Only trigger if 'Enter' is pressed
  //     if (e.key === "Enter") {
  //       // Prevent default behavior (like form submissions)
  //       e.preventDefault();

  //       // Check same conditions as your button:
  //       // 1. Not an owner
  //       // 2. Cart is not empty
  //       if (user?.role?.name !== "owner" && totalItems > 0) {
  //         handleProceed();
  //       }
  //     }
  //   };

  //   window.addEventListener("keydown", handleGlobalKeyDown);
  //   return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  // }, [totalItems, user, handleProceed]); // Dependencies ensure logic stays current
  const handleDiscountClick = () => {
    if (cartData.length === 0) {
      notifyError(t("discount.needItems"));
      return;
    }
    openModal("discount");
  };

  /* ---------------- SHORTCUT LOGIC ---------------- */
  useEffect(() => {
    const handleShortcuts = (e) => {
      // Don't trigger if user is typing in any input or textarea
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      const key = e.key.toLowerCase();

      switch (key) {
        case "u":
          e.preventDefault();
          navigate("/pos/customers");
          break;
        case "s":
          e.preventDefault();
          navigate("/pos/tables");
          break;
        case "d":
          e.preventDefault();
          handleDiscountClick();
          break;
        case "e":
          e.preventDefault();
          navigate("/pos/invoices");
          break;
        case "h":
          e.preventDefault();
          handleHoldClick();
          break;
        case "enter":
          e.preventDefault();
          if (user?.role?.name !== "owner") {
            handleProceed();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, [totalItems, user, navigate]);

  const handleDirectHoldOrder = async () => {
    if (placing) return;

    if (!cartData.length) {
      notifyError(t("cart.isEmpty"));
      return;
    }
    // A table is asked for only where there are tables. On a counter an
    // Order is eaten standing there, so there is nothing to seat it at.
    if (seatsPeople && isDineIn && !hasSelectedTable(selectedTable)) {
      notifyError(t("cart.pickTable"));
      navigate("/pos/tables");
      return;
    }

    // Who the bill is for.
    //
    // A chosen customer comes first. This used to take the name the bill was
    // already carrying, so a table first held with nobody named stayed "Guest"
    // for the rest of the night even after the customer was picked — the name
    // the cashier had just chosen lost to a placeholder.
    //
    // The same order as the hold popup uses, so the two ways of holding a bill
    // cannot disagree about its name.
    const selectedCustomerName = `${selectedCustomer?.firstName || ""} ${
      selectedCustomer?.lastName || ""
    }`.trim();
    const carriedName = customerName === "Guest" ? "" : customerName;
    const finalName = selectedCustomerName || carriedName || "Guest";

    // One Hold = one KOT. A resumed bill already has its earlier rounds in the
    // kitchen, so only what the waiter added since goes on this one.
    const kotItems = pendingKotItems(cartData);

    if (!kotItems.length) {
      notifyError(t("cart.nothingNew"));
      return;
    }

    // The money for THIS round, not the table's. The bill is the sum of
    // its rounds, so a round carrying the whole table's subtotal makes the
    // second one add the first one's money all over again.
    const money = roundTotals(kotItems, cartData, discount);

    const holdOrderPayload = {
      localId: `HOLD-${Date.now()}`,
      timestamp: Date.now(),
      note: finalName,
      serverId: null,
      cartData: {
        customer: selectedCustomer,
        table: selectedTable,
        orderType: currentOrderType,
        orderItems: kotItems,
        subtotal: money.subtotal,
        taxAmount: money.taxAmount,
        discount: {
          type: discount < 1 ? "PERCENT" : "FIXED",
          value:
            discount < 1
              ? parseFloat((discount * 100).toFixed(2))
              : parseFloat(money.discount.toFixed(2)),
        },
        totalAmountToPay: money.total,
      },
    };

    setPlacing(true);

    try {
      // Always a new KOT: rewriting the earlier round would wipe whatever the
      // kitchen had already started cooking on it. The server links this round
      // to the bill the table already has open.
      await createHoldOrder(holdOrderPayload);

      resetCart();
      setPayToProceed(false);
      notifySuccess(t("cart.sentToKitchen"));

      // A dine-in bill now belongs to its table, and the next thing the waiter
      // does is pick another table — so go back to the floor plan. A parcel has
      // no table to show, so the till stays on the menu for the next one.
      if (isDineIn) navigate("/pos/tables");
    } catch (err) {
      notifyError(t("cart.holdFailed"));
    } finally {
      setPlacing(false);
    }
  };

  const handleHoldClick = () => {
    // Everything that places a round comes through here — the tile, and the
    // H key, which repeats if it is held down.
    if (placing) return;

    // A table is asked for only where there are tables. On a counter an
    // Order is eaten standing there, so there is nothing to seat it at.
    if (seatsPeople && isDineIn && !hasSelectedTable(selectedTable)) {
      notifyError(t("cart.pickTable"));
      navigate("/pos/tables");
      return;
    }
    if (fromHoldResume) {
      handleDirectHoldOrder();
      clearActiveHoldOrder();
    } else if (selectedCustomer?.firstName) {
      handleDirectHoldOrder();
    } else {
      openModal("holdOrder");
    }
  };

  // Handed down where the screen above has already worked it out; worked out
  // here only for a caller that has not been updated to pass it.
  const discountAmount = (
    discountGiven !== undefined && discountGiven !== null
      ? Number(discountGiven)
      : discountAmountOf(subtotal, discount)
  ).toFixed(2);

  const handleItemUpdate = async (cartKey, qty, _unused, note) => {
    try {
      const currentItem = cartData.find(
        (item) => (item.cartKey || item.id) === cartKey
      );
      const minQty = Math.max(1, getCompletedQuantity(currentItem));
      const safeQty = Math.max(minQty, Number(qty) || minQty);

      // 1. update local cart
      updateQuantity(cartKey, safeQty, note);

    } catch (err) {
      notifyError(t("cart.updateFailed"));
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border-default">

      {/* ── OLD HEADER (commented out, preserved) ── */}
      {/* <div className="cart-header sticky top-0 flex items-center justify-between px-3 py-2.5 border-b border-border-default text-text-secondary">
        <div className="icons flex gap-3 fill-gray-600">
          <div className="cart-icons p-2 shadow-[0_0_3px_var(--shadow-soft-hex)] rounded-md cursor-pointer">
            <svg
              viewBox="0 0 1024 1024"
              focusable="false"
              data-icon="shopping-cart"
              width="26"
              height="26"
              fill="currentColor"
              aria-hidden="true"
              color={isOnline ? "green" : "red"}
            >
              <path d="M723 620.5C666.8 571.6 593.4 542 513 542s-153.8 29.6-210.1 78.6a8.1 8.1 0 00-.8 11.2l36 42.9c2.9 3.4 8 3.8 11.4.9C393.1 637.2 450.3 614 513 614s119.9 23.2 163.5 61.5c3.4 2.9 8.5 2.5 11.4-.9l36-42.9c2.8-3.3 2.4-8.3-.9-11.2zm117.4-140.1C751.7 406.5 637.6 362 513 362s-238.7 44.5-327.5 118.4a8.05 8.05 0 00-1 11.3l36 42.9c2.8 3.4 7.9 3.8 11.2 1C308 472.2 406.1 434 513 434s205 38.2 281.2 101.6c3.4 2.8 8.4 2.4 11.2-1l36-42.9c2.8-3.4 2.4-8.5-1-11.3zm116.7-139C835.7 241.8 680.3 182 511 182c-168.2 0-322.6 59-443.7 157.4a8 8 0 00-1.1 11.4l36 42.9c2.8 3.3 7.8 3.8 11.1 1.1C222 306.7 360.3 254 511 254c151.8 0 291 53.5 400 142.7 3.4 2.8 8.4 2.3 11.2-1.1l36-42.9c2.9-3.4 2.4-8.5-1.1-11.3zM448 778a64 64 0 10128 0 64 64 0 10-128 0z"></path>
            </svg>
          </div>
          <div className="reset-icons p-2 shadow-[0_0_3px_var(--shadow-soft-hex)] rounded-md cursor-pointer" onClick={() => { resetCart(); setPayToProceed(false); }}>
            <svg
              viewBox="64 64 896 896"
              focusable="false"
              data-icon="redo"
              width="26"
              height="26"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M758.2 839.1C851.8 765.9 912 651.9 912 523.9 912 303 733.5 124.3 512.6 124 291.4 123.7 112 302.8 112 523.9c0 125.2 57.5 236.9 147.6 310.2 3.5 2.8 8.6 2.2 11.4-1.3l39.4-50.5c2.7-3.4 2.1-8.3-1.2-11.1-8.1-6.6-15.9-13.7-23.4-21.2a318.64 318.64 0 01-68.6-101.7C200.4 609 192 567.1 192 523.9s8.4-85.1 25.1-124.5c16.1-38.1 39.2-72.3 68.6-101.7 29.4-29.4 63.6-52.5 101.7-68.6C426.9 212.4 468.8 204 512 204s85.1 8.4 124.5 25.1c38.1 16.1 72.3 39.2 101.7 68.6 29.4 29.4 52.5 63.6 68.6 101.7 16.7 39.4 25.1 81.3 25.1 124.5s-8.4 85.1-25.1 124.5a318.64 318.64 0 01-68.6 101.7c-9.3 9.3-19.1 18-29.3 26L668.2 724a8 8 0 00-14.1 3l-39.6 162.2c-1.2 5 2.6 9.9 7.7 9.9l167 .8c6.7 0 10.5-7.7 6.3-12.9l-37.3-47.9z"></path>
            </svg>
          </div>
        </div>
        <div className="buttons flex gap-1">
          <button
            onClick={() => navigate("/pos/customers")}
            className="select-customer cursor-pointer bg-linear-to-b justify-center from-secondary to bg-primary text-text-inverted px-4 py-2 rounded mr-2 flex items-center gap-2 w-[180px]"
          >
            <p className="text-sm">
              {selectedCustomer?.firstName ? (
                `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
              ) : (
                <>
                  <ShortcutLabel text={t("order.selectCustomer")} char="u" />
                </>
              )}
            </p>
            <svg
              viewBox="64 64 896 896"
              focusable="false"
              data-icon="edit"
              width="1em"
              height="1em"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M880 836H144c-17.7 0-32 14.3-32 32v36c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-36c0-17.7-14.3-32-32-32zm-622.3-84c2 0 4-.2 6-.5L431.9 722c2-.4 3.9-1.3 5.3-2.8l423.9-423.9a9.96 9.96 0 000-14.1L694.9 114.9c-1.9-1.9-4.4-2.9-7.1-2.9s-5.2 1-7.1 2.9L256.8 538.8c-1.5 1.5-2.4 3.3-2.8 5.3l-29.5 168.2a33.5 33.5 0 009.4 29.8c6.6 6.4 14.9 9.9 23.8 9.9z"></path>
            </svg>
          </button>
          <button onClick={() => navigate("/pos/tables")} className="select-table cursor-pointer bg-pos-green text-text-inverted px-4 py-2 rounded flex gap-2 items-center w-[180px] justify-center">
            <svg
              className="w-6"
              fill="currentColor"
              version="1.1"
              id="Capa_1"
              xmlns="http://www.w3.org/2000/svg"
              x="0px"
              y="0px"
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
            <p className="text-[13px]">{selectedTable?.tableNumber ? `Table ${tableLabel(selectedTable.tableNumber)}` : <ShortcutLabel text={t("order.selectTable")} char="s" />}</p>
          </button>
        </div>
      </div> */}

      {/* ══════════════════════ HEADER ══════════════════════ */}
      <div className="cart-header sticky top-0 z-10 px-2 sm:px-3 py-2.5 bg-surface border-b border-primary/10 shadow-sm">
        <div className="flex items-center justify-between gap-2 w-full">

          {/* LEFT: status + reset icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* WIFI STATUS */}
            <div
              title={isOnline ? "Online" : "Offline"}
              className={`p-1.5 sm:p-2 rounded-lg border shadow-sm transition-colors ${isOnline
                ? "bg-success/10 border-success/20 text-success"
                : "bg-secondary/10 border-secondary/20 text-secondary"
                }`}
            >
              <svg viewBox="0 0 1024 1024" width="15" height="15" fill="currentColor" className="sm:w-[18px] sm:h-[18px]">
                <path d="M723 620.5C666.8 571.6 593.4 542 513 542s-153.8 29.6-210.1 78.6a8.1 8.1 0 00-.8 11.2l36 42.9c2.9 3.4 8 3.8 11.4.9C393.1 637.2 450.3 614 513 614s119.9 23.2 163.5 61.5c3.4 2.9 8.5 2.5 11.4-.9l36-42.9c2.8-3.3 2.4-8.3-.9-11.2zm117.4-140.1C751.7 406.5 637.6 362 513 362s-238.7 44.5-327.5 118.4a8.05 8.05 0 00-1 11.3l36 42.9c2.8 3.4 7.9 3.8 11.2 1C308 472.2 406.1 434 513 434s205 38.2 281.2 101.6c3.4 2.8 8.4 2.4 11.2-1l36-42.9c2.8-3.4 2.4-8.5-1-11.3zm116.7-139C835.7 241.8 680.3 182 511 182c-168.2 0-322.6 59-443.7 157.4a8 8 0 00-1.1 11.4l36 42.9c2.8 3.3 7.8 3.8 11.1 1.1C222 306.7 360.3 254 511 254c151.8 0 291 53.5 400 142.7 3.4 2.8 8.4 2.3 11.2-1.1l36-42.9c2.9-3.4 2.4-8.5-1.1-11.3zM448 778a64 64 0 10128 0 64 64 0 10-128 0z" />
              </svg>
            </div>

            {/* RESET */}
            <button
              onClick={() => { resetCart(); setPayToProceed(false); }}
              title={t("cart.clear")}
              className="p-1.5 sm:p-2 rounded-lg bg-surface border border-primary/20 shadow-sm text-primary hover:text-secondary hover:border-secondary/30 hover:bg-secondary/5 transition-all duration-150"
            >
              <svg viewBox="64 64 896 896" width="15" height="15" fill="currentColor" className="sm:w-[18px] sm:h-[18px]">
                <path d="M758.2 839.1C851.8 765.9 912 651.9 912 523.9 912 303 733.5 124.3 512.6 124 291.4 123.7 112 302.8 112 523.9c0 125.2 57.5 236.9 147.6 310.2 3.5 2.8 8.6 2.2 11.4-1.3l39.4-50.5c2.7-3.4 2.1-8.3-1.2-11.1-8.1-6.6-15.9-13.7-23.4-21.2a318.64 318.64 0 01-68.6-101.7C200.4 609 192 567.1 192 523.9s8.4-85.1 25.1-124.5c16.1-38.1 39.2-72.3 68.6-101.7 29.4-29.4 63.6-52.5 101.7-68.6C426.9 212.4 468.8 204 512 204s85.1 8.4 124.5 25.1c38.1 16.1 72.3 39.2 101.7 68.6 29.4 29.4 52.5 63.6 68.6 101.7 16.7 39.4 25.1 81.3 25.1 124.5s-8.4 85.1-25.1 124.5a318.64 318.64 0 01-68.6 101.7c-9.3 9.3-19.1 18-29.3 26L668.2 724a8 8 0 00-14.1 3l-39.6 162.2c-1.2 5 2.6 9.9 7.7 9.9l167 .8c6.7 0 10.5-7.7 6.3-12.9l-37.3-47.9z" />
              </svg>
            </button>
          </div>

          {/* RIGHT: customer + table chips */}
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
            {/* SELECT CUSTOMER */}
            <button
              onClick={() => navigate("/pos/customers")}
              className="tap-target flex-1 min-w-0 px-2 sm:px-3 py-1.5 rounded-xl text-text-inverted text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 shadow-sm transition-all duration-200
                gf-metal-green hover:opacity-90 active:scale-[0.97]"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" className="shrink-0 sm:w-[15px] sm:h-[15px]">
                <path d="M12 12c2.7 0 5-2.3 5-5S14.7 2 12 2 7 4.3 7 7s2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
              </svg>

              {/* Improved text display with better truncation */}
              <span className="inline-block max-w-[70px] sm:max-w-[110px] md:max-w-none truncate">
                {selectedCustomer?.firstName ? (
                  `${selectedCustomer.firstName} ${selectedCustomer.lastName?.charAt(0) || ''}.`
                ) : (
                  <>
                    <span className="sm:hidden">{t("order.customer")}</span>
                    <span className="hidden sm:inline">{t("order.selectCustomer")}</span>
                  </>
                )}
              </span>
            </button>

            {/* SELECT TABLE — only where there are tables to select. */}
            {/* The table is the one gold thing on this panel — it is what a
                cashier looks for first when a guest walks up and says a
                number. It used to be a gradient running from gold into
                green, which is two metals welded together and looks like
                neither. */}
            {seatsPeople && <button
              onClick={() => navigate("/pos/tables")}
              className="tap-target flex-1 min-w-0 px-2 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all duration-200
                gf-metal-gold active:scale-[0.97]"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" className="shrink-0 sm:w-[15px] sm:h-[15px]">
                <path d="M3 11h18v2H3zm2 4h2v4H5zm12 0h2v4h-2zM7 5h10v2H7z" />
              </svg>
              <span className="inline-block max-w-[60px] sm:max-w-[90px] md:max-w-none truncate">
                {selectedTable?.tableNumber ? (
                  `Table ${tableLabel(selectedTable.tableNumber)}`
                ) : (
                  <>
                    <span className="sm:hidden">Table{isDineIn ? "*" : ""}</span>
                    <span className="hidden sm:inline">Select Table{isDineIn ? "*" : ""}</span>
                  </>
                )}
              </span>
            </button>}
          </div>
        </div>
      </div>

      {/* Dine-in / Parcel — the till's choice, and only where the outlet has a
          parcel counter. With one option there is nothing to choose, so the
          row is not drawn at all rather than shown with a dead half. */}
      {mayTakeParcels && <div className="px-2 pt-2">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-background border border-border-default/50">
          {/* DINE-IN button */}
          <button
            type="button"
            onClick={() => setOrderType(ORDER_TYPE.DINE_IN)}
            className={`py-3 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${
              currentOrderType === ORDER_TYPE.DINE_IN
                ? "gf-metal-green text-text-inverted shadow-md scale-[1.01]"
                : "text-text-secondary hover:bg-primary/5"
            }`}
          >
            {/* Fork & Knife icon */}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="shrink-0">
              <path d="M11 3a1 1 0 00-1 1v5H8V4a1 1 0 00-2 0v5H4V4a1 1 0 00-2 0v6a3 3 0 002 2.83V20a1 1 0 002 0v-7.17A3 3 0 008 10V4a1 1 0 00-1-1H5V4h1V3zm9 0a1 1 0 00-1 1v7a3 3 0 01-2 2.83V20a1 1 0 01-2 0v-7.17A3 3 0 0113 10V4a1 1 0 011-1 3 3 0 013 3v4h1V4a1 1 0 00-1-1z"/>
            </svg>
            <span>{dineInLabel}</span>
          </button>

          {/* PARCEL button */}
          <button
            type="button"
            onClick={() => setOrderType(ORDER_TYPE.PARCEL)}
            className={`py-3 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${
              currentOrderType === ORDER_TYPE.PARCEL
                ? "gf-metal-green text-text-inverted shadow-md scale-[1.01]"
                : "text-text-secondary hover:bg-primary/5"
            }`}
          >
            {/* Box / Parcel icon */}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="shrink-0">
              <path d="M20.5 7.28l-8-4.5a1 1 0 00-1 0l-8 4.5A1 1 0 003 8.18v7.64a1 1 0 00.5.86l8 4.5a1 1 0 001 0l8-4.5a1 1 0 00.5-.86V8.18a1 1 0 00-.5-.9zM12 4.82L18.43 8.5 16 9.89 9.57 6.21zm-1 14.36L5 15.54v-5.77l6 3.37zm1-7.23L5.57 8.5 8 7.11l6.43 3.68zM18 15.54l-6 3.64V13.5l6-3.37z"/>
            </svg>
            <span>{t("order.parcel")}</span>
          </button>
        </div>
      </div>}

      {/* ── Select Order banner (desktop only) ──
          It names the table this till is ringing up. A counter has none, so
          there is nothing for it to say. */}
      {seatsPeople && <div className="px-2 pt-2 hidden lg:block">
        <button
          className="w-full flex items-center justify-center gap-2 text-text-inverted text-sm font-semibold
          py-2 rounded-xl gf-metal-green
          shadow-sm hover:opacity-90 active:scale-[0.99] transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 214.539 214.539">
            <g><g>
              <path d="M121.164,154.578h-6.625V89.14h38.937c4.014,0,7.269-3.254,7.269-7.269s-3.254-7.269-7.269-7.269h-92.41 c-4.014,0-7.269,3.254-7.269,7.269s3.254,7.269,7.269,7.269h38.936v65.438h-6.625c-4.014,0-7.269,3.254-7.269,7.27 c0,4.015,3.254,7.269,7.269,7.269h27.787c4.015,0,7.27-3.254,7.27-7.269C128.433,157.832,125.179,154.578,121.164,154.578z" />
              <path d="M73.783,120.777c0-4.014-3.254-7.269-7.269-7.269H54.833H34.219c-11.08,0-13.41-16.14-13.509-16.869l-6.239-45.122 c-0.55-3.977-4.217-6.748-8.196-6.205c-3.976,0.55-6.754,4.219-6.205,8.196l6.229,45.053c0.831,6.47,4.167,16.593,11.367,23.133 l-7.485,38.956c-0.758,3.942,1.824,7.752,5.766,8.509c3.946,0.761,7.752-1.825,8.509-5.766l6.792-35.349h17.579l6.792,35.349 c0.668,3.479,3.714,5.897,7.13,5.897c0.455,0,0.916-0.043,1.379-0.132c3.942-0.757,6.524-4.566,5.766-8.509l-6.265-32.605h2.883 C70.527,128.046,73.783,124.791,73.783,120.777z" />
              <path d="M208.267,45.313c-3.975-0.543-7.646,2.229-8.196,6.205l-6.244,45.165c-0.094,0.687-2.424,16.827-13.504,16.827h-20.614 h-11.681c-4.014,0-7.27,3.254-7.27,7.269s3.255,7.269,7.27,7.269h2.883l-6.265,32.605c-0.758,3.942,1.824,7.752,5.766,8.509 c3.946,0.761,7.752-1.825,8.509-5.766l6.792-35.349h17.579l6.792,35.349c0.668,3.479,3.714,5.897,7.13,5.897 c0.455,0,0.916-0.043,1.38-0.132c3.941-0.757,6.523-4.566,5.766-8.509l-7.485-38.953c7.198-6.534,10.532-16.64,11.357-23.065 l6.238-45.123C215.021,49.533,212.242,45.863,208.267,45.313z" />
            </g></g>
          </svg>
          <span className="truncate">
            {selectedTable?.tableNumber
              ? `Table ${tableLabel(selectedTable.tableNumber)}`
              : t("order.selectOrder")}
          </span>
        </button>
      </div>}

      {/* What has already been ordered on this table, visit by visit. */}
      <OrderRounds kots={openBill?.kots} />

      {/* ══════════════════════ CART ITEMS ══════════════════════ */}
      {/* Cart items will be rendered here */}
      <div className="p-1.5 flex-1 min-h-0 overflow-y-auto">
        {cartData?.length > 0 ? (
          <div className="flex flex-col divide-y divide-border-default/50 rounded-xl border border-border-default/30 shadow-sm">
            {cartData?.map((p, index) => {
              const currentBG =
                expandedProductId === index ? (matchBG += 2) : (matchBG += 1);

              return (
                <div
                  key={p.cartKey || p.id}
                  className={`cart-item-container ${currentBG % 2 === 0 ? "bg-button-background" : "bg-surface"}`}
                >
                  <CartProdctComponent
                    product={p}
                    onJainChange={setJainCount}
                    jainGroup={jainGroupSummary(cartData, p)}
                    isExpanded={expandedProductId === index}
                    onToggle={() => handleToggleExpand(index)}
                    onRemove={() => handleRemoveItem(p)}
                    // onQuantityChange={updateQuantity}
                    onQuantityChange={handleItemUpdate}
                    notifyError={notifyError}
                    matchBG={currentBG}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty cart state */
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary/30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-text-muted">{t("cart.empty")}</p>
            <p className="text-xs text-text-muted/60">{t("cart.emptyHint")}</p>
          </div>
        )}
        <div ref={cartEndRef} />
      </div>

      {/* ══════════════════════ BOTTOM PANEL ══════════════════════ */}
      <div className="sticky bottom-0 bg-surface border-t border-border-default/60 px-3 pt-3 pb-2 shadow-[0_-4px_20px_var(--overlay-black-6)]">

        {/* Cart details like subtotal, tax, total will be shown here */}
        {/* Summary rows.

            A captain never settles a bill, so tax and discount are not theirs
            to read — they only need what the food on this table comes to. The
            split, the discount and the money are the till's business. */}
        <div className="cart-summary flex flex-col gap-1 mb-3">
          <div className="subtotal flex justify-between items-center text-[12px] text-primary/70">
            <span className="font-medium">{mayBill ? t("cart.subtotal") : t("cart.orderValue")}</span>
            <span className="font-semibold text-primary">{cur()}{subtotal.toFixed(2)}</span>
          </div>
          {/* Tax, in as many lines as this country charges it in. India
              halves GST into CGST and SGST; the UAE charges one VAT and a
              bill showing halves of it would not be a valid tax invoice. */}
          {mayBill && (() => {
            const taxed = getGst();
            if (!taxed.enabled) return null;

            const amount = Number(tax) || 0;
            const line = (name, value) => (
              <div key={name} className="subtotal flex justify-between items-center text-[12px] text-primary/70">
                <span className="font-medium">{name}</span>
                <span className="font-semibold text-primary">{cur()}{value.toFixed(2)}</span>
              </div>
            );

            if (!taxed.split) {
              return line(`${taxed.label} ${taxed.percentage}%`, amount);
            }

            // Halve the total rather than taxing twice, so the two lines add
            // up to it exactly with no rounding drift.
            const half = amount / 2;
            return (
              <>
                {line(`CGST ${taxed.cgstPercentage}%`, half)}
                {line(`SGST ${taxed.sgstPercentage}%`, amount - half)}
              </>
            );
          })()}
          {mayBill && (
            <div className="subtotal flex justify-between items-center text-[12px] text-primary/70">
              <span className="font-medium">{t("cart.discount")}</span>
              <span className="font-semibold text-secondary">
                {cur()}{discountAmount}
              </span>
            </div>
          )}
        </div>

        {/* <div className="cart-btns mt-4 flex gap-2"> */}
        {/* Action buttons */}
        {/* Discount and Exchange both end at a bill, which a captain never
            reaches: Exchange opens a settled invoice, and a captain's invoice
            screen only lists the tables still on hold. Leaving them on screen
            left two buttons that went nowhere, so the captain gets the one
            button they do use, at full width. */}
        <div className={`cart-btns grid ${payToProceed ? "hidden" : ""} ${
          !seatsPeople ? "grid-cols-1" : isParcelSale ? "grid-cols-2" : mayBill ? "grid-cols-3" : "grid-cols-2"
        } gap-1.5 mb-3`}>
          {mayBill && <button
            onClick={handleDiscountClick}
            className="pos-key w-full py-2.5 flex flex-col items-center justify-center gap-1 text-text-secondary cursor-pointer hover:text-[var(--theme-primary)]"
          >
            <svg viewBox="64 64 896 896" focusable="false" data-icon="percentage" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M855.7 210.8l-42.4-42.4a8.03 8.03 0 00-11.3 0L168.3 801.9a8.03 8.03 0 000 11.3l42.4 42.4c3.1 3.1 8.2 3.1 11.3 0L855.6 222c3.2-3 3.2-8.1.1-11.2zM304 448c79.4 0 144-64.6 144-144s-64.6-144-144-144-144 64.6-144 144 64.6 144 144 144zm0-216c39.7 0 72 32.3 72 72s-32.3 72-72 72-72-32.3-72-72 32.3-72 72-72zm416 344c-79.4 0-144 64.6-144 144s64.6 144 144 144 144-64.6 144-144-64.6-144-144-144zm0 216c-39.7 0-72-32.3-72-72s32.3-72 72-72 72 32.3 72 72-32.3 72-72 72z" />
            </svg>
            <p className="text-[11px] font-semibold">
              <ShortcutLabel text={t("cart.discount")} char="d" />
            </p>
          </button>}

          {/* Swapping a dish is something done to a table whose order is
              already with the kitchen. A counter has no such table — the sale
              is rung up and gone — so this would sit there greyed out for
              ever, which is worse than not being there. */}
          {seatsPeople && <button
            disabled={!openBillId}
            title={
              openBillId
                ? t("cart.exchangeHint")
                : t("cart.kitchenFirst")
            }
            onClick={async () => {
              // Another till or the captain's tablet may have changed this table
              // since this screen last looked, and the list has to match what
              // the server will accept.
              await fetchHoldOrders();
              setExchangeOpen(true);
            }}
            className={`w-full py-2.5 flex flex-col items-center justify-center gap-1 ${
              openBillId
                ? "pos-key text-text-secondary cursor-pointer hover:text-[var(--theme-primary)]"
                : "rounded-[9px] border border-transparent bg-[var(--primary-alpha-4)] text-text-muted/45 cursor-not-allowed"
            }`}
          >
            <svg viewBox="64 64 896 896" focusable="false" data-icon="swap" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M938 458.8l-29.6-312.6c-1.5-16.2-14.4-29-30.6-30.6L565.2 86h-.4c-3.2 0-5.7 1-7.6 2.9L88.9 557.2a9.96 9.96 0 000 14.1l363.8 363.8c1.9 1.9 4.4 2.9 7.1 2.9s5.2-1 7.1-2.9l468.3-468.3c2-2.1 3-5 2.8-8zM699 387c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64z" />
            </svg>
            <p className="text-[11px] font-semibold">
              <ShortcutLabel text={t("cart.exchange")} char="e" />
            </p>
          </button>}

          {/* A parcel is never held: the next tap is Pay, which sends the
              food and takes the money together. */}
          {!isParcelSale && <button
            onClick={handleHoldClick}
            disabled={placing}
            aria-busy={placing}
            className={`pos-key w-full py-2.5 text-text-secondary flex flex-col items-center justify-center gap-1 ${
              placing
                ? "cursor-wait opacity-70 border-primary/30 text-primary"
                : "cursor-pointer hover:border-primary/30 hover:bg-primary/5 hover:text-primary active:scale-95"
            }`}
          >
            {placing ? (
              <Spinner size={18} label={t("cart.sending")} />
            ) : (
              <svg viewBox="64 64 896 896" focusable="false" data-icon="pause" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M304 176h80v672h-80zm408 0h-64c-4.4 0-8 3.6-8 8v656c0 4.4 3.6 8 8 8h64c4.4 0 8-3.6 8-8V184c0-4.4-3.6-8-8-8z" />
              </svg>
            )}
            <p className="text-[11px] font-semibold">
              {placing ? "Sending…" : <ShortcutLabel text={t("cart.sendToKot")} char="h" />}
            </p>
          </button>}

          {/* What the table actually has, taken from the bill the server
              holds rather than from this till's cart. The two drift apart —
              a cart can still be carrying a dish the kitchen never got, or one
              that another till has already exchanged away — and the cart was
              offering dishes the server then refused as "only 0 to exchange". */}
          <ExchangeItemPopup
            open={exchangeOpen}
            onClose={() => setExchangeOpen(false)}
            cartItems={openBill?.cartData?.orderItems ?? []}
            products={allProducts}
            onExchange={handleExchange}
          />

          {/* popup for hold order and manager discount */}
          <DiscountHoldOrderPopup
            activeModal={activeModal}
            closeModal={() => setActiveModal(null)}
            subtotal={subtotal}
            tax={tax}
            discount={discount}
            total={total}
            setPayToProceed={setPayToProceed}
            fromHoldResume={fromHoldResume}
            customerName={customerName || ""}
            onCustomerReady={() => setPayToProceed(true)}
          />
        </div>

        {/* ── Proceed to Pay ── */}
        <div
          onClick={() =>
            // Always one of the two. A tap that falls into `undefined`
            // leaves the captain pressing a button that answers nothing;
            // the handler below says why it cannot go on instead.
            mayBill ? handleProceed() : handleRequestBill()
          }
          title={
            nothingSentYet
              ? `Not in the kitchen yet: ${describeNotSent(notSentYet)}. Place the order first.`
              : waitingOnKitchen
                ? `Still cooking: ${describeStillCooking(stillCooking)}`
                : isParcelSale
                  ? t("cart.parcelPayHint")
                : mayBill
                  ? t("cart.proceedToPay")
                  : billAlreadyRequested
                    ? t("cart.billAlreadyTold")
                    : canRequestBill
                      ? t("cart.tellTill")
                      : t("cart.openBillFirst")
          }
          className={`
            cart-checkout flex justify-between items-center text-text-inverted px-4 py-3 rounded-xl shadow-md transition-all duration-200
            ${payToProceed ? "hidden" : ""}
            ${nothingSentYet || waitingOnKitchen || (!mayBill && !canRequestBill)
              ? "bg-[var(--bg-medium-gray)] cursor-not-allowed opacity-70"
              /* Deep green with a gold edge, and nothing else on the screen
                 shaped like it. This is the last thing pressed on every sale
                 and a cashier finds it by its colour, not by reading it. */
              /* The gold is an inset hairline rather than a 2px ring round
                 the outside. The ring read as a highlighter drawn on the
                 button; the hairline reads as an edge the button has. */
              : "pos-cta sheen cursor-pointer"
            }
          `}
        >
          <div className="proceed">
            <h3 className="text-sm font-bold leading-tight">
              {/* The captain never takes money — they hand the table over to
                  the till instead. */}
              {isParcelSale
                ? t("cart.paySendKitchen")
                : mayBill
                  ? t("cart.proceedToPay")
                  : billAlreadyRequested
                    ? t("cart.billRequested")
                    : t("cart.proceedToBill")}
            </h3>
            <p className="text-[11px] text-white/70 mt-0.5">
              {nothingSentYet
                ? t("cart.placeFirst")
                : waitingOnKitchen
                  ? `Still cooking: ${describeStillCooking(stillCooking)}`
                  : billAlreadyRequested && !mayBill
                    ? t("cart.waitingCounter")
                    : `${totalItems} ${totalItems === 1 ? "Item" : "Items"}`}
            </p>
          </div>
          <div className="proceed flex gap-2 items-center">
            {/* Same reasoning as the summary above: the captain hands over the
                food's value, the till adds the tax on top of it. */}
            {/* The currency small, the figure large: this is the number the
                guest is about to be asked for, and it is read across the
                counter upside down. */}
            <span className="flex items-baseline gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                {cur().trim()}
              </span>
              <span className="text-[19px] font-extrabold tabular-nums leading-none">
                {(mayBill ? total : subtotal).toFixed(2)}
              </span>
            </span>
            <div className="icon w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
              <svg viewBox="64 64 896 896" focusable="false" data-icon="double-right" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M533.2 492.3L277.9 166.1c-3-3.9-7.7-6.1-12.6-6.1H188c-6.7 0-10.4 7.7-6.3 12.9L447.1 512 181.7 851.1A7.98 7.98 0 00188 864h77.3c4.9 0 9.6-2.3 12.6-6.1l255.3-326.1c9.1-11.7 9.1-27.9 0-39.5zm304 0L581.9 166.1c-3-3.9-7.7-6.1-12.6-6.1H492c-6.7 0-10.4 7.7-6.3 12.9L751.1 512 485.7 851.1A7.98 7.98 0 00492 864h77.3c4.9 0 9.6-2.3 12.6-6.1l255.3-326.1c9.1-11.7 9.1-27.9 0-39.5z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
