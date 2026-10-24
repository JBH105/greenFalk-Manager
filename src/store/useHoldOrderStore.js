import { create } from "zustand";
import { t } from "../i18n";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useProductStore } from "./useProductStore";
import { useAuthStore } from "./useAuthStore";
import { onceAtATime } from "../utils/onceAtATime";

/**
 * Held orders live on the server so every till and tablet at the outlet sees
 * the same tables and the same kitchen queue.
 *
 * One held order is one KOT - one round sent to the kitchen. The chef endpoint
 * returns each round on its own, while the hold list folds the rounds of a
 * table back into a single bill for the cashier.
 */

/** Turns one API row (a bill, or a single KOT) into what the screens expect. */
export const mapHoldOrder = (o) => {
  const allProducts = useProductStore.getState().products;

  return {
    localId: o.id,
    serverId: o.id,
    timestamp: o.createdAt,
    note: o.customer_name,

    // Whoever sent this round. The kitchen ticket falls back to it when the
    // table was never put under a guest's name, so a ticket always names a
    // real person rather than reading "Guest".
    cashierName: o.cashier_name || "",

    // The number the kitchen and the counter call out. Only the kitchen feed
    // sends it; the cashier list has no use for one.
    tokenNo: o.token_no ?? null,

    // Which round of the bill this is, and - on the cashier list - the rounds
    // that make the bill up.
    kotNumber: o.kot_number ?? 1,
    kots: o.kots ?? null,

    // Set once the captain has told the till this table wants to pay.
    billRequestedAt: o.bill_requested_at ?? null,

    cartData: {
      customer: o.customer_id
        ? {
            id: o.customer_id,
            serverId: o.customer_id,
            localId: o.customer_id,
            firstName: o.customerFirstName || "",
            lastName: o.customerLastName || "",
            phoneCode: o.customerPhoneCode || "",
            phoneNumber: o.customerPhone || "",
          }
        : null,
      table: o.table_id
        ? {
            id: o.table_id,
            serverId: o.table_id,
            localId: o.table_id,
            tableNumber: o.table_number || o.table?.table_number || "",
          }
        : null,
      orderType: o.order_type || o.orderType || "DINE_IN",
      orderItems: (o.order_details?.items || []).map((item) => {
        const product = allProducts.find((p) => p.serverId === item.product_id);
        return {
          ...item,
          id: item.product_id,
          serverId: item.product_id,
          // Which round this line sits on, and which line it is. Without
          // both, a dish removed at the till cannot be named to the server
          // and goes on being cooked.
          holdOrderId: item.hold_order_id ?? o.id ?? null,
          lineId: item.line_id ?? null,
          name: item.product_name || product?.name || "",
          /**
           * The Arabic name, looked up from the menu rather than carried on
           * the order.
           *
           * The order stores the name the dish was sold under, which is what
           * a bill reprinted a year later has to say. The Arabic is only
           * ever a second way of writing the same dish, so it is read from
           * the product the line points at — no column on the order, nothing
           * to migrate, and a translation typed today shows on tickets that
           * were already open.
           */
          nameAr: product?.nameAr || null,
          price: item.price ?? product?.sellingPrice ?? 0,
          tax: product?.tax || 0,
          // The section a dish belongs to, so the kitchen board can group by
          // it. The kitchen feed sends it with the item; the till side has to
          // look it up on the product it already holds.
          categoryName: item.category_name || product?.categoryName || "Other",
          // What the dish is, and whether a Jain version can be had, are
          // facts about the dish — so they come from the product, which is
          // current, rather than from a copy taken when the round went in.
          foodType: item.food_type || product?.foodType || "VEG",
          jainAvailable: product?.jainAvailable === true,
          // Whether THIS plate was asked for Jain is not a fact about the
          // dish, so it comes from the round as it was sent.
          jain: item.jain === true,
          note: item.note || "",
        };
      }),
      subtotal: o.order_details?.subtotal || 0,
      taxAmount: o.order_details?.tax || 0,
      discount: { value: o.order_details?.discount || 0 },
      totalAmountToPay: o.order_details?.total || 0,
    },

    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
};

const buildPayload = (data, note, outletId, requestKey) => ({
  outlet_id: outletId || "",
  // What this attempt is called. One press has one name, so the same press
  // reaching the server twice is taken once.
  ...(requestKey ? { request_key: String(requestKey) } : {}),
  customer_id: data?.customer?.id || data?.customer?.serverId || null,
  customer_name: note || "",
  table_id: data?.table?.id || data?.table?.serverId || null,
  order_type: data?.orderType || data?.order_type || "DINE_IN",
  order_details: {
    items: (data?.orderItems || []).map((item) => ({
      product_id: item.id || item.serverId,
      quantity: item.quantity,
      price: item.price,
      /**
       * The two the kitchen reads before it starts cooking.
       *
       * This list names every field that survives the trip, so anything
       * left out of it is silently dropped. The Jain request was exactly
       * that: ticked on the till, gone by the time the ticket printed.
       */
      jain: item.jain === true,
      food_type: item.foodType || item.food_type || null,
      ...(item.note && { note: item.note }),
    })),
    subtotal: data?.subtotal || 0,
    tax: data?.taxAmount || 0,
    discount: data?.discount?.value || 0,
    total: data?.totalAmountToPay || 0,
  },
});

export const useHoldOrderStore = create((set, get) => ({
  holdOrders: [],
  hydrated: false,
  loading: false,

  /* ================= CASHIER: one entry per bill ================= */
  /**
   * @param force  a live event says this has changed, so ask again rather
   *               than being handed the answer to a question asked just
   *               before the change happened.
   */
  fetchHoldOrders: async (outletId, { force = false } = {}) => {
    const outlet = outletId || useAuthStore.getState().user?.outlet_id;
    if (!outlet) return undefined;

    return onceAtATime(
      "hold-orders:" + outlet,
      () => get()._loadHoldOrders(outlet),
      { force }
    );
  },

  _loadHoldOrders: async (outlet) => {
    set({ loading: true });
    try {
      const res = await api.get("/hold-order", { params: { outlet_id: outlet } });
      const apiData = res?.data?.data || [];
      set({ holdOrders: apiData.map(mapHoldOrder), hydrated: true, loading: false });
    } catch (err) {
      console.error("Failed to fetch hold orders:", err);
      set({ hydrated: true, loading: false });
    }
  },

  /* ================= KITCHEN: one entry per KOT ================= */
  fetchChefHoldOrders: async (outletId) => {
    const outlet = outletId || useAuthStore.getState().user?.outlet_id;
    if (!outlet) return;

    set({ loading: true });
    try {
      const res = await api.get("/chef", { params: { outlet_id: outlet } });
      const apiData = res?.data?.data || [];
      set({ holdOrders: apiData.map(mapHoldOrder), hydrated: true, loading: false });
    } catch (err) {
      console.error("Failed to fetch kitchen orders:", err);
      set({ hydrated: true, loading: false });
    }
  },

  /* ================= SEND A ROUND TO THE KITCHEN ================= */
  createHoldOrder: async (order) => {
    const outletId = useAuthStore.getState().user?.outlet_id;

    // The localId is made once, when the press is turned into a payload, so
    // it names this attempt and no other. A genuine second order gets a
    // second name and a second round, which is what it should get.
    await api.post(
      "/hold-order",
      buildPayload(order.cartData, order.note, outletId, order.localId)
    );
    await get().fetchHoldOrders(outletId);
  },

  /** Correcting an existing round. Adding food creates a new round instead. */
  updateHoldOrder: async (orderId, updatedData) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    await api.put(`/hold-order/${orderId}`, {
      id: orderId,
      ...buildPayload(updatedData.cartData, updatedData.note, outletId),
    });
    await get().fetchHoldOrders(outletId);
  },

  /**
   * Takes one dish back off a round that is already with the kitchen.
   *
   * A line the till has not sent yet only exists in this browser, so there
   * is nothing to tell anybody about. One that has been sent lives on the
   * server and the kitchen reads it from there — removing it here alone
   * left the cook making a dish nobody was going to be charged for.
   *
   * Returns false when the server refused, having already said why.
   */
  removeHeldItem: async (item) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    const roundId = item?.holdOrderId;

    // Never sent. Nothing on the server, nothing in the kitchen.
    if (!roundId || !outletId) return true;

    try {
      await api.delete(`/hold-order/${roundId}/item`, {
        params: { outlet_id: outletId },
        data: {
          line_id: item.lineId ?? null,
          product_id: item.serverId || item.id || null,
          note: item.note || "",
          jain: item.jain === true,
        },
      });
      await get().fetchHoldOrders(outletId, { force: true });
      return true;
    } catch (err) {
      toast.error(
        err?.response?.data?.message || t("hold.dishStuck")
      );
      return false;
    }
  },

  /**
   * The captain tells the till a table has finished and wants its bill.
   * The bill then appears on the till's "Bill Requests" tab.
   */
  requestBill: async (order) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    const id = order?.serverId || order?.localId;
    if (!id) return false;

    try {
      await api.patch(`/hold-order/${id}/request-bill`, null, {
        params: { outlet_id: outletId },
      });
      await get().fetchHoldOrders(outletId);
      return true;
    } catch (err) {
      console.error("Failed to request the bill:", err);
      return false;
    }
  },

  /**
   * A dish goes back at a table that is still eating, and another takes its
   * place. The server moves it on the held order and keeps the reason.
   */
  exchangeItem: async (holdOrderId, payload) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    if (!holdOrderId || !outletId) throw new Error(t("hold.noOpenOrder"));

    const res = await api.post(`/hold-order/${holdOrderId}/exchange`, payload, {
      params: { outlet_id: outletId },
    });
    await get().fetchHoldOrders(outletId);
    return res?.data?.data ?? res?.data;
  },

  /** Billing a table: the server closes every round of that bill. */
  removeHoldOrder: async (order) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    const id = order?.serverId || order?.localId;
    if (!id) return;

    try {
      await api.delete(`/hold-order/${id}`, { params: { outlet_id: outletId } });
    } catch (err) {
      console.error("Failed to remove hold order:", err);
    }

    await get().fetchHoldOrders(outletId);
  },

  /* ================= KITCHEN: mark an item started / done ================= */
  updateHoldOrderStatus: async (orderId, item, { completedQty, action }) => {
    try {
      await api.patch("/chef/item-status", {
        orderId,
        product_id: item.product_id || item.id,
        // Which line of that dish. Two lines on one ticket can share a
        // product — five paneer tikka with two of them Jain — and without
        // this the server marked both at once.
        ...(item.line_id ? { line_id: item.line_id } : {}),
        ...(completedQty ? { completedQty } : {}),
        ...(action ? { action } : {}),
      });

      // Reflect it locally so the ticket updates without waiting for a refetch.
      set({
        holdOrders: get().holdOrders.map((order) => {
          if (order.serverId !== orderId) return order;

          return {
            ...order,
            cartData: {
              ...order.cartData,
              orderItems: order.cartData.orderItems.map((i) => {
                if ((i.product_id || i.id) !== (item.product_id || item.id)) return i;

                if (completedQty) {
                  const prepared = (i.prepared_quantity || 0) + completedQty;
                  return {
                    ...i,
                    prepared_quantity: prepared,
                    status: prepared >= i.quantity ? "COMPLETED" : "PREPARING",
                  };
                }

                return { ...i, status: action === "START" ? "PREPARING" : i.status };
              }),
            },
          };
        }),
      });
    } catch (error) {
      // A kitchen screen is watched from across the room and tapped with the
      // back of a knuckle. If the tap did not land, the chef has to be told —
      // otherwise the dish sits there looking untouched and the table waits.
      const why =
        error?.response?.data?.message ||
        (error?.response?.status === 401 || error?.response?.status === 403
          ? t("hold.notKitchen")
          : t("hold.noTill"));
      toast.error(why);
      console.error("Failed to update item status:", error);
      throw error;
    }
  },
}));
