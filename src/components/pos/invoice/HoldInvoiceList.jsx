import { useEffect, useState } from "react";
import { useT } from "../../../i18n";
import { cur } from "../../../utils/currency";
import { tableLabel, waitingLabel, waitingLevel } from "../../../utils/kitchen";
import SearchBar from "../../searchBar/SearchBar";

const HoldInvoiceList = ({
 orders, selectedHoldOrder, setSelectedHoldOrder, searchTerm, setSearchTerm, role }) => {
  const t = useT();
    //   const { dateAsPerTimezone } = useDate();
    // The kitchen needs to see how long a ticket has been waiting, so re-render
    // once a minute. Only the chef view shows the timer, so only it ticks.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (role !== "chef") return undefined;
        const id = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(id);
    }, [role]);

    // The order they arrive in is the order they are shown in.
    //
    // This list used to re-sort everything newest-first, which quietly undid
    // the ordering each screen had chosen: Bill Requests hands them over
    // longest-wait-first, because that is the person standing at the counter,
    // and it was being flipped to newest-first on the way in. The screen that
    // built the list is the one that knows what order it wants.
    const sortedOrders = orders;

    return (
        <div className="px-1 flex flex-col h-full min-h-0">

            <div className="px-1 pb-2">
                <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder={t("invoice.searchHold")}
                    resultCount={sortedOrders.length}
                />
            </div>

            {sortedOrders.length === 0 ? (
                <p className="text-center text-text-muted py-2 bg-surface mx-2 mt-2">
                    {t("invoice.noDetails")}
                </p>
            ) : (
                <ul className="py-0.5 p-1 flex-grow overflow-y-auto no-scrollbar min-h-0 text-secondary">
                    {sortedOrders.map((order) => {
                        const isActive = order?.localId === selectedHoldOrder?.localId;
                        const isParcel = order?.cartData?.orderType === 'PARCEL';
                        const tableNum = order?.cartData?.table?.tableNumber || order?.cartData?.table?.name || order?.cartData?.table?.table_number;

                        return (
                            <li
                                key={order?.orderId}
                                onClick={() => setSelectedHoldOrder(order)}
                                /* On a phone the three columns fought for room and the
                                   name and time came out ragged. Below `sm` the card
                                   wraps: name and amount on the first line, the
                                   Dine-in/Table badges on their own line underneath. */
                                className={`flex flex-wrap sm:flex-nowrap justify-between items-center gap-y-2 gap-x-3 mb-2 px-3 py-2 rounded-lg cursor-pointer relative bg-surface shadow-[0_0_3px_var(--shadow-soft-hex-alt)] transition-all duration-300 ${isActive ? "bg-gradient-to-r from-primary/5 via-[var(--theme-secondary)]/5 to-white border border-primary shadow-sm" : "border border-white hover:border-primary/20"}`}
                            >
                                {/* LEFT: ICON & CUSTOMER / TIME */}
                                <div className="order-1 sm:order-none flex items-center gap-3 py-1 flex-1 min-w-0">
                                    <span
                                        className={`${isActive ? "text-primary bg-primary/10" : "text-primary/70 bg-primary/5"} p-2 rounded-xl transition-colors shrink-0`}
                                        title={isParcel ? t("parcel.one") : t("order.dineIn")}
                                    >
                                        {role === 'chef' ? (
                                            isParcel ? (
                                                /* BOX / PARCEL icon (Large 26px) */
                                                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                                                    <path d="M20.5 7.28l-8-4.5a1 1 0 00-1 0l-8 4.5A1 1 0 003 8.18v7.64a1 1 0 00.5.86l8 4.5a1 1 0 001 0l8-4.5a1 1 0 00.5-.86V8.18a1 1 0 00-.5-.9zM12 4.82L18.43 8.5 16 9.89 9.57 6.21zm-1 14.36L5 15.54v-5.77l6 3.37zm1-7.23L5.57 8.5 8 7.11l6.43 3.68zM18 15.54l-6 3.64V13.5l6-3.37z"/>
                                                </svg>
                                            ) : (
                                                /* FORK & KNIFE / DINE-IN icon (Large 26px) */
                                                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                                                    <path d="M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.29v8.05zM1 21.99V21h15.03v.99c0 .55-.45 1-1.01 1H2.01c-.56 0-1.01-.45-1.01-1zm15.03-7c0-8-15.03-8-15.03 0h15.03zM1.02 17h15v2h-15z"/>
                                                </svg>
                                            )
                                        ) : (
                                            /* RIGHT ARROW SVG for non-chef */
                                            <svg viewBox="64 64 896 896" width="1.25rem" height="1.25rem" fill="currentColor">
                                                <path d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.4 12.9 6.3l450.8-352.1a31.96 31.96 0 000-50.4z" />
                                            </svg>
                                        )}
                                    </span>

                                    <div className="min-w-0">
                                        <h3 className="text-sm sm:text-base font-semibold flex items-center min-w-0 gap-1.5">
                                            {/* The label wrapped onto three lines on a phone and squeezed
                                                the name down to a single letter — "Nilesh" showed as "N".
                                                It is dropped on small screens, where the name alone is
                                                obviously the customer, and never allowed to wrap.

                                                It now waits for a wide screen rather than any screen over
                                                `sm`. On a sideways tablet it cost about a hundred pixels,
                                                and a dine-in row — which carries a Dine-in badge AND a
                                                Table badge — had nothing left: "Jaydeep Bhayani" came out
                                                as "Ja...". Without the label the name fits whole, and the
                                                label comes back on a screen with room for both. */}
                                            <span className="hidden xl:inline shrink-0 whitespace-nowrap text-[10px] sm:text-xs font-semibold text-text-muted/80 tracking-wider">
                                                {t("customer.nameLabel")}:
                                            </span>

                                            <span
                                                className={`truncate min-w-0 transition-all duration-200 ${
                                                    isActive
                                                        ? "text-primary bg-clip-text font-bold"
                                                        : "text-text-secondary font-semibold"
                                                }`}
                                                title={order?.note || "Unnamed"}
                                            >
                                                {order?.note || "Unnamed"}
                                            </span>
                                        </h3>

                                        {/* Time row */}
                                        <p className="text-xs sm:text-sm text-text-muted flex flex-wrap items-center gap-1 whitespace-nowrap">
                                            <span className="anticon anticon-field-time shrink-0">
                                                <svg
                                                    viewBox="64 64 896 896"
                                                    focusable="false"
                                                    data-icon="field-time"
                                                    width="1em"
                                                    height="1em"
                                                    fill="currentColor"
                                                    aria-hidden="true"
                                                >
                                                    <defs>
                                                        <style></style>
                                                    </defs>
                                                    <path d="M945 412H689c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h256c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zM811 548H689c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h122c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zM477.3 322.5H434c-6.2 0-11.2 5-11.2 11.2v248c0 3.6 1.7 6.9 4.6 9l148.9 108.6c5 3.6 12 2.6 15.6-2.4l25.7-35.1v-.1c3.6-5 2.5-12-2.5-15.6l-126.7-91.6V333.7c.1-6.2-5-11.2-11.1-11.2z"></path>
                                                    <path d="M804.8 673.9H747c-5.6 0-10.9 2.9-13.9 7.7a321 321 0 01-44.5 55.7 317.17 317.17 0 01-101.3 68.3c-39.3 16.6-81 25-124 25-43.1 0-84.8-8.4-124-25-37.9-16-72-39-101.3-68.3s-52.3-63.4-68.3-101.3c-16.6-39.2-25-80.9-25-124 0-43.1 8.4-84.7 25-124 16-37.9 39-72 68.3-101.3 29.3-29.3 63.4-52.3 101.3-68.3 39.2-16.6 81-25 124-25 43.1 0 84.8 8.4 124 25 37.9 16 72 39 101.3 68.3a321 321 0 0144.5 55.7c3 4.8 8.3 7.7 13.9 7.7h57.8c6.9 0 11.3-7.2 8.2-13.3-65.2-129.7-197.4-214-345-215.7-216.1-2.7-395.6 174.2-396 390.1C71.6 727.5 246.9 903 463.2 903c149.5 0 283.9-84.6 349.8-215.8a9.18 9.18 0 00-8.2-13.3z"></path>
                                                </svg>
                                            </span>
                                            <span>
                                                {order?.timestamp
                                                    ? new Date(order.timestamp).toLocaleString("en-US", {
                                                        month: "short",
                                                        day: "2-digit",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                        hour12: true,
                                                    })
                                                        .replace("at", "")
                                                    : "-"}
                                            </span>
                                            {role === 'chef' && waitingLabel(order?.timestamp, now) && (
                                                <span
                                                    className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide ${
                                                        waitingLevel(order?.timestamp, now) === 'late'
                                                            ? 'bg-red-100 text-red-700 border border-red-300'
                                                            : waitingLevel(order?.timestamp, now) === 'warn'
                                                                ? 'bg-[var(--secondary-alpha-13)] text-[var(--theme-secondary-dark)] border border-[var(--secondary-alpha-35)]'
                                                                : 'bg-[var(--primary-alpha-8)] text-[var(--theme-primary)] border border-[var(--primary-alpha-25)]'
                                                    }`}
                                                    title={t("invoice.sinceKitchen")}
                                                >
                                                    {waitingLabel(order?.timestamp, now)}
                                                </span>
                                            )}
                                        </p>

                                        {/* The phone number, when there is one. The name is
                                            already on the line above. */}
                                        {role !== 'chef' &&
                                          (order?.cartData?.customer?.phoneNumber ||
                                            order?.cartData?.customer?.phone) && (
                                        <p className="text-xs sm:text-sm text-text-muted flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                            <span className="anticon anticon-user">
                                                {/* USER SVG */}
                                                <svg
                                                    viewBox="64 64 896 896"
                                                    focusable="false"
                                                    data-icon="user"
                                                    width="1em"
                                                    height="1em"
                                                    fill="currentColor"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M858.5 763.6a374 374 0 00-80.6-119.5 375.63 375.63 0 00-119.5-80.6c-.4-.2-.8-.3-1.2-.5C719.5 518 760 444.7 760 362c0-137-111-248-248-248S264 225 264 362c0 82.7 40.5 156 102.8 201.1-.4.2-.8.3-1.2.5-44.8 18.9-85 46-119.5 80.6a375.63 375.63 0 00-80.6 119.5A371.7 371.7 0 00136 901.8a8 8 0 008 8.2h60c4.4 0 7.9-3.5 8-7.8 2-77.2 33-149.5 87.8-204.3 56.7-56.7 132-87.9 212.2-87.9s155.5 31.2 212.2 87.9C779 752.7 810 825 812 902.2c.1 4.4 3.6 7.8 8 7.8h60a8 8 0 008-8.2c-1-47.8-10.9-94.3-29.5-138.2zM512 534c-45.9 0-89.1-17.9-121.6-50.4S340 407.9 340 362c0-45.9 17.9-89.1 50.4-121.6S466.1 190 512 190s89.1 17.9 121.6 50.4S684 316.1 684 362c0 45.9-17.9 89.1-50.4 121.6S557.9 534 512 534z"></path>
                                                </svg>
                                            </span>
                                            <span>
                                                <svg
                                                    viewBox="64 64 896 896"
                                                    focusable="false"
                                                    data-icon="phone"
                                                    width="1em"
                                                    height="1em"
                                                    fill="currentColor"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M877.1 238.7L770.6 132.3c-13-13-30.4-20.3-48.8-20.3s-35.8 7.2-48.8 20.3L558.3 246.8c-13 13-20.3 30.5-20.3 48.9 0 18.5 7.2 35.8 20.3 48.9l89.6 89.7a405.46 405.46 0 01-86.4 127.3c-36.7 36.9-79.6 66-127.2 86.6l-89.6-89.7c-13-13-20.3-30.4-20.3a68.2 68.2 0 00-48.8 20.3L132.3 673c-13 13-20.3 30.5-20.3 48.9 0 18.5 7.2 35.8 20.3 48.9l106.4 106.4c22.2 22.2 52.8 34.9 84.2 34.9 6.5 0 12.8-.5 19.2-1.6 132.4-21.8 263.8-92.3 369.9-198.3C818 606 888.4 474.6 910.4 342.1c6.3-37.6-6.3-76.3-33.3-103.4zm-37.6 91.5c-19.5 117.9-82.9 235.5-178.4 331s-213 158.9-330.9 178.4c-14.8 2.5-30-2.5-40.8-13.2L184.9 721.9 295.7 611l119.8 120 .9.9 21.6-8a481.29 481.29 0 00285.7-285.8l8-21.6-120.8-120.7 110.8-110.9 104.5 104.5c10.8 10.8 15.8 26 13.3 40.8z"></path>
                                                </svg>
                                            </span>
                                            <span>
                                                {/* The held order carries this as phoneNumber; reading
                                                    "phone" left every row showing a phone icon with
                                                    nothing beside it. */}
                                                {order?.cartData?.customer?.phoneNumber ||
                                                  order?.cartData?.customer?.phone ||
                                                  ""}
                                            </span>
                                        </p>
                                        )}
                                    </div>
                                </div>

                                {/* CENTER: ORDER TYPE STATUS & TABLE NUMBER (LARGE SIZE) */}
                                {/* Tight on purpose: on an upright tablet these two badges
                                    and the name are within a few pixels of each other, and
                                    those pixels are the difference between the last letter
                                    of a name and an ellipsis. */}
                                <div className="order-3 sm:order-none w-full sm:w-auto flex items-center justify-start sm:justify-center gap-1.5 sm:px-1 shrink-0">
                                    <span
                                        className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold px-3 py-1.5 rounded-xl border shadow-xs ${
                                            isParcel
                                                ? 'bg-[var(--secondary-alpha-13)] text-[var(--theme-secondary-dark)] border-[var(--secondary-alpha-35)]'
                                                : 'bg-[var(--primary-alpha-8)] text-[var(--theme-primary)] border-[var(--primary-alpha-25)]'
                                        }`}
                                    >
                                        {isParcel ? (
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20.5 7.28l-8-4.5a1 1 0 00-1 0l-8 4.5A1 1 0 003 8.18v7.64a1 1 0 00.5.86l8 4.5a1 1 0 001 0l8-4.5a1 1 0 00.5-.86V8.18a1 1 0 00-.5-.9zM12 4.82L18.43 8.5 16 9.89 9.57 6.21zm-1 14.36L5 15.54v-5.77l6 3.37zm1-7.23L5.57 8.5 8 7.11l6.43 3.68zM18 15.54l-6 3.64V13.5l6-3.37z"/></svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.29v8.05zM1 21.99V21h15.03v.99c0 .55-.45 1-1.01 1H2.01c-.56 0-1.01-.45-1.01-1zm15.03-7c0-8-15.03-8-15.03 0h15.03zM1.02 17h15v2h-15z"/></svg>
                                        )}
                                        {isParcel ? t("parcel.one") : t("order.dineIn")}
                                    </span>

                                    {/* Which round of the bill this is — the kitchen
                                        works round by round, so #2 on a table that
                                        already has #1 is the new food. */}
                                    {role === 'chef' && order?.kotNumber > 1 && (
                                        <span className="inline-flex items-center text-xs sm:text-sm font-extrabold px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-dark-muted)] border border-[var(--border-default)] shadow-xs">
                                            KOT #{order.kotNumber}
                                        </span>
                                    )}

                                    {/* Table badge if tableNum exists */}
                                    {tableNum && (
                                        <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold px-3 py-1.5 rounded-xl bg-[var(--primary-alpha-8)] text-[var(--theme-primary)] border border-[var(--primary-alpha-25)] shadow-xs">
                                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                                                <path d="M3 11h18v2H3zm2 4h2v4H5zm12 0h2v4h-2zM7 5h10v2H7z" />
                                            </svg>
                                            Table {tableLabel(tableNum).replace(/^T/, "")}
                                        </span>
                                    )}
                                </div>

                                {/* RIGHT: PRICE / ITEM COUNT */}
                                <div className="order-2 sm:order-none text-right shrink-0">
                                    {role !== 'chef' && (
                                        <h3 className={`text-sm sm:text-base font-bold ${isActive ? "bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" : "text-primary"}`}>
                                            {cur()}{parseFloat(order?.cartData?.subtotal || 0).toFixed(2)}
                                        </h3>
                                    )}
                                    <small
                                        className={`text-text-muted ${
                                            role === 'chef' ? "text-sm sm:text-base font-bold text-primary" : "text-xs"
                                        }`}
                                    >
                                        {order?.cartData?.orderItems?.length || 0} Items
                                    </small>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default HoldInvoiceList;
