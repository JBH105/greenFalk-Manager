import { cur } from "../../../utils/currency";
import { useT } from "../../../i18n";
import React, { useEffect, useState } from "react";
import defaultImg from "./../../../assets/images/Default_Product_Img.png";
import { useNotification } from "./../../../hooks/useNotification"
import { buildRefundItems, refundTotals } from "../../../helper/refundLines";

const RefundPopup = ({
 open, onClose, items = [], orderId, onProcessRefund }) => {
  const t = useT();

    const [refundItems, setRefundItems] = useState([]);
    const [restock, setRestock] = useState(true);
    const [reason, setReason] = useState("");
    const { notifyError, notifySuccess } = useNotification();
    const [isProcessing, setIsProcessing] = useState(false);



    useEffect(() => {
        // Only initialize/reset if the popup is opening AND we aren't currently processing a refund
        if (open && !isProcessing) {
            // The list arrives already narrowed to what is still refundable,
            // one row per line of the bill.
            setRefundItems(items.map(item => ({ ...item, refundQty: 0 })));
            setRestock(true);
            setReason("");
        }
    }, [open]);

    if (!open) return null;

    const updateQty = (index, type) => {
        setRefundItems(prev =>
            prev.map((item, i) => {
                if (i !== index) return item;

                let qty = item.refundQty;
                if (type === "inc" && qty < item.remainingQuantity) qty++;
                if (type === "dec" && qty > 0) qty--;

                return { ...item, refundQty: qty };
            })
        );
    };

    const { subtotal: refundSubtotal, tax: refundTax, total: refundAmount } =
        refundTotals(refundItems);

    const handleClose = () => {
        onClose();
    };

    const handleSubmit = async () => {
        // Each line carries its own money. Stamping every line with the whole
        // refund made a two-dish refund pay out twice over.
        const itemsToRefund = buildRefundItems(refundItems);

        if (itemsToRefund.length === 0) return onClose();
        setIsProcessing(true);
        // Construct the RefundData interface
        const refundData = {
            order_id: orderId,
            items: itemsToRefund,
            restock: restock,
            reason: reason
        };
        // Send back to Invoices.jsx
        try {
            await onProcessRefund(refundData, refundAmount, refundSubtotal);
            notifySuccess(t("refund.success"));
            onClose();
        } catch (error) {
            console.error("Refund failed:", error);
            notifyError("Refund failed:", error.message || error);
        } finally {
            setIsProcessing(false);
        }

    };



    return (
        <div
            className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center px-3 sm:px-8 md:px-16 lg:px-32 py-4 sm:py-8"
            onClick={handleClose}
        >
            <div className="bg-surface w-full h-full rounded-lg shadow-xl p-4 sm:p-7 flex flex-col animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Heading */}
                <h2 className="text-2xl text-center text-text-secondary font-bold mb-5">
                    {t("refund.available")}
                </h2>

                {/* Item List */}
                <div className="flex-1  overflow-y-auto mb-4">
                    {refundItems.length === 0 && (
                        <p className="text-center text-sm py-6 text-text-muted">
                            {t("refund.noItems")}
                        </p>
                    )}

                    {refundItems.map((item, index) => (
                        <div
                            key={index}
                            className="flex justify-between items-center px-3 py-2 "
                        >
                            <div className="flex gap-2">
                                {/* {item.imageUrl ? (
                                    <img src={item.imageUrl} alt="" className="h-10" />
                                ) : (
                                    <img src={defaultImg} alt="" className="h-10" />
                                )} */}
                                <div>
                                    <p className="text-md text-text-secondary">{item.productName}</p>
                                    <p className="text-sm text-text-secondary font-bold">
                                        {cur()}{(Number(item.unitPrice) || 0).toFixed(2)} X {item.remainingQuantity} {item.unit}
                                    </p>
                                </div>

                            </div>

                            <div className="flex items-center">
                                <button
                                    onClick={() => updateQty(index, "dec")}
                                    className="w-8 h-9 font-bold gf-metal-green text-text-inverted"
                                >
                                    −
                                </button>
                                <span className="w-10 py-1.5 text-center border-y-1 border-border-default h-full">
                                    {item.refundQty}
                                </span>
                                <button
                                    onClick={() => updateQty(index, "inc")}
                                    className="w-8 h-9 font-bold gf-metal-green text-text-inverted"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* BOTTOM FIXED AREA */}
                <div className="mt-auto border-t border-border-default">

                    {/* Restock & Summary */}
                    <div className="fborder-t border-border-default py-6
                flex flex-col sm:flex-row sm:justify-between gap-4">
                        <label className="flex items-center gap-2 text-sm text-text-secondary">
                            <input
                                type="checkbox"
                                checked={restock}
                                onChange={e => setRestock(e.target.checked)}
                                className="accent-[var(--theme-primary)]"
                            />
                            {t("refund.restock")}
                        </label>

                        <div className="text-sm text-right flex text-success">
                            <div className="text-left mr-8">
                                <p>{t("refund.subtotal")}</p>
                                <p>{t("refund.tax")}</p>
                                <p className="text-secondary font-bold">{t("refund.amount")}</p>
                            </div>

                            <div className="text-right">
                                <p>{cur()}{refundSubtotal.toFixed(2)}</p>
                                <p>{cur()}{refundTax.toFixed(2)}</p>
                                <p className="text-secondary font-bold">{cur()}{refundAmount.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <input
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="w-full p-2.5 border-0 border-border-default rounded-md  outline-none placeholder:text-text-secondary shadow-[0_0_3px_var(--shadow-soft-hex)] focus:outline-primary text-sm "
                            placeholder={t("refund.reason")}
                        />
                    </div>

                    {/* Buttons */}
                    <div className=" flex flex-col sm:flex-row gap-5 mt-7">
                        <button
                            onClick={handleSubmit}
                            disabled={refundItems.every(i => i.refundQty === 0) || isProcessing}
                            className={`flex-1 font-bold py-2 rounded-md text-text-inverted bg-gradient-to-b from-[var(--theme-primary)] to-[var(--theme-primary-light)] transition-all ${(refundItems.every(i => i.refundQty === 0) || isProcessing)
                                ? "cursor-not-allowed opacity-70"
                                : "cursor-pointer hover:shadow-lg"}`}
                        >
                            {isProcessing ? "Processing..." : "Refund"}
                        </button>
                        <button
                            onClick={handleClose}
                            className="flex-1 font-bold py-2 border-border-default rounded-md text-text-secondary  outline-none shadow-[0_0_3px_var(--shadow-soft-hex)] hover:bg-bg-tertiary hover:shadow-none cursor-pointer"
                        >
                            {t("common.cancel")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RefundPopup;
