import { create } from "zustand";
import { t } from "../i18n";
import api from "../utils/api";
import { useAuthStore } from "./useAuthStore";
import { onceAtATime } from "../utils/onceAtATime";
import { mapTableToApiPayload, mapApiResponseToTable } from "../utils/tableMapper";

/**
 * Tables live on the server: their status (free or occupied) has to agree
 * across every till and captain's tablet, so this store is a straight read of
 * what the server holds rather than a local copy.
 */
export const useTableStore = create((set, get) => ({
  tables: [],
  hydrated: false,

  hydrate: async () => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    if (!outletId) {
      set({ tables: [], hydrated: true });
      return;
    }

    await get().fetchTablesFromAPI();
    set({ hydrated: true });
  },

  /**
   * @param force  a live event says this has changed, so ask again rather
   *               than being handed the answer to a question asked just
   *               before the change happened.
   */
  fetchTablesFromAPI: async ({ force = false } = {}) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    if (!outletId) return undefined;

    return onceAtATime(
      "tables:" + outletId,
      () => get()._loadTables(outletId),
      { force }
    );
  },

  _loadTables: async (outletId) => {
    try {
      const res = await api.get(`/outlet/table?outlet_id=${outletId}`);

      // This endpoint has been seen wrapping its rows three different ways.
      let apiTables = [];
      if (Array.isArray(res.data?.data)) apiTables = res.data.data;
      else if (Array.isArray(res.data?.data?.tables)) apiTables = res.data.data.tables;
      else if (Array.isArray(res.data)) apiTables = res.data;
      else return;

      set({
        tables: apiTables.map((t) => mapApiResponseToTable(t, null, outletId)),
      });
    } catch (err) {
      console.error("Failed to fetch tables:", err);
    }
  },

  addTable: async ({ tableNumber, seats, zoneId = null }) => {
    const user = useAuthStore.getState().user;
    const outletId = user?.outlet_id;
    if (!outletId) throw new Error("Outlet ID is required");

    // Refusing has to be raised, not returned. This used to stop here quietly,
    // so the caller thought the table had been made, said so, and closed the
    // form — while nothing had been created.
    const totalTablesLimit = user?.outlets?.[0]?.outlet?.total_tables || 0;
    if (totalTablesLimit && get().tables.length >= totalTablesLimit) {
      throw new Error(
        `This outlet is set up for ${totalTablesLimit} tables and already has ${get().tables.length}. Raise the limit under Outlets in the admin to add another.`
      );
    }

    try {
      await api.post(
        `/outlet/table?outlet_id=${outletId}`,
        mapTableToApiPayload({ tableNumber, seats, zoneId }),
        { headers: { "Content-Type": "application/json" } }
      );
      await get().fetchTablesFromAPI({ force: true });
    } catch (err) {
      // The reason is shown on the form that asked for it, so no toast here —
      // one refusal used to raise two messages, the real one and a generic one.
      const reason =
        err?.response?.data?.message ||
        t("tables.createFailed");

      // The server says the allowance is used up but not what to do about it,
      // and the owner has no reason to know the number lives on the outlet.
      throw new Error(
        /more than \d+ tables|table limit/i.test(reason)
          ? reason + " " + t("tables.raiseLimit")
          : reason
      );
    }
  },

  /** Rename a table, or change how many it seats. */
  updateTable: async (localId, { tableNumber, seats }) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    const table = get().tables.find((t) => t.localId === localId || t.serverId === localId);
    const serverId = table?.serverId ?? localId;
    if (!serverId || !outletId) throw new Error(t("tables.notFound"));

    try {
      await api.put(
        `/outlet/table/${serverId}?outlet_id=${outletId}`,
        mapTableToApiPayload({ tableNumber, seats }),
        { headers: { "Content-Type": "application/json" } }
      );
      await get().fetchTablesFromAPI();
    } catch (err) {
      throw new Error(err?.response?.data?.message || t("tables.updateFailed"));
    }
  },

  deleteTable: async (localId) => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    const table = get().tables.find((t) => t.localId === localId || t.serverId === localId);
    const serverId = table?.serverId ?? localId;
    if (!serverId || !outletId) return;

    try {
      await api.delete(`/outlet/table/${serverId}?outlet_id=${outletId}`);
      await get().fetchTablesFromAPI();
    } catch (err) {
      console.error("Failed to delete table:", err);
      throw err;
    }
  },
}));
