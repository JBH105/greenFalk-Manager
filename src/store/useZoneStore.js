import { create } from "zustand";
import { t } from "../i18n";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuthStore } from "./useAuthStore";
import { onceAtATime } from "../utils/onceAtATime";

/**
 * The parts of a restaurant — an AC room, a terrace, a family section — and
 * which tables stand in each.
 *
 * A restaurant that has never divided its floor has none of these, and every
 * screen is expected to work with an empty list. That is the normal case,
 * not an error state: one undivided grid is what a small shop wants.
 */

const messageFrom = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

export const useZoneStore = create((set, get) => ({
  zones: [],
  loading: false,
  saving: false,

  /** Every part of this outlet, in the order it is walked through. */
  fetchZones: async ({ force = false } = {}) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    if (!outletId) return;

    return onceAtATime(
      "zones:" + outletId,
      async () => {
        set({ loading: true });
        try {
          const res = await api.get("/outlet/zone", { params: { outlet_id: outletId } });
          const rows = Array.isArray(res.data?.data) ? res.data.data : [];
          set({ zones: rows, loading: false });
        } catch (err) {
          // A floor plan that cannot reach the server still draws; it simply
          // draws without headings, which is the undivided view.
          set({ loading: false });
        }
      },
      { force }
    );
  },

  addZone: async (zoneName, zoneNameAr) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    set({ saving: true });
    try {
      await api.post(
        "/outlet/zone",
        { zone_name: zoneName, zone_name_ar: zoneNameAr ?? null },
        { params: { outlet_id: outletId } },
      );
      await get().fetchZones({ force: true });
      toast.success(t("tables.zoneAdded", { name: zoneName }));
      return true;
    } catch (err) {
      toast.error(messageFrom(err, t("zones.addFailed")));
      return false;
    } finally {
      set({ saving: false });
    }
  },

  renameZone: async (zoneId, zoneName, zoneNameAr) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    set({ saving: true });
    try {
      await api.put(
        `/outlet/zone/${zoneId}`,
        {
          zone_name: zoneName,
          /* Left out when the caller has nothing to say about it, so a rename
             that only touches the English name cannot wipe the Arabic one. */
          ...(zoneNameAr === undefined ? {} : { zone_name_ar: zoneNameAr }),
        },
        { params: { outlet_id: outletId } },
      );
      await get().fetchZones({ force: true });
      toast.success(t("tables.zoneRenamed", { name: zoneName }));
      return true;
    } catch (err) {
      toast.error(messageFrom(err, t("zones.renameFailed")));
      return false;
    } finally {
      set({ saving: false });
    }
  },

  /**
   * Closes a part of the restaurant. Its tables are not touched — they go
   * back to the unsorted heading, furniture and bills intact.
   */
  closeZone: async (zoneId) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    set({ saving: true });
    try {
      await api.delete(`/outlet/zone/${zoneId}`, { params: { outlet_id: outletId } });
      await get().fetchZones({ force: true });
      toast.success(t("zones.removed"));
      return true;
    } catch (err) {
      toast.error(messageFrom(err, t("zones.removeFailed")));
      return false;
    } finally {
      set({ saving: false });
    }
  },

  /** Moves one table into a part of the restaurant, or out of all of them. */
  setTableZone: async (tableId, zoneId) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    try {
      await api.put(
        `/outlet/zone/table/${tableId}`,
        { zone_id: zoneId || null },
        { params: { outlet_id: outletId } }
      );
      return true;
    } catch (err) {
      toast.error(messageFrom(err, t("zones.moveFailed")));
      return false;
    }
  },
}));
