import { taxLabel } from "../../../utils/gst";
import { useT } from "../../../i18n";
import { cur } from "../../../utils/currency";
// import { ShoppingCart, RefreshCcw, Pencil, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCustomerStore } from "../../../store/useCustomerStore";
import { useProductStore } from "../../../store/useProductStore";
import { useCartStore } from "../../../store/useCartStore";
import Select from "react-select";
import { useEffect, useState, useMemo } from "react";
import { useRetail } from "../../../hooks/useRetail";
import { useNotification } from "../../../hooks/useNotification";
import { useAuthStore } from "../../../store/useAuthStore";
import { usePromotionStore } from "../../../store/usePromotionStore";
import DiscountHoldOrderPopup from "../dashboard/DiscountHoldOrderPopup";
import ShortcutLabel from "../../common/ShortcutLabel";

const RightPanel = ({ total, setPayToProceed, getFinalProductPrice }) => {
  const t = useT();

    const navigate = useNavigate();
    const { customers, hydrate: customerHydrate } = useCustomerStore();
    const { products, hydrated: productsHydrated, hydrate: productsHydrate } = useProductStore();
    const { selectedCustomer, setSelectedCustomer, addToCart, cartData, resetCart, ownerDiscount } = useCartStore();
    const [activeModal, setActiveModal] = useState("");
    const { setIsRetailOpen } = useRetail();
    const { notifyError } = useNotification();
    const user = useAuthStore((u) => u.user);
    const tax = cartData.reduce((totalTax, item) => {
        const taxPercent = Number(item.tax || 0);
        return (
            totalTax +
            ((item.price || 0) * (item.quantity || 1) * taxPercent) / 100
        );
    }, 0);
    const discount = Number(ownerDiscount) < 1 ? ((total + tax) * (ownerDiscount)).toFixed(2) : Number(ownerDiscount).toFixed(2);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    //promotions
    const outletId = useAuthStore.getState().user?.outlet_id;
    const { promotions, hydrate: promoHydrate, hydrated: promoHydarated } = usePromotionStore();
    // --- fatching customers and products data when component mounts ---
    useEffect(() => {
        customerHydrate();
        productsHydrate();
        promoHydrate();
    }, [])
    // this is to change the status offline instantly when the user goes offline or online without needing to refresh the page
    useEffect(() => {
        const handleStatusChange = () => {
            setIsOnline(navigator.onLine);
        };
        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);
        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, []);

    // --- Keyboard Shortcuts Logic ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger shortcuts if the user is typing in a search/input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const key = e.key.toLowerCase();

            switch (key) {
                case 'i': navigate("/pos/invoices"); break;    // I for Invoice
                case 'p': navigate("/pos/promotions"); break;  // P for Promotion
                case 'l': navigate("/pos/lowstock"); break;    // L for Low Stock
                case 'u': navigate("/pos/customers"); break;    // U for select Customer
                case 'd': handleDiscountClick(); break;        // D for Discount
                case 'h': setActiveModal("holdOrder"); break;  // H for Hold Order
                default: break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate, cartData, activeModal]); // Dependencies to ensure functions have latest state

    // --- Data Formatting for Searchable Select ---
    const customerOptions = useMemo(() => {
        return (customers?.map(c => ({
            value: c.localId,
            label: `${c.firstName} ${c.lastName} [${c.phoneCode}-${c.phone}]`,
            data: c
        })) || []);
    }, [customers]);

    const formatCustomerLabel = ({ label, data }, { context }) => (
        // 'text-inherit' ensures the spans take the color from the option: (base) style
        <div className="flex justify-between items-center w-full gap-4 text-inherit">
            <span className="text-sm truncate text-inherit">
                {data.firstName} {data.lastName}
            </span>
            <span className="text-sm whitespace-nowrap text-inherit opacity-80">
                [{data.phoneCode}-{data.phone}]
            </span>
        </div>
    );


    const productOptions = useMemo(() => {
        return products
            ?.map(p => ({
                value: p?.serverId,
                label: p?.name || t("menu.unknownProduct"),
                data: p
            }));
    }, [products]);

    // --- Custom Styles to match your existing UI ---
    const customSelectStyles = {
        control: (base) => ({
            ...base,
            border: 'none',
            boxShadow: '0 0 3px var(--shadow-soft-hex-alt)',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            padding: '2px',
        }),
        placeholder: (base) => ({
            ...base,
            color: 'var(--text-secondary)'
        }),
        menuPortal: (base) => ({
            ...base,
            zIndex: 9999
        }),
        // 1. INCREASE DROPDOWN HEIGHT
        menuList: (base) => ({
            ...base,
            maxHeight: 'calc(100vh - 280px)',
            // minHeight: '100px',
            scrollbarWidth: 'thin', // Increased from default 300px
        }),
        // 2. PRIMARY BG AND WHITE TEXT ON HOVER/FOCUS
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected || state.isFocused
                ? "var(--color-primary)"
                : "white",

            "&:nth-of-type(even)": {
                backgroundColor: state.isSelected || state.isFocused
                    ? "var(--color-primary)"
                    : "var(--bg-main)",
            },

            // Force all nested text to be white when hovered/selected
            color: state.isSelected || state.isFocused
                ? "white !important"
                : "black",

            transition: "background-color 0.2s ease",

            "&:active": {
                backgroundColor: "var(--color-primary)",
            },
            cursor: "pointer",
        }),
    };

    const handleProductSelect = (data) => {
        const price = getFinalProductPrice({
            product: data,
            promotions,
            outletId,
        });
        const discount = price < data.sellingPrice ? data.sellingPrice - price : 0

        const addToCartData = {
            id: data.serverId,
            img: data.img,
            name: data.name,
            price: price,
            stock: data.stock,
            stockQueue: data.stockQueue,
            unit: data.unit,
            barcode: data.barcode,
            discount: discount
        }
        const result = addToCart(addToCartData);
        if (result?.success === false) return;
    }

    const handleDiscountClick = () => {
        if (cartData.length === 0) {
            notifyError(t("discount.needItems"));
            return;
        }
        setActiveModal("discount");
    };

    const handleProceed = () => {
        if (cartData.length === 0) {
            notifyError(t("cart.addItems"));
            return;
        }
        setIsRetailOpen(false);
        setPayToProceed(true);
    };

    return (
        <div className="h-full flex flex-col bg-surface rounded-md text-text-secondary">

            {/* HEADER (STICKY TOP) */}
            <div className="sticky top-0 z-20 bg-surface border-b border-border-default py-2.5 px-3">
                <div className="flex gap-2 items-center justify-between">

                    {/* Left Icons */}
                    <div className="flex gap-3">
                        <div className="cart-icons p-2 shadow-[0_0_3px_var(--shadow-soft-hex)] rounded-md">
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
                        <div className="reset-icons p-2 shadow-[0_0_3px_var(--shadow-soft-hex)] rounded-md cursor-pointer" onClick={() => resetCart()}>
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

                    {/* Right Buttons */}
                    <div className="flex flex-1 gap-2">
                        <button className="flex flex-1 justify-between items-center gap-2 px-3 py-2 text-md text-text-inverted rounded-md gf-metal-green">
                            <p className="text-sm">{selectedCustomer?.firstName ? `${selectedCustomer?.firstName} ${selectedCustomer?.lastName} ` : <ShortcutLabel text={t("order.selectCustomer")} char="u" />}</p>
                            {selectedCustomer ? `[${selectedCustomer?.phoneCode}-${selectedCustomer?.phone}]` :
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
                            }
                        </button>

                        <button className="w-10 h-10 flex text-2xl items-center justify-center text-text-inverted rounded-md gf-metal-green cursor-pointer" onClick={() => navigate("/pos/customers")}>
                            +
                        </button>
                    </div>
                </div>
            </div>

            {/* SCROLLABLE MIDDLE SPACE */}
            <div className="flex-1 z-10 overflow-y-auto px-4">
                <div className="flex z-60 flex-col gap-4 mt-4">

                    {/* SEARCHABLE CUSTOMER DROPDOWN */}
                    <Select
                        options={customerOptions}
                        placeholder={t("order.selectCustomer")}
                        styles={customSelectStyles}
                        formatOptionLabel={formatCustomerLabel}
                        value={selectedCustomer ? customerOptions.find(opt => opt.value === selectedCustomer.localId) : null}
                        onChange={(selected) => { setSelectedCustomer(selected ? selected.data : null); }}
                        isSearchable
                        isClearable
                        menuPortalTarget={document.body}
                    />

                    {/* SEARCHABLE PRODUCT DROPDOWN */}
                    <Select
                        options={productOptions}
                        placeholder={t("promo.selectProduct")}
                        styles={customSelectStyles}
                        value={null} // Keep as null so it resets after adding to cart
                        onChange={(selected) => handleProductSelect(selected.data)}
                        isSearchable
                        menuPortalTarget={document.body}
                        formatOptionLabel={(option) => {
                            return (
                                <div className="flex justify-between items-center text-inherit">
                                    <div className="text-inherit">
                                        <span className="text-sm font-medium text-inherit">{option.data.name}</span>
                                        <div className="text-xs text-inherit opacity-70">{option.data.barcode}</div>
                                    </div>
                                    <div className="text-right text-inherit">
                                        <div className="text-sm font-semibold text-inherit">
                                            {getFinalProductPrice({ product: option.data, promotions, outletId }) < option.data.sellingPrice ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs line-through opacity-50">{cur()}{option.data.sellingPrice.toFixed(2)}</span>
                                                    <span>{cur()}{getFinalProductPrice({ product: option.data, promotions, outletId }).toFixed(2)}</span>
                                                </div>
                                            ) : (
                                                <span>{cur()}{option.data.sellingPrice.toFixed(2)}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }}

                    />

                </div>
            </div>

            {/* FOOTER (STICKY BOTTOM) */}
            <div className="sticky bottom-0 bg-surface border-t border-border-default px-4 py-2 text-sm z-10">

                {/* SUMMARY */}
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                        <span>{t("cart.subtotal")}</span>
                        <span>{cur()}{(total).toFixed(2) || 0.00}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>{taxLabel()}</span>
                        <span>{cur()}{tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>{t("cart.discount")}</span>
                        {/* <span>{cur()}{ownerDiscount ? ownerDiscount : 0.00}</span> */}
                        <span>{cur()}{Number(discount).toFixed(2)}</span>
                    </div>
                </div>

                {/* 6 ACTION BUTTONS */}

                <div className="cart-btns mt-2 flex gap-2 text-base">
                    <div className="discount w-full bg-button-background p-4 fill-gray-700 text-text-secondary rounded-lg cursor-pointer" onClick={() => navigate("/pos/invoices")}>
                        <svg
                            viewBox="64 64 896 896"
                            focusable="false"
                            data-icon="swap"
                            width="24"
                            height="24"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="M938 458.8l-29.6-312.6c-1.5-16.2-14.4-29-30.6-30.6L565.2 86h-.4c-3.2 0-5.7 1-7.6 2.9L88.9 557.2a9.96 9.96 0 000 14.1l363.8 363.8c1.9 1.9 4.4 2.9 7.1 2.9s5.2-1 7.1-2.9l468.3-468.3c2-2.1 3-5 2.8-8zM699 387c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64z"></path>
                        </svg>
                        <p><ShortcutLabel text={t("nav.invoice")} char="i" /></p>
                    </div>
                    <div className="discount w-full bg-button-background p-4 fill-gray-700 text-text-secondary rounded-lg cursor-pointer" onClick={() => navigate("/pos/promotions")}>
                        <svg
                            viewBox="64 64 896 896"
                            focusable="false"
                            data-icon="swap"
                            width="24"
                            height="24"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="M938 458.8l-29.6-312.6c-1.5-16.2-14.4-29-30.6-30.6L565.2 86h-.4c-3.2 0-5.7 1-7.6 2.9L88.9 557.2a9.96 9.96 0 000 14.1l363.8 363.8c1.9 1.9 4.4 2.9 7.1 2.9s5.2-1 7.1-2.9l468.3-468.3c2-2.1 3-5 2.8-8zM699 387c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64z"></path>
                        </svg>
                        <p><ShortcutLabel text={t("promo.one")} char="p" /></p>
                    </div>
                    <div className="discount w-full bg-button-background p-4 fill-gray-700 text-text-secondary rounded-lg cursor-pointer" onClick={() => navigate("/pos/lowstock")}>
                        <svg
                            viewBox="64 64 896 896"
                            focusable="false"
                            data-icon="swap"
                            width="24"
                            height="24"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="M938 458.8l-29.6-312.6c-1.5-16.2-14.4-29-30.6-30.6L565.2 86h-.4c-3.2 0-5.7 1-7.6 2.9L88.9 557.2a9.96 9.96 0 000 14.1l363.8 363.8c1.9 1.9 4.4 2.9 7.1 2.9s5.2-1 7.1-2.9l468.3-468.3c2-2.1 3-5 2.8-8zM699 387c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64z"></path>
                        </svg>
                        <p><ShortcutLabel text={t("nav.lowStock")} char="o" /></p>
                    </div>
                </div>
                <div className="cart-btns mt-2 flex gap-2 text-base">
                    <div className="discount w-full bg-button-background p-4 fill-gray-700 text-text-secondary rounded-lg cursor-pointer"
                        onClick={() => handleDiscountClick()}
                    >
                        <svg
                            viewBox="64 64 896 896"
                            focusable="false"
                            data-icon="percentage"
                            width="24"
                            height="24"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="M855.7 210.8l-42.4-42.4a8.03 8.03 0 00-11.3 0L168.3 801.9a8.03 8.03 0 000 11.3l42.4 42.4c3.1 3.1 8.2 3.1 11.3 0L855.6 222c3.2-3 3.2-8.1.1-11.2zM304 448c79.4 0 144-64.6 144-144s-64.6-144-144-144-144 64.6-144 144 64.6 144 144 144zm0-216c39.7 0 72 32.3 72 72s-32.3 72-72 72-72-32.3-72-72 32.3-72 72-72zm416 344c-79.4 0-144 64.6-144 144s64.6 144 144 144 144-64.6 144-144-64.6-144-144-144zm0 216c-39.7 0-72-32.3-72-72s32.3-72 72-72 72 32.3 72 72-32.3 72-72 72z"></path>
                        </svg>
                        <p><ShortcutLabel text={t("nav.discount")} char="d" /></p>
                    </div>
                    <div className="discount w-full bg-button-background p-4 fill-gray-700 text-text-secondary rounded-lg cursor-pointer"
                        onClick={() => setActiveModal("holdOrder")}>
                        <svg
                            viewBox="64 64 896 896"
                            focusable="false"
                            data-icon="pause"
                            width="24"
                            height="24"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="M304 176h80v672h-80zm408 0h-64c-4.4 0-8 3.6-8 8v656c0 4.4 3.6 8 8 8h64c4.4 0 8-3.6 8-8V184c0-4.4-3.6-8-8-8z"></path>
                        </svg>
                        <p><ShortcutLabel text={t("nav.holdOrder")} char="h" /></p>
                    </div>
                </div>
                {/* <div className="cart-checkout flex justify-between items-center bg-gradient-to-b from-[var(--theme-primary)] to-[var(--theme-primary-light)] text-text-inverted p-4 mt-4 rounded-lg  cursor-pointer" onClick={handleProceed}> */}
                <div onClick={() => user?.role?.name === "owner" ? "" : handleProceed()}
                    className={`${user?.role?.name === "owner" ? "opacity-70 cursor-not-allowed" : "cursor-pointer"} cart-checkout flex justify-between items-center bg-linear-to-b from-[var(--theme-primary)] to-[var(--theme-primary-light)] text-text-inverted p-4 mt-4 rounded-lg `}>
                    <div className="proceed">
                        <h3 className="text-xl font-semibold">{t("cart.proceedToPay")}</h3>
                        <h4 className="text-sm">{cartData.length} Items</h4>
                    </div>
                    <div className="proceed flex gap-2 items-center">
                        <div className="price text-xl font-semibold">{cur()}{(total + tax - discount).toFixed(2)}</div>
                        <div className="icon">
                            <svg
                                viewBox="64 64 896 896"
                                focusable="false"
                                data-icon="double-right"
                                width="32"
                                height="32"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path d="M533.2 492.3L277.9 166.1c-3-3.9-7.7-6.1-12.6-6.1H188c-6.7 0-10.4 7.7-6.3 12.9L447.1 512 181.7 851.1A7.98 7.98 0 00188 864h77.3c4.9 0 9.6-2.3 12.6-6.1l255.3-326.1c9.1-11.7 9.1-27.9 0-39.5zm304 0L581.9 166.1c-3-3.9-7.7-6.1-12.6-6.1H492c-6.7 0-10.4 7.7-6.3 12.9L751.1 512 485.7 851.1A7.98 7.98 0 00492 864h77.3c4.9 0 9.6-2.3 12.6-6.1l255.3-326.1c9.1-11.7 9.1-27.9 0-39.5z"></path>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* popup for hold order and manager discount */}
            <DiscountHoldOrderPopup
                activeModal={activeModal}
                closeModal={() => setActiveModal(null)}
                subtotal={total}
                tax={tax}
                discount={discount}
                total={total + tax - discount}
            />
        </div>
    );
};

export default RightPanel;
