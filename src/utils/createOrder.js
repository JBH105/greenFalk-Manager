import api from "../utils/api";
import { useProductStore } from "../store/useProductStore";
import { useAuthStore } from "../store/useAuthStore";
import { getGst, netOfTax } from "../utils/gst";

/**
 * Puts a sale through. The server is the only record of it: if the call fails
 * the sale has not happened, and the caller must show that rather than let the
 * cashier believe it was taken.
 */
export const createOrder = async ({
  cartData,
  customer,
  table,
  orderType,
  totals,
  paymentMethods,
  tenderedAmount,
  cashReturned,
  holdOrderId,
  sendToKitchen,
  customerName,
}) => {
  const productStore = useProductStore.getState();
  const outletId = useAuthStore.getState().user?.outlet_id;

  const payload = {
    customer: customer
      ? {
          id: customer.serverId || null,
          first_name: customer.first_name || customer.firstName || null,
          last_name: customer.last_name || customer.lastName || null,
          email: customer.email || null,
          phone_code: customer.phone_code || customer.phoneCode || null,
          phone_number:
            customer.phone_number ||
            customer.phoneNumber ||
            customer.phone ||
            null,
        }
      : null,
    table_id: table?.serverId || null,

    // Which held bill this is closing. A parcel has no table to find it by,
    // so without this the server could not check the kitchen had finished one.
    ...(holdOrderId ? { hold_order_id: holdOrderId } : {}),

    // A parcel is paid for before it is cooked, so the kitchen ticket is
    // written with the sale rather than ahead of it. Either both happen or
    // neither does — nobody is charged for food the kitchen never heard of.
    ...(sendToKitchen ? { send_to_kitchen: true, customer_name: customerName || "Parcel" } : {}),

    order_type: orderType || "DINE_IN",
    subtotal: totals.subtotal,
    outlet_id: outletId || null,
    discountAmount: totals?.discount || 0,
    discount_percentage: totals?.discount_percentage,
    taxAmount: totals.taxAmount || totals.tax || 0,
    amount: totals.amount || totals.total || 0,
    paymentMethods,
    tenderedAmount,
    cashReturned,
    orderItems: cartData.map((p) => {
      const unitPrice = p.price || p.unitPrice || p.sellingPrice || 0;
      const qty = p.quantity || 0;

      // Item total as the menu reads it, before discount. Where the menu
      // price carries the tax, this carries it too.
      const rawTotal = unitPrice * qty;

      // Order-level discount rate, same as the Dashboard uses.
      const discountRate = (totals?.discount_percentage || 0) / 100;
      const discountedTotal = rawTotal * (1 - discountRate);
      const discountAmount = rawTotal * discountRate;

      /**
       * Where the price already includes the tax, the line has to be split.
       *
       * Not for the sake of the slip — which goes on showing the menu price,
       * because that is the number the guest agreed to — but for the owner's
       * reports. Every one of them works out a line's gross as its subtotal
       * plus its tax. Hand them a subtotal that already has the tax inside it
       * and the tax again beside it, and a day's takings read five per cent
       * higher than the money in the till.
       *
       * So the line's own tax is the bill's rate taken out of it, and its
       * discount is net of that tax as well. Both are linear in the line
       * total, so they add up to the figures on the bill exactly.
       */
      const tax = getGst();
      const inclusive = tax.enabled && tax.mode === "INCLUSIVE";

      // A single rate across the bill where the country charges one; the
      // product's own rate where tax is added on top, as before.
      const taxRate = inclusive
        ? tax.percentage
        : Number(p.tax || p.taxPercentage || p.tax_percentage_per_product || 0);

      // One where the tax is added on top, so the two lines below are the
      // same arithmetic in both countries.
      const net = netOfTax();
      const taxAmountPerProduct = (discountedTotal * net * taxRate) / 100;

      return {
        productId: p.id || p.productId,
        product_name: p.name,
        unitPrice,
        quantity: qty,
        unit: p.unit || "pcs",
        taxAmountPerProduct,
        discount: discountAmount * net,
        tax_percentage_per_product: taxRate,
        ...(p.note && { note: p.note }),
        // Asked for without onion, garlic or root vegetables. Sent on every
        // line, not only the ones that say yes: a bill reprinted later has to
        // be able to show which plates were Jain and which were not.
        is_jain: p.jain === true,
        food_type: p.foodType || null,
      };
    }),
  };

  const res = await api.post("/outlet/order", payload);

  // Take the sold quantity off the grid straight away. The server has already
  // done the real deduction; this only keeps the screen honest until the next
  // fetch or the stock socket event lands.
  await productStore.subtractStockLocal(cartData);

  return {
    mode: "online",
    orderId: res.data?.data?.orderId,
    order: res.data?.data,
  };
};
