import { splitStoredTax, billHeading } from "../../../utils/gst";
import { cur } from "../../../utils/currency";
import React, { useEffect, useRef, useState } from "react";
import { RECEIPT_PRINT_CSS } from "../../../utils/receiptStyles";
import { printSlip } from "../../../utils/printSlip";
import SlipBody from "../print/SlipBody";
import { billMoment } from "../../../utils/billMoment";
import { useAuthStore } from "../../../store/useAuthStore";

const PrintInvoiceSlip = ({ show, setShow = false, orderDetails }) => {
  const printRef = useRef();
  const user = useAuthStore((u) => u.user);
  const [ReceiveAmount, setReceiveAmount] = useState(0.0);
  const [RefundAmound, setRefundAmount] = useState(0.0);
  const isPrinting = useRef(false);

  /**
   * The till printer first, the browser only if there is no till printer.
   *
   * The helper is what reaches the cable. On a machine without one — a
   * tablet a captain carries, a till nobody has set up yet — the old
   * dialog still opens, so no screen loses the ability to print.
   */
  const handlePrint = async () => {
    if (isPrinting.current) return;

    isPrinting.current = true;
    let printed = "none";
    try {
      printed = await printSlip(printRef.current, null);
    } catch {
      printed = "none";
    } finally {
      isPrinting.current = false;
    }

    if (printed === "printer") {
      if (typeof setShow === "function") setShow(false);
      return;
    }

    printThroughTheBrowser();
  };

  const printThroughTheBrowser = () => {
    if (!printRef?.current || !orderDetails || isPrinting.current) return;
    isPrinting.current = true;

    const formatDateForFilename = (dt) => {
      try {
        return dt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" }).replace(", ", ", ");
      } catch { return ""; }
    };
    const printDate = orderDetails?.orderDate ? new Date(orderDetails.orderDate) : new Date();
    const datePart = formatDateForFilename(printDate);
    const filename = `${datePart ? `${datePart} ` : ""}(Invoice #${orderDetails?.orderId ?? "Receipt"})`;
    const originalTitle = document.title;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "display:none;position:fixed;right:0;bottom:0;width:0;height:0;border:none;";
    document.body.appendChild(iframe);

    iframe.contentDocument.write(`
      <html>
        <head>
          <title>${filename}</title>
          <style>${RECEIPT_PRINT_CSS}</style>
        </head>
        <body>${printRef.current.innerHTML}</body>
      </html>
    `);

    iframe.contentDocument.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      try { document.title = originalTitle; } catch { }
      isPrinting.current = false;
      setShow(false);
    }, 500);
  };

  useEffect(() => {
    if (!orderDetails?.orderItems?.length) {
      setRefundAmount(0);
      setReceiveAmount(0);
      return;
    }

    const safeNum = (val) => (isNaN(Number(val)) ? 0 : Number(val));
    const { returnTotal, newTotal } = orderDetails.orderItems.reduce(
      (totals, item) => {
        const subtotal    = safeNum(item?.subtotal);
        const baseAmount  = Math.abs(subtotal);
        const taxPct      = safeNum(item?.taxPercentagePerProduct ?? item?.tax_percentage_per_product ?? 0);
        const grandTotal  = baseAmount + (baseAmount * taxPct) / 100;
        if (item?.type === "RETURN") totals.returnTotal += grandTotal;
        else if (item?.type === "EXCHANGE_NEW" || item?.type === "REEXCHANGE_NEW") totals.newTotal += grandTotal;
        return totals;
      },
      { returnTotal: 0, newTotal: 0 }
    );

    const diff = newTotal - returnTotal;
    if (diff > 0)      { setRefundAmount(0); setReceiveAmount(diff); }
    else if (diff < 0) { setRefundAmount(Math.abs(diff)); setReceiveAmount(0); }
    else               { setRefundAmount(0); setReceiveAmount(0); }
  }, [orderDetails]);

  useEffect(() => {
    if (show === true && orderDetails) {
      handlePrint();
    }
  }, [show, orderDetails]);

  /* ──────── helpers ──────── */

  const formatQty = (item) => {
    const isWeighed = item.unit === "gm" || item.unit === "kg";
    return isWeighed ? `${item.quantity} kg` : `${item.quantity}`;
  };

  /* ──────── computed ──────── */
  const allItems      = orderDetails?.orderItems || [];
  const originalItems = allItems.filter(i => i.type === null || !i.type);
  const exchangeItems = allItems.filter(i => i.type === "RETURN" || i.type === "EXCHANGE_NEW" || i.type === "REEXCHANGE_NEW");

  const gst = splitStoredTax(orderDetails?.taxAmount, orderDetails?.gst_percentage);

  const outletName    = orderDetails?.outletName || user?.outlet_name || "Restaurant";
  // Both are set per outlet in the hotel admin and are only ever printed.
  // A restaurant below the GST threshold has no number, and the bill then
  // simply does not carry that line rather than showing an empty one.
  const outletGstin   = orderDetails?.outletGstin || user?.outlet_gstin || "";
  const outletTagline = orderDetails?.outletTagline || user?.outlet_tagline || "";
  const outletAddress = orderDetails?.outletAddress || user?.outlet_address;
  const outletContact = orderDetails?.outletContact || user?.outlet_contact;
  const resolveCustomerName = () => {
    if (orderDetails?.customer?.first_name || orderDetails?.customer?.last_name) {
      return [orderDetails.customer.first_name, orderDetails.customer.last_name].filter(Boolean).join(" ");
    }
    if (typeof orderDetails?.customerName === "string") return orderDetails.customerName;
    if (orderDetails?.customerName?.fullName) return orderDetails.customerName.fullName;
    return null;
  };
  const customerName = resolveCustomerName();

  // Printed under the name. A reprint has to show the same details the
  // guest was given the first time.
  const customerPhone =
    orderDetails?.customer?.phone_number ||
    orderDetails?.customer?.phone ||
    orderDetails?.customer?.phoneNumber ||
    orderDetails?.customerPhone ||
    "";

  const tableDisplay = orderDetails?.table?.tableNumber
    ? `Table ${orderDetails.table.tableNumber}`
    : orderDetails?.tableName
    ? orderDetails.tableName
    : null;

  const isTableOrder = !!tableDisplay || (orderDetails?.order_type || orderDetails?.orderType) === "DINE_IN" || (orderDetails?.order_type || orderDetails?.orderType) === "dine_in";
  const staffRole    = isTableOrder ? "Captain" : "Cashier";
  const staffName    = orderDetails?.cashierName || user?.first_name || "-";

  const dateSource = orderDetails?.orderDate || orderDetails?.createdAt || orderDetails?.created_at;
  const invoiceId = orderDetails?.display_id || orderDetails?.orderId || orderDetails?.serverOrderId || "-";

  const discountAmount = parseFloat(orderDetails?.discountAmount || 0);
  const subtotal = parseFloat(orderDetails?.subtotal || 0);
  const grandTotal = parseFloat(orderDetails?.totalAmount || 0);

  /**
   * The number the guest is called by while the food is cooked.
   *
   * Given to the sale when it was rung up and kept with it, so the slip in
   * the guest's hand and the screen above the pass always say the same
   * thing. Only a parcel has one — a table is called by its number.
   */
  const tokenNumber = orderDetails?.token_no ?? orderDetails?.tokenNo ?? "";

  const orderTypeLabel = (() => {
    const raw = String(orderDetails?.order_type || orderDetails?.orderType || "").toUpperCase();
    if (raw.includes("PARCEL") || raw.includes("TAKE")) return "Parcel";
    if (raw.includes("DELIVER")) return "Delivery";
    if (raw.includes("DINE")) return "Dine In";
    return tableDisplay ? "Dine In" : "Counter";
  })();

  // What was actually taken, not what was owed. A bill that says PAID when
  // nothing was collected is worse than one that says nothing.
  const paidSoFar = (orderDetails?.payments || [])
    .reduce((sum, p) => sum + (parseFloat(p?.amount) || 0), 0);
  const paymentStatus = paidSoFar > 0 || String(orderDetails?.payment_status || "").toUpperCase() === "PAID"
    ? "PAID"
    : "UNPAID";
  const paymentModes = [...new Set(
    (orderDetails?.payments || []).map((p) => p?.paymentMethod).filter(Boolean)
  )].join(", ");

  const stamp = billMoment(dateSource || new Date());


  return (
    <div ref={printRef} style={{ display: "none" }}>
      <SlipBody
        outlet={{ name: outletName, tagline: outletTagline, address: outletAddress, contact: outletContact, gstin: outletGstin }}
        title={billHeading()}
        billNo={invoiceId}
        dateTime={stamp}
        orderType={orderTypeLabel}
        tableNo={tableDisplay}
        token={tokenNumber}
        staffRole={staffRole}
        staffName={staffName}
        items={originalItems.map((item) => ({
          name: item.productName || item.name || "Item",
          jain: item.jain === true || item.is_jain === true,
          qty: formatQty(item),
          rate: Math.abs(parseFloat(item.unitPrice || item.price || 0)),
          amount: Math.abs(parseFloat(item.subtotal || item.total || 0)),
        }))}
        exchanges={exchangeItems.map((item) => ({
          name: item.productName || item.name || "Item",
          tag: item.type === "RETURN" ? "RET" : "NEW",
          qty: formatQty(item),
          rate: Math.abs(parseFloat(item.unitPrice || 0)),
          amount: Math.abs(parseFloat(item.subtotal || 0)),
          negative: item.type === "RETURN",
        }))}
        subtotal={subtotal}
        discount={discountAmount}
        gst={gst}
        grandTotal={grandTotal}
        currency={cur()}
        customerName={customerName}
        customerPhone={customerPhone}
        paymentRows={[
          ...(orderDetails?.payments || []).map((p, i) => ({
            label: p?.paymentMethod || `Payment ${i + 1}`,
            value: parseFloat(p?.amount ?? orderDetails?.tenderedAmount ?? 0),
          })),
          ...((orderDetails?.cashReturned > 0 || orderDetails?.transactions?.[0]?.cashReturned > 0)
            ? [{ label: "Change", value: parseFloat(orderDetails?.cashReturned || orderDetails?.transactions?.[0]?.cashReturned || 0) }]
            : []),
          ...((RefundAmound > 0 || ReceiveAmount > 0)
            ? [{ label: `Exchange (${RefundAmound > 0 ? "Refund" : "Receive"})`, value: RefundAmound || ReceiveAmount }]
            : []),
          ...(orderDetails?.refunded > 0
            ? [{ label: "Refunded", value: parseFloat(orderDetails.refunded) }]
            : []),
        ]}
        paymentStatus={paymentStatus}
        paymentModes={paymentModes}
        itemCount={allItems.length}
      />
    </div>
  );
};

export default PrintInvoiceSlip;
