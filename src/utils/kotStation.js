import api from "./api";
import { mapHoldOrder } from "../store/useHoldOrderStore";
import { markAllPrinted } from "./kotLedger";

/**
 * This machine takes over printing for the kitchen, starting now.
 *
 * "Now" is the whole point. Whatever the kitchen already has open belongs to
 * however it was working a minute ago — a screen, or tickets from another
 * machine — and printing all of it again would bury the pass the moment the
 * setting is switched on. So the open rounds are written off as the starting
 * line, and everything after them prints.
 *
 * Drawing that line when the switch is flipped, rather than waiting for the
 * next round to arrive and drawing it then, is the difference between a shop
 * that prints its very next order and one that quietly swallows it. The lazy
 * version did the second, and the first order after setting the printer up is
 * exactly the order somebody is standing there watching for.
 *
 * Failing is not worth stopping the switch over: the ledger stays empty, the
 * next round draws the line instead, and the shop is one ticket worse off
 * rather than unable to turn the feature on at all.
 */
export const beginKitchenPrinting = async (outletId) => {
  if (!outletId) return false;

  try {
    const res = await api.get("/chef", { params: { outlet_id: outletId } });
    const open = (res?.data?.data || []).map(mapHoldOrder);
    markAllPrinted(open.map((o) => o.serverId || o.localId));
    return true;
  } catch {
    return false;
  }
};

export default beginKitchenPrinting;
