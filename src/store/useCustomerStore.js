import { create } from "zustand";
import { t } from "../i18n";
import api from "../utils/api";
import { mapCustomerToApiPayload, mapApiResponseToCustomer } from "../utils/customerMapper";
import { useAuthStore } from "./useAuthStore";
import { onceAtATime } from "../utils/onceAtATime";

/**
 * Customers belong to the outlet, not to one till: the counter and a captain's
 * tablet must see the same list the moment someone is added. Every change goes
 * to the server and the list is re-read from it.
 */
export const useCustomerStore = create((set, get) => ({
  customers: [],
  hydrated: false,

  hydrate: async () => {
    await get().fetchCustomersFromAPI();
    set({ hydrated: true });
  },

  /**
   * @param force  a live event says this has changed, so ask again rather
   *               than being handed the answer to a question asked just
   *               before the change happened.
   */
  fetchCustomersFromAPI: async ({ force = false } = {}) => {
    const outletId = useAuthStore.getState().user?.outlet_id || "none";
    return onceAtATime(
      "customers:" + outletId,
      () => get()._loadCustomers(),
      { force }
    );
  },

  _loadCustomers: async () => {
    const outletId = useAuthStore.getState().user?.outlet_id;
    if (!outletId) return;

    try {
      const res = await api.get(`/tenant/customer/${outletId}`);

      // This endpoint has been seen wrapping its rows three different ways.
      let apiCustomers = [];
      if (Array.isArray(res.data?.data)) apiCustomers = res.data.data;
      else if (Array.isArray(res.data?.data?.customers)) apiCustomers = res.data.data.customers;
      else if (Array.isArray(res.data)) apiCustomers = res.data;
      else return;

      set({ customers: apiCustomers.map((c) => mapApiResponseToCustomer(c)) });
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    }
  },

  /** Guards the till against two records for the same person. */
  isDuplicateCustomer: ({ email, phone, excludeLocalId = null }) =>
    get().customers.some((c) => {
      if (excludeLocalId && c.localId === excludeLocalId) return false;
      return (
        (email && c.email === email) ||
        (phone && c.phone === phone)
      );
    }),

  /**
   * The guest this order is for, whether or not we have met them before.
   *
   * On the Customers screen, naming someone who already exists is a mistake
   * worth stopping. At the counter it is not: a regular gives their name, the
   * cashier types it rather than picking it off the list, and the till used to
   * refuse the whole order — "Customer with same email or phone already
   * exists" — with the guest standing there and no way forward.
   *
   * A phone number is the strong answer: one number, one person. Without one
   * the name has to do, and only when exactly one guest answers to it —
   * two different Rakeshes with no numbers between them cannot be told apart,
   * and quietly merging their history is worse than holding two records. The
   * cashier can still pick the right one off the list.
   */
  findOrAddCustomer: async (payload) => {
    const sameAs = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
    const whole = (c) => [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
    const wanted = [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim();
    const phone = String(payload.phone ?? "").trim();

    const known = get().customers || [];

    if (phone) {
      const byPhone = known.find((c) => String(c.phone ?? "").trim() === phone);
      if (byPhone) return byPhone;
    } else if (wanted) {
      const byName = known.filter((c) => sameAs(whole(c), wanted));
      if (byName.length === 1) return byName[0];
    }

    return get().addCustomer(payload);
  },

  addCustomer: async (payload) => {
    if (get().isDuplicateCustomer({ email: payload.email, phone: payload.phone })) {
      throw new Error(t("customers.exists"));
    }

    const outletId = useAuthStore.getState().user?.outlet_id || null;

    const res = await api.post(
      "/tenant/customer",
      mapCustomerToApiPayload({ ...payload, outlet_id: outletId }),
      { headers: { "Content-Type": "application/json" } }
    );

    const created = res.data?.data?.customer || res.data?.data || res.data;
    const customer = mapApiResponseToCustomer({ ...created, ...payload });

    set((s) => ({ customers: [...s.customers, customer] }));
    return customer;
  },

  editCustomer: async (payload) => {
    const existing = get().customers.find((c) => c.localId === payload.localId);
    const serverId = payload.serverId ?? existing?.serverId;
    if (!serverId) throw new Error("Customer has no server id");

    if (
      get().isDuplicateCustomer({
        email: payload.email,
        phone: payload.phone,
        excludeLocalId: payload.localId,
      })
    ) {
      throw new Error(t("customers.exists"));
    }

    await api.put(`/tenant/customer/${serverId}`, mapCustomerToApiPayload(payload), {
      headers: { "Content-Type": "application/json" },
    });

    const updated = { ...existing, ...payload, serverId };
    set((s) => ({
      customers: s.customers.map((c) => (c.localId === payload.localId ? updated : c)),
    }));
    return updated;
  },

  deleteCustomer: async (localId) => {
    const customer = get().customers.find((c) => c.localId === localId);
    if (!customer?.serverId) return;

    await api.delete(`/tenant/customer/${customer.serverId}`);

    set((s) => ({ customers: s.customers.filter((c) => c.localId !== localId) }));
  },
}));
