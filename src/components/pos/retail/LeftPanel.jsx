import { taxLabel } from "../../../utils/gst";
import { useT } from "../../../i18n";
import { cur } from "../../../utils/currency";
import React, { useEffect } from "react";
import { useCartStore } from "../../../store/useCartStore";
import { useAuthStore } from "../../../store/useAuthStore";
import { usePromotionStore } from "../../../store/usePromotionStore";

const LeftPanel = ({ setTotalAmount, getFinalProductPrice }) => {
  const t = useT();


  const { cartData, updateQuantity, removeFromCart } = useCartStore();


  //promotions
  // const outletId = useAuthStore.getState().user?.outlet_id;
  // const { promotions, hydrate: promoHydrate, hydrated: promoHydarated } = usePromotionStore();
  // const tax = 0.00; // Placeholder for tax calculation
  // --- Calculate Total Amount for the entire cart ---
  useEffect(() => {
    const total = cartData.reduce((acc, item) => {
      const price = item.price || 0;
      const qty = item.quantity || 1;
      return acc + (price * qty);
    }, 0);

    if (setTotalAmount) setTotalAmount(total);
  }, [cartData, setTotalAmount]);

  const changeQuantity = (method, item, newValue) => {
    if (method === "inc") {
      updateQuantity(item.id, (item.quantity || 0) + 1);
    }

    else if (method === "dec") {
      const newQty = (item.quantity || 0) - 1;
      if (newQty >= 0) updateQuantity(item.id, newQty);
    }

    else if (method === "manual") {
      const val = parseInt(newValue);

      // If input is empty or not a number, we can let them type, 
      // but we only update if it's a valid number.
      // if (isNaN(val) || val <= 0){
      //   updateQuantity(item.id, 1);
      //   return;
      // }

      updateQuantity(item.id, val);
    }
  }



  return (
    <div className="h-[80vh] mt-4 rounded-md bg-surface flex flex-col overflow-hidden border border-border-default">

      {/* BARCODE SEARCH SECTION */}


      {/* TABLE HEADER */}
      <div className="sticky top-0 z-10">
        <div className="flex text-sm font-semibold text-text-inverted gf-metal-green">
          <div className="flex-1 flex">
            <div className="w-1/3 px-3 py-2.5">{t("retail.code")}</div>
            <div className="w-2/3 px-3 py-2.5 text-cente">{t("retail.item")}</div>
          </div>
          <div className="flex-1 w-2/4  py-2.5">
            <div className="grid grid-cols-4 text-center">
              <span>{t("retail.qty")}</span>
              <span>{taxLabel()}</span>
              <span>{t("cart.discount")}</span>
              <span>{t("cart.subtotal")}</span>
            </div>
          </div>
          <span className="delete-btn cursor-pointer pr-10 m-auto text-red-400"></span>
        </div>
      </div>

      {/* TABLE BODY */}
      <div className=" overflow-y-auto text-sm bg-surface mr-2 text-text-secondary">
        {cartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <p>{t("retail.scanToStart")}</p>
          </div>
        ) : (
          cartData.map((item, index) => {
            const unitPrice = item.price + item.discount || 0;
            // const unitPrice = price || 0;
            const quantity = item.quantity || 1;
            const discountValue = (item.discount * quantity).toFixed(2);
            const subtotal = (unitPrice * quantity) - discountValue;

            return (
              <div key={item.serverId || index} className="flex border-b border-border-default py-3 hover:bg-background transition-colors text-text-secondary">
                <div className="flex-1 flex">
                  <div className="px-3 w-1/3 self-center">{item.barcode || "N/A"}</div>
                  <div className="px-3 w-2/3 flex flex-col font-medium self-center">
                    <span>{item.name}</span>
                    <span className="text-xs">{cur()}{unitPrice.toFixed(2)} X {quantity}{item.unit}</span>
                  </div>
                </div>
                {/* <div className="flex-1 self-center"> */}
                <div className="flex-1 grid grid-cols-4 text-center items-center">
                  {/* <span className="font-bold">{quantity}</span> */}
                  <div className="flex w-full h-10 items-center justify-between bg-surface overflow-hidden border border-border-default">
                    <div
                      onClick={() => changeQuantity("dec", item)}
                      className="w-10 pb-0.5 h-full flex items-center justify-center text-text-inverted font-bold text-xl gf-metal-green cursor-pointer"
                    >
                      -
                    </div>

                    <input
                      type="number"
                      className="w-10 text-center outline-none border-none  appearance-none"
                      value={item.quantity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => changeQuantity("manual", item, e.target.value)}
                      onBlur={(e) => {
                        // Revert if they leave the input empty
                        if (e.target.value === "") updateQuantity(item.id, item.quantity);
                      }}
                    />

                    <div
                      onClick={() => changeQuantity("inc", item)}
                      className="w-10 h-full flex items-center justify-center text-text-inverted font-bold text-xl gf-metal-green cursor-pointer"
                    >
                      +
                    </div>
                  </div>

                  <span>{item.tax ? parseFloat(item?.tax).toFixed(2) : "0.00"}%</span>
                  <span>{cur()}{(Number(discountValue) || 0).toFixed(2)}</span>
                  <span>P {subtotal.toFixed(2)}</span>
                </div>
                {/* </div> */}
                <span className="delete-btn cursor-pointer w-5 pr-10 m-auto " onClick={() => removeFromCart(item.id)}>
                  <svg
                    viewBox="64 64 896 896"
                    focusable="false"
                    data-icon="delete"
                    width="16"
                    height="16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M360 184h-8c4.4 0 8-3.6 8-8v8h304v-8c0 4.4 3.6 8 8 8h-8v72h72v-80c0-35.3-28.7-64-64-64H352c-35.3 0-64 28.7-64 64v80h72v-72zm504 72H160c-17.7 0-32 14.3-32 32v32c0 4.4 3.6 8 8 8h60.4l24.7 523c1.6 34.1 29.8 61 63.9 61h454c34.2 0 62.3-26.8 63.9-61l24.7-523H888c4.4 0 8-3.6 8-8v-32c0-17.7-14.3-32-32-32zM731.3 840H292.7l-24.2-512h487l-24.2 512z"></path>
                  </svg>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LeftPanel;