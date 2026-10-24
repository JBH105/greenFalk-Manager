import { create } from "zustand";
import { getAuth, saveAuth, clearAuth } from "../utils/authSession";
import api from "../utils/api";
import { clearGstSettings, refreshGstSettings } from "../utils/gst";
import { clearMenuLanguage, refreshMenuLanguage } from "../utils/menuLanguage";
import { clearLanguage, refreshLanguage } from "../i18n";
// What this outlet has been given. Fetched beside GST every time, because it
// answers the same kind of question and can change the same way: while a till
// is signed in, without anybody signing in again.
import { clearOutletFeatures, refreshOutletFeatures } from "../utils/features";
import { joinOutletRoom, leaveOutletRoom } from "../socket/socket";
import { describeThisDevice } from "../utils/deviceLabel";

interface AuthState {
  user: any | null;
  token: string | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  /** The shops an owner of several has still to choose between. */
  outletsToChoose: { id: string; outlet_name: string; address?: string | null }[];

  login: (payload: { user: any; token: string }) => Promise<void>;
  loginWithCredentials: (
    credentials: { username: string; password: string },
    options?: { takeOver?: boolean }
  ) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  hydrated: false,
  outletsToChoose: [],

  /* -------------------------------------------------------
   * LOCAL LOGIN (NO SERVER)
   * ----------------------------------------------------- */
  login: async (payload) => {
    await saveAuth(payload);
    set({
      user: payload.user,
      token: payload.token,
      isAuthenticated: true,
      hydrated: true,
    });
    // Only now is there a token to authenticate with.
    refreshGstSettings(api, payload.user?.outlet_id);
    refreshMenuLanguage(api);
    refreshLanguage(api);
    refreshOutletFeatures(api, payload.user?.outlet_id);
    joinOutletRoom({
      outletId: payload.user?.outlet_id,
      tenantId: payload.user?.tenantId,
    });
  },

  /* -------------------------------------------------------
   * ONLINE LOGIN (SERVER REQUIRED)
   * ----------------------------------------------------- */
  /**
   * @param options.takeOver the person has been asked about the screen this
   *        account is already open on, and has said to sign in here anyway.
   *        That screen is signed out the moment this one succeeds.
   */
  loginWithCredentials: async (credentials, options) => {
    // The device name rides along so that whoever is asked next is told
    // which screen this account is open on.
    const res = await api.post(
      "/user/login",
      {
        ...credentials,
        side: "cashier",
        ...(options?.takeOver ? { take_over: true } : {}),
      },
      { headers: { "x-device-label": describeThisDevice() || "" } }
    );

    const data = res.data?.data || res.data;
    const token = data?.token || data?.accessToken;
    const user = data?.user;
    if (!token || !user) {
      throw new Error("Invalid login response");
    }

    await saveAuth({ user, token });

    set({
      user,
      token,
      isAuthenticated: true,
      hydrated: true,
      // An owner of several shops is signed in but not yet standing in one.
      // The till asks before it shows a menu; until then this is the list.
      outletsToChoose: data?.needsOutlet ? data?.outlets || [] : [],
    });

    // Now that a token exists, pull the tenant's current GST settings — the
    // owner may have changed them since this till last signed in.
    refreshGstSettings(api, user?.outlet_id);
    refreshMenuLanguage(api);
    refreshLanguage(api);
    refreshOutletFeatures(api, user?.outlet_id);
    joinOutletRoom({ outletId: user?.outlet_id, tenantId: user?.tenantId });

    return { ...user, needsOutlet: Boolean(data?.needsOutlet) };
  },

  /* -------------------------------------------------------
   * LOGOUT (LOCAL ONLY)
   * ----------------------------------------------------- */
  logout: async () => {
    /**
     * Tell the server first.
     *
     * One account may only be signed in on one screen, so a till that just
     * forgets its token leaves the account looking busy - and the captain
     * moving to another tablet is refused for no reason. This closes the
     * session, so the next screen goes straight in.
     *
     * It must never stop the sign-out: a till with no network still has to
     * be able to hand over. The server lets a silent device go on its own a
     * couple of minutes later, which covers exactly this case.
     */
    try {
      await api.post("/user/logout", {}, { timeout: 4000 });
    } catch (err) {
      console.warn("Could not tell the server we signed out:", err);
    }

    clearGstSettings();
    clearMenuLanguage();
    clearLanguage();
    clearOutletFeatures();
    leaveOutletRoom();
    await clearAuth();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      hydrated: true,
    });
  },

  /* -------------------------------------------------------
   * HYDRATE (OFFLINE-FIRST, NO SERVER EVER)
   * ----------------------------------------------------- */
  hydrate: async () => {
    try {
      const data = await getAuth(); // IndexedDB only

      if (data?.token && data?.user) {
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          hydrated: true,
        });
        // Session restored — pick up any GST change made since last time.
        refreshGstSettings(api, data.user?.outlet_id);
        refreshMenuLanguage(api);
    refreshLanguage(api);
        refreshOutletFeatures(api, data.user?.outlet_id);
        joinOutletRoom({
          outletId: data.user?.outlet_id,
          tenantId: data.user?.tenantId,
        });
      } else {
        set({ hydrated: true });
      }
    } catch (err) {
      // 🔴 NEVER BLOCK UI
      set({ hydrated: true });
    }
  },

  /**
   * Which shop this till is standing in.
   *
   * Asked of the server rather than written down here. The shop is baked
   * into the token, so changing it on this device alone left the server
   * still sending every request to the shop just left — a petty-cash entry
   * or a bill raised afterwards was filed against it. The server checks the
   * shop is actually theirs, then hands back a new token and that shop's own
   * GST, switches, address and tagline.
   */
  setOutlet: async (outlet_id: string, outlet_name: string) => {
    const { user, token } = get();
    if (!user || !token) return;

    const res = await api.post("/user/choose-outlet", { outlet_id });
    const data = res.data?.data || res.data;

    const nextToken = data?.accessToken || data?.token || token;
    // Named userData by the server; the older shape is still accepted so a
    // till talking to a server that has not been updated yet keeps working.
    const nextUser = data?.userData || data?.user || {
      ...user,
      outlet_id,
      outlet_name,
    };

    await saveAuth({ user: nextUser, token: nextToken });

    set({
      user: nextUser,
      token: nextToken,
      isAuthenticated: true,
      // The choice has been made; nothing left to ask.
      outletsToChoose: [],
    });

    // The till has moved to a different outlet — swap which room it listens on,
    // and pick up that outlet's GST, which may not be the one it was charging.
    joinOutletRoom({ outletId: nextUser?.outlet_id, tenantId: nextUser?.tenantId });
    refreshGstSettings(api, nextUser?.outlet_id, { force: true });
    refreshMenuLanguage(api);
    refreshLanguage(api);
    // And what that outlet has been given, which may not be what the last one had.
    refreshOutletFeatures(api, nextUser?.outlet_id, { force: true });
  },

}));
