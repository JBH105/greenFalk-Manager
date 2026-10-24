import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useCartStore } from "../store/useCartStore";
import { claimTable, releaseTable } from "../socket/socket";

/**
 * Tells the rest of the restaurant which table this device is standing at.
 *
 * Between opening a table and sending anything to the kitchen there is no
 * order, so the table looks free on every other screen — and the cashier, out
 * front with a family waiting, seats them at the table the captain is already
 * taking an order on. This closes that gap.
 *
 * It watches the selected table rather than hooking into every place a table
 * can be picked up or put down. Opening one, walking to another, holding the
 * order, signing out, closing the app: all of them end up changing this one
 * value, so all of them are covered without hunting for call sites.
 */
const idOf = (table) => table?.serverId || table?.localId || table?.id || null;

/** Sent again on this beat, which is how the server knows the device is still there. */
const STILL_HERE_MS = 30 * 1000;

export const useTableClaim = () => {
  const user = useAuthStore((s) => s.user);
  const selectedTable = useCartStore((s) => s.selectedTable);

  const outletId = user?.outlet_id || null;
  const tableId = idOf(selectedTable);
  const tableNumber =
    selectedTable?.tableNumber ||
    selectedTable?.table_number ||
    selectedTable?.name ||
    null;

  useEffect(() => {
    if (!outletId || !tableId) {
      // Nothing selected: whatever this device was holding, it has let go.
      releaseTable();
      return undefined;
    }

    const who = {
      outletId,
      tableId,
      tableNumber,
      userId: user?.id || null,
      name: user?.first_name || user?.username || null,
      role: user?.role?.name || null,
    };

    claimTable(who);
    const stillHere = setInterval(() => claimTable(who), STILL_HERE_MS);

    return () => {
      clearInterval(stillHere);
      releaseTable();
    };
  }, [
    outletId,
    tableId,
    tableNumber,
    user?.id,
    user?.first_name,
    user?.username,
    user?.role?.name,
  ]);
};
