import { useState, useRef, useEffect } from "react";
import { useT } from "../../../i18n";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import Select from "react-select";
import { useCartStore, ORDER_TYPE, hasSelectedTable } from "../../../store/useCartStore";
import { useFeatures } from "../../../hooks/useFeatures";
import { useNotification } from "../../../hooks/useNotification";
import { useHoldOrderStore } from "../../../store/useHoldOrderStore";
import { useCustomerStore } from "../../../store/useCustomerStore";
import CustomerNameInput from "../customer/CustomerNameInput";
import { pendingKotItems } from "../../../utils/kitchen";
import { roundTotals } from "../../../utils/roundTotals";
import Spinner from "../../common/Spinner";
import { countriesList } from "../../../store/countryStore";

const DiscountHoldOrderPopup = ({ activeModal, closeModal, subtotal, tax, discount, total, setPayToProceed, fromHoldResume, customerName, onCustomerReady }) => {
  const t = useT();

    const navigate = useNavigate();
    const features = useFeatures();
    const [discountType, setDiscountType] = useState("percentage");
    const [discountValue, setDiscountValue] = useState(0.00);
    const parseName = (fullName) => {
        const trimmed = (fullName || "").trim();
        if (!trimmed) return { firstName: "", lastName: "" };
        const parts = trimmed.split(/\s+/);
        const firstName = parts[0];
        // A one-word name has no surname. Copying the first name in here was
        // what turned "Rupit" into "Rupit Rupit" on every screen and receipt.
        const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
        return { firstName, lastName };
    };

    const [customerForm, setCustomerForm] = useState({
        name: "",
        phone: "",
    });
    const { createHoldOrder } = useHoldOrderStore();

    /**
     * A round is on its way to the kitchen.
     *
     * The server takes a moment, and a captain who sees nothing happen
     * presses again. Each press used to be a whole new round, so the same
     * table's food reached the kitchen two and three times over.
     */
    const [placing, setPlacing] = useState(false);
    // Naming a regular at the counter is not a mistake to be stopped; it is
    // the guest telling us who they are.
    const findOrAddCustomer = useCustomerStore((state) => state.findOrAddCustomer);
    // Refs for auto-focus
    const discountInputRef = useRef(null);
    const holdOrderInputRef = useRef(null);

    const { notifyError, notifySuccess } = useNotification();
    const {
        cartData,
        resetCart,
        selectedCustomer,
        selectedTable,
        orderType,
        setOwnerDiscount,
        setSelectedCustomer,
    } = useCartStore();
    const currentOrderType =
        orderType === ORDER_TYPE.PARCEL ? ORDER_TYPE.PARCEL : ORDER_TYPE.DINE_IN;

    const codeOptions = countriesList.map((country) => ({
        label: country.name,
        value: country.code,
    }));

    const hasSelectedCustomer = !!selectedCustomer?.firstName;

    /**
     * A guest picked out of the list is the record we already hold.
     *
     * Setting them as the selected customer is what stops a second copy
     * being written: the order attaches to the person who was already
     * here, and their number comes with them.
     */
    const pickExistingCustomer = (customer) => {
        if (!customer) return;
        setSelectedCustomer(customer);
        setCustomerForm({
            name: [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim(),
            phone: customer.phone || "",
        });
    };

    // Effect to focus the first input whenever a modal opens
    useEffect(() => {
        if (activeModal === 'holdOrder') {
            holdOrderInputRef.current?.focus();
        }
    }, [activeModal]);

    useEffect(() => {
        if (activeModal === "holdOrder" && fromHoldResume) {
            handleHoldOrder();
        }
    }, [activeModal, fromHoldResume]);

    // The figure gets the cursor the moment the box opens.
    useEffect(() => {
        if (activeModal === 'discount') {
            // Small timeout ensures the DOM has rendered the new element
            setTimeout(() => discountInputRef.current?.focus(), 10);
        }
    }, [activeModal]);

    const saveDiscountHandler = (e) => {
        e?.preventDefault(); // Prevents page reload
        const discountData = discountType === "percentage" ? discountValue / 100 : discountValue;
        setOwnerDiscount(discountData);
        notifySuccess(t("discount.applied"));
        closeModal();
    }

    const handleCustomerChange = (e) => {
        const { name, value } = e.target;
        if (name === "phone") {
            const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
            setCustomerForm((prev) => ({ ...prev, phone: digitsOnly }));
            return;
        }
        setCustomerForm((prev) => ({ ...prev, [name]: value }));
    };

    const resetCustomerForm = () => {
        setCustomerForm({
            name: "",
            phone: "",
        });
    };

  /**
   * Who the bill is for, asked at the counter before the money is taken.
   *
   * Every bill carries a name and a number — it is printed on the receipt
   * and called out in the kitchen — so a sale cannot go through without
   * one. Same two fields as Place Order; only what happens next differs.
   */
    const handleCustomerBeforePay = async (e) => {
        e?.preventDefault();
        if (!cartData.length) {
            notifyError(t("cart.isEmpty"));
            return;
        }

        try {
            let orderCustomer = selectedCustomer;

            if (!hasSelectedCustomer) {
                if (!customerForm.name.trim()) {
                    notifyError(t("order.enterName"));
                    return;
                }
                if (customerForm.phone.trim() && customerForm.phone.trim().length !== 10) {
                    notifyError(t("customers.mobile10"));
                    return;
                }

                const { firstName, lastName } = parseName(customerForm.name);

                orderCustomer = await findOrAddCustomer({
                    firstName,
                    lastName,
                    phoneCode: "+91",
                    phone: customerForm.phone.trim(),
                    email: "",
                    address1: "",
                    address2: "",
                    country: "",
                    state: "",
                    city: "",
                    pincode: "",
                });
                setSelectedCustomer(orderCustomer);
            }

            resetCustomerForm();
            closeModal();
            onCustomerReady?.(orderCustomer);
        } catch (err) {
            console.error(err);
            notifyError(t("customers.saveFailed"));
        }
    };

    const handleHoldOrder = async (e) => {
        if (placing) return;
        e?.preventDefault(); // Prevents page reload
        if (!cartData.length) {
            notifyError(t("cart.isEmpty"));
            return;
        }
        // Only where there are tables. A counter has none, and sending the
        // cashier to a floor plan that is not there is a dead end.
        if (features.table_service_enabled && currentOrderType === ORDER_TYPE.DINE_IN && !hasSelectedTable(selectedTable)) {
            notifyError(t("cart.pickTable"));
            closeModal();
            navigate("/pos/tables");
            return;
        }

        let orderCustomer = selectedCustomer;

        try {
            if (!hasSelectedCustomer) {
                if (!customerForm.name.trim()) {
                    notifyError(t("order.enterName"));
                    return;
                }
                if (customerForm.phone.trim() && customerForm.phone.trim().length !== 10) {
                    notifyError(t("customers.mobile10"));
                    return;
                }

                const { firstName, lastName } = parseName(customerForm.name);

                const customerPayload = {
                    firstName,
                    lastName,
                    phoneCode: "+91",
                    phone: customerForm.phone.trim(),
                    email: "",
                    address1: "",
                    address2: "",
                    country: "",
                    state: "",
                    city: "",
                    pincode: "",
                };

                orderCustomer = await findOrAddCustomer(customerPayload);
                setSelectedCustomer(orderCustomer);
            }

            const finalCustomerName =
                `${orderCustomer?.firstName || ""} ${orderCustomer?.lastName || ""}`.trim() ||
                customerName ||
                "Guest";

            // One press of Place Order is one round. A resumed table already
            // has its earlier rounds in the kitchen, so only what was added
            // since goes on this one — and only that round's money with it.
            const kotItems = pendingKotItems(cartData);

            if (!kotItems.length) {
                notifyError(t("cart.nothingNew"));
                return;
            }

            const money = roundTotals(kotItems, cartData, discount);

            const holdOrderPayload = {
                localId: `HOLD-${Date.now()}`,
                timestamp: Date.now(),
                note: finalCustomerName,
                serverId: null,
                cartData: {
                    customer: orderCustomer || null,
                    table: selectedTable,
                    orderType: currentOrderType,
                    orderItems: kotItems,
                    subtotal: money.subtotal,
                    taxAmount: money.taxAmount,
                    discount: {
                        type: discount < 1 ? "PERCENT" : "FIXED",
                        value: discount < 1 ? parseFloat((discount * 100).toFixed(2)) : parseFloat(money.discount.toFixed(2)),
                    },
                    totalAmountToPay: money.total,
                },
            };

            setPlacing(true);
            await createHoldOrder(holdOrderPayload);
            resetCart();
            resetCustomerForm();
            closeModal();
            setPayToProceed?.(false);
            notifySuccess(t("order.onHold"));

            // Same as the direct hold: a dine-in order goes back to the floor
            // plan, where the table now shows as occupied.
            if (currentOrderType !== "PARCEL") navigate("/pos/tables");
        } catch (err) {
            notifyError(err?.message || t("cart.holdFailed"));
            console.log(err);
        } finally {
            setPlacing(false);
        }
    };

    const phoneCodeStyles = {
        control: (provided, state) => ({
            ...provided,
            minHeight: "40px",
            borderRadius: "0.5rem",
            border: state.isFocused
                ? "1px solid var(--color-primary)"
                : "1px solid var(--border-default)",
            boxShadow: state.isFocused ? "0 0 0 3px var(--overlay-indigo-10)" : "none",
            fontSize: "0.875rem",
            backgroundColor: "var(--bg-main)",
        }),
        menuPortal: (provided) => ({ ...provided, zIndex: 999999 }),
        menu: (provided) => ({ ...provided, zIndex: 999999, fontSize: "0.875rem" }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor:
                state.isSelected || state.isFocused
                    ? "var(--color-secondary)"
                    : "white",
            color: state.isSelected || state.isFocused ? "white" : "var(--gray-700)",
            cursor: "pointer",
        }),
    };

    const modalContent = (
        <>
            {/* Discount Value Popup */}
            {activeModal === 'discount' && (
                <div onClick={closeModal} className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <form
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={saveDiscountHandler}
                        className="bg-surface p-6 rounded-xl shadow-2xl w-full max-w-sm mx-4 animate-scale-in"
                    >
                        <h2 className="text-2xl font-bold mb-4 text-primary text-center">{t("discount.apply")}</h2>
                        <div className="text-center text-lg font-semibold text-primary py-4 space-y-2 my-4 rounded-md">
                            <p>{t("discount.selectType")}</p>
                            <div className="flex justify-center gap-2 text-sm text-text-inverted font-medium">
                                <button
                                    type="button"
                                    onClick={() => notifyError(t("discount.fixedOff"))}
                                    className={`py-2 px-6 rounded-lg cursor-pointer transition-all ${discountType === "fixed" ? "gf-metal-green text-text-inverted shadow-md" : "border border-primary/20 text-primary bg-surface hover:bg-background"}`}
                                >
                                    {t("discount.fixed")}
                                </button>
                                <button type="button" onClick={() => setDiscountType("percentage")} className={`py-2 px-4 rounded-lg cursor-pointer transition-all ${discountType === "percentage" ? "gf-metal-green text-text-inverted shadow-md" : "border border-primary/20 text-primary bg-surface hover:bg-background"}`}>{t("discount.percentage")}</button>
                            </div>
                        </div>
                        <input
                            ref={discountInputRef}
                            type="number"
                            required
                            placeholder={discountType === "percentage" ? t("discount.enterPercentage") : t("discount.enterValue")}
                            onChange={(e) => { setDiscountValue(e.target.value) }}
                            className="shadow-sm border border-primary/20 w-full mb-6 p-3 rounded-md outline-none text-sm text-primary"
                        />
                        <div className="flex justify-between gap-3">
                            <button type="submit" className="px-4 py-2.5 text-text-inverted font-bold text-sm rounded-lg flex-1 shadow-md gf-metal-green hover:opacity-90 transition-opacity cursor-pointer">+ Add</button>
                            <button type="button" onClick={closeModal} className="px-4 py-2.5 border border-primary/20 text-primary text-sm hover:bg-background font-bold rounded-lg flex-1 shadow-sm transition-colors cursor-pointer">{t("common.cancel")}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Who the bill is for — asked before payment */}
            {activeModal === 'customerBeforePay' && (
                <div onClick={closeModal} className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50">
                    <form
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={handleCustomerBeforePay}
                        className="bg-surface p-6 rounded-xl shadow-2xl w-full max-w-sm mx-4 animate-scale-in"
                    >
                        <h2 className="text-2xl font-bold mb-1 text-primary text-center">{t("order.customerDetails")}</h2>
                        <p className="text-xs text-text-muted text-center mb-4">
                            {t("customer.printedOnBill")}
                        </p>
                        <div className="space-y-3 mb-6">
                            <CustomerNameInput
                                inputRef={holdOrderInputRef}
                                required
                                value={customerForm.name}
                                onChange={handleCustomerChange}
                                onPick={pickExistingCustomer}
                                className="shadow-sm border border-primary/20 text-primary w-full p-2 rounded-md outline-none text-sm"
                            />
                            <input
                                type="tel"
                                name="phone"
                                maxLength={10}
                                placeholder={t("order.phoneOptional")}
                                value={customerForm.phone}
                                onChange={handleCustomerChange}
                                className="shadow-sm border border-primary/20 text-primary w-full p-2 rounded-md outline-none text-sm"
                            />
                        </div>
                        <div className="flex justify-between gap-3">
                            <button type="submit" className="px-4 py-2.5 text-text-inverted font-bold text-sm rounded-lg flex-1 gf-metal-green hover:opacity-90 transition-opacity shadow-md cursor-pointer">{t("pay.continue")}</button>
                            <button type="button" onClick={closeModal} className="px-4 py-2.5 border border-primary/20 text-primary text-sm hover:bg-background transition-colors font-bold rounded-lg flex-1 shadow-sm cursor-pointer">{t("common.cancel")}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Hold Order Popup */}
            {/* While the round is on its way, the sheet stays put: closing it
                would leave the kitchen cooking an order the till had forgotten
                it sent. */}
            {activeModal === 'holdOrder' && (
                <div onClick={() => { if (!placing) closeModal(); }} className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 ">
                    <form
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={handleHoldOrder}
                        className="bg-surface p-6 rounded-xl shadow-2xl w-full max-w-sm mx-4 animate-scale-in"
                    >
                        <h2 className="text-2xl font-bold mb-4 text-primary text-center">{t("pay.place")}</h2>
                        {!hasSelectedCustomer && (
                            <div className="space-y-3 mb-6">
                                <CustomerNameInput
                                    inputRef={holdOrderInputRef}
                                    required
                                    value={customerForm.name}
                                    onChange={handleCustomerChange}
                                    onPick={pickExistingCustomer}
                                    className="shadow-sm border border-primary/20 text-primary w-full p-2 rounded-md outline-none text-sm"
                                />
                                <input
                                    type="tel"
                                    name="phone"
                                    maxLength={10}
                                    placeholder={t("order.phoneOptional")}
                                    value={customerForm.phone}
                                    onChange={handleCustomerChange}
                                    className="shadow-sm border border-primary/20 text-primary w-full p-2 rounded-md outline-none text-sm"
                                />
                            </div>
                        )}
                        <div className="flex justify-between gap-3">
                            <button
                                type="submit"
                                disabled={placing}
                                aria-busy={placing}
                                className={`px-4 py-2.5 text-text-inverted font-bold text-sm rounded-lg flex-1 gf-metal-green shadow-md transition-opacity flex items-center justify-center gap-2 ${
                                    placing ? "cursor-wait opacity-80" : "cursor-pointer hover:opacity-90"
                                }`}
                            >
                                {placing && <Spinner size={15} label={t("cart.sending")} />}
                                {placing ? t("order.sendingKitchen") : t("order.placeOrder")}
                            </button>
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={placing}
                                className={`px-4 py-2.5 border border-primary/20 text-primary text-sm font-bold rounded-lg flex-1 shadow-sm transition-colors ${
                                    placing ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-background"
                                }`}
                            >
                                {t("common.cancel")}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );

    // Only render the portal if we're actually in a browser environment to avoid SSR issues
    if (typeof window === 'undefined') return null;
    return createPortal(modalContent, document.body);
}

export default DiscountHoldOrderPopup;
