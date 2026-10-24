import React from "react";
import { useT } from "../../../i18n";
import { foodMark, JAIN_COLOUR } from "../../../utils/foodType";

/**
 * The square-with-a-dot every menu in India carries.
 *
 * Drawn rather than written so it reads at a glance and at arm's length —
 * a chef looking at a ticket across the pass, a cashier scanning a list of
 * forty dishes. The label is still there for a screen reader and for anyone
 * hovering.
 */
export const FoodMark = ({ type, size = 14, title }) => {
  const mark = foodMark(type);

  return (
    <span
      title={title || mark.label}
      aria-label={mark.label}
      className="inline-flex shrink-0 items-center justify-center rounded-[3px] border-[1.5px] bg-white"
      style={{ width: size, height: size, borderColor: mark.colour }}
    >
      <span
        className="rounded-full"
        style={{
          width: Math.round(size * 0.5),
          height: Math.round(size * 0.5),
          backgroundColor: mark.colour,
        }}
      />
    </span>
  );
};

/**
 * That this plate is being made Jain.
 *
 * A word, not a symbol: there is no mark anyone already knows for it, and the
 * kitchen must not have to guess. It is deliberately loud — a Jain order
 * cooked with onion is a plate thrown away and a guest who will not eat.
 */
export const JainTag = ({ size = "normal" }) => (
  <span
    className={
      "inline-flex shrink-0 items-center rounded font-black uppercase tracking-wide text-white " +
      (size === "big" ? "px-2 py-[3px] text-[12px]" : "px-1.5 py-[1px] text-[10px]")
    }
    style={{ backgroundColor: JAIN_COLOUR }}
    title={t("cart.jainExplain")}
  >
    {t("cart.jain")}
  </span>
);

export default FoodMark;
