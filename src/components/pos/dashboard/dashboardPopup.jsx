import React, { useEffect, useState } from "react";
import { useT } from "../../../i18n";
import PrintOrder from "./PrintOrder";
import ShortcutLabel from "../../common/ShortcutLabel";
import PhoneInputWithCode from "../../phoneCodeInput/PhoneInputWithCode";
import CustomerNameInput from "../customer/CustomerNameInput";
import { useOrderStore } from "../../../store/useOrderStore";
import { useFeatures } from "../../../hooks/useFeatures";

const DashboardPopup = ({
  activePopup,
  setActivePopup,
  orderId,
  isPrinting,
  setIsPrinting,
  orderData,
  customerDetails,
  setCustomerDetails,
  handleCustomerChange,
  resetCart,
  setCartProducts,
  setPayToProceed,
  handleWhatsApp,
}) => {
  const t = useT();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const seatsPeople = useFeatures().table_service_enabled;

  // --- ACTIONS ---
  const onWhatsAppAction = () => {
    // Closed to a counter from the keyboard as well as the screen, so the
    // shortcut cannot open a form the button no longer offers.
    if (!seatsPeople) return;
    if (isOnline) {
      if (
        orderData?.customer?.phone_code &&
        orderData?.customer?.phone_number
      ) {
        handleWhatsApp();
      } else {
        setActivePopup("customer");
      }
    }
  };

  const onCancelAction = () => {
    setActivePopup(null);
    setPayToProceed(false);
    resetCart();
    setCartProducts([]);
  };

  const onPrintAction = () => setIsPrinting(true);

  // --- SHORTCUTS ---
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Don't trigger if user is typing in the Customer Name input or Phone input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      if (activePopup === "receipt") {
        const key = e.key.toLowerCase();

        if (key === "n") {
          e.preventDefault();
          onPrintAction();
        } else if (key === "w") {
          e.preventDefault();
          onWhatsAppAction();
        } else if (key === "c") {
          e.preventDefault();
          onCancelAction();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activePopup, isOnline, orderData, seatsPeople]);

  // Online status listener
  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleStatusChange);
    window.addEventListener("offline", handleStatusChange);
    return () => {
      window.removeEventListener("online", handleStatusChange);
      window.removeEventListener("offline", handleStatusChange);
    };
  }, []);

  return (
    <>
      {/* ---------- RECEIPT POPUP ---------- */}
      {activePopup === "receipt" && (
        <div className="fixed inset-0 z-999 flex text-text-secondary items-center justify-center bg-black/20">
          <div className="bg-surface rounded-md shadow-2xl w-full max-w-[600px] mx-4 py-4 px-5 animate-scale-in">
            <div className="py-2 text-center">
              <h2 className="text-2xl font-bold pb-2">{t("receipt.title")}</h2>
              <p className="text-text-muted text-sm mt-2">
                {t("order.order")}{" "}
                <span className="font-bold text-text-secondary">
                  #{orderId}
                </span>{" "}
                {t("receipt.isCompleted")}
              </p>
            </div>

            <div className="flex gap-4 p-2 text-sm">
              {/* A bill is sent to somebody, and a counter never asked who.
                  Nobody gives a phone number for a ten-rupee ice cream, so
                  this would open a form asking for one with the next guest
                  already at the counter. */}
              {seatsPeople && (
              <button
                onClick={onWhatsAppAction}
                /* `bg-success` is the status palette's emerald — the green a
                   toast goes when something worked. It is not one of ours,
                   and beside the brand's deep green it read as a different
                   product's button. The brand has its own bright emerald. */
                className={`gf-metal-emerald flex-1 py-2 font-semibold text-white rounded-md ${
                  !isOnline ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                <ShortcutLabel text={t("pay.sendWhatsApp")} char="w" />
              </button>
              )}

              <button
                onClick={onPrintAction}
                /* Gold, and the loudest thing in the dialog: the box is
                   headed "Print Receipt" and this is the key that does it.
                   It used to run gold into green down its own height, and
                   the blend between the brand's two colours is the olive
                   that keeps turning up — green and gold never share a
                   gradient. Gold writes in the dark green, because white on
                   gold is the one pairing here that cannot be read. */
                className="gf-metal-gold flex-1 py-2 font-bold text-[var(--theme-primary-darker)] rounded-md"
              >
                <ShortcutLabel text={t("invoice.print")} char="n" />
              </button>

              <button
                onClick={onCancelAction}
                className="flex-1 py-2 font-bold shadow rounded-md"
              >
                <ShortcutLabel text={t("common.cancel")} char="c" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- CUSTOMER POPUP ---------- */}
      {activePopup === "customer" && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/30">
          <div className="bg-surface rounded-md shadow-2xl w-full max-w-[480px] mx-4 p-6 animate-scale-in">
            <h2 className="text-2xl font-bold mb-6 text-center">
              {t("receipt.addCustomer")}
            </h2>

            <div className="space-y-5">
              <label className="text-sm font-semibold text-text-secondary">
                {t("customer.nameLabel")} <span className="text-red-500">*</span>
              </label>
              {/* Typing shows the guests already known by that name. */}
              <CustomerNameInput
                value={customerDetails.name}
                placeholder={t("order.customerName")}
                onChange={handleCustomerChange}
                onPick={(c) =>
                  setCustomerDetails((d) => ({
                    ...d,
                    name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim(),
                    phone: c.phone || d.phone,
                    phoneCode: c.phoneCode || d.phoneCode,
                  }))
                }
                className="w-full p-3 bg-background shadow rounded-md text-sm mt-2"
              />

              <PhoneInputWithCode
                formData={customerDetails}
                setFormData={setCustomerDetails}
                onPhoneChange={handleCustomerChange}
              />
            </div>

            <div className="flex gap-3 mt-7">
              <button
                onClick={() => handleWhatsApp()}
                className="gf-metal-emerald flex-1 py-3 text-white font-bold rounded-md"
              >
                {t("pay.sendWhatsApp")}
              </button>

              <button
                onClick={() => setActivePopup("receipt")}
                className="flex-1 py-3 shadow rounded-md font-bold"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- PRINT ---------- */}
      {isPrinting && (
        <PrintOrder
          show={isPrinting}
          setShow={setIsPrinting}
          finalOrderData={orderData}
        />
      )}
    </>
  );
};

export default DashboardPopup;
