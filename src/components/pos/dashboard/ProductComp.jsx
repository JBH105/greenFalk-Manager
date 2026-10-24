import { cur } from "../../../utils/currency";
import React from "react";
import { useCartStore } from "../../../store/useCartStore";
import { useShallow } from "zustand/react/shallow";
import defaultImg from "./../../../assets/images/Default_Product_Img.png";
import { FoodMark } from "./FoodMark";
import { dishName, useMenuLanguage } from "../../../utils/menuLanguage";
import { useT } from "../../../i18n";
import { useState } from "react";
import {
  getCompletedQuantity,
  isEditableCartItem,
} from "../../../utils/cartItemStatus";

/**
 * Plus and minus, drawn rather than typed.
 *
 * As text they never sat in the middle of their keys. A font centres "+"
 * and "−" on its MATH AXIS — a line roughly a third of the way up, where an
 * equals sign goes — not on the middle of the em box. So flex centring put
 * the box in the middle and the ink above it, every time, on every key.
 * Nudging it back by a pixel or two is a fix that holds for one font at one
 * size and fails at the next.
 *
 * A square viewBox with the stroke on its centre line has no such axis. It
 * is in the middle because the middle is where it is drawn, at any size.
 * `block` matters too: an inline SVG sits on the baseline and leaves a
 * descender's worth of space beneath it.
 */
const PlusGlyph = ({ className = "h-[15px] w-[15px]" }) => (
  <svg viewBox="0 0 24 24" className={`block ${className}`} aria-hidden="true">
    <path
      d="M12 5.5v13M5.5 12h13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
  </svg>
);

const MinusGlyph = ({ className = "h-[15px] w-[15px]" }) => (
  <svg viewBox="0 0 24 24" className={`block ${className}`} aria-hidden="true">
    <path
      d="M5.5 12h13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
  </svg>
);

