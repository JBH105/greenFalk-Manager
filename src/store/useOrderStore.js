import { create } from "zustand";
import api from "../utils/api";
import { useAuthStore } from "./useAuthStore";
import { onceAtATime } from "../utils/onceAtATime";

export const useOrderStore = create((set, get) => ({
  allOrders: [],
  orders: [],
  loading: false,

  /** Past invoices for the till's outlet. */
  /**
   * @param force  a live event says this has changed, so ask again rather
   *               than being handed the answer to a question asked just
   *               before the change happened.
   */
  fetchOrders: async ({ force = false } = {}) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    if (!outletId) {
      set({ allOrders: [], orders: [], loading: false });
      return undefined;
    }

    return onceAtATime(
      "orders:" + outletId,
      () => get()._loadOrders(outletId),
      { force }
    );
  },

  _loadOrders: async (outletId) => {
    set({ loading: true });
    try {
      const res = await api.get("/outlet/order", { params: { outletId } });
      const orders = res?.data?.data || [];

      set({ allOrders: orders, orders, loading: false });
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      set({ allOrders: [], orders: [], loading: false });
    }
  },

  filterByOutlet: (outletId) => {
    const { allOrders } = get();
    set({
      orders: allOrders.filter((order) => order.outlet_id === outletId),
    });
  },

  // Used by the refund and exchange flows to patch a row in place.
  setOrders: (updater) =>
    set((state) => ({
      orders:
        typeof updater === "function" ? updater(state.orders) : updater,
    })),
}));
