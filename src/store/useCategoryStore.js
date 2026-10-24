import { create } from "zustand";
import api from "../utils/api";
import { mapApiResponseToCategory } from "../utils/categoryMapper";
import { useAuthStore } from "./useAuthStore";
import { onceAtATime } from "../utils/onceAtATime";

export const useCategoryStore = create((set, get) => ({
  categories: [],
  hydrated: false,

  /* ================= HYDRATE ================= */

  hydrate: async () => {
    if (get().hydrated) return;
    await get().fetchCategoriesFromAPI();
    set({ hydrated: true });
  },

  /* ================= FETCH ================= */

  /**
   * @param force  a live event says this has changed, so ask again rather
   *               than being handed the answer to a question asked just
   *               before the change happened.
   */
  fetchCategoriesFromAPI: async ({ force = false } = {}) => {
    const outletId = useAuthStore.getState().user?.outlet_id || "none";
    return onceAtATime(
      "categories:" + outletId,
      () => get()._loadCategories(),
      { force }
    );
  },

  _loadCategories: async () => {
    try {
      // Send outletId so the server returns only this outlet's categories.
      // If the outlet has no specific assignments, the server falls back to
      // all tenant categories automatically — no special handling needed here.
      const outletId = useAuthStore.getState().user?.outlet_id;

      const params = outletId ? { outletId } : {};
      const res = await api.get("/admin/category", { params });

      const apiCategories = res?.data?.data || [];

      const mapped = apiCategories.map(mapApiResponseToCategory);

      // Sort by sequence_number so the tab order matches what the owner set.
      const sorted = [...mapped].sort(
        (a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0)
      );

      set({ categories: sorted });
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  },
}));
