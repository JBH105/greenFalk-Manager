import axios from "axios";
import { getAuth } from "./authSession";

const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_BACKEND_API || "",
});

// Seed the Authorization header straight away, so a hard refresh uses the
// saved token on the very first request rather than the one after it.
//
// Through getAuth, never localStorage directly: localStorage is shared by
// every window of one browser, so a kitchen screen opened beside a till
// would have gone out carrying the cashier's token.
try {
  const seeded = getAuth();
  if (seeded?.token) api.defaults.headers.common["Authorization"] = `Bearer ${seeded.token}`;
} catch (err) {
  // ignore (e.g. SSR or private mode)
}

// Request interceptor to add auth token
api.interceptors.request.use(async (config) => {
  // Attach the saved session token.
  const authData = await getAuth();
  if (authData?.token) {
    config.headers.Authorization = `Bearer ${authData.token}`;
  }
  return config;
});

// Response interceptor for error handling
/** So one burst of failed calls cannot fire a dozen sign-outs. */
let signingOut = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    /**
     * The account has been signed in somewhere else, so this token is dead.
     * Sitting on a screen that looks signed in but can no longer take an
     * order is worse than being sent back to the login screen, so go.
     *
     * Only this one code: a plain 401 can be a single mis-timed call, and a
     * till must not drop a busy service over one of those.
     */
    if (
      error.response?.status === 401 &&
      error.response?.data?.errorCode === "session_ended" &&
      !signingOut
    ) {
      signingOut = true;
      // Imported here rather than at the top: the store imports this file.
      import("../store/useAuthStore")
        .then(({ useAuthStore }) => useAuthStore.getState().logout())
        .catch(() => {})
        .finally(() => {
          signingOut = false;
        });
    }

    return Promise.reject(error);
  }
);

export default api;

