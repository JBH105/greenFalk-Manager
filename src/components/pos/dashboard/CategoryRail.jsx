import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { dishName, useMenuLanguage } from "../../../utils/menuLanguage";
import { useCategoryStore } from "../../../store/useCategoryStore";
import { useProductStore } from "../../../store/useProductStore";

/** The name the Favourites section answers to, everywhere it is checked. */
export const FAVOURITES = "Favourites";

/**
 * One category on the menu.
 *
 * The chip has two shapes and one behaviour. Across a row it is as wide as its
 * own name — every category used to be given the same 180px box, so "Breads"
 * carried as much empty space as "Rice & Biryani". Down the side it is as wide
 * as the rail, with the name at one end and the count at the other, because a
 * column of ragged-width pills reads as a mess where a row of them reads as a
 * set of choices.
 *
 * The chosen one is filled solid rather than tinted: at a till the cashier has
 * to see which category they are in from arm's length, not hunt for a
 * one-pixel border. The count rides along because the first thing anyone asks
 * of a category is whether there is anything in it.
 */
const CategoryChip = ({ category, count, isActive, onSelect, starred = false }) => {
  const ref = useRef(null);

  // The first category is chosen for you, and on a long menu the active one
  // can sit off the edge — pull it back into view, whichever way it scrolls.
  useEffect(() => {
    if (isActive) {
      ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [isActive]);

  const shown = dishName(category.category_name, category.category_name_ar, useMenuLanguage());

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      title={category.category_name}
      className={`flex shrink-0 items-center gap-2 h-10 rounded-full text-sm font-semibold
        whitespace-nowrap cursor-pointer select-none outline-none
        transition-[background-color,border-color,box-shadow,transform] duration-200
        focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-35)]
        lg:w-full lg:justify-start
        ${count > 0 ? "pl-4 pr-2" : "px-4"}
        ${isActive
          /* Polished emerald with a gold hairline inside it — the same
             treatment as the pay button and the rail, so the three things
             that say "you are here" all say it the same way. */
          ? "pos-cta sheen border-0 !rounded-full text-white"
          /* The rest are a quiet white card.
             They were made fully transparent for a while — no surface, no
             border, a word floating on the ivory — and the column stopped
             looking like a column: it read as a wide empty margin between
             the rail and the dishes, with some words adrift in it. A list
             needs a shape to be a list. So the resting state is back to a
             surface, only a far quieter one than the outlined white boxes
             it started as. */
          : "bg-white/70 text-text-secondary border border-[var(--primary-alpha-8)] hover:bg-white hover:border-[var(--primary-alpha-20)] hover:text-[var(--theme-primary)]"
        }`}
    >
      {starred && (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="shrink-0">
          <path d="M12 2l2.9 6.26 6.6.72-4.9 4.55 1.35 6.47L12 16.7 6.05 20l1.35-6.47L2.5 8.98l6.6-.72L12 2z" />
        </svg>
      )}

      {/* Down the side a long name is cut rather than allowed to widen the
          rail; the title attribute above still gives it in full. */}
      {/* The section in Arabic under its English name, where there is one.
          Same rule as a dish: a section nobody has translated keeps the name
          it has, rather than leaving a gap down the column. */}
      <span className="flex min-w-0 flex-col lg:truncate">
        <span className="lg:truncate">{shown.primary}</span>
        {shown.secondary && (
          <span dir="rtl" className="font-arabic text-[10px] font-semibold leading-[1.3] opacity-70 lg:truncate">
            {shown.secondary}
          </span>
        )}
      </span>

      {count > 0 && (
        <span
          className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold
            leading-[22px] text-center shrink-0 lg:ml-auto
            ${isActive
              ? "bg-[var(--overlay-white-22)] text-white"
              : "text-text-muted/70"
            }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};

/** Scroll arrow, shown only on the side that still has something to reach. */
const StripArrow = ({ side, onClick }) => (
  <div
    className={`absolute inset-y-0 z-10 flex w-14 items-center pointer-events-none
      ${side === "left"
        ? "left-0 justify-start bg-gradient-to-r"
        : "right-0 justify-end bg-gradient-to-l"
      } from-background via-background to-transparent`}
  >
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? t("menu.previousCategories") : t("menu.moreCategories")}
      className="tap-target pointer-events-auto w-8 h-8 rounded-full bg-surface border border-[var(--primary-alpha-15)]
        shadow-[0_2px_8px_var(--primary-alpha-15)] text-[var(--theme-primary)]
        flex items-center justify-center cursor-pointer transition-all duration-200
        hover:bg-[var(--theme-primary)] hover:text-white hover:border-transparent"
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={side === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
      </svg>
    </button>
  </div>
);

/**
 * The menu's categories.
 *
 * They used to run across the top, above the search box, which cost the menu
 * a band of height on every screen and gave a long list nowhere to go but
 * sideways behind two arrows. Down the left they have a whole column to use:
 * a till with fifteen sections shows most of them at once, and the one in
 * hand stays put while the dishes beside it change.
 *
 * On a phone there is no column to spare — 160px of a 390px screen is most of
 * a dish — so below `lg` it stays the scrolling row it always was. A tablet sits in that
 * band: it already gives 45% of itself to the cart, and a rail on top of
 * that would leave the dishes a single cramped column.
 *
 * A plain scroll rather than a carousel: on the tablet a captain carries, a
 * native scroll is what the thumb already expects, and at a till with a mouse
 * the arrows do what dragging a carousel never made obvious.
 */
const CategoryRail = ({ filters, setFilters, favouriteCount = 0 }) => {
  const scroller = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const { hydrate: hydrateCategories, categories, hydrated: isCategoryHydrated } = useCategoryStore();

  useEffect(() => {
    hydrateCategories();
  }, [categories, isCategoryHydrated]);

  // Already in the order the owner set — the server sorts by sequence_number.
  const sortedCategories = categories || [];

  // How many products sit behind each chip. Counted off the same list the grid
  // filters, so the number on the chip and the rows beside it always agree.
  const products = useProductStore((s) => s.products);
  const counts = useMemo(() => {
    const tally = {};
    for (const product of products || []) {
      const key = product.categoryName?.toLowerCase();
      if (!key) continue;
      tally[key] = (tally[key] || 0) + 1;
    }
    return tally;
  }, [products]);

  // The arrows belong to the row. A column scrolls under the thumb and the
  // wheel without being asked, so measuring it would only light two arrows
  // that do nothing.
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const sideways = el.scrollWidth > el.clientWidth;
    setEdges({
      left: sideways && el.scrollLeft > 4,
      right: sideways && el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, sortedCategories.length]);

  const nudge = (direction) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(220, el.clientWidth * 0.7),
      behavior: "smooth",
    });
  };

  const choose = (name) => setFilters((prev) => ({ ...prev, category: name }));

  // Nothing to stand on. The strip hid itself the same way; the rail has to
  // give its width back as well, or the menu sits in a narrower column for
  // the sake of an empty box.
  if (!sortedCategories.length) return null;

  return (
    <div
      /* Narrower, and no rule down its edge. The column is told apart from
         the dishes by its own cards now, and a border as well made three
         vertical lines within eighty pixels of each other — the rail, the
         border, and the first card's edge. */
      className="relative w-full min-w-0 shrink-0
        lg:w-[158px] xl:w-[172px] lg:h-full lg:pr-1"
    >
      {edges.left && <StripArrow side="left" onClick={() => nudge(-1)} />}
      {edges.right && <StripArrow side="right" onClick={() => nudge(1)} />}

      <div
        ref={scroller}
        onScroll={measure}
        className="no-scrollbar flex items-center gap-2.5 overflow-x-auto py-1
          lg:flex-col lg:items-stretch lg:gap-2 lg:overflow-x-hidden lg:overflow-y-auto
          lg:h-full lg:py-2 lg:pr-1"
      >
        {/* What this outlet sells all day, at the front. It only appears when
            the owner has marked something — an empty section is a dead end. */}
        {favouriteCount > 0 && (
          <CategoryChip
            key="__favourites"
            category={{ id: "__favourites", category_name: FAVOURITES }}
            count={favouriteCount}
            starred
            isActive={(filters.category || "").toLowerCase() === FAVOURITES.toLowerCase()}
            onSelect={() => choose(FAVOURITES)}
          />
        )}

        {sortedCategories.map((cat) => (
          <CategoryChip
            key={cat.id}
            category={cat}
            count={counts[cat.category_name?.toLowerCase()] || 0}
            isActive={
              (filters.category || "").toLowerCase() ===
              (cat.category_name || "").toLowerCase()
            }
            onSelect={() => choose(cat.category_name)}
          />
        ))}
      </div>
    </div>
  );
};

export default CategoryRail;
