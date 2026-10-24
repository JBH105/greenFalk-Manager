import { create } from "zustand";
import api from "../utils/api";
import { useAuthStore } from "./useAuthStore";
import { onceAtATime } from "../utils/onceAtATime";

export const usePaymentMethodStore = create((set, get) => ({
  paymentMethods: [],
  hydrated: false,

  loading: false,

  /**
   * Runs once at boot, before anyone has logged in — so it usually comes back
   * 401 and fetches nothing. `hydrated` only means "the boot attempt is over"
   * and lets the app stop showing its loading bar; it does not mean the methods
   * arrived. Screens that need the list call ensureLoaded instead.
   */
  hydrate: async () => {
    if (get().hydrated) return;

    await get().fetchPaymentMethodsFromAPI();
    set({ hydrated: true });
  },

  /**
   * Fetch the methods if they are not in yet.
   *
   * Marking the boot attempt as done used to be the end of it: the till came up
   * before login, that request was refused, and the payment screen then showed
   * an empty method list for the whole session — the cashier could not pick
   * Cash or UPI at all until the page was reloaded.
   */
  ensureLoaded: async () => {
    if (get().paymentMethods.length > 0 || get().loading) return;

    set({ loading: true });
    try {
      await get().fetchPaymentMethodsFromAPI();
    } finally {
      set({ loading: false });
    }
  },

  /**
   * @param force  a live event says this has changed, so ask again rather
   *               than being handed the answer to a question asked just
   *               before the change happened.
   */
  fetchPaymentMethodsFromAPI: async ({ force = false } = {}) => {
    // Scoped to this till's outlet: the owner can set up a method for one
    // branch only, and another branch must not be offered it.
    const outletId = useAuthStore.getState().user?.outlet_id;

    return onceAtATime(
      "payment-methods:" + (outletId || "none"),
      () => get()._loadPaymentMethods(outletId),
      { force }
    );
  },

  _loadPaymentMethods: async (outletId) => {
    try {
      const res = await api.get("/tenant_payment_methods", {
        params: outletId ? { outlet_id: outletId } : undefined,
      });

      // The endpoint has been seen returning both { data: [...] } and a bare
      // array, so accept either rather than failing the till's payment screen.
      let apiPaymentMethods = [];
      if (Array.isArray(res.data?.data)) {
        apiPaymentMethods = res.data.data;
      } else if (Array.isArray(res.data)) {
        apiPaymentMethods = res.data;
      } else {
        return;
      }

      const mappedPaymentMethods = apiPaymentMethods.map((pm) => ({
        id: pm.id,
        payment_method_name: pm.payment_method_name || pm.paymentMethodName || "",
        display_name: pm.display_name || pm.displayName || pm.payment_method_name || "",
      }));

      set({ paymentMethods: mappedPaymentMethods });
    } catch (err) {
      console.error("Failed to fetch payment methods:", err.response?.data || err.message);
    }
  },
}));
