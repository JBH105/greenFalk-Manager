import { cur } from "../../../utils/currency";
import { useT } from "../../../i18n";
import { useEffect, useState, useRef, useMemo } from "react";
import { useCartStore, ORDER_TYPE, hasSelectedTable } from "../../../store/useCartStore";
import { usePaymentMethodStore } from "../../../store/usePaymentMethodStore";
import { useRetail } from "../../../hooks/useRetail";
import { useOutletStore } from "../../../store/useOutletStore";
import { useHoldOrderStore } from "../../../store/useHoldOrderStore";
import { dishesStillCooking, describeStillCooking } from "../../../utils/cartItemStatus";
import { useFeatures } from "../../../hooks/useFeatures";
import { useNotification } from "../../../hooks/useNotification";
import { discountAmountOf } from "../../../utils/discount";

/**
 * Settling a bill.
 *
 * The cashier is doing this with a queue in front of them, so the screen is
 * built around the three things that matter at that moment: how much is due,
 * how it is being paid, and Pay. Everything else stays out of the way.
 */
export const Payment = ({ setPayToProceed, total, onPay, tax, discount, subtotal, cartProducts, orderId }) => {
  const t = useT();

    const { paymentMethods, ensureLoaded, loading: loadingMethods } = usePaymentMethodStore();
    const [isPaying, setIsPaying] = useState(false);
    const { hydrate: hydrateOutlet, hydrated: hydratedOutlet } = useOutletStore.getState();
    const removeHoldOrder = useHoldOrderStore((state) => state.removeHoldOrder);

    useEffect(() => {
        // Not `hydrate`: that one gives up after the boot attempt, which happens
        // before login and is refused, leaving this screen with no methods.
        ensureLoaded();
        if (!hydratedOutlet) {
            hydrateOutlet();
        }
    }, []);

    const [splits, setSplits] = useState([
        { id: Date.now(), amount: "", methodId: "", methodName: "" }
    ]);

    const { isRetail, setIsRetail, isRetailOpen, setIsRetailOpen } = useRetail();
    const features = useFeatures();
    const { notifyError } = useNotification();
    const inputRef = useRef(null);

    /**
     * The exact amount is put in for the cashier, once, when the screen opens.
     *
     * Almost every bill is settled for exactly what it says, so making the
     * cashier type it — or hunt for Exact — was a step on every single sale.
     * Now the screen opens ready to take payment: one tap on Pay.
     *
     * It is only ever done once. A cashier who clears the box, taps a note or
     * splits the bill is not fought with; `filledIn` says the figure in the
     * box is ours, so the first key they press replaces it rather than being
     * appended to it — otherwise tapping 5 on 283.50 would read 283.505.
     */
    const prefilled = useRef(false);
    const [filledIn, setFilledIn] = useState(false);

    /**
     * Whether this screen is worked with a finger rather than a keyboard.
     *
     * This screen carries its own number pad, so the phone's keyboard is not
     * wanted — and it does real harm: the amount box takes focus as the
     * screen opens, the keyboard slides up over the keypad and the Pay
     * button, and the cashier is typing on the wrong set of numbers.
     *
     * Only suppressed where there is something to suppress. A till with a
     * real keyboard still types the amount straight in, which is faster than
     * hunting for the digits with a mouse.
     */
    const fingerOnly = useMemo(
        () =>
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(pointer: coarse) and (hover: none)").matches,
        []
    );

    const totalTendered = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

    // A bill cannot be closed while the kitchen is still cooking for the table.
    // The server refuses it too; this is so the cashier is told before they
    // take the guest's money rather than after.
    const stillCooking = dishesStillCooking(cartProducts);
    const waitingOnKitchen = stillCooking.length > 0;

    const isPayDisabled = totalTendered < total || waitingOnKitchen;

    useEffect(() => {
        // Only run if we have methods and the first split hasn't been assigned a method yet
        if (paymentMethods.length > 0 && splits[0].methodId === "") {
            const defaultMethod = paymentMethods[0];

            setSplits(prev => {
                const newSplits = [...prev];
                newSplits[0] = {
                    ...newSplits[0],
                    methodId: defaultMethod.id,
                    methodName: defaultMethod.display_name || defaultMethod.payment_method_name || "Cash"
                };
                return newSplits;
            });
        }
    }, [paymentMethods]);

    const [payLeft, setPayLeft] = useState(total);
    const [change, setChange] = useState("0.00");
    const { selectedTable, selectedCustomer, orderType } = useCartStore();
    // Off the food, not off the food plus the tax — the same sum the cart and
    // the bill do, so the three agree on one screen's worth of figures.
    const discountAmount = discountAmountOf(subtotal, discount);

    // Helper to update a specific row
    const updateSplit = (id, field, value) => {
        setSplits(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    // The row being typed into is always the last one.
    const activeSplit = splits[splits.length - 1];
    const earlierSplits = splits.slice(0, -1);

    /**
     * What to offer as one-tap amounts.
     *
     * These used to be the exact total rounded up to the rupee, the ten and the
     * hundred — which on a round bill like 400 produced four identical buttons.
     * Now it is the exact amount followed by the notes a guest would actually
     * hand over, with duplicates dropped.
     */
    const quickAmounts = useMemo(() => {
        const due = Math.max(0, Number(total) || 0);
        const exact = Math.round(due * 100) / 100;

        const candidates = [
            exact,
            Math.ceil(due),
            Math.ceil(due / 10) * 10,
            Math.ceil(due / 50) * 50,
            Math.ceil(due / 100) * 100,
            100, 200, 500, 1000, 2000,
        ];

        const seen = new Set();
        const list = [];
        for (const raw of candidates) {
            const value = Math.round(raw * 100) / 100;
            if (value < exact || seen.has(value)) continue;
            seen.add(value);
            list.push(value);
            if (list.length === 4) break;
        }
        return list;
    }, [total]);

    const handleNumpadClick = (val) => {
        const lastRow = splits[splits.length - 1];
        // The figure in the box was put there rather than typed, so the first
        // key starts a fresh number instead of running on the end of it.
        let prev = filledIn ? "" : lastRow.amount;
        if (filledIn) setFilledIn(false);
        let newValue = prev;

        if (val === "." && prev.includes(".")) return;
        if (val === "." && prev === "") newValue = "0.";
        else newValue = prev + val;

        updateSplit(lastRow.id, "amount", newValue);
    };

    const handleBoxClick = (val) => {
        setFilledIn(false);
        updateSplit(splits[splits.length - 1].id, "amount", val.toString());
    };

    const pickMethod = (pm) => {
        updateSplit(activeSplit.id, "methodId", pm.id);
        updateSplit(
            activeSplit.id,
            "methodName",
            pm.display_name || pm.payment_method_name || ""
        );
    };

    useEffect(() => {
        if (prefilled.current) return;

        const due = Math.round((Number(total) || 0) * 100) / 100;
        if (due <= 0) return;

        prefilled.current = true;
        setFilledIn(true);
        updateSplit(splits[0].id, "amount", due.toFixed(2));
    }, [total]);

    useEffect(() => {
        // On a phone this would only summon the keyboard. The first press on
        // the keypad replaces the filled-in figure either way — that is what
        // filledIn is for — so nothing is lost by leaving the box alone.
        if (fingerOnly) return undefined;

        const timer = setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                // Selected, so a cashier taking a larger note just types over it.
                inputRef.current.select?.();
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [fingerOnly]);

    useEffect(() => {
        if (totalTendered === 0) {
            setPayLeft(total);
            setChange("0.00");
        } else if (totalTendered < total) {
            setPayLeft((total - totalTendered).toFixed(2));
            setChange("0.00");
        } else {
            setPayLeft(0.00);
            setChange((totalTendered - total).toFixed(2));
        }
        // Not on a phone. This runs on every keypad press, and each one would
        // have called the keyboard back up over the keys the cashier is using.
        if (!fingerOnly && inputRef.current) inputRef.current.focus();
    }, [totalTendered, total, splits, fingerOnly]);

    const handleClear = () => {
        setFilledIn(false);
        updateSplit(splits[splits.length - 1].id, "amount", "");
    };

    const handleBackspace = () => {
        setFilledIn(false);
        const lastRow = splits[splits.length - 1];
        const newValue = String(lastRow.amount).slice(0, -1);
        updateSplit(lastRow.id, "amount", newValue);
    };

    const handlePay = async () => {
        if (isPaying || isPayDisabled) return;
        /**
         * A dine-in bill belongs to a table, and is refused without one.
         *
         * Only where there are tables. A counter sells the same kind of order
         * to someone standing at it — nothing to seat, nothing to come back
         * to — and this turned the Pay button into a button that did nothing
         * at all, silently, with the money already counted out.
         *
         * And it says so now. Refusing without a word is how a cashier comes
         * to believe the till is broken.
         */
        if (
            features.table_service_enabled &&
            (orderType === ORDER_TYPE.PARCEL ? ORDER_TYPE.PARCEL : ORDER_TYPE.DINE_IN) ===
                ORDER_TYPE.DINE_IN &&
            !hasSelectedTable(selectedTable)
        ) {
            notifyError(t("pay.pickTableFirst"));
            return;
        }
        /**
         * What each method actually keeps.
         *
         * The cashier keys in the note the guest handed over — ₹500 against a
         * ₹210 bill — because that is how change is worked out. But the ₹290
         * goes straight back across the counter: it was never takings. Sending
         * the keyed figure as the payment put the change into the day's cash
         * and into the owner's books.
         *
         * So each method is credited with what it covers of the bill, in the
         * order it was entered, and the last one is trimmed to the remainder.
         * A split typed exactly — ₹100 cash, ₹110 card on ₹210 — is unchanged.
         */
        let leftToCover = Math.round((Number(total) || 0) * 100) / 100;
        const paymentsToRecord = splits.map((s) => {
            const keyed = parseFloat(s.amount) || 0;
            const applied = Math.max(0, Math.min(keyed, leftToCover));
            leftToCover = Math.round((leftToCover - applied) * 100) / 100;

            return {
                paymentMethodId: s.methodId,
                paymentMethodName: s.methodName,
                payment_tax_amount: tax,
                amount: Math.round(applied * 100) / 100,
            };
        });

        const finalOrderData = {
            customerData: { ...selectedCustomer },
            tableData: { ...selectedTable },
            order_type: orderType || ORDER_TYPE.DINE_IN,
            date: Date.now(),
            orderItems: [...cartProducts],
            subtotal: subtotal,
            discount: discount,
            tenderedAmount: totalTendered,
            cashReturned: parseFloat(change) || 0,
            paymentMethods: paymentsToRecord
        };

        try {
            setIsPaying(true);
            await onPay(finalOrderData);
            await removeHoldOrder(orderId);
        } catch (err) {
            console.error(err);
        } finally {
            setIsPaying(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (!isPayDisabled && !isPaying) {
                handlePay();
            }
        }
    };

    const HandleGoBack = () => {
        setPayToProceed(false);
        if (isRetail || isRetailOpen) {
            setIsRetail(true);
            setIsRetailOpen(true);
        }
    };

    const addSplit = () => {
        const remaining = Math.max(0, total - totalTendered);
        const defaultMethod = paymentMethods[0];
        // The rest of the bill is put into the new row the same way, so the
        // first key typed there replaces it rather than running on the end.
        setFilledIn(remaining > 0);
        setSplits([...splits, {
            id: Date.now(),
            amount: remaining > 0 ? remaining.toFixed(2) : "",
            methodId: defaultMethod?.id || "",
            methodName: defaultMethod?.display_name || defaultMethod?.payment_method_name || ""
        }]);
    };

    const settled = totalTendered >= total && total > 0;

    /**
     * One key of the numpad.
     *
     * Raised rather than outlined. A grid of twelve thin-bordered white
     * rectangles is a table of empty cells; the same twelve with a hairline
     * and a little lift are keys, and a cashier's hand knows the difference
     * before they have read any of them. The digits are set in tabular
     * figures so the whole pad stays on its grid.
     */
    const key =
        "pos-key flex items-center justify-center text-[19px] font-bold tabular-nums " +
        "select-none cursor-pointer";

    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden">

            {/* ── Top bar: back, what is due, and where the payment stands ── */}
            <div className="flex items-stretch gap-3 px-4 pt-3 pb-2 shrink-0">
                {/* Fixed height, not stretched: once the money row beside it is
                    allowed to wrap, stretching turned this into a tall blank
                    column. It matches the row on one line, and sits neatly at
                    the top when the row takes two. */}
                <button
                    onClick={HandleGoBack}
                    title={t("pay.backToOrder")}
                    className="w-12 h-16 self-start shrink-0 rounded-xl bg-surface border border-border-default text-text-secondary flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                </button>

                {/* Wrapping, not breakpoints.

                    How much room this row has depends on the panel it sits in,
                    not on the size of the screen: on a tablet the cart keeps
                    half the width, so a screen-width rule would call it roomy
                    and still push Change off the edge — which is exactly what
                    it did. Letting it wrap fixes it at every width there is. */}
                <div className="flex-1 min-w-0 rounded-xl bg-surface border border-border-default px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{t("pay.totalDue")}</p>
                        <p className="text-2xl sm:text-3xl font-extrabold text-primary leading-tight whitespace-nowrap">
                            {cur()}{parseFloat(total).toFixed(2)}
                        </p>
                    </div>

                    {discount > 0 && (
                        <div className="text-right shrink-0">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{t("pay.discount")}</p>
                            <p className="text-lg font-bold text-success leading-tight whitespace-nowrap">
                                -{cur()}{parseFloat(discountAmount).toFixed(2)}
                            </p>
                        </div>
                    )}

                    <div className="text-right shrink-0">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{t("pay.tendered")}</p>
                        <p className="text-lg font-bold text-text-secondary leading-tight whitespace-nowrap">
                            {cur()}{totalTendered.toFixed(2)}
                        </p>
                    </div>

                    {/* One status box rather than two: before the money is enough
                        it counts down what is left, after it shows the change. */}
                    <div
                        className={`text-right rounded-lg px-3 py-1.5 shrink-0 ml-auto min-w-[108px] sm:min-w-[130px] ${
                            settled
                                ? "bg-success/10 border border-success/30"
                                : "bg-[var(--error-default)]/10 border border-[var(--error-default)]/25"
                        }`}
                    >
                        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                            {settled ? t("pay.change") : t("pay.payLeft")}
                        </p>
                        <p className={`text-xl sm:text-2xl font-extrabold leading-tight whitespace-nowrap ${settled ? "text-success" : "text-[var(--error-default)]"}`}>
                            {cur()}{Number(settled ? change : payLeft || 0).toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 min-h-0 px-4 pb-3 flex flex-col gap-2.5 overflow-y-auto no-scrollbar">

                {/* Payment method — one tap, no dropdown to open */}
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1.5 px-0.5">
                        {t("pay.method")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {paymentMethods.length === 0 && (
                            loadingMethods ? (
                                <span className="text-xs text-text-muted py-2">{t("pay.loadingMethods")}</span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={ensureLoaded}
                                    className="px-4 py-2.5 rounded-xl border border-[var(--error-default)]/40 bg-[var(--error-default)]/10 text-[var(--error-default)] text-xs font-bold"
                                >
                                    No payment methods loaded — tap to retry
                                </button>
                            )
                        )}
                        {paymentMethods.map((pm) => {
                            const label = pm.display_name || pm.payment_method_name;
                            const isOn = activeSplit?.methodId === pm.id;
                            return (
                                <button
                                    key={pm.id}
                                    type="button"
                                    onClick={() => pickMethod(pm)}
                                    className={`px-5 py-2.5 rounded-xl font-bold text-sm border transition-all duration-150 active:scale-[0.97] ${
                                        isOn
                                            ? "gf-metal-green text-text-inverted border-transparent shadow-[0_4px_12px_var(--overlay-black-20)]"
                                            : "bg-surface text-text-secondary border-border-default hover:border-primary hover:text-primary"
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Anything already put down on another method */}
                {earlierSplits.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        {earlierSplits.map((s) => (
                            <div
                                key={s.id}
                                className="flex items-center justify-between rounded-lg bg-surface border border-border-default px-3 py-2"
                            >
                                <span className="text-xs font-bold text-text-secondary">{s.methodName || "—"}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-primary">
                                        {cur()}{(parseFloat(s.amount) || 0).toFixed(2)}
                                    </span>
                                    <button
                                        onClick={() => setSplits(splits.filter((x) => x.id !== s.id))}
                                        title={t("pay.removePayment")}
                                        className="text-[var(--error-default)] hover:opacity-70"
                                    >
                                        <svg viewBox="64 64 896 896" width="14" height="14" fill="currentColor" aria-hidden="true">
                                            <path d="M360 184h-8c4.4 0 8-3.6 8-8v8h304v-8c0 4.4 3.6 8 8 8h-8v72h72v-80c0-35.3-28.7-64-64-64H352c-35.3 0-64 28.7-64 64v80h72v-72zm504 72H160c-17.7 0-32 14.3-32 32v32c0 4.4 3.6 8 8 8h60.4l24.7 523c1.6 34.1 29.8 61 63.9 61h454c34.2 0 62.3-26.8 63.9-61l24.7-523H888c4.4 0 8-3.6 8-8v-32c0-17.7-14.3-32-32-32zM731.3 840H292.7l-24.2-512h487l-24.2 512z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Amount being taken now */}
                <div>
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                            Amount Received{activeSplit?.methodName ? ` · ${activeSplit.methodName}` : ""}
                        </p>
                        <button
                            onClick={addSplit}
                            className="text-[11px] font-bold text-primary hover:underline"
                            title={t("pay.splitHint")}
                        >
                            + {t("pay.split")}
                        </button>
                    </div>
                    {/* Both inputMode and readOnly, on purpose: inputMode is the
                        polite way to ask for no keyboard, and readOnly is the one
                        every phone has always honoured. The keypad writes to state
                        rather than through the box, so readOnly costs nothing. */}
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode={fingerOnly ? "none" : "decimal"}
                        readOnly={fingerOnly}
                        value={activeSplit?.amount ?? ""}
                        placeholder="0.00"
                        onKeyDown={handleKeyDown}
                        onFocus={(e) => { if (filledIn) e.target.select(); }}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                setFilledIn(false);
                                updateSplit(activeSplit.id, "amount", val);
                            }
                        }}
                        className="w-full h-[58px] rounded-xl border-2 border-border-default bg-surface px-4 text-3xl font-extrabold text-primary outline-none focus:border-primary transition-colors"
                    />
                </div>

                {/* One-tap amounts the guest is likely to hand over */}
                <div className="grid grid-cols-4 gap-2">
                    {quickAmounts.map((amount) => (
                        <button
                            key={amount}
                            onClick={() => handleBoxClick(amount)}
                            /* The notes a guest actually hands over. Gold-edged
                               on hover, because this is a shortcut rather than
                               a digit and should not look like one. */
                            className="pos-key py-3 font-bold text-sm tabular-nums text-text-secondary hover:border-[var(--theme-secondary)] hover:text-[var(--theme-secondary-dark)]"
                        >
                            {cur()}{Number.isInteger(amount) ? amount : amount.toFixed(2)}
                        </button>
                    ))}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-4 gap-2 flex-1 min-h-[210px]">
                    {["1", "2", "3"].map((n) => (
                        <div key={n} onClick={() => handleNumpadClick(n)} className={key}>{n}</div>
                    ))}
                    <div onClick={handleClear} className={key + " text-sm"}>{t("pay.clear")}</div>

                    {["4", "5", "6"].map((n) => (
                        <div key={n} onClick={() => handleNumpadClick(n)} className={key}>{n}</div>
                    ))}
                    <div onClick={handleBackspace} className={key} title={t("common.backspace")}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                    </div>

                    {["7", "8", "9"].map((n) => (
                        <div key={n} onClick={() => handleNumpadClick(n)} className={key}>{n}</div>
                    ))}
                    <div onClick={HandleGoBack} className={key + " text-sm"}>{t("common.cancel")}</div>

                    <div onClick={() => handleNumpadClick("0")} className={key}>0</div>
                    <div onClick={() => handleNumpadClick("00")} className={key}>00</div>
                    <div onClick={() => handleNumpadClick(".")} className={key}>.</div>
                    <div
                        onClick={() => handleBoxClick(parseFloat(total).toFixed(2))}
                        className={key + " text-xs leading-tight text-center px-1"}
                        title={t("pay.exactAmount")}
                    >
                        {t("pay.exact")}
                    </div>
                </div>

                {/* The one action this screen exists for */}
                <button
                    onClick={!isPayDisabled && !isPaying ? handlePay : undefined}
                    disabled={isPayDisabled || isPaying}
                    className={`w-full h-[64px] flex items-center justify-between px-5 text-text-inverted font-extrabold transition-all duration-200 shrink-0 ${
                        isPayDisabled || isPaying
                            ? "rounded-[13px] bg-[var(--bg-medium-gray)] opacity-70 cursor-not-allowed"
                            : "pos-cta sheen cursor-pointer"
                    }`}
                >
                    <span className="text-[17px] tracking-tight">
                        {isPaying
                            ? "Paying…"
                            : isPayDisabled
                                ? `${cur()}${Number(payLeft || 0).toFixed(2)} more to collect`
                                : "Pay"}
                    </span>
                    <span className="flex items-baseline gap-1">
                        <span className="text-[12px] font-bold uppercase tracking-wide text-white/60">
                            {cur().trim()}
                        </span>
                        <span className="pos-money text-[22px]">
                            {totalTendered.toFixed(2)}
                        </span>
                    </span>
                </button>
            </div>
        </div>
    );
}
