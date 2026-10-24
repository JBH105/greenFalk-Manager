import React, { useEffect, useState } from "react";
import { useT } from "../../i18n";
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore } from "../../store/useCartStore";

const LogoutPopUp = ({ setIsLogoutClicked }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const logout = useAuthStore((l) => l.logout);
  const user = useAuthStore((u) => u.user);
  const resetCart = useCartStore((s) => s.resetCart);

  useEffect(() => {
    // trigger animation after mount
    setOpen(true);
  }, []);

  // --- Helper to clear IndexedDB ---
  // const clearIndexedDB = async () => {
  //   // List all possible DB names used by your app
  //   const databases = [
  //     "pos-auth-db",
  //     "pos-categories-db",
  //     "pos-credit-order-db",
  //     "pos-customers-db",
  //     "pos-hold-orders-db",
  //     "pos-lowstock-db",
  //     "pos-orders-db",
  //     "pos-outlet-db",
  //     "pos-payment-methods-db",
  //     "pos-products-db",
  //     "pos-promotions-db",
  //     "pos-tables-db"
  //   ];

  //   databases.forEach((dbName) => {
  //     const req = indexedDB.deleteDatabase(dbName);

  //     req.onsuccess = () => {
  //       console.log(`Deleted database: ${dbName}`);
  //     };
  //     req.onerror = () => {
  //       console.error(`Couldn't delete database: ${dbName}`);
  //     };
  //     req.onblocked = () => {
  //       console.warn(`Deletion of ${dbName} blocked. Close other tabs.`);
  //     };
  //   });
  // };

  const handleLogout = async () => {
    try {
      // await clearIndexedDB();
      // localStorage.clear();
      // sessionStorage.clear();
      logout();
      resetCart();
      setIsLogoutClicked(false);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div
      className="w-full h-screen bg-black/30  grid place-items-center fixed inset-0 z-50"
      onClick={() => setIsLogoutClicked(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`
          card w-full max-w-[420px] mx-4 bg-surface rounded-md
          transform transition-all duration-300 ease-out p-6
          ${open ? "scale-100 opacity-100" : "scale-0 opacity-0"}
        `}
      >
        <h1 className="text-lg text-text-secondary font-semibold text-center mb-4">
          <p className="text-xl font-bold text-secondary">
            {user?.first_name} {user?.last_name}
          </p>{" "}
          Do you want to Logout?
        </h1>
        <div className="button-group gap-4 flex justify-center">
          <button
            onClick={handleLogout}
            className="py-2.5 px-8 sm:px-12 bg-gradient-to-r from-[var(--theme-accent)] to-[var(--theme-primary-light)] text-text-inverted rounded-lg cursor-pointer font-semibold shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/40"
          >
            {t("logout.confirm")}
          </button>
          <button
            onClick={() => setIsLogoutClicked(false)}
            className="py-1 px-14 bg-surface border border-border-default rounded-md cursor-pointer font-semibold"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutPopUp;