const ProductComp = ({
  id,
  img,
  /**
   * Whether this menu shows photographs at all.
   *
   * Decided once for the whole grid rather than per dish, so the cards in a
   * row are the same shape. See the note where the thumbnail is drawn.
   */
  showPhoto = false,
  name,
  /** The same dish in Arabic, where somebody has typed one. */
  nameAr,
  code,
  foodType,
  jainAvailable,
  price,
  unit,
  stock,
  stockQueue,
  categoryName,
  setCartProducts,
  discount,
  tax,
  mute,
  originalPrice,
  isautoFill,
  isDisabled,
}) => {
  const playBeepSound = () => {
    const audio = new Audio("/sounds/add-to-cart.mp3");
    audio.volume = 1;
    if (!mute) {
      audio.play().catch((error) => {
        console.warn("Error playing sound:", error);
      });
    } else {
      console.warn("Sound is on mute");
    }
  };

  /**
   * Only this dish's own lines in the cart.
   *
   * Watching the whole cart meant every card on the menu re-drew itself
   * whenever anything anywhere in the cart changed — add one Paneer Tikka
   * and forty cards did the work of showing it. On a tablet the number on
   * the card took the better part of a second to catch up with the tap.
   *
   * useShallow compares the lines themselves rather than the list wrapping
   * them, so a change to a different dish leaves this card alone.
   */
  const cartItems = useCartStore(
    useShallow((state) => (state.cartData || []).filter((item) => item.id === id))
  );
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeFromCart = useCartStore((state) => state.removeFromCart);

  const editableCartItem =
    cartItems.find((item) => isEditableCartItem(item)) || null;
  const cartItem = editableCartItem || cartItems[0];
  /* Which name this card writes, and whether a second line goes under it.
     Read from the restaurant's setting rather than passed down, so one
     switch in the owner's screen changes every card at once. */
  const t = useT();
  const shown = dishName(name, nameAr, useMenuLanguage());

  const isAdded = cartItems.length > 0;
  const currentQty = cartItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
  const completedQty = getCompletedQuantity(editableCartItem);
  const minEditableQty = Math.max(1, completedQty);
  const canDecrease =
    !!editableCartItem &&
    (completedQty === 0 ||
      Number(editableCartItem.quantity || 0) > minEditableQty);

  const handleIncreaseFromZero = (e) => {
    e?.stopPropagation();
        addDirectlyToCart(1);
  };

  const handleDecrease = (e) => {
    e?.stopPropagation();
    if (!editableCartItem) return;
    const cartItem = editableCartItem;
    const updateId = cartItem.cartKey || id;
    const editableQty = Number(cartItem.quantity) || 1;
    const minEditableQty = Math.max(1, getCompletedQuantity(cartItem));

    if (editableQty > minEditableQty) {
      updateQuantity(updateId, editableQty - 1);
      playBeepSound();
    } else if (getCompletedQuantity(cartItem) === 0) {
      removeFromCart(id, cartItem.cartKey);
      playBeepSound();
    }
  };

  const handleIncrease = (e) => {
    e?.stopPropagation();
    if (!editableCartItem) {
      handleIncreaseFromZero(e);
      return;
    }
    const cartItem = editableCartItem;
    const updateId = cartItem.cartKey || id;
    const editableQty = Number(cartItem.quantity) || 1;
    updateQuantity(updateId, editableQty + 1);
    playBeepSound();
  };

  const addDirectlyToCart = (quantity = 1) => {
    const result = useCartStore.getState().addToCart({
      id,
      img,
      name,
      /* Carried into the cart so the bill and the kitchen ticket can write
         the dish under the same name the menu did. */
      nameAr,
      foodType,
      jainAvailable,
      price,
      originalPrice,
      discount,
      unit,
      tax,
      stock,
      stockQueue,
      categoryName,
      quantity,
    });

    if (result?.success === false) {
      playBeepSound();
      return;
    }

    playBeepSound();
  };

  const handleImageError = (e) => {
    e.target.src = defaultImg;
  };

  /**
   * The unit, when it is worth printing.
   *
   * A restaurant sells everything by the piece, so "/PCS" appeared under
   * every price on the menu and distinguished nothing — forty identical
   * lines of grey under forty different numbers. A shot of spirit or a kilo
   * of sweets is a different matter, and still says so.
   */
  const unitWord = unit === "ml" && isautoFill ? "SHOT" : (unit || "").toUpperCase();
  const notablyPricedBy = ["", "PCS", "PC", "PIECE", "NOS", "UNIT"].includes(unitWord)
    ? null
    : unitWord;

  return (
    <>
      {/**
       * The dish, as a card.
       *
       * Read top to bottom rather than left to right: the mark and the name
       * first, what it costs and how many underneath. The old card put the
       * name and the price on one line and ran out of room — a dish called
       * "Paneer Tikka Masala (Half)" was truncated to make space for a
       * stepper, and the one thing a card has to do is say which dish it is.
       *
       * Going quiet rather than going away when it is unavailable: the cook
       * turned it off for the day, and a cashier looking for it should find
       * it crossed out rather than wonder whether they have misremembered
       * the menu.
       */}
      <div
        onClick={(!isAdded && !isDisabled) ? handleIncreaseFromZero : undefined}
        /* No minimum height. It had one, and a dish with a short name and no
           Jain line left a visible hole in the middle of its own card — the
           price was pinned to a floor that nothing reached. The cards in a
           row stretch to match each other instead, so a row is tidy and a
           row of short names is simply shorter. */
        className={`pos-card group relative overflow-hidden w-full h-full flex flex-col ${
          isDisabled
            ? "opacity-55 grayscale pointer-events-none select-none"
            : isAdded
              ? "pos-card-selected cursor-default"
              : "cursor-pointer"
          }`}
      >
        {/**
         * The card, in two columns.
         *
         * The dish on the left, what it costs and how many on the right —
         * which is how a printed menu is laid out and how a hand works: read
         * down the left to find the thing, reach to the right to take it.
         *
         * It used to run top to bottom, with the name across the whole width
         * and the price and stepper on a row beneath. That made every card a
         * line taller than it needed to be and left a hole in the middle of
         * any card whose name was short.
         *
         * Three type sizes on the card and no more: the name, the price, and
         * everything else. It had five, which is what made it look unfinished
         * however good the colours were.
         */}
        <div className="flex flex-1 items-stretch gap-2.5 px-3 py-2.5 overflow-hidden">

          {/**
           * ── THE PHOTOGRAPH ──
           *
           * Shown on every card in the menu or on none of them, never on
           * some. `showPhoto` is decided once for the whole grid: most of a
           * menu is typed in without pictures, and a column of cards where
           * three have a thumbnail and nine have a gap looks like a fault
           * rather than a choice. So until one dish has a photograph the
           * cards keep the shape they have always had, and from the moment
           * one does, they all make room.
           *
           * A dish with no picture gets its own mark on a tinted square
           * instead of an empty hole — quiet, and still says what the dish
           * is at a glance.
           */}
          {showPhoto && (
            <div className="relative h-11 w-11 shrink-0 self-center overflow-hidden rounded-lg border border-[var(--primary-alpha-8)] bg-[var(--primary-alpha-4)]">
              {img ? (
                <img
                  src={img}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                  /* A dish whose picture has gone — moved bucket, bad link —
                     falls back to the tinted square rather than showing the
                     browser's broken-image glyph on the menu. */
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center opacity-45">
                  <FoodMark type={foodType} size={16} />
                </span>
              )}
            </div>
          )}

          {/* ── THE DISH ── */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            <h2
              className="text-[13px] font-semibold leading-[1.35] text-text-primary line-clamp-2 text-left"
              title={shown.secondary ? `${shown.primary} — ${shown.secondary}` : shown.primary}
              dir={shown.primaryIsArabic ? "rtl" : undefined}
            >
              {/* The mark is part of the line, not a box beside it: the
                  text's own baseline does the aligning, at any size and in
                  any weight. */}
              <span className="mr-1.5 inline-block align-text-bottom">
                <FoodMark type={foodType} size={13} />
              </span>
              <span className={shown.primaryIsArabic ? "font-arabic" : undefined}>
                {shown.primary}
              </span>
            </h2>

            {/**
             * The Arabic name, under the English one.
             *
             * Only in BOTH, and only where a dish actually has one — a menu
             * is translated over weeks, and a card that reserved a line for
             * every untranslated dish would leave a hole on most of them.
             * Smaller and quieter, because the cashier is reading the line
             * above and the guest is reading the bill.
             */}
            {shown.secondary && (
              <p
                dir="rtl"
                className="font-arabic -mt-1 truncate text-left text-[11px] leading-[1.4] text-text-muted"
                title={shown.secondary}
              >
                {shown.secondary}
              </p>
            )}

            {(jainAvailable || code) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {jainAvailable && (
                  <span className="pos-chip pos-chip-green">{t("menu.jainOnRequest")}</span>
                )}
                {/* A code nobody can see is a code nobody learns, and then
                    nobody types it either. */}
                {code ? (
                  <span
                    className="text-[10px] font-bold tabular-nums tracking-wide text-text-muted/70"
                    title={`Code ${code}`}
                  >
                    #{code}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* ── WHAT IT COSTS, AND HOW MANY ── */}
          <div className="flex shrink-0 flex-col items-end justify-between gap-2">
            <div className="flex flex-col items-end gap-0.5 leading-none">
              {price !== originalPrice && (
                <span className="text-[9px] font-semibold text-text-muted line-through leading-none">
                  {cur()}{parseFloat(originalPrice).toFixed(2)}
                </span>
              )}

              {/* The currency small and tucked in front: down a menu of forty
                  dishes it is the same characters forty times, and the number
                  is the only part anybody compares. */}
              <span className="flex items-baseline gap-[3px] leading-none">
                <span className="text-[9px] font-bold text-text-muted/75">
                  {cur().trim()}
                </span>
                <span
                  className={`pos-money text-[14px] ${
                    price === originalPrice
                      ? "text-[var(--theme-primary)]"
                      : "text-secondary"
                  }`}
                >
                  {parseFloat(price).toFixed(2)}
                </span>
              </span>

              {/* Only where it is worth saying. Every dish in a restaurant is
                  sold by the piece, so "/PCS" under forty prices told nobody
                  anything. A 30ml shot or a kilo of sweets still gets told. */}
              {notablyPricedBy ? (
                <span className="text-[9px] font-bold uppercase tracking-wide text-text-muted/65">
                  /{notablyPricedBy}
                </span>
              ) : null}
            </div>

            {/* QUANTITY CONTROLS — one track rather than three keys. Narrower
                than three separate shapes, and it reads as a single control
                instead of two buttons that happen to sit near each other, so
                the price stays the loudest thing on the card. */}
            <div
              className="tap-stepper pos-stepper h-[30px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                disabled={!canDecrease}
                onClick={canDecrease ? handleDecrease : undefined}
                aria-label={t("menu.oneLess")}
                className="pos-stepper-minus h-full w-[28px] cursor-pointer"
              >
                <MinusGlyph className="h-[13px] w-[13px]" />
              </button>

              <span
                className={`pos-stepper-count w-[22px] text-[13px] ${
                  isAdded ? "text-[var(--theme-primary)]" : "text-text-muted/55"
                }`}
              >
                {currentQty}
              </span>

              <button
                onClick={isAdded ? handleIncrease : handleIncreaseFromZero}
                aria-label={t("menu.oneMore")}
                className="pos-stepper-plus h-full w-[28px] cursor-pointer"
              >
                <PlusGlyph className="h-[13px] w-[13px]" />
              </button>
            </div>

            {/* 🔴 LOW STOCK BADGE OR UNAVAILABLE BADGE */}
            {/* The outlet's own switch for the day. Nothing to do with a
                count: a kitchen turns a dish off when it cannot cook it. */}
            {isDisabled && (
              <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/40 z-30">
                <span className="bg-red-600 text-white text-[11px] font-bold px-3 py-1 rounded shadow-lg transform -rotate-12 uppercase tracking-wider">
                  {t("menu.unavailableToday")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * Whether this card is showing the same dish as before.
 *
 * Written out rather than left to the default comparison because the menu
 * builds a fresh `extraCartFields` object for every card on every render,
 * which would make the default comparison say "different" every time. Its
 * two values are the `originalPrice` and `discount` already compared here,
 * so its identity means nothing. `setCartProducts` is not used at all.
 */
const sameDish = (before, after) =>
  before.id === after.id &&
  before.name === after.name &&
  before.nameAr === after.nameAr &&
  before.img === after.img &&
  /* Without this the first dish to get a photograph would make room on its
     own card and on no other: every other card is memoised and would never
     hear that the menu now shows pictures. */
  before.showPhoto === after.showPhoto &&
  before.price === after.price &&
  before.originalPrice === after.originalPrice &&
  before.discount === after.discount &&
  before.unit === after.unit &&
  before.stock === after.stock &&
  before.stockQueue === after.stockQueue &&
  before.categoryName === after.categoryName &&
  before.foodType === after.foodType &&
  before.jainAvailable === after.jainAvailable &&
  before.tax === after.tax &&
  before.mute === after.mute &&
  before.isautoFill === after.isautoFill &&
  before.isDisabled === after.isDisabled;

export default React.memo(ProductComp, sameDish);

