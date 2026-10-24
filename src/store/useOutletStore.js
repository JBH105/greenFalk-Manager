import { create } from "zustand";
import api from "../utils/api";
import { mapApiResponseToOutlet } from "../utils/outletMapper";

export const useOutletStore = create((set, get) => ({
    outlets: [],
    hydrated: false,

    /* ================= HYDRATE ================= */

    hydrate: async () => {
        if (get().hydrated) return;

        await get().fetchOutletsFromAPI();
        set({ hydrated: true });
    },

    /* ================= FETCH ================= */

    fetchOutletsFromAPI: async () => {
        try {
            const res = await api.get("/tenant/outlet");

            const apiOutlet = res?.data.data || [];
            const mapped = apiOutlet.map(mapApiResponseToOutlet);

            set({ outlets: mapped });
        } catch (err) {
            console.error("Failed to fetch outlets:", err);
        }
    },
}));
