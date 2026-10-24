import React, { useEffect, useMemo, useState } from "react";
import { useT } from "../../i18n";
import { useParcelStore } from "../../store/useParcelStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useSocket } from "../../socket/SocketProvider";
import { useNotification } from "../../hooks/useNotification";
import LoadingBar from "../../components/common/LoadingBar/LoadingBar";
import { cur } from "../../utils/currency";
import { billMoment } from "../../utils/billMoment";
import { useFeatures } from "../../hooks/useFeatures";
import { useNavigate } from "react-router-dom";

/**
 * The parcels this counter has sold today.
 *
 * A parcel is paid for before it is cooked, which is what makes this screen
 * necessary: the sale leaves every other list the moment the money is taken.
 * Until now the cashier had nowhere to look, and finding out whether a parcel
 * was ready meant leaning into the kitchen and asking.
 *
 * Three columns, in the order a cashier thinks: what is still cooking, what is
 * ready to hand over, and what has gone. Ready is the working column and is
 * the only one given colour — on a busy counter the eye should land there
 * without being asked to.
 */

const STAGES = [
  {
    key: "COOKING",
    title: "parcel.cooking",
    blurb: "parcel.withKitchen",
    dot: "bg-[var(--warning-default)]",
  },
  {
    key: "READY",
    title: "parcel.ready",
    blurb: "parcel.waitingCollect",
    dot: "bg-success",
  },
  {
    key: "HANDED_OVER",
    title: "parcel.collected",
    blurb: "parcel.givenToGuest",
    dot: "bg-[var(--gray-400)]",
  },
];

