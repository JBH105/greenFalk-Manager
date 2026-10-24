import React from "react";
import { registrationLabel, taxIncludedNote } from "../../../utils/gst";

/**
 * The bill. One copy of it, for every screen that prints one.
 *
 * There were two: the slip the cashier gets when the guest pays, and the slip
 * the Invoices screen prints when someone asks for the bill again. They were
 * built separately and drifted — the second was given the owner's layout, the
 * registration number, the token, the date and time on one line, and the first
 * quietly kept printing the old one. A guest who paid and then asked for a copy
 * was handed two different-looking bills for the same meal.
 *
 * So the layout lives here and nowhere else. The two screens still gather their
 * own facts, because they hold them in different shapes, but neither decides
 * what a bill looks like any more.
 *
 * The class names are the layout: the stylesheet dresses them for the browser,
 * and slipToText reads them to write the same bill in the printer's own
 * language. Renaming one without the other breaks the printed slip silently.
 */
const SlipBody = ({
  outlet = {},
  title = "Invoice",
  billNo,
  dateTime,
  orderType,
  tableNo,
  token,
  staffRole = "Cashier",
  staffName,
  items = [],
  exchanges = [],
  subtotal = 0,
  discount = 0,
  gst = null,
  grandTotal = 0,
  currency = "",
  customerName,
  customerPhone,
  paymentRows = [],
  paymentStatus,
  paymentModes,
  itemCount,
}) => {
  const money = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0).toFixed(2);
  let sr = 1;

  const row = (item, key) => (
    <tr key={key}>
      <td className="col-sr r" style={{ fontSize: "9px", color: "#555" }}>{sr++}</td>
      <td className="col-name" style={{ paddingLeft: "4px" }}>
        {/* Jain sits beside the dish, not under it: the line reads as one
            thing and the bill stays a line shorter for every such dish. */}
        <div className="item-name">
          {item.name}
          {item.jain ? " (Jain)" : ""}
          {item.tag ? <span className="item-tag">{item.tag}</span> : null}
        </div>
      </td>
      <td className="col-qty c">{item.qty}</td>
      <td className="col-rate r">{money(item.rate)}</td>
      <td className="col-amt r bold">{item.negative ? "-" : ""}{money(item.amount)}</td>
    </tr>
  );

  return (
    <>
      {/* ── WHO IS SELLING ── */}
      <p className="shop-name">{outlet.name || "Restaurant"}</p>
      {outlet.tagline && <p className="center shop-tagline">{outlet.tagline}</p>}
      {outlet.address && <p className="center">{outlet.address}</p>}
      {outlet.contact && <p className="center">Ph: {outlet.contact}</p>}
      {/* What makes the slip a tax invoice rather than a receipt. The number
          is called a GSTIN in India and a TRN in the UAE, and printing the
          wrong word over the right number is a bill the tax authority does
          not recognise. */}
      {outlet.gstin && <p className="center">{registrationLabel()}: {outlet.gstin}</p>}

      <p className="doc-title">{title}</p>

      <hr className="dash" />

      {/* ── WHICH BILL, AND WHEN ── */}
      <div className="meta"><span className="k">Bill No.</span><span className="v">{billNo || "-"}</span></div>
      {dateTime && <div className="meta"><span className="k">Date &amp; Time</span><span className="v">{dateTime}</span></div>}
      {orderType && <div className="meta"><span className="k">Order Type</span><span className="v">{orderType}</span></div>}
      {tableNo && <div className="meta"><span className="k">Table No.</span><span className="v">{tableNo}</span></div>}
      {token && <div className="meta"><span className="k">Token No.</span><span className="v">{token}</span></div>}
      {staffName && <div className="meta"><span className="k">{staffRole}</span><span className="v">{staffName}</span></div>}

      {/* ── WHAT WAS EATEN ── */}
      <table>
        <thead>
          <tr>
            <th className="col-sr r">#</th>
            <th className="col-name" style={{ paddingLeft: "4px" }}>Item</th>
            <th className="col-qty c">Qty</th>
            <th className="col-rate r">Unit</th>
            <th className="col-amt r">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => row(item, `it-${i}`))}

          {exchanges.length > 0 && (
            <tr>
              <td colSpan="5" style={{ fontWeight: 700, textAlign: "center", borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "3px 0", fontSize: "10px" }}>
                EXCHANGES
              </td>
            </tr>
          )}
          {exchanges.map((item, i) => row(item, `ex-${i}`))}
        </tbody>

        {/* ── WHAT IS OWED, in the order it happens ── */}
        <tfoot>
          <tr>
            <td colSpan="3"></td>
            <td className="r" style={{ borderTop: "1px dashed #000", paddingTop: "2px" }}>SUBTOTAL</td>
            <td className="r bold" style={{ borderTop: "1px dashed #000", paddingTop: "2px" }}>{money(subtotal)}</td>
          </tr>
          {discount > 0 && (
            <tr><td colSpan="3"></td><td className="r">Discount</td><td className="r">-{money(discount)}</td></tr>
          )}
          {/* Tax, in as many lines as the country charges it in.
              India halves GST into CGST and SGST. The UAE charges a single
              VAT, and a Dubai bill showing halves of it under Indian names
              is not a valid tax invoice — so the split is asked for rather
              than assumed. `split` is undefined on a bill rendered from an
              older cached setting, which reads as India, as it always was. */}
          {gst?.total > 0 && gst.split !== false ? (
            <>
              <tr><td colSpan="3"></td><td className="r">CGST ({gst.cgstPercentage}%)</td><td className="r">{money(gst.cgst)}</td></tr>
              <tr><td colSpan="3"></td><td className="r">SGST ({gst.sgstPercentage}%)</td><td className="r">{money(gst.sgst)}</td></tr>
            </>
          ) : null}
          {gst?.total > 0 && gst.split === false && (
            <tr>
              <td colSpan="3"></td>
              <td className="r">{gst.label || "VAT"} ({gst.percentage}%)</td>
              <td className="r">{money(gst.total)}</td>
            </tr>
          )}
          <tr className="grand">
            <td colSpan="3" style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.05em" }}>TOTAL</td>
            <td colSpan="2" className="r">{currency}{money(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Where the menu price already carried the tax, the guest is owed the
          words for it: the total above is not the food plus something, it is
          the price they were quoted, with the tax named inside it. Empty, and
          so invisible, in a country that adds the tax on top. */}
      {taxIncludedNote() && <p className="center">{taxIncludedNote()}</p>}

      {/* ── WHO IT WAS FOR ── */}
      <hr className="dash" />
      <div className="meta">
        <span className="k">Customer Name</span>
        <span className="v">{customerName || (tableNo ? "Dine In Guest" : "Walk In")}</span>
      </div>
      {customerPhone && <div className="meta"><span className="k">Mobile</span><span className="v">{customerPhone}</span></div>}

      {/* ── WHAT WAS TAKEN ── */}
      {(paymentRows.length > 0 || paymentStatus) && <hr className="dash" />}
      {paymentRows.map((p, i) => (
        <div className="pay-row" key={`pay-${i}`}>
          <span>{p.label}</span>
          <span style={{ fontWeight: "600" }}>{currency}{money(p.value)}</span>
        </div>
      ))}
      {paymentStatus && <div className="meta"><span className="k">Payment Status</span><span className="v">{paymentStatus}</span></div>}
      {paymentModes && <div className="meta"><span className="k">Payment Mode</span><span className="v">{paymentModes}</span></div>}

      <hr className="dash" />

      <p className="footer-items">Total Items: {itemCount ?? items.length + exchanges.length}</p>
      <p className="footer-thanks">THANK YOU, VISIT AGAIN!</p>
    </>
  );
};

export default SlipBody;
