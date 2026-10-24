import { create } from "zustand";
import api from "../utils/api";
import { useAuthStore } from "./useAuthStore";
import { aggregateInventoryToProducts } from "../utils/productAggregator";
import { onceAtATime } from "../utils/onceAtATime";

export const useProductStore = create((set, get) => ({
  products: [],
  hydrated: false,
  ready: false,

  hydrate: async () => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    if (!outletId) {
      set({ hydrated: true, ready: true });
      return;
    }

    await get().fetchProductsFromAPI();
    set({ hydrated: true, ready: true });
  },

  /**
   * Take sold quantity off the tills's copy of stock so the grid reflects the
   * sale straight away. The server is the real record — the next fetch, or the
   * `purchase:product` socket event, corrects anything that drifted.
   */
  subtractStockLocal: async (cartItems) => {
    if (!get().ready) {
      console.warn("Products not ready, skipping stock subtraction");
      return;
    }

    set((state) => {
      const updatedProducts = state.products.map((product) => {
        const orderedItem = cartItems.find(
          (item) => item.id === product.serverId
        );
        if (!orderedItem) return product;

        return {
          ...product,
          stock: Math.max(0, product.stock - orderedItem.quantity),
        };
      });

      // Every dish stays on the menu. It used to drop off the grid the
      // moment its count reached zero, which took dishes away from the till
      // in the middle of service for a number nobody in a kitchen keeps.
      return { products: updatedProducts };
    });
  },

  /**
   * @param force  a live event says this has changed, so ask again rather
   *               than being handed the answer to a question asked just
   *               before the change happened.
   */
  fetchProductsFromAPI: async ({ force = false } = {}) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    if (!outletId) return undefined;

    return onceAtATime(
      "products:" + outletId,
      () => get()._loadProducts(outletId),
      { force }
    );
  },

  _loadProducts: async (outletId) => {
    try {
      const res = await api.get(`/tenant/purchase/productList/${outletId}`);
      const products = aggregateInventoryToProducts(res.data.data, outletId);

      // Everything on the menu is on the till, whatever any count says.
      set({ products });
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  },
}));
