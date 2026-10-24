import { create } from "zustand";
import api from "../utils/api";
import { useAuthStore } from "./useAuthStore";
import { onceAtATime } from "../utils/onceAtATime";

/**
 * The parcels this counter has sold today.
 *
 * A parcel is paid for before it is cooked, so its kitchen ticket is kept off
 * the cashier's list of unpaid bills — it has no place there. The effect was
 * that once the money was taken the sale vanished from every screen the
 * cashier had, and the only way to find out whether a parcel was ready was to
 * lean into the kitchen and ask.
 *
 * The list is kept in three stages, which is the order a cashier thinks in:
 * what is still cooking, what is ready to hand over, and what has gone.
 */
export const useParcelStore = create((set, get) => ({
  parcels: [],
  day: null,
  loading: false,
  hydrated: false,

  /**
   * @param force  a live event says this has changed, so ask again rather
   *               than being handed the answer to a question asked just
   *               before the change happened.
   */
  fetchParcels: async ({ force = false } = {}) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    if (!outletId) return undefined;
    return onceAtATime(
      "parcels:" + outletId,
      () => get()._loadParcels(outletId),
      { force }
    );
  },

  _loadParcels: async (outletId) => {
    set({ loading: true });
    try {
      const res = await api.get("/hold-order/parcels", { params: { outlet_id: outletId } });
      const body = res.data?.data ?? res.data ?? {};
      set({
        parcels: Array.isArray(body.parcels) ? body.parcels : [],
        day: body.day ?? null,
        hydrated: true,
      });
    } catch (err) {
      console.error("Could not read the counter's parcels:", err);
      set({ hydrated: true });
    } finally {
      set({ loading: false });
    }
  },

  /**
   * The guest has taken their parcel.
   *
   * Moved on the screen first, because the cashier is already reaching for the
   * next one and a counter that waits for the network feels broken. If the
   * server disagrees the list is re-read and the truth wins.
   */
  markHandedOver: async (parcelId) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    const before = get().parcels;

    set({
      parcels: before.map((p) =>
        p.id === parcelId
          ? { ...p, stage: "HANDED_OVER", handedOverAt: new Date().toISOString() }
          : p
      ),
    });

    try {
      await api.patch(`/hold-order/parcels/${parcelId}/handed-over`, { outlet_id: outletId });
      return true;
    } catch (err) {
      console.error("The counter could not mark that parcel as collected:", err);
      set({ parcels: before });
      return false;
    }
  },
}));

export default useParcelStore;
