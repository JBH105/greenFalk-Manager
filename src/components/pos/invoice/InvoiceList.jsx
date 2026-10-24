import { cur } from "../../../utils/currency";
import { useT } from "../../../i18n";
import { useEffect } from "react";
import SearchBar from "../../searchBar/SearchBar";
import { useAuthStore } from "../../../store/useAuthStore";
import { useCustomerStore } from "../../../store/useCustomerStore";

const invoiceList = ({
 orders, selectedOrder, setSelectedOrder, setSearchTerm, searchTerm }) => {
  const t = useT();
    const user = useAuthStore((u) => u.user);
    const { customers, hydrate, hydrated } = useCustomerStore();
    // Helper to get a consistent ID from an order object
    const getOrderId = (o) => o?.orderId;

    // Helper to sort orders by date (Newest first)
    const sortOrders = (data) => {
        return [...data].sort((a, b) => {
            const dateA = new Date(a.orderDate || a.createdAt || 0).getTime();
            const dateB = new Date(b.orderDate || b.createdAt || 0).getTime();
            return dateB - dateA;
        });
    };

    useEffect(() => {
        setSelectedOrder(null);
    }, [orders.length]);

    useEffect(() => {
        hydrate();
    }, [hydrated]);

    useEffect(() => {
        if (orders.length === 0) {
            setSelectedOrder(null);
            return;
        }
        const currentSelectedId = getOrderId(selectedOrder);
        const isSelectedOrderValid = selectedOrder && orders.some(o => getOrderId(o) === currentSelectedId);

        // If nothing is selected OR the selection is no longer in the list
        if (!selectedOrder || !isSelectedOrderValid) {
            const sorted = sortOrders(orders);
            setSelectedOrder(sorted[0]);
        }
    }, [orders]);

    const getCustomerInfo = (id, field = 'both') => {
        // 1. Find the customer by localId or serverId
        const customer = customers.find(c => c.localId === id || c.serverId === id);

        // 2. Handle case where customer isn't found
        if (!customer) return "-";

        // 3. Prepare the data
        const fullName = `${customer.firstName} ${customer.lastName}`.trim();
        const phoneNumber = `${customer.phoneCode} ${customer.phone}`;

        // 4. Return based on the requested field
        if (field === 'name') return fullName;
        if (field === 'phone') return phoneNumber;

        return { name: fullName, phone: phoneNumber };
    };

    return (
        <div className="px-1 flex flex-col h-full min-h-0">

            <div className="px-1 pb-2">

                <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder={t("invoice.searchInvoice")}
                    resultCount={orders.length}
                />

            </div>

            {orders.length === 0 ? (
                <p className="text-center text-text-muted py-2 bg-surface mx-2 mt-2">
                    {t("invoice.noDetails")}
                </p>
            ) : (
                <ul className="py-0.5 p-1 flex-grow overflow-y-auto no-scrollbar min-h-0 text-secondary">
                    {[...orders]
                        .sort((a, b) => {
                            const dateA = new Date(a.orderDate || a.createdAt || 0).getTime();
                            const dateB = new Date(b.orderDate || b.createdAt || 0).getTime();
                            return dateB - dateA;
                        }).map((order) => {
                            const orderKey = order?.localId || order?.serverOrderId || order?.orderId;
                            const isActive = orderKey === (selectedOrder?.localId || selectedOrder?.serverOrderId || selectedOrder?.orderId);
                            const fullName = order.customerName || getCustomerInfo(order.customer_id, "name");
                            const phoneNumber = order.customerPhone || getCustomerInfo(order.customer_id, "phone");
                            return (
                                <li
                                    key={orderKey}
                                    onClick={() => { setSelectedOrder({ ...order, customerName: { fullName }, customerPhone: { phoneNumber } }) }}
                                    className={`flex justify-between items-center gap-2 mb-2 px-2 py-0.5 rounded-md cursor-pointer relative bg-surface shadow-[0_0_3px_var(--shadow-soft-hex-alt)] transition-all duration-300 ${isActive ? "bg-gradient-to-r from-primary/5 via-[var(--theme-secondary)]/5 to-white border border-primary" : "border border-white"}`}
                                >
                                    {/* LEFT */}
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`anticon anticon-right ${isActive ? "text-primary" : "text-primary/40"
                                                }` + " px-2.5 transition-colors"}
                                        >
                                            {/* RIGHT ARROW SVG */}
                                            <svg
                                                viewBox="64 64 896 896"
                                                width="1rem"
                                                height="1rem"
                                                fill="currentColor"
                                            >
                                                <path d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.4 12.9 6.3l450.8-352.1a31.96 31.96 0 000-50.4z" />
                                            </svg>
                                        </span>

                                        <div>
                                            <h3 className="text-base sm:text-lg font-semibold flex flex-wrap gap-x-2 gap-y-1 sm:gap-4 items-center break-all sm:break-normal">
                                                <span className={`${isActive ? "text-primary" : "text-text-secondary"}`}>
                                                    Invoice #{order?.display_id || order?.invoiceNo || order?.serverOrderId || order?.localId?.slice(0, 8) || "-"}
                                                </span>
                                                <span className="text-text-muted font-medium text-sm">Cashier: {order?.cashierName || user?.first_name || "N/A"}</span>
                                            </h3>

                                            <p className="text-xs sm:text-sm text-text-muted flex flex-wrap items-center gap-1">
                                                <span className="anticon anticon-field-time">
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
                                                    {(order?.orderDate || order?.createdAt)
                                                        ? new Date(order.orderDate || order.createdAt).toLocaleString("en-US", {
                                                            month: "short",
                                                            day: "2-digit",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            hour12: true,
                                                        })
                                                            .replace("at", "")

                                                        : "-"}
                                                </span>
                                            </p>


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
                                                {fullName}
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
                                                        <path d="M877.1 238.7L770.6 132.3c-13-13-30.4-20.3-48.8-20.3s-35.8 7.2-48.8 20.3L558.3 246.8c-13 13-20.3 30.5-20.3 48.9 0 18.5 7.2 35.8 20.3 48.9l89.6 89.7a405.46 405.46 0 01-86.4 127.3c-36.7 36.9-79.6 66-127.2 86.6l-89.6-89.7c-13-13-30.4-20.3-48.8-20.3a68.2 68.2 0 00-48.8 20.3L132.3 673c-13 13-20.3 30.5-20.3 48.9 0 18.5 7.2 35.8 20.3 48.9l106.4 106.4c22.2 22.2 52.8 34.9 84.2 34.9 6.5 0 12.8-.5 19.2-1.6 132.4-21.8 263.8-92.3 369.9-198.3C818 606 888.4 474.6 910.4 342.1c6.3-37.6-6.3-76.3-33.3-103.4zm-37.6 91.5c-19.5 117.9-82.9 235.5-178.4 331s-213 158.9-330.9 178.4c-14.8 2.5-30-2.5-40.8-13.2L184.9 721.9 295.7 611l119.8 120 .9.9 21.6-8a481.29 481.29 0 00285.7-285.8l8-21.6-120.8-120.7 110.8-110.9 104.5 104.5c10.8 10.8 15.8 26 13.3 40.8z"></path>
                                                    </svg>
                                                </span>
                                                <span>
                                                    {phoneNumber}
                                                </span>
                                            </p>

                                        </div>
                                    </div>

                                    {/* RIGHT */}
                                    <div className="text-right shrink-0">
                                        <h3 className={`text-sm sm:text-base font-bold ${isActive ? "bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" : "text-primary"}`}>
                                            {cur()}{parseFloat(order.totalAmount || order?.subtotal).toFixed(2)}
                                        </h3>
                                        <small className="text-xs text-text-muted">
                                            {(order?.orderItems?.length ?? order?.items?.length ?? 0)} Items
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

export default invoiceList;