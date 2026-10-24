import { create } from "zustand";
import api from "../utils/api";

export const useCreditOrderStore = create((set) => ({
    creditOrders: [],
    hydrated: false,
    loading: false,

    /* ================= HYDRATE ================= */
    // Credit invoices are only meaningful for a chosen outlet and payment
    // method, so nothing is loaded until fetchCreditOrders is called with them.
    hydrate: async () => {
        set({ hydrated: true });
    },

    /* ================= FETCH ================= */
    fetchCreditOrders: async (outletId, paymentMethodId) => {
        if (!outletId || !paymentMethodId) return;

        set({ loading: true });
        try {
            const url = `/outlet/order/invoices-on-credit/${outletId}/${paymentMethodId}`;
            const res = await api.get(url);

            set({ creditOrders: res?.data?.data || res?.data || [], loading: false });
        } catch (err) {
            console.error("Failed to fetch credit orders:", err);
            set({ loading: false });
        }
    },
}));
