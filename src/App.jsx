import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/login/LoginPage";
import PosLayout from "./components/layout/PosLayout";
import Dashboard from "./pages/pos/Dashboard";
import Customers from "./pages/pos/Customers";
import Invoices from "./pages/pos/Invoices";
import BillRequests from "./pages/pos/BillRequests";
import Parcels from "./pages/pos/Parcels";
import Promotions from "./pages/pos/Promotions";
import Tables from "./pages/pos/Tables";
import PrinterSettings from "./pages/pos/PrinterSettings";
import ProtectedRoute from "./components/ProtectedRoute";
import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/useAuthStore";
import { usePaymentMethodStore } from "./store/usePaymentMethodStore";
import { RetailProvider } from "./hooks/useRetail.jsx";
import SelectOutlet from "./pages/outlet/SelectOutlet.jsx";
import { getSocket } from "./socket/socket";
import LoadingBar from "./components/common/LoadingBar/LoadingBar";
import { useTableClaim } from "./hooks/useTableClaim";
import { useKotPrinter } from "./hooks/useKotPrinter";
import { useCartStore } from "./store/useCartStore";
import { meansThisScreen } from "./utils/sessionToken";
import api from "./utils/api";
import { applyOutletFeatures, refreshOutletFeatures } from "./utils/features";
import { applyMenuLanguage } from "./utils/menuLanguage";
import { applyLanguage, bootLanguage, t } from "./i18n";
import { canBill } from "./utils/roleUi";


const App = () => {
  const authHydrate = useAuthStore((s) => s.hydrate);
  const paymentMethodHydrate = usePaymentMethodStore((s) => s.hydrate);

  const authHydrated = useAuthStore((s) => s.hydrated);
  const paymentMethodHydrated = usePaymentMethodStore((s) => s.hydrated);

  // Tell the rest of the floor which table this device is standing at.
  useTableClaim();

  // And, on the one machine that has been told to, print the kitchen's
  // tickets. It does nothing at all anywhere else.
  useKotPrinter();


  useEffect(() => {   // online/offline detection
    authHydrate();   // cookie-based auth
    paymentMethodHydrate(); // Payment methods hydration

    const socket = getSocket();
    /**
     * The table was already taken.
     *
     * Two people reaching for the same table within a second of each other
     * is a real thing on a busy floor. The one who got there second is put
     * back where they were and told who has it, rather than being left to
     * write an order on a table somebody else is already writing on.
     */
    /**
     * The platform has changed what this outlet may do.
     *
     * It arrives with the new switches already on it, so there is nothing
     * to go and ask for. Without this a till only found out at the next
     * sign-in: somebody turns printed kitchen tickets on at head office,
     * the shop carries on as before, and the feature looks broken when it
     * is only unheard.
     */
    socket.on("outletFeaturesUpdated", (data) => {
      const mine = useAuthStore.getState().user?.outlet_id;
      if (data?.outlet_id && mine && data.outlet_id !== mine) return;
      applyOutletFeatures(data);
    });

    /**
     * The owner has changed which name a dish is written by.
     *
     * Restaurant-wide, so it arrives on the tenant's room rather than the
     * outlet's, and it carries the new value — there is nothing to go and
     * ask for. Every menu card, cart line and kitchen ticket redraws on the
     * spot; without it a till would keep the old names until somebody signed
     * out, which on a busy evening is nobody.
     */
    socket.on("menuLanguageUpdated", (data) => {
      applyMenuLanguage(data?.menu_language);
    });

    /* The owner has switched the language the till speaks. Restaurant-wide,
       so it arrives on the tenant room, and it carries the new value. */
    socket.on("uiLanguageUpdated", (data) => {
      applyLanguage(data?.language);
    });

    socket.on("table:claim:refused", (data) => {
      /**
       * Except at the counter.
       *
       * The refusal means somebody else is taking the order at that table.
       * That is a reason for a captain to stop, and no reason at all for
       * the till: the cashier is settling a bill that was ordered long
       * before, and letting go of the table left the guest standing at the
       * counter with a payment screen that had no table to bill. Money is
       * never blocked by who is holding a notepad.
       */
      if (canBill(useAuthStore.getState().user?.role?.name)) return;

      const who = data?.held_by?.name;
      const table = data?.table_number ? "Table " + data.table_number : t("tables.thatTable");
      toast.error(
        who ? `${table} is with ${who} right now.` : `${table} is already being served.`,
        { duration: 5000 }
      );
      useCartStore.getState().setSelectedTable({});
    });

    // Signed in on another screen. Landing back on the login page with no
    // explanation reads as a crash, so say what happened.
    socket.on("force_logout", (data) => {
      const { user: currentUser, token } = useAuthStore.getState();
      if (currentUser && meansThisScreen(data, { userId: currentUser.id, token })) {
        toast.error(t("session.takenOver"), {
          duration: 6000,
        });
        useAuthStore.getState().logout();
      }
    });

    /**
     * And a look back whenever the till is picked up again.
     *
     * A message sent while this screen was asleep, behind a locked tablet
     * or off the wifi is a message it never had. Asking again the moment
     * somebody returns to it costs one request and covers every way the
     * live update can be missed.
     */
    const lookAgain = () => {
      if (document.visibilityState !== "visible") return;
      const outletId = useAuthStore.getState().user?.outlet_id;
      if (outletId) refreshOutletFeatures(api, outletId, { force: true });
    };

    document.addEventListener("visibilitychange", lookAgain);
    window.addEventListener("focus", lookAgain);

    return () => {
      socket.off("force_logout");
      socket.off("table:claim:refused");
      socket.off("outletFeaturesUpdated");
      socket.off("menuLanguageUpdated");
      socket.off("uiLanguageUpdated");
      document.removeEventListener("visibilitychange", lookAgain);
      window.removeEventListener("focus", lookAgain);
    };
  }, []);

  // Hold the UI until the session and the till's reference data are in.
  if (!authHydrated || !paymentMethodHydrated) {
    return <LoadingBar />;
  }

  return (
    <>
      <RetailProvider>

        <Toaster
          position="bottom-left"
          reverseOrder={false}
          gutter={8}
          containerClassName="pos-toast-wrap"
        />
        <Routes>
          {/* Public */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/select-outlet" element={<SelectOutlet />} />

          {/* Protected POS */}
          <Route element={<ProtectedRoute />}>
            <Route path="/pos" element={<PosLayout />}>
              <Route index element={<Navigate to="/pos/dashboard" replace />} />
              <Route path="/pos/dashboard" element={<Dashboard />} />
              <Route path="/pos/customers" element={<Customers />} />
              <Route path="/pos/invoices" element={<Invoices />} />
              <Route path="/pos/bill-requests" element={<BillRequests />} />
              <Route path="/pos/parcels" element={<Parcels />} />
              <Route path="/pos/promotions" element={<Promotions />} />
              <Route path="/pos/tables" element={<Tables />} />
              <Route path="/pos/printer" element={<PrinterSettings />} />
            </Route>
          </Route>
        </Routes>
      </RetailProvider>
    </>
  );
};

export default App;
