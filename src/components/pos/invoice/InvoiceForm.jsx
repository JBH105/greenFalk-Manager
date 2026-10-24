import { taxLabel } from "../../../utils/gst";
import { useT } from "../../../i18n";
import { cur } from "../../../utils/currency";
import React from "react";
import defaultImg from "./../../../assets/images/Default_Product_Img.png";
import { useState, useEffect } from "react";
import PrintInvoiceSlip from "./PrintInvoiceSlip";
import RefundPopup from "./RefundPopup";
import { refundableLines } from "../../../helper/refundLines";
import { useFeatures } from "../../../hooks/useFeatures";
const InvoiceFrom = ({ selectedOrder, onRefund }) => {
  const t = useT();

  if (!selectedOrder) {
    return (
      <div className="flex  h-full text-text-secondary border-l border-border-default px-4 py-2 text-sm">
        {t("invoice.noOrders")}
      </div>
    );
  }
  // 🔁 Exchange calculations (frontend only)
  const exchangeReturnTotal = (selectedOrder.orderItems || [])
    .filter((item) => item.type === "RETURN")
    .reduce((sum, item) => sum + Math.abs(item.subtotal), 0);

  const exchangeNewTotal = (selectedOrder.orderItems || [])
    .filter((item) => item.type === "EXCHANGE_NEW")
    .reduce((sum, item) => sum + item.subtotal, 0);

  const exchangeDiff = exchangeNewTotal - exchangeReturnTotal;

  const exchangeRefundAmount = exchangeDiff < 0 ? Math.abs(exchangeDiff) : 0;

  const exchangeReceiveAmount = exchangeDiff > 0 ? exchangeDiff : 0;

  const [showPrintSlip, setShowPrintSlip] = useState(false);

  const [showRefund, setShowRefund] = useState(false);

  const tax = (selectedOrder.orderItems || []).reduce((acc, item) => {
    if (!item) return acc;
    const itemTax = item.taxPercentagePerProduct
      ? (item.itemSubtotal * item.taxPercentagePerProduct) / 100
      : 0;
    return acc + itemTax;
  }, 0);

  /**
   * What is still on the bill to be sent back.
   *
   * Refunds used to be offered the exchange list, which groups the bill by
   * product. Two lines of one dish — three as they come and two made Jain, or
   * a round ordered later — became a single row carrying only one of the two
   * order-item ids, and the server refused a refund that named more than that
   * one line held.
   */
  const refundableItems = refundableLines(selectedOrder?.orderItems);

  const seatsPeople = useFeatures().table_service_enabled;

  const isDisabled =
    selectedOrder?.orderStatus === "REFUNDED" || refundableItems.length === 0;

  return (
    <div className="pt-2 px-4 pb-2 flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 px-2 flex-wrap">
        {/* Invoice Badge */}
        <div className="gf-metal-green text-white font-bold text-[12px] py-1 px-3 rounded-full shadow-[0_3px_12px_var(--primary-alpha-30)] tracking-[0.04em] uppercase">
          {`Invoice ${selectedOrder.display_id}`}
        </div>

        {/* {selectedOrder.cartData?.table && (
    <div className="ml-auto">
      <span className="flex gap-2 items-center text-text-secondary">
        <svg
          style={{ width: "28px" }}
          version="1.1"
          id="Capa_1"
          xmlns="http://www.w3.org/2000/svg"
          x="0px"
          y="0px"
          viewBox="0 0 214.539 214.539"
        >
          <g>
            <g>
              <path d="M121.164,154.578h-6.625V89.14h38.937c4.014,0,7.269-3.254,7.269-7.269s-3.254-7.269-7.269-7.269h-92.41 c-4.014,0-7.269,3.254-7.269,7.269s3.254,7.269,7.269,7.269h38.936v65.438h-6.625c-4.014,0-7.269,3.254-7.269,7.27 c0,4.015,3.254,7.269,7.269,7.269h27.787c4.015,0,7.27-3.254,7.27-7.269C128.433,157.832,125.179,154.578,121.164,154.578z"></path>
              <path d="M73.783,120.777c0-4.014-3.254-7.269-7.269-7.269H54.833H34.219c-11.08,0-13.41-16.14-13.509-16.869l-6.239-45.122 c-0.55-3.977-4.217-6.748-8.196-6.205c-3.976,0.55-6.754,4.219-6.205,8.196l6.229,45.053c0.831,6.47,4.167,16.593,11.367,23.133 l-7.485,38.956c-0.758,3.942,1.824,7.752,5.766,8.509c3.946,0.761,7.752-1.825,8.509-5.766l6.792-35.349h17.579l6.792,35.349 c0.668,3.479,3.714,5.897,7.13,5.897c0.455,0,0.916-0.043,1.379-0.132c3.942-0.757,6.524-4.566,5.766-8.509l-6.265-32.605h2.883 C70.527,128.046,73.783,124.791,73.783,120.777z"></path>
              <path d="M208.267,45.313c-3.975-0.543-7.646,2.229-8.196,6.205l-6.244,45.165c-0.094,0.687-2.424,16.827-13.504,16.827h-20.614 h-11.681c-4.014,0-7.27,3.254-7.27,7.269s3.255,7.269,7.27,7.269h2.883l-6.265,32.605c-0.758,3.942,1.824,7.752,5.766,8.509 c3.946,0.761,7.752-1.825,8.509-5.766l6.792-35.349h17.579l6.792,35.349c0.668,3.479,3.714,5.897,7.13,5.897 c0.455,0,0.916-0.043,1.38-0.132c3.941-0.757,6.523-4.566,5.766-8.509l-7.485-38.953c7.198-6.534,10.532-16.64,11.357-23.065 l6.238-45.123C215.021,49.533,212.242,45.863,208.267,45.313z"></path>
            </g>
          </g>
        </svg>
        Table {selectedOrder.cartData?.table.tableName}
      </span>
    </div>
  )} */}

        {/* Customer Section */}
        {selectedOrder.customerId && (
          <div className="flex items-center gap-2 ml-auto px-2 py-1 rounded-lg bg-[var(--primary-alpha-5)] border border-[var(--primary-alpha-12)] text-[var(--theme-primary)] text-[12px] font-bold">
            {/* Circular avatar icon */}
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white border border-[var(--primary-alpha-20)] shrink-0">
              <svg viewBox="64 64 896 896" width="14" height="14" fill="var(--theme-primary)">
                <path d="M858.5 763.6a374 374 0 00-80.6-119.5 375.63 375.63 0 00-119.5-80.6c-.4-.2-.8-.3-1.2-.5C719.5 518 760 444.7 760 362c0-137-111-248-248-248S264 225 264 362c0 82.7 40.5 156 102.8 201.1-.4.2-.8.3-1.2.5-44.8 18.9-85 46-119.5 80.6a375.63 375.63 0 00-80.6 119.5A371.7 371.7 0 00136 901.8a8 8 0 008 8.2h60c4.4 0 7.9-3.5 8-7.8 2-77.2 33-149.5 87.8-204.3 56.7-56.7 132-87.9 212.2-87.9s155.5 31.2 212.2 87.9C779 752.7 810 825 812 902.2c.1 4.4 3.6 7.8 8 7.8h60a8 8 0 008-8.2c-1-47.8-10.9-94.3-29.5-138.2zM512 534c-45.9 0-89.1-17.9-121.6-50.4S340 407.9 340 362c0-45.9 17.9-89.1 50.4-121.6S466.1 190 512 190s89.1 17.9 121.6 50.4S684 316.1 684 362c0 45.9-17.9 89.1-50.4 121.6S557.9 534 512 534z" />
              </svg>
            </div>
            {/* Customer ID */}
            <p className="text-[12px] font-bold leading-none truncate max-w-[90px]">
              {selectedOrder.customerId}
            </p>
          </div>
        )}
      </div>
      {/* Items section header */}
      <div className="flex items-center justify-between px-2 pb-[6px] border-b border-[var(--primary-alpha-11)]">
        <h2 className="text-[11px] font-extrabold text-[var(--theme-primary)] tracking-[0.06em] uppercase">{t("invoice.originalItems")}</h2>
      </div>

      {/* Items List */}
      <div className="flex flex-col mt-2 overflow-auto custom-scroll text-sm pr-1 flex-1 min-h-0">
        {(selectedOrder.orderItems || selectedOrder.items || [])
          .filter(
            (item) => item.type !== "EXCHANGE_NEW" && item.type !== "RETURN",
          )
          .map((item, index) => (
            <div
              key={item.productId}
              className={`flex items-center justify-between gap-3 p-2.5 rounded-[12px] transition-all duration-150 mb-1.5 border border-transparent
          ${index % 2 === 0 ? "bg-white/80" : "bg-[var(--primary-alpha-3)]"} hover:bg-white hover:border-[var(--primary-alpha-11)] hover:shadow-[0_2px_10px_var(--primary-alpha-6)]`}
            >
              {/* LEFT SIDE */}
              <div className="flex items-center gap-2 min-w-0">
                {/* Image */}
                {/* <div className="w-10 h-10 min-w-[40px] rounded-[10px] overflow-hidden border border-[var(--primary-alpha-11)] bg-white/50">
                    <img
                      src={item.imageUrl || defaultImg}
                      alt={item.productName}
                      className="w-full h-full object-cover"
                    />
                  </div> */}

                {/* Details */}
                <div className="flex flex-col gap-[2px] min-w-0">
                  <p className="text-[13px] text-[var(--theme-primary-dark)] font-bold truncate max-w-[140px] sm:max-w-[200px]">
                    {item.productName || item.name}
                  </p>

                  <div className="flex flex-wrap gap-1 text-[var(--primary-alpha-60)] text-[11px] font-medium">
                    <span>{cur()}{Number(item.unitPrice || item.price || 0).toFixed(2)}</span>

                    <span>×</span>

                    <span>
                      {Number(item.quantity)}
                    </span>

                    <span>
                      {item.unit || "pcs"}
                    </span>

                    {/* REFUND */}
                    {selectedOrder.refunded > 0 && (
                      <div>
                        {(() => {
                          const totalReturned = (
                            selectedOrder.refundHistory || []
                          ).reduce((acc, refund) => {
                            const match = refund.items?.find(
                              (ri) => ri.orderItemId === item.productId,
                            );
                            return acc + (match ? match.quantity : 0);
                          }, 0);

                          if (item.refundQuantity <= 0) return null;

                          return (
                            <div className="flex items-center gap-1 text-green-600 font-semibold">
                              <svg
                                viewBox="64 64 896 896"
                                width="12"
                                height="12"
                              >
                                <path
                                  fill="currentColor"
                                  d="M511.4 124C290.5 124.3 112 303 112 523.9c0 128 60.2 242 153.8 315.2l-37.5 48c-4.1 5.3-.3 13 6.3 12.9l167-.8c5.2 0 9-4.9 7.7-9.9L369.8 727a8 8 0 00-14.1-3L315 776.1c-10.2-8-20-16.7-29.3-26a318.64 318.64 0 01-68.6-101.7C200.4 609 192 567.1 192 523.9s8.4-85.1 25.1-124.5c16.1-38.1 39.2-72.3 68.6-101.7 29.4-29.4 63.6-52.5 101.7-68.6C426.9 212.4 468.8 204 512 204s85.1 8.4 124.5 25.1c38.1 16.1 72.3 39.2 101.7 68.6 29.4 29.4 52.5 63.6 68.6 101.7 16.7 39.4 25.1 81.3 25.1 124.5s-8.4 85.1-25.1 124.5a318.64 318.64 0 01-68.6 101.7c-7.5 7.5-15.3 14.5-23.4 21.2a7.93 7.93 0 00-1.2 11.1l39.4 50.5c2.8 3.5 7.9 4.1 11.4 1.3C854.5 760.8 912 649.1 912 523.9c0-221.1-179.4-400.2-400.6-399.9z"
                                />
                              </svg>
                              <span>{item.refundQuantity}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE (PRICE) */}
              <div className="text-[13px] font-extrabold text-[var(--theme-secondary)] whitespace-nowrap">
                {cur()}{parseFloat(item.subtotal || item.total).toFixed(2)}
              </div>
            </div>
          ))}

        {/* --- Bottom Section SAME --- */}
        {selectedOrder?.orderItems?.some(
          (item) => item.type === "RETURN" || item.type === "EXCHANGE_NEW",
        ) && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-text-secondary uppercase pb-1 border-b border-border-default">
                {t("invoice.exchanges")}
              </h3>

              {/* 🔴 RETURN ITEMS */}
              {selectedOrder.orderItems
                .filter((item) => item.type === "RETURN")
                .map((item, i) => (
                  <div
                    key={item.orderItemId}
                    className={`flex my-1 p-2 rounded-lg justify-between items-center text-sm font-semibold text-red-500 border border-dashed border-border-default ${i % 2 === 0 ? "bg-surface" : "bg-background"
                      }`}
                  >
                    <div className="flex gap-2 items-center">
                      <img
                        src={item.imageUrl || defaultImg}
                        className="w-10 h-10 rounded-md border"
                      />
                      <div className="flex flex-col">
                        <span>{item.productName}</span>
                        <span className="text-text-muted text-xs">
                          {cur()}{Number(item.unitPrice || 0).toFixed(2)} × {Math.abs(item.quantity)} (Old)
                        </span>
                      </div>
                    </div>
                    <span>-{cur()}{Math.abs(Number(item.subtotal) || 0).toFixed(2)}</span>
                  </div>
                ))}

              {/* 🟢 EXCHANGE NEW ITEMS */}
              {selectedOrder.orderItems
                .filter((item) => item.type === "EXCHANGE_NEW")
                .map((item, i) => (
                  <div
                    key={item.orderItemId}
                    className={`flex my-1 p-2 rounded-lg justify-between items-center text-sm font-semibold border border-dashed border-border-default ${i % 2 === 0 ? "bg-background" : "bg-surface"
                      }`}
                  >
                    <div className="flex gap-2 items-center">
                      <img
                        src={item.imageUrl || defaultImg}
                        className="w-10 h-10 rounded-md border"
                      />
                      <div className="flex flex-col">
                        <span className="text-green-600">
                          {item.productName}
                        </span>
                        <span className="text-text-muted text-xs">
                          {cur()}{Number(item.unitPrice || 0).toFixed(2)} × {item.quantity} (New)
                        </span>
                      </div>
                    </div>
                    <span className="text-green-600">{cur()}{(Number(item.subtotal) || 0).toFixed(2)}</span>
                  </div>
                ))}
            </div>
          )}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-3 border-t border-[var(--primary-alpha-11)] text-sm sticky bottom-0 bg-white/70 backdrop-blur-md pb-2">
        {/* GRID SECTION (layout) */}
        <div className="text-[var(--primary-alpha-70)] font-bold grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] sm:text-[12px] bg-[var(--primary-alpha-3)] p-3 rounded-[12px] border border-[var(--primary-alpha-8)] mb-3">
          <div className="flex justify-between items-center">
            <p>{t("cart.subtotal")}</p>
            <span className="text-[var(--theme-primary-dark)]">{cur()}{parseFloat(selectedOrder?.subtotal).toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center">
            <p>{taxLabel()}</p>
            <span className="text-[var(--theme-primary-dark)]">{cur()}{(Number(selectedOrder?.taxAmount) || 0).toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center text-[var(--theme-secondary)] bg-[var(--secondary-alpha-6)] px-2 py-0.5 rounded-md">
            <p>{t("cart.discount")}</p>
            <span>-{cur()}{(Number(selectedOrder.discountAmount) || 0).toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center text-[var(--theme-primary)] font-extrabold text-[13px] bg-[var(--primary-alpha-8)] px-2 py-0.5 rounded-md border border-[var(--primary-alpha-14)]">
            <p>{t("invoice.total")}</p>
            <span>{cur()}{parseFloat(selectedOrder?.totalAmount).toFixed(2)}</span>
          </div>

          {/* Most bills are paid once and never touched again. These two read
              "0.00" on every one of them, which is two lines of nothing to
              look past — they appear the moment there is something to say. */}
          {Number(selectedOrder.refunded) > 0 && (
            <div className="flex justify-between items-center text-green-600">
              <p>{t("invoice.refunded")}</p>
              <span>{cur()}{(Number(selectedOrder.refunded) || 0).toFixed(2)}</span>
            </div>
          )}

          {(exchangeRefundAmount > 0 || exchangeReceiveAmount > 0) && (
            <div className="flex justify-between items-center text-green-600">
              <p>
                Exchanged
                {exchangeRefundAmount
                  ? " (Refund)"
                  : exchangeReceiveAmount
                    ? " (Receive)"
                    : ""}
              </p>
              <span>
                {/* This said "P0.00". A stray letter where the rupee sign
                    belongs — every other figure on the bill uses cur(). */}
                {cur()}
                {exchangeReceiveAmount
                  ? exchangeReceiveAmount.toFixed(2)
                  : exchangeRefundAmount.toFixed(2)}
              </span>
            </div>
          )}

          {selectedOrder?.payments?.map((item, i) => (
            <div key={i} className="flex justify-between col-span-2">
              <p className="capitalize">
                {item?.paymentMethod || item.name} (tendered Amount)
              </p>
              <span>{cur()}{(Number(item?.amount) || 0).toFixed(2)}</span>
            </div>
          ))}

          <div className="flex justify-between col-span-2">
            <p>{t("invoice.change")}</p>
            <span>
              {cur()}
              {Number(
                selectedOrder?.transactions?.[0]?.cashReturned ??
                  selectedOrder?.cashReturned ??
                  0
              ).toFixed(2)}
            </span>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className={`grid ${seatsPeople ? "grid-cols-2" : "grid-cols-1"} gap-1.5 sm:gap-2 mt-4 mb-2 w-full`}>

          {/* PRINT */}
          <button
            className="h-[42px] group flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3 rounded-xl border border-border-default bg-surface text-text-secondary font-bold text-[10px] sm:text-xs transition-all duration-300 hover:shadow-md hover:border-[var(--primary-alpha-30)] hover:bg-[var(--primary-alpha-4)] active:scale-[0.97] whitespace-nowrap overflow-hidden w-full"
            onClick={() => setShowPrintSlip(true)}
            title={t("invoice.printInvoice")}
          >
            <span className="shrink-0 transition-transform duration-300 group-hover:scale-110">
              {/* Printer icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </span>
            <span className="truncate">{t("invoice.print")}</span>
          </button>

          {/* REFUND — money back out of the till, which a counter does not
              do. A ten-rupee ice cream is already eaten by the time anyone
              could ask, and the button sat there inviting a cashier to open
              the drawer for a sale nobody is coming back about. */}
          {seatsPeople && <button
            className={`h-[42px] group flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3 rounded-xl border font-bold text-[10px] sm:text-xs transition-all duration-300 active:scale-[0.97] whitespace-nowrap overflow-hidden w-full
              ${isDisabled
                ? "opacity-50 cursor-not-allowed bg-surface text-text-muted border-border-default"
                : "border-[var(--secondary-alpha-35)] bg-[var(--secondary-alpha-5)] text-[var(--theme-secondary)] hover:bg-[var(--theme-secondary)] hover:text-[var(--theme-primary-darker)] hover:shadow-md"
              }`}
            disabled={isDisabled}
            onClick={() => setShowRefund(true)}
            title={t("invoice.refund")}
          >
            <span className="shrink-0 transition-transform duration-300 group-hover:scale-110">
              {/* Arrow-back / refund icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </span>
            <span className="truncate">{t("invoice.refund")}</span>
          </button>}

        </div>

      </div>
      <PrintInvoiceSlip
        show={showPrintSlip}
        setShow={setShowPrintSlip}
        orderDetails={selectedOrder}
      />
      <RefundPopup
        open={showRefund}
        disabled={isDisabled}
        onClose={() => setShowRefund(false)}
        items={refundableItems}
        orderId={selectedOrder?.orderId} // Pass the ID
        onProcessRefund={onRefund} // Pass the function
      />
    </div>
  );
};

export default InvoiceFrom;
