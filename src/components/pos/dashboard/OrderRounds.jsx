import { useState } from "react";
import { useT } from "../../../i18n";

/**
 * The rounds already ordered on this table.
 *
 * A captain walks up to a table several times through a meal, and each visit is
 * its own KOT. Once the rounds are folded into one bill it stops being obvious
 * what was ordered when — which matters when a guest queries the bill later.
 * This lists each visit with its time and what was taken on it.
 */

const timeOf = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const itemLine = (item) =>
  `${item.product_name || item.name || "Item"} ×${item.quantity ?? item.qty ?? 1}`;

const OrderRounds = ({ kots }) => {
  const t = useT();

  // Nothing worth showing until there is more than one visit.
  const rounds = Array.isArray(kots) ? kots : [];
  const [open, setOpen] = useState(false);

  if (rounds.length < 1) return null;

  const sorted = [...rounds].sort(
    (a, b) => (a.kot_number || 0) - (b.kot_number || 0)
  );

  return (
    <div className="mx-1.5 mt-1.5 rounded-xl border border-[var(--primary-alpha-12)] bg-[var(--primary-alpha-4)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
        title={t("order.visitHistory")}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-bold text-primary">
            {t("order.history")}
          </span>
          <span className="text-[10px] font-semibold text-text-inverted bg-[var(--theme-primary)] rounded-full px-1.5 py-[1px]">
            {sorted.length} {sorted.length === 1 ? "round" : "rounds"}
          </span>
        </span>
        <span className={`text-primary text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="px-3 pb-2.5 flex flex-col gap-2">
          {sorted.map((round) => (
            <div
              key={round.id || round.kot_number}
              className="rounded-lg bg-surface border border-border-default/50 px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-primary">
                  Round {round.kot_number || 1}
                </span>
                <span className="text-[10px] text-text-muted font-mono-jet">
                  {timeOf(round.createdAt)}
                </span>
              </div>
              <p className="text-[10.5px] text-text-secondary leading-snug mt-0.5">
                {(round.items || []).length
                  ? (round.items || []).map(itemLine).join(", ")
                  : "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderRounds;
