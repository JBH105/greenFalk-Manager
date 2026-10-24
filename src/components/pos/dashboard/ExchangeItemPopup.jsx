import { useMemo, useState } from "react";
import { useT } from "../../../i18n";
import { createPortal } from "react-dom";
import { cur } from "../../../utils/currency";

/* ─── Icons ──────────────────────────────────────────────────────────── */
const Svg = ({ size, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
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
const IcoSwap = ({ s = 16 }) => <Svg size={s}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></Svg>;
const IcoX = ({ s = 14 }) => <Svg size={s}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>;
const IcoSearch = ({ s = 13 }) => <Svg size={s}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Svg>;
const IcoArrow = ({ s = 13 }) => <Svg size={s}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Svg>;

/** The reasons a dish actually goes back, so nobody has to type them. */
const REASONS = [
  { value: "Not good", key: "exchange.reasonNotGood" },
  { value: "Served cold", key: "exchange.reasonCold" },
  { value: "Too spicy", key: "exchange.reasonSpicy" },
  { value: "Wrong item served", key: "exchange.reasonWrong" },
  { value: "Guest changed their mind", key: "exchange.reasonChanged" },
];

/** The menu list calls it sellingPrice; the cart calls it price. */
const priceOf = (p) => Number(p?.sellingPrice ?? p?.price ?? 0);

const Step = ({ n, children }) => (
  <div className="text-[9.5px] font-extrabold text-[var(--primary-alpha-42)] uppercase tracking-[0.09em] mb-1.5">
    {n} · {children}
  </div>
);

/**
 * Swapping a dish at a table that is still eating.
 *
 * This is when an exchange really happens — the guest says something is wrong
 * with a dish while they are still sitting there, long before a bill exists.
 * The dish goes back, another is cooked in its place, and the reason is kept
 * so the owner can see what is going wrong in the kitchen.
 *
 * The two lists sit side by side rather than stacked. A till is a wide, short
 * screen: stacked, a table with five dishes on it pushed the menu and the
 * button below the fold, and the whole dialog had to be scrolled to finish the
 * job. Each list scrolls inside its own box instead, so the dialog stays put.
 */
const ExchangeItemPopup = ({ open, onClose, cartItems = [], products = [], onExchange }) => {
  const t = useT();

  const [oldItem, setOldItem] = useState(null);
  const [newProduct, setNewProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onTable = useMemo(() => {
    const tally = new Map();
    for (const item of cartItems) {
      const id = item.id || item.serverId || item.product_id;
      if (!id) continue;
      const seen = tally.get(id);
      if (seen) seen.quantity += Number(item.quantity) || 0;
      else
        tally.set(id, {
          id,
          name: item.name || item.product_name || "Item",
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 0,
        });
    }
    return [...tally.values()].filter((i) => i.quantity > 0);
  }, [cartItems]);

  const choices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => (p.serverId || p.id) !== oldItem?.id)
      .filter((p) => !q || (p.name || "").toLowerCase().includes(q))
      .slice(0, 60);
  }, [products, search, oldItem]);

  if (!open) return null;

  const difference =
    oldItem && newProduct ? (priceOf(newProduct) - Number(oldItem.price)) * qty : 0;

  const ready = oldItem && newProduct && qty > 0 && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      await onExchange({
        old_product_id: oldItem.id,
        new_product_id: newProduct.serverId || newProduct.id,
        quantity: qty,
        reason: reason.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || t("exchange.failed"));
    } finally {
      setBusy(false);
    }
  };

  const rowBase =
    "flex items-center justify-between gap-3 px-3 h-10 rounded-lg border text-left cursor-pointer transition-all shrink-0";

  // Rendered onto the body rather than where it sits in the cart. A fixed
  // element is still trapped inside an ancestor that makes its own stacking
  // context, and the menu behind this one was painting straight through the
  // dialog because of one such ancestor.
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3"
      style={{ background: "var(--primary-darker-alpha-45)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[740px] max-h-[94vh] flex flex-col rounded-[18px] bg-white overflow-hidden border-[1.5px] border-[var(--primary-alpha-12)]"
        style={{ boxShadow: "0 28px 70px var(--primary-darker-alpha-22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--primary-alpha-12)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white flex-shrink-0"
              style={{
                background: "linear-gradient(145deg,var(--theme-secondary),var(--theme-secondary-dark))",
                boxShadow: "0 4px 14px var(--secondary-alpha-38)",
              }}
            >
              <IcoSwap s={16} />
            </div>
            <div>
              <div className="text-[15px] font-extrabold text-[var(--theme-primary-darker)] tracking-[-0.02em] leading-tight">
                {t("exchange.title")}
              </div>
              <div className="text-[10px] text-[var(--primary-alpha-42)] font-medium">
                {t("exchange.explain")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="w-[28px] h-[28px] rounded-lg border-[1.5px] border-[var(--primary-alpha-12)] bg-[var(--theme-primary-palest)] text-[var(--primary-alpha-42)] flex items-center justify-center cursor-pointer transition-all hover:bg-[var(--theme-secondary-ghost)] hover:border-[var(--secondary-alpha-25)] hover:text-[var(--theme-secondary)]"
          >
            <IcoX s={14} />
          </button>
        </div>

        {onTable.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-[var(--primary-alpha-42)]">
            {t("exchange.nothingYet")}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scroll px-4 py-3">
            {/* Two columns on anything wider than a phone: a till is wide and short. */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* ── going back ── */}
              <div className="flex flex-col min-h-0">
                <Step n={1}>{t("exchange.whichDish")}</Step>
                <div
                  className="flex flex-col gap-1.5 overflow-y-auto custom-scroll pr-1"
                  style={{ maxHeight: 186 }}
                  data-role="table-items"
                >
                  {onTable.map((item) => {
                    const picked = oldItem?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setOldItem(item);
                          setQty(1);
                        }}
                        className={`${rowBase} ${
                          picked
                            ? "border-[var(--theme-secondary)] bg-[var(--secondary-alpha-6)]"
                            : "border-[var(--primary-alpha-12)] bg-white hover:border-[var(--primary-alpha-30)]"
                        }`}
                      >
                        <span className="text-[12.5px] font-bold text-[var(--theme-primary-darker)] truncate">
                          {item.name}
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--primary-alpha-62)] whitespace-nowrap">
                          {cur()}{item.price.toFixed(2)} × {item.quantity}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {oldItem && oldItem.quantity > 1 && (
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span className="text-[9.5px] font-extrabold text-[var(--primary-alpha-42)] uppercase tracking-[0.09em]">
                      {t("exchange.howMany")}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Array.from({ length: oldItem.quantity }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setQty(i + 1)}
                          className={`w-8 h-7 rounded-md border-[1.5px] text-[12px] font-bold cursor-pointer transition-all ${
                            qty === i + 1
                              ? "border-transparent gf-metal-green"
                              : "border-[var(--primary-alpha-12)] bg-white text-[var(--theme-primary)] hover:border-[var(--primary-alpha-30)]"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── coming instead ── */}
              <div className="flex flex-col min-h-0">
                <Step n={2}>{t("exchange.whatInstead")}</Step>
                <div className="relative mb-1.5">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--primary-alpha-42)] pointer-events-none flex">
                    <IcoSearch s={13} />
                  </span>
                  <input
                    className="w-full h-8 pl-8 pr-3 rounded-lg border-[1.5px] border-[var(--primary-alpha-12)] bg-[var(--primary-alpha-4)] text-[12px] text-[var(--theme-primary-darker)] outline-none transition-all placeholder:text-[var(--primary-alpha-42)] focus:border-[var(--theme-primary)]"
                    placeholder={t("menu.search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div
                  className="flex flex-col gap-1.5 overflow-y-auto custom-scroll pr-1"
                  style={{ maxHeight: 148 }}
                  data-role="menu-choices"
                >
                  {choices.length === 0 ? (
                    <div className="py-4 text-center text-[11px] text-[var(--primary-alpha-42)]">
                      {t("exchange.noMatch")}
                    </div>
                  ) : (
                    choices.map((p) => {
                      const id = p.serverId || p.id;
                      const picked = (newProduct?.serverId || newProduct?.id) === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setNewProduct(p)}
                          className={`${rowBase} ${
                            picked
                              ? "border-[var(--theme-primary)] bg-[var(--primary-alpha-6)]"
                              : "border-[var(--primary-alpha-12)] bg-white hover:border-[var(--primary-alpha-30)]"
                          }`}
                        >
                          <span className="text-[12px] font-semibold text-[var(--theme-primary-darker)] truncate">
                            {p.name}
                          </span>
                          <span className="text-[11px] font-semibold text-[var(--primary-alpha-62)] whitespace-nowrap">
                            {cur()}{priceOf(p).toFixed(2)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ── why ── */}
            <div className="mt-4">
              <Step n={3}>{t("exchange.why")}</Step>
              <input
                className="w-full h-8 px-3 rounded-lg border-[1.5px] border-[var(--primary-alpha-12)] bg-[var(--primary-alpha-4)] text-[12px] text-[var(--theme-primary-darker)] outline-none transition-all placeholder:text-[var(--primary-alpha-42)] focus:border-[var(--theme-primary)] mb-1.5"
                placeholder={t("discount.ownerWillSee")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className={`px-2.5 h-6 rounded-full text-[10.5px] font-semibold border cursor-pointer transition-all ${
                      reason === r.value
                        ? "border-transparent gf-metal-green"
                        : "border-[var(--primary-alpha-15)] bg-white text-[var(--primary-alpha-62)] hover:border-[var(--primary-alpha-30)]"
                    }`}
                  >
                    {t(r.key)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {onTable.length > 0 && (
          <div className="border-t border-[var(--primary-alpha-12)] px-4 py-2.5 flex flex-col gap-1.5 shrink-0">
            {oldItem && newProduct && (
              <div className="flex items-center justify-center gap-2 text-[11.5px] font-semibold text-[var(--theme-primary-darker)] flex-wrap">
                <span className="text-[var(--theme-secondary)]">{oldItem.name} × {qty}</span>
                <IcoArrow s={13} />
                <span className="text-[var(--theme-primary)]">{newProduct.name} × {qty}</span>
                <span className="text-[var(--primary-alpha-62)]">
                  {difference === 0
                    ? `· ${t("exchange.samePrice")}`
                    : difference > 0
                      ? `· ${t("exchange.moreOnBill", {
                          amount: `${cur()}${difference.toFixed(2)}`,
                        })}`
                      : `· ${t("exchange.offBill", {
                          amount: `${cur()}${Math.abs(difference).toFixed(2)}`,
                        })}`}
                </span>
              </div>
            )}

            {error && (
              <div className="text-[11px] font-semibold text-[var(--theme-secondary)] text-center">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={!ready}
              onClick={submit}
              className={`w-full h-10 rounded-xl text-[13px] font-bold tracking-[0.02em] transition-all ${
                ready
                  ? "cursor-pointer text-white gf-metal-green hover:opacity-95 active:scale-[0.99]"
                  : "cursor-not-allowed bg-[var(--primary-alpha-8)] text-[var(--primary-alpha-30)]"
              }`}
            >
              {busy ? "Exchanging…" : t("exchange.thisItem")}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ExchangeItemPopup;
