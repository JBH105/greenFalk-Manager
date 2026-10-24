import React, { useEffect, useRef } from "react";
import { RECEIPT_PRINT_CSS } from "../../../utils/receiptStyles";
import { printSlip } from "../../../utils/printSlip";
import SlipBody from "../print/SlipBody";
import { billMoment } from "../../../utils/billMoment";
import { useAuthStore } from "../../../store/useAuthStore";
// A held round is nobody's invoice yet; a settled bill that charged tax is
// one, and has to say so in those words — billHeading supplies them.
import { splitStoredTax, billHeading } from "../../../utils/gst";
import { cur } from "../../../utils/currency";

const PrintOrder = ({ show, setShow, finalOrderData, isHold = false }) => {
  const user = useAuthStore((u) => u.user);
  const printRef = useRef();
  const isPrinting = useRef(false);
  const originalTitle = document.title;

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
    if (!printRef?.current || !finalOrderData || isPrinting.current) return;
    isPrinting.current = true;

    const filename = `Invoice_${finalOrderData.display_id || finalOrderData.displayId || Date.now()}`;
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
    try { document.title = filename; } catch { }

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      try { document.title = originalTitle; } catch { }
      isPrinting.current = false;
      setShow(false);
    }, 500);
  };

  useEffect(() => {
    if (show === true && finalOrderData) {
      handlePrint();
      setShow(false);
    }
  }, [show, finalOrderData]);

  /* ──────── helpers ──────── */
  const getDiscountValue = () => {
    const { discount, subtotal, taxAmound, tax_amount, taxAmount, discount_amount, discountAmount } = finalOrderData || {};
    if (discount && typeof discount === "object") {
      if (discount.type === "PERCENT") {
        const base = (parseFloat(subtotal) || 0) + (parseFloat(tax_amount || taxAmount || taxAmound) || 0);
        return base * (discount.value / 100);
      }
      if (discount.type === "FIXED") return discount.value || 0;
      if (discount.value) return (parseFloat(subtotal) || 0) * (discount.value / 100);
      return 0;
    }
    return discount_amount || discountAmount || (typeof discount === "number" ? discount : 0);
  };


  const formatQty = (item) => {
    if (item.unit === "gm" || item.unit === "kg") return `${item.quantity} kg`;
    return `${item.quantity}`;
  };

  /* ──────── computed ──────── */
  const discountValue = parseFloat(getDiscountValue()) || 0;
  const orderItems    = finalOrderData?.orderItems || finalOrderData?.order_items || [];
  const paymentArray  = finalOrderData?.payments   || finalOrderData?.payment    || [];
  const subtotal      = parseFloat(finalOrderData?.subtotal || 0);
  const grandTotal    = parseFloat(
    finalOrderData?.totalAmountToPay || finalOrderData?.total_amount ||
    finalOrderData?.totalAmount      || finalOrderData?.amount || 0
  );
  const change = parseFloat(
    finalOrderData?.cashReturned || finalOrderData?.change_amount ||
    finalOrderData?.transactions?.[0]?.cash_returned || 0
  );
  const gst = splitStoredTax(
    finalOrderData?.tax_amount || finalOrderData?.taxAmount || finalOrderData?.tax || 0,
    finalOrderData?.gst_percentage
  );

  const invoiceNo  = finalOrderData?.displayId || finalOrderData?.display_id || "-";
  const tableNo   = finalOrderData?.table?.tableNumber;
  const orderType = (finalOrderData?.order_type || finalOrderData?.orderType || "").replace("_", "-").toLowerCase();
  
  const isTableOrder = !!tableNo || orderType === "dine-in";
  const staffRole  = isTableOrder ? "Captain" : "Cashier";
  const cashier    = finalOrderData?.cashierName || finalOrderData?.user?.first_name || user?.first_name || "-";

  // The bill is asked for by name at the counter, so it is always on the
  // receipt. The customer may arrive under any of these spellings depending
  // on whether it came from the cart, the server or a resumed bill.
  const customerName = [
    finalOrderData?.customer?.firstName || finalOrderData?.customer?.first_name,
    finalOrderData?.customer?.lastName  || finalOrderData?.customer?.last_name,
  ].filter(Boolean).join(" ")
    || (typeof finalOrderData?.customerName === "string" ? finalOrderData.customerName : "")
    || finalOrderData?.customer_name
    || "";

  const customerPhone =
    finalOrderData?.customer?.phone ||
    finalOrderData?.customer?.phoneNumber ||
    finalOrderData?.customer?.phone_number ||
    finalOrderData?.customerPhone ||
    "";

  /**
   * The number the guest is called by while the food is cooked.
   *
   * Given to the sale when it was rung up and kept with it, so the slip in
   * the guest's hand and the screen above the pass always say the same
   * thing. Only a parcel has one — a table is called by its number.
   */
  const tokenNumber = finalOrderData?.token_no ?? finalOrderData?.tokenNo ?? "";

  const orderTypeLabel = (() => {
    const raw = String(orderType || "").toUpperCase();
    if (raw.includes("PARCEL") || raw.includes("TAKE")) return "Parcel";
    if (raw.includes("DELIVER")) return "Delivery";
    if (raw.includes("DINE")) return "Dine In";
    return tableNo ? "Dine In" : "Counter";
  })();

  // What was actually taken. A slip that says PAID when nothing was
  // collected is worse than one that says nothing at all.
  const paidSoFar = paymentArray.reduce((sum, p) => sum + (parseFloat(p?.amount ?? p?.amountPaid ?? 0) || 0), 0);
  const paymentStatus = isHold ? "UNPAID" : (paidSoFar > 0 ? "PAID" : "UNPAID");
  const paymentModes = [...new Set(
    paymentArray.map((p) => p?.paymentMethod || p?.payment_method).filter(Boolean)
  )].join(", ");

  const when = billMoment(
    finalOrderData?.order_date || finalOrderData?.created_at || finalOrderData?.createdAt || new Date()
  );

  return (
    <div ref={printRef} style={{ display: "none" }}>
      <SlipBody
        outlet={{
          name: user?.outlet_name,
          tagline: user?.outlet_tagline,
          address: user?.outlet_address,
          contact: user?.outlet_contact,
          gstin: user?.outlet_gstin,
        }}
        title={isHold ? "Hold Order" : billHeading()}
        billNo={invoiceNo}
        dateTime={when}
        orderType={orderTypeLabel}
        tableNo={tableNo}
        token={tokenNumber}
        staffRole={staffRole}
        staffName={cashier}
        items={(orderItems || []).map((item) => {
          const rate = parseFloat(item.unitPrice || item.price || item.unit_price || 0) || 0;
          const qty = parseFloat(item.quantity ?? item.qty ?? 0) || 0;
          // An order just saved sends back the line as the till wrote it:
          // a price and a count, with no total worked out. Reading only a
          // total left every line on the cashier's copy at 0.00.
          const sent = parseFloat(item.subtotal ?? item.total ?? item.total_amount ?? NaN);
          return {
            name: item.productName || item.name || item.product_name || "Item",
            jain: item.jain === true || item.is_jain === true,
            qty: formatQty(item),
            rate,
            amount: Number.isFinite(sent) ? sent : rate * qty,
          };
        })}
        subtotal={subtotal}
        discount={discountValue}
        gst={gst}
        grandTotal={grandTotal}
        currency={cur()}
        customerName={customerName}
        customerPhone={customerPhone}
        paymentRows={[
          ...paymentArray.map((p, i) => ({
            label: p?.paymentMethod || p?.payment_method || `Payment ${i + 1}`,
            value: parseFloat(p?.amount ?? p?.amountPaid ?? 0),
          })),
          ...(change > 0 ? [{ label: "Change", value: change }] : []),
        ]}
        paymentStatus={paymentStatus}
        paymentModes={paymentModes}
        itemCount={(orderItems || []).length}
      />
    </div>
  );
};

export default PrintOrder;
