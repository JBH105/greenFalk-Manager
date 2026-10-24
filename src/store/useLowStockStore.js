import { create } from "zustand";
import api from "../utils/api";
import { useAuthStore } from "./useAuthStore";

export const useLowStockStore = create((set, get) => ({
  lowStock: [],
  hydrated: false,

  hydrate: async () => {
    await get().fetchLowStockFromAPI();
    set({ hydrated: true });
  },

  fetchLowStockFromAPI: async () => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    if (!outletId) return;

    try {
      const res = await api.get(`/tenant/purchase/low-stock-products/${outletId}`);

      // The endpoint has been seen wrapping its rows at three different depths;
      // accept whichever comes back rather than showing an empty list.
      let apiData = [];
      if (Array.isArray(res.data?.data?.data)) apiData = res.data.data.data;
      else if (Array.isArray(res.data?.data)) apiData = res.data.data;
      else if (Array.isArray(res.data)) apiData = res.data;
      else return;

      set({
        lowStock: apiData.map((item) => ({
          serverId: item.productId,
          productId: item.productId,
          productName: item.productName,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          outletId,
          outletName: item.outletName,
          stock: item.stockQuantity,
          threshold: item.lowStockThreshold,
          img: item.imageUrl,
        })),
      });
    } catch (err) {
      console.error("Failed to fetch low stock:", err);
    }
  },
}));
