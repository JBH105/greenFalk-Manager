import React from "react";
import { useT } from "../../i18n";
import LeftPanel from "../../components/pos/retail/LeftPanel";
import RightPanel from "../../components/pos/retail/RightPanel";
import brandLogo from "../../assets/images/greenfalk-logo.png";
import { useState, useEffect } from "react";
import { useProductStore } from "../../store/useProductStore";
import { useCartStore } from "../../store/useCartStore";
import { useRetail } from "../../hooks/useRetail";
// import camera from "../../assets/icons/camera.svg";
import camera from "../../assets/images/camera.png";
import { useAuthStore } from "../../store/useAuthStore";
import { usePromotionStore } from "../../store/usePromotionStore";
// import fullScreenIcon from "../../../assets/icons/full-screen.svg";
// import exitFullScreenIcon from "../../../assets/icons/close-full-screen.svg";
import exitFullScreenIcon from "../../assets/icons/close-full-screen.svg";
import fullScreenIcon from "../../assets/icons/full-screen.svg";
import muteIcon from "../../assets/icons/mute.svg";
import speakerIcon from "../../assets/icons/speaker.svg";
const Retail = ({ setPayToProceed, getFinalProductPrice, setIsPettyClicked, mute, setMute, }) => {
  const t = useT();


    const { products } = useProductStore();
    const outletId = useAuthStore.getState().user?.outlet_id;
    const { promotions } = usePromotionStore();

    const [barcodeSearch, setBarcodeSearch] = useState("");
    const [filteredProducts, setFilteredProducts] = useState([]);
    const { addToCart } = useCartStore();
    const [totalAmount, setTotalAmount] = useState(0);
    const { setIsRetail, setIsRetailOpen } = useRetail();
    const [isFullScreen, setIsFullScreen] = useState(
        !!document.fullscreenElement
    );
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            // Check if there is currently an element in fullscreen
            setIsFullScreen(!!document.fullscreenElement);
        };

        // Listen for the change event
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        // Clean up the listener when the component unmounts
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    // --- Code / barcode search ---
    const handleBarcodeChange = (e) => {
        const value = e.target.value;
        setBarcodeSearch(value);

        if (value.length > 1) {
            const matches = products.filter((p) =>
                p.barcode?.toLowerCase().includes(value.toLowerCase())
            );
            setFilteredProducts(matches);
        } else {
            setFilteredProducts([]);
        }
    };

    // --- NEW: Handle Enter Key Press ---
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            // Prevent form submission if this is inside a form
            e.preventDefault();

            // Find an EXACT match for the barcode
            const exactMatch = products.find(
                (p) => p.barcode?.toLowerCase() === barcodeSearch.toLowerCase()
            );

            if (exactMatch) {
                selectProduct(exactMatch)
            } else {
                // Optional: Alert the user if no exact match found on Enter
                console.log("No product found with this barcode");
            }
        }
    };

    const selectProduct = (data) => {
        const price = getFinalProductPrice({
            product: data,
            promotions,
            outletId
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
        setBarcodeSearch("");
        setFilteredProducts([]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
            <div className="w-[65vw] h-full px-5" >
                <div className="flex h-15 mt-3">
                    <div><img className="w-36" src={brandLogo} alt="" /></div>
                    {/* <div className="font-bold text-3xl text-right flex-1"><h3>{t("retail.cashierPanel")}</h3></div> */}
                </div>
                <div className="mt-2 flex items-center gap-3 space-between">
                    <div className="relative w-3/4 flex items-center justify-between gap-2">
                        <svg
                            className="absolute left-3 top-3.5 w-3.5 h-3.5 text-text-muted"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            placeholder={t("retail.scanOrType")}
                            className="py-2 pl-8 bg-surface w-full rounded-md shadow-[0_0_3px_var(--shadow-soft-hex)] outline-0 cursor-text placeholder:text-text-secondary placeholder:text-sm"
                            value={barcodeSearch}
                            onChange={handleBarcodeChange}
                            onKeyDown={handleKeyDown} // Listen for the Enter key
                        />

                        {/* BARCODE SEARCH POPUP */}
                        {filteredProducts.length > 0 && (
                            <div className="absolute left-0 right-0 top-10 mt-1 bg-surface border border-border-default rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                                {filteredProducts.map((p) => (
                                    <div
                                        key={p.serverId || p.barcode}
                                        className="p-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b last:border-none"
                                        onClick={() => selectProduct(p)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-text-secondary">{p.name}</span>
                                            <span className="text-xs text-text-muted">SN: {p.barcode}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            {getFinalProductPrice({ product: p, promotions, outletId }) < p.sellingPrice ? (
                                                <>
                                                    <span className="text-xs line-through text-text-muted">P {p.sellingPrice}</span>
                                                    <span className="text-sm font-semibold text-primary">P {getFinalProductPrice({ product: p, promotions, outletId })}</span>
                                                </>
                                            ) : (
                                                <span className="text-sm font-semibold text-primary">P {p.sellingPrice}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-text-secondary">
                        {/* Add Icon */}
                        {/* <span className="cursor-pointer bg-surface rounded-md shadow-[0_0_3px_var(--shadow-soft-hex)] text-3xl font-light w-10 h-10 flex items-center justify-center">
                            +
                        </span> */}

                        {/* 'P' Icon */}
                        <div
                            onClick={() => setIsPettyClicked(true)}
                            className="cursor-pointer rounded-md shadow-[0_0_3px_var(--shadow-soft-hex)] bg-surface text-text-secondary w-10 h-10 flex items-center justify-center"
                        >
                            <p className="text-xl font-medium">P</p>
                        </div>

                        {/* Fullscreen Icon */}
                        <div
                            onClick={toggleFullscreen}
                            className="cursor-pointer rounded-md shadow-[0_0_3px_var(--shadow-soft-hex)] bg-surface text-text-secondary w-10 h-10 flex items-center justify-center"
                        >
                            <img
                                src={isFullScreen ? exitFullScreenIcon : fullScreenIcon}
                                alt={t("common.fullScreen")}
                                className="w-6"
                            />
                        </div>

                        {/* Mute Icon */}
                        <div
                            onClick={() => setMute(!mute)}
                            className="cursor-pointer rounded-md shadow-[0_0_3px_var(--shadow-soft-hex)] bg-surface text-text-secondary w-10 h-10 flex items-center justify-center"
                        >
                            <img src={mute ? muteIcon : speakerIcon} alt={t("common.speaker")} className="w-6" />
                        </div>

                        {/* Camera Icon */}
                        <span
                            onClick={() => { setIsRetail(false); setIsRetailOpen(false); }}
                            className="cursor-pointer rounded-md shadow-[0_0_3px_var(--shadow-soft-hex)] bg-surface w-10 h-10 flex items-center justify-center"
                        >
                            <img src={camera} alt={t("common.camera")} className="w-6" />
                        </span>
                    </div>
                    <div className="min-w-30 text-right">
                        {filteredProducts.length} Results
                    </div>
                </div>
                <div>
                    <LeftPanel setTotalAmount={setTotalAmount} getFinalProductPrice={getFinalProductPrice} />
                </div>
            </div>
            <div className="w-[35vw] h-full border-l border-border-default">
                <RightPanel total={totalAmount} setPayToProceed={setPayToProceed} getFinalProductPrice={getFinalProductPrice} />
            </div>
        </div>
    );
};

export default Retail;