/** How long a parcel has been waiting, in words a person would use. */
const waitedFor = (since) => {
  if (!since) return "";
  const minutes = Math.floor((Date.now() - new Date(since).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0) return "";
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "1 hr" : `${hours} hrs`;
};

/**
 * A parcel kept waiting is the thing worth noticing on this screen, so after
 * a quarter of an hour it stops looking like all the others.
 */
const LATE_AFTER_MINUTES = 15;
const isLate = (since) => {
  if (!since) return false;
  return (Date.now() - new Date(since).getTime()) / 60000 >= LATE_AFTER_MINUTES;
};

const ParcelCard = ({ parcel, onHandOver, busy }) => {
  const t = useT();
  const ready = parcel.stage === "READY";
  const gone = parcel.stage === "HANDED_OVER";
  const late = !gone && isLate(parcel.placedAt);

  return (
    <li
      className={
        "rounded-2xl border bg-surface shadow-sm transition-all duration-200 " +
        (ready
          ? "border-success/40 shadow-[0_2px_12px_var(--overlay-black-15)]"
          : "border-border-default") +
        (gone ? " opacity-55" : "")
      }
    >
      <div className="flex items-stretch gap-3 p-3">
        {/* The number called across the counter. Nothing else on this card is
            said out loud, so nothing else is this size. */}
        <div
          className={
            "shrink-0 w-[58px] rounded-xl px-2 py-1.5 text-center leading-none " +
            (gone
              ? "bg-bg-secondary text-text-muted"
              : "gf-metal-green shadow-sm")
          }
        >
          <p className="text-[22px] font-black tabular-nums">
            {parcel.tokenNo ?? "—"}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] opacity-80">
            {t("parcel.token")}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight text-text-primary">
              {parcel.customerName || t("parcel.walkIn")}
            </p>
            {/* Whether this one goes into a bag. Only said when it does — the
                other kind is the ordinary case and needs no label. */}
            {String(parcel.orderType).toUpperCase() === "PARCEL" && (
              <span className="shrink-0 rounded px-1.5 py-[1px] text-[9px] font-black uppercase tracking-wide bg-[var(--warning-default)]/15 text-[var(--warning-default)] border border-[var(--warning-default)]/30">
                {t("parcel.one")}
              </span>
            )}
          </div>
          {parcel.customerPhone && (
            <p className="truncate text-xs tabular-nums text-text-secondary">
              {parcel.customerPhone}
            </p>
          )}
          <p className="mt-1 truncate text-[11px] text-text-muted">
            {parcel.billNo}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between text-right">
          <p className="text-[13px] font-bold tabular-nums text-text-primary">
            {cur()}
            {Number(parcel.total ?? 0).toFixed(2)}
          </p>
          <p
            className={
              "text-[11px] font-semibold " +
              (late ? "text-[var(--error-default)]" : "text-text-muted")
            }
          >
            {gone ? "collected" : waitedFor(parcel.placedAt)}
          </p>
        </div>
      </div>

      {parcel.dishes?.length > 0 && (
        <ul className="mx-3 space-y-1 border-t border-border-default py-2">
          {parcel.dishes.map((dish, i) => (
            <li key={i} className="flex gap-2 text-[12px] leading-snug">
              <span className="w-6 shrink-0 font-bold tabular-nums text-primary">
                {dish.quantity}&times;
              </span>
              <span className="min-w-0 flex-1 text-text-secondary">
                {dish.name}
                {dish.jain && (
                  <span className="ml-1 rounded border border-primary/40 px-1 text-[9px] font-bold uppercase tracking-wide text-primary">
                    {t("cart.jain")}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {ready && (
        <div className="p-3 pt-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => onHandOver(parcel)}
            className="w-full rounded-xl bg-success px-3 py-2.5 text-sm font-bold text-text-inverted shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "…" : t("parcel.handedOver")}
          </button>
        </div>
      )}
    </li>
  );
};

const Parcels = () => {
  const t = useT();

  const { parcels, day, loading, hydrated, fetchParcels, markHandedOver } =
    useParcelStore();
  const user = useAuthStore((u) => u.user);
  const socket = useSocket();
  const { notifyError } = useNotification();
  const [busyId, setBusyId] = useState(null);
  const features = useFeatures();
  const navigate = useNavigate();

  /**
   * A counter has no use for this screen.
   *
   * The side bar already leaves it out, but the address is still an address —
   * a bookmark, or a till left on it when the shop changed. The menu is where
   * the work is.
   */
  useEffect(() => {
    if (!features.table_service_enabled) navigate("/pos/dashboard", { replace: true });
  }, [features.table_service_enabled, navigate]);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  // The kitchen finishing a parcel is the event this screen exists for, so it
  // arrives rather than being waited for.
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchParcels({ force: true });
    socket.on("holdOrderUpdated", refresh);
    socket.on("parcelUpdated", refresh);
    socket.on("orderStatusUpdated", refresh);
    return () => {
      socket.off("holdOrderUpdated", refresh);
      socket.off("parcelUpdated", refresh);
      socket.off("orderStatusUpdated", refresh);
    };
  }, [socket, fetchParcels]);

  // A counter is read at a glance, and "8 min" has to keep being true.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const byStage = useMemo(() => {
    const groups = { COOKING: [], READY: [], HANDED_OVER: [] };
    for (const p of parcels || []) (groups[p.stage] ?? groups.COOKING).push(p);
    // Collected ones read newest first; the other two oldest first, because
    // whoever has waited longest is served next.
    groups.HANDED_OVER.reverse();
    return groups;
  }, [parcels]);

  const handOver = async (parcel) => {
    setBusyId(parcel.id);
    const ok = await markHandedOver(parcel.id);
    setBusyId(null);
    if (!ok) notifyError(t("parcel.collectFailed"));
  };

  return (
    <div className="flex h-full flex-col gap-3 bg-bg-main p-3 sm:p-4">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {/* In a shop with no tables this is not the parcel counter beside
              the restaurant — it is the whole day's trade, so it is named for
              what it holds. The side bar calls it the same thing. */}
          <h1 className="bg-[var(--gf-gradient-gold)] bg-clip-text text-2xl font-black leading-tight text-transparent">
            {features.table_service_enabled ? t("parcel.title") : t("nav.orders")}
          </h1>
          <p className="text-xs text-text-muted">
            {t("parcel.soldToday")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
            {byStage.READY.length} ready
          </span>
          <span className="rounded-full bg-[var(--warning-default)]/10 px-3 py-1 text-xs font-bold text-[var(--warning-default)]">
            {byStage.COOKING.length} cooking
          </span>
        </div>
      </header>

      {loading && !hydrated && <LoadingBar />}

      {hydrated && (parcels?.length ?? 0) === 0 && (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border-default bg-surface">
          <div className="p-8 text-center">
            <p className="text-base font-bold text-text-secondary">
              {t("parcel.noneToday")}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {t("parcel.appearsWhenPaid")}
            </p>
          </div>
        </div>
      )}

      {(parcels?.length ?? 0) > 0 && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto md:grid-cols-3 md:overflow-hidden">
          {STAGES.map((stage) => (
            <section
              key={stage.key}
              className="flex min-h-0 flex-col rounded-2xl bg-bg-secondary/60 p-2.5"
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={"h-2 w-2 shrink-0 rounded-full " + stage.dot} />
                <h2 className="text-[13px] font-black uppercase tracking-wide text-text-primary">
                  {t(stage.title)}
                </h2>
                <span className="rounded-full bg-surface px-1.5 text-[11px] font-bold tabular-nums text-text-secondary">
                  {byStage[stage.key].length}
                </span>
                <span className="ml-auto hidden truncate text-[11px] text-text-muted lg:block">
                  {t(stage.blurb)}
                </span>
              </div>

              {byStage[stage.key].length === 0 ? (
                <p className="rounded-xl border border-dashed border-border-default bg-surface/50 p-4 text-center text-xs text-text-muted">
                  {t("parcel.nothingHere")}
                </p>
              ) : (
                <ul className="space-y-2 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
                  {byStage[stage.key].map((parcel) => (
                    <ParcelCard
                      key={parcel.id}
                      parcel={parcel}
                      busy={busyId === parcel.id}
                      onHandOver={handOver}
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Which counter, and which day's parcels these are — a till left open
          overnight would otherwise show yesterday without saying so. */}
      {(user?.outlet_name || day) && (
        <p className="text-center text-[11px] text-text-muted">
          {[user?.outlet_name, day ? billMoment(`${day} 00:00`).split("  ")[0] : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </div>
  );
};

export default Parcels;
