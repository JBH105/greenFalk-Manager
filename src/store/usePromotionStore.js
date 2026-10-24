import { create } from "zustand";
import api from "../utils/api";
import { mapApiResponseToPromotion } from "../utils/promotionMapper";
import { onceAtATime } from "../utils/onceAtATime";

export const usePromotionStore = create((set, get) => ({
  promotions: [],
  hydrated: false,
  isLoading: false,

  /* ================= HYDRATE ================= */
  hydrate: async () => {
    if (get().hydrated) return;
    await get().fetchPromotionsFromAPI();
    set({ hydrated: true });
  },

  /* ================= FETCH ================= */
  /**
   * @param force  a live event says this has changed, so ask again rather
   *               than being handed the answer to a question asked just
   *               before the change happened.
   */
  fetchPromotionsFromAPI: async ({ force = false } = {}) => {
    return onceAtATime("promotions", () => get()._loadPromotions(), { force });
  },

  _loadPromotions: async () => {
    try {
      const res = await api.get("/tenant/promotions");
      const apiPromotions = res.data.data || [];

      const formattedPromotions = apiPromotions.map((p) =>
        mapApiResponseToPromotion(p)
      );

      set({ promotions: formattedPromotions });
    } catch (err) {
      console.error("Failed to fetch promotions:", err);
    }
  },
}));
