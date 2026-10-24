import { useEffect, useRef } from "react";
import api from "../utils/api";
import { getSocket } from "../socket/socket";
import { useAuthStore } from "../store/useAuthStore";
import { mapHoldOrder } from "../store/useHoldOrderStore";
import { getFeatures } from "../utils/features";
import { readPrinterSettings, sendKitchenTicket, findHelper } from "../utils/printSlip";
import { readTillSettings } from "../utils/tillSettings";
import { kotSlip } from "../utils/kotSlip";
import { hasStarted, markAllPrinted, markPrinted, unprinted } from "../utils/kotLedger";

/**
 * The machine that prints for the kitchen.
 *
 * A round can be sent from anywhere — the counter, a captain's tablet in the
 * middle of the floor — and a tablet has no printer cable. So printing cannot
 * belong to whoever took the order. One machine in the shop is told it is the
 * kitchen's printer, and it prints every round however it arrived.
 *
 * It listens for "something changed at this outlet" rather than for new rounds,
 * because that is the only signal there is. So it reads the kitchen's list,
 * compares it against what it has already printed, and prints the difference.
 * Anything else — a dish marked as cooking, a table paying — moves nothing.
 *
 * Whether it may print at all is asked each time rather than when the screen
 * loaded. Both answers change under it: the platform turns printed tickets on
 * from head office, and the person setting the shop up flips this machine to
 * being the kitchen's printer. Asking once meant both only took effect after a
 * reload, and a setting that needs a reload to work reads as a setting that
 * does not work.
 *
 * And it says what it is doing, out loud.
 *
 * There are five points at which this can decide it has nothing to do, and
 * every one of them used to be silent. Between "it printed" and "it stopped at
 * the first gate" the console showed exactly the same thing: nothing. Somebody
 * standing at a printer that has not moved cannot tell those apart, and nor
 * could I. A line per decision costs nothing and turns an evening of guessing
 * into one glance.
 */

const say = (...what) => console.info("[kitchen printer]", ...what);

export const useKotPrinter = () => {
  const user = useAuthStore((s) => s.user);
  const outletId = user?.outlet_id || null;

  // One run at a time. Four changes in the same second must not become four
  // overlapping reads of the same list, each printing what the others are
  // already printing.
  const busy = useRef(false);

  /** So the reasons are said once, not on every change all evening. */
  const lastReason = useRef("");

  useEffect(() => {
    if (!outletId) return undefined;

    let stopped = false;

    /**
     * Three things, every one of them asked fresh — and the reason named when
     * the answer is no.
     */
    const allowed = () => {
      const settings = readPrinterSettings();

      let reason = "";
      if (!settings.kotStation) {
        reason = "this machine is not set as the kitchen's printer (POS > Printer)";
      } else if (!settings.enabled) {
        reason = "printing is switched off on this machine (POS > Printer)";
      } else if (!getFeatures().kot_print_enabled) {
        reason = "this outlet has not been given printed kitchen tickets (super admin > Features)";
      }

      if (reason) {
        if (lastReason.current !== reason) {
          say("standing by —", reason);
          lastReason.current = reason;
        }
        return null;
      }

      if (lastReason.current) {
        say("ready");
        lastReason.current = "";
      }
      return settings;
    };

    const fetchQueue = async () => {
      const res = await api.get("/chef", { params: { outlet_id: outletId } });
      return (res?.data?.data || []).map(mapHoldOrder);
    };

    const printOne = async (order, settings) => {
      /**
       * Drawn once per printer rather than once for both.
       *
       * The kitchen and the counter can be on different rolls, so the ticket
       * is laid out to whichever paper it is about to come off. Asked fresh
       * each time as well: the platform can turn a shop from tables to a
       * counter mid-shift, and the next ticket should say so.
       */
      const render = ({ width, font, cut }) =>
        kotSlip(order, {
          width,
          font,
          cut,
          seatsPeople: getFeatures().table_service_enabled,
        }).toBase64();

      // Asked fresh too: a counter that hands one ticket to the guest and
      // keeps one with the food wants two of every round, and that is set on
      // this machine rather than decided here.
      return sendKitchenTicket(render, settings, {
        copies: readTillSettings().kotCopies,
        onTrouble: say,
      });
    };

    const run = async (why = "a change at this outlet") => {
      if (busy.current || stopped) return;

      const settings = allowed();
      if (!settings) return;

      busy.current = true;
      try {
        const helper = await findHelper();
        if (!helper) {
          say("cannot print —", "the print helper is not running on this machine");
          return;
        }

        const queue = await fetchQueue();

        /**
         * The first time this machine is made the kitchen's printer, whatever
         * is already open counts as printed.
         *
         * A kitchen that has been working off a screen all evening has a full
         * list, and printing all of it the moment the setting is turned on
         * buries the pass in tickets for food already cooking. Normally the
         * line is drawn the moment the switch is flipped, on the Printer
         * screen; this catches a machine whose switch was set some other way.
         */
        if (!hasStarted()) {
          markAllPrinted(queue.map((o) => o.serverId || o.localId));
          say(`starting here — ${queue.length} round(s) already open will not print`);
          return;
        }

        const waiting = unprinted(queue);
        if (!waiting.length) {
          say(`${why}: nothing new (${queue.length} round(s) in the kitchen)`);
          return;
        }

        say(`${why}: printing ${waiting.length} new round(s)`);
        for (const order of waiting) {
          if (stopped) break;
          const sent = await printOne(order, settings);
          // Only a ticket that reached the printer counts as printed. One that
          // did not is left for the next change, which is a second chance
          // rather than a round the kitchen never hears about.
          if (sent) {
            markPrinted(order.serverId || order.localId);
            say("printed", order.serverId || order.localId);
          } else {
            say("the printer would not take", order.serverId || order.localId, "- will try again");
          }
        }
      } catch (err) {
        console.warn("[kitchen printer] could not be given this round", err);
      } finally {
        busy.current = false;
      }
    };

    say("watching this outlet for new rounds");
    run("on opening");

    const socket = getSocket();
    const onChange = () => run("a round was sent");
    socket.on("holdOrderUpdated", onChange);

    /**
     * And a sweep, because a missed message is a round the kitchen never sees.
     *
     * The socket carries every round in practice, but a till that slept, lost
     * wifi for a minute, or reconnected between two rounds has no way of
     * knowing what it missed. Reading the list again costs one request and
     * prints nothing when there is nothing new.
     */
    const sweep = setInterval(() => run("the minute sweep"), 60 * 1000);

    return () => {
      stopped = true;
      clearInterval(sweep);
      socket.off("holdOrderUpdated", onChange);
    };
  }, [outletId]);
};

export default useKotPrinter;
