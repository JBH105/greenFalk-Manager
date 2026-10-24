import React, { useMemo, useState, useEffect } from "react";
import { useT } from "../../../i18n";
import { useZoneStore } from "../../../store/useZoneStore";
import AddNewTable from "./AddNewTable";
import { tableLabel } from "../../../utils/kitchen";

/* ─── Icons ──────────────────────────────────────────────────────────── */
const Svg = ({ size, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, display: "block" }}
  >
    {children}
  </svg>
);
const IcoGrid = ({ s = 17 }) => <Svg size={s}><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><rect x="14" y="14" width="7" height="7" rx="1.2" /></Svg>;
const IcoPlus = ({ s = 13 }) => <Svg size={s}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>;
const IcoPencil = ({ s = 13 }) => <Svg size={s}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></Svg>;
const IcoTrash = ({ s = 13 }) => <Svg size={s}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></Svg>;
const IcoUsers = ({ s = 12 }) => <Svg size={s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></Svg>;
const IcoX = ({ s = 15 }) => <Svg size={s}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>;
const IcoSearch = ({ s = 14 }) => <Svg size={s}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Svg>;

/**
 * The floor plan's back office.
 *
 * Creating, renaming and removing tables used to live on the cards themselves —
 * a delete button sat next to every table, one mis-tap away from wiping a table
 * mid-service. All of it moved here, where it is a deliberate trip rather than
 * something you can do by accident while seating a guest.
 */
const ManageTables = ({
  tables,
  isOccupied,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onRefreshTables,
}) => {
  const t = useT();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // table being edited
  const [creating, setCreating] = useState(null); // the room a new table is being added to
  const [confirming, setConfirming] = useState(null); // table queued for removal
  const [busyId, setBusyId] = useState(null);

  /* The parts of the restaurant, and the field for adding another. */
  const zones = useZoneStore((s) => s.zones);
  const fetchZones = useZoneStore((s) => s.fetchZones);
  const addZone = useZoneStore((s) => s.addZone);
  const renameZone = useZoneStore((s) => s.renameZone);
  const closeZone = useZoneStore((s) => s.closeZone);
  const setTableZone = useZoneStore((s) => s.setTableZone);
  const [newZone, setNewZone] = useState("");
  const [newZoneAr, setNewZoneAr] = useState("");
  /** The part being renamed, or null when the form is adding a new one. */
  const [editingZone, setEditingZone] = useState(null);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  /**
   * Moves a table, and re-reads the floor.
   *
   * The table list is owned by its own store, so the move has to be told to
   * the server and then read back — writing it into local state here would
   * leave the floor plan behind this screen showing the old room until
   * something else happened to refresh it.
   */
  const onMoveTable = async (table, zoneId) => {
    if (!table.serverId) return;
    const moved = await setTableZone(table.serverId, zoneId);
    if (moved) await onRefreshTables?.();
  };

  /**
   * One form for both jobs.
   *
   * Adding a part and giving an existing one its Arabic name are the same
   * two boxes, so they are the same two boxes. Tapping the pencil on a chip
   * loads it in here; the button then says Save and a Cancel appears beside
   * it. A second form under the first would have been a second thing to
   * find, for a screen whose whole job is a list of names.
   */
  const handleAddZone = async (e) => {
    e?.preventDefault?.();
    const name = newZone.trim();
    if (!name) return;

    const nameAr = newZoneAr.trim();

    if (editingZone) {
      if (await renameZone(editingZone, name, nameAr)) clearZoneForm();
      return;
    }

    if (await addZone(name, nameAr || null)) clearZoneForm();
  };

  const clearZoneForm = () => {
    setNewZone("");
    setNewZoneAr("");
    setEditingZone(null);
  };

  const startEditingZone = (zone) => {
    setEditingZone(zone.id);
    setNewZone(zone.zone_name || "");
    setNewZoneAr(zone.zone_name_ar || "");
  };

  const rows = useMemo(
    () =>
      [...tables]
        .sort((a, b) => String(a.tableNumber).localeCompare(String(b.tableNumber), undefined, { numeric: true }))
        .filter((t) => String(t.tableNumber ?? "").toLowerCase().includes(search.toLowerCase())),
    [tables, search]
  );

  /**
   * The rooms, each carrying its own tables.
   *
   * Driven by the list of rooms rather than by the tables, so a room that
   * is still empty is still shown — with its own "add a table" under it,
   * which is the whole point of having made it.
   *
   * A table pointing at a room that is no longer open falls into the first
   * one, which is where the server will have put it anyway; this only keeps
   * the screen from dropping it while the two catch up.
   */
  const zoneSections = useMemo(() => {
    if (!zones.length) return [];

    const byId = new Map(
      zones.map((z) => ({ id: z.id, name: z.zone_name, tables: [] })).map((s) => [s.id, s])
    );

    for (const table of rows) {
      const section = byId.get(table.zoneId) || byId.get(zones[0].id);
      section?.tables.push(table);
    }

    return [...byId.values()];
  }, [zones, rows]);

  const handleDelete = async (table) => {
    setBusyId(table.localId);
    try {
      await onDelete(table.localId);
      setConfirming(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
        style={{ background: "var(--primary-darker-alpha-45)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-[560px] max-h-[82vh] flex flex-col rounded-[20px] bg-white overflow-hidden border-[1.5px] border-[var(--primary-alpha-12)]"
          style={{ boxShadow: "0 28px 70px var(--primary-darker-alpha-22)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 pt-[18px] pb-4 border-b border-[var(--primary-alpha-12)]">
            <div className="flex items-center gap-2.5">
              <div
                className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center text-white flex-shrink-0"
                style={{
                  background: "linear-gradient(145deg,var(--theme-primary),var(--theme-primary-dark))",
                  boxShadow: "0 4px 16px var(--primary-alpha-42)",
                }}
              >
                <IcoGrid s={17} />
              </div>
              <div>
                <div className="text-[16px] font-extrabold text-[var(--theme-primary-darker)] tracking-[-0.025em] leading-tight">
                  {t("tables.manage")}
                </div>
                <div className="text-[10.5px] text-[var(--primary-alpha-42)] font-medium mt-px tracking-[0.02em]">
                  {tables.length} table{tables.length === 1 ? "" : "s"} on the floor
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="w-[30px] h-[30px] rounded-lg border-[1.5px] border-[var(--primary-alpha-12)] bg-[var(--theme-primary-palest)] text-[var(--primary-alpha-42)] flex items-center justify-center cursor-pointer transition-all hover:bg-[var(--theme-secondary-ghost)] hover:border-[var(--secondary-alpha-25)] hover:text-[var(--theme-secondary)]"
            >
              <IcoX s={15} />
            </button>
          </div>

          {/* ── Search + Add ── */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--primary-alpha-11)]">
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--primary-alpha-42)] pointer-events-none flex">
                <IcoSearch s={14} />
              </span>
              <input
                className="w-full h-[38px] pl-9 pr-3 rounded-[10px] border-[1.5px] border-[var(--primary-alpha-11)] bg-[var(--primary-alpha-4)] text-[13px] text-[var(--theme-primary-darker)] outline-none transition-all placeholder:text-[var(--primary-alpha-42)] focus:border-[var(--theme-primary)] focus:bg-[var(--primary-alpha-7)]"
                placeholder={t("tables.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {/* The button at the top still works, and puts the table in the
                first room. The one inside each room is the better way in,
                because it already knows the answer to "which room?". */}
            <button
              type="button"
              onClick={() => setCreating(zones[0]?.id ?? null)}
              disabled={!zones.length}
              className="pos-btn-primary flex items-center gap-[6px] px-4 h-[38px] text-[12px] font-bold tracking-[0.03em] cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <IcoPlus s={13} />{t("tables.newTable")}
            </button>
          </div>

          {/**
           * The parts of the restaurant.
           *
           * An AC room, a terrace, a family section — the restaurant names
           * its own, because no two of them divide a building the same way
           * and a fixed list would be wrong everywhere.
           *
           * Removing one never removes its tables. They go back to the
           * unsorted heading with their furniture and their bills intact,
           * and the chip says so plainly — deleting four tables because
           * somebody tidied a label would be the worst thing this screen
           * could do.
           */}
          <div className="border-b border-[var(--primary-alpha-11)] px-5 py-3">
            <div className="mb-2 flex items-center gap-3">
              <h3 className="label-caps !text-[var(--theme-primary)] shrink-0">
                {t("tables.zones")}
              </h3>
              <hr className="pos-rule-gold min-w-0 flex-1" />
            </div>

            <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
              {zones.length === 0 && (
                <span className="text-[11px] text-[var(--primary-alpha-42)]">
                  {t("tables.noZonesYet")}
                </span>
              )}
              {zones.map((z) => (
                <span
                  key={z.id}
                  className={`pos-chip pos-chip-green !text-[11px] gap-1.5 ${
                    editingZone === z.id ? "ring-2 ring-[var(--theme-primary)]/35" : ""
                  }`}
                >
                  {/* Both names on the chip, so which parts have been
                      translated is answered by looking rather than by
                      opening each one in turn. */}
                  <button
                    type="button"
                    title={t("tables.editZone")}
                    onClick={() => startEditingZone(z)}
                    className="flex cursor-pointer flex-col items-start leading-tight"
                  >
                    <span>{z.zone_name}</span>
                    {z.zone_name_ar && (
                      <span className="font-arabic text-[10px] opacity-70">
                        {z.zone_name_ar}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    title={t("tables.removeZone", { name: z.zone_name })}
                    aria-label={t("tables.removeZone", { name: z.zone_name })}
                    onClick={async () => {
                      if (editingZone === z.id) clearZoneForm();
                      if (await closeZone(z.id)) await onRefreshTables?.();
                    }}
                    className="-mr-1 ml-0.5 cursor-pointer rounded-full px-1 leading-none text-[13px] text-[var(--theme-primary)]/55 transition-colors hover:text-[var(--error-main)]"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>

            {/* Wraps rather than squeezes: two names and two buttons do not
                fit across a phone, and an input crushed to forty pixels is
                worse than one on its own line. */}
            <form onSubmit={handleAddZone} className="flex flex-wrap items-center gap-2">
              <input
                className="pos-inset h-[34px] min-w-[140px] flex-1 rounded-[9px] px-3 text-[12px] outline-none"
                placeholder={t("tables.addZone")}
                maxLength={60}
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
              />
              {/* Right to left, and in the Arabic face, because what goes in
                  here is Arabic — an Arabic word typed into a left-to-right
                  box puts its own punctuation on the wrong end. */}
              <input
                dir="rtl"
                className="pos-inset font-arabic h-[34px] min-w-[140px] flex-1 rounded-[9px] px-3 text-[12px] outline-none"
                placeholder={`${t("tables.zoneArabic")} — ${t("tables.zoneArabicHint")}`}
                maxLength={60}
                value={newZoneAr}
                onChange={(e) => setNewZoneAr(e.target.value)}
              />
              <button
                type="submit"
                disabled={!newZone.trim()}
                className="pos-btn-primary h-[34px] shrink-0 px-3.5 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {editingZone ? t("common.save") : t("common.add")}
              </button>
              {editingZone && (
                <button
                  type="button"
                  onClick={clearZoneForm}
                  className="h-[34px] shrink-0 cursor-pointer rounded-[9px] px-3 text-[12px] font-bold text-[var(--primary-alpha-62)]"
                >
                  {t("common.cancel")}
                </button>
              )}
            </form>
          </div>

          {/**
           * ── The floor, a room at a time ──
           *
           * Rooms are the outline and tables live inside them, rather than
           * one flat list with a room-picker bolted onto each row. It was
           * that way first, and the question it could never answer was the
           * obvious one: a new table — which room does it go in? Asked from
           * inside a room, it answers itself.
           */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scroll px-3 py-2">
            {zoneSections.map((zone) => (
              <section key={zone.id} className="mb-4 last:mb-1">
                <div className="mb-1.5 flex items-center gap-2 px-2">
                  <h3 className="label-caps !text-[11px] !text-[var(--theme-primary)] shrink-0">
                    {zone.name}
                  </h3>
                  <span className="pos-chip pos-chip-quiet shrink-0">
                    {zone.tables.length}
                  </span>
                  <hr className="pos-rule-gold min-w-0 flex-1" />

                  {/* The last room standing cannot be removed: a floor has
                      to have somewhere for its tables to be. */}
                  {zones.length > 1 && (
                    <button
                      type="button"
                      title={`Remove ${zone.name}. Its tables move to ${
                        zones.find((z) => z.id !== zone.id)?.zone_name
                      }.`}
                      aria-label={`Remove ${zone.name}`}
                      onClick={async () => {
                        if (await closeZone(zone.id)) await onRefreshTables?.();
                      }}
                      className="shrink-0 cursor-pointer rounded-md px-1.5 text-[15px] leading-none text-[var(--primary-alpha-35)] transition-colors hover:text-[var(--error-main)]"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {zone.tables.length === 0 && (
                  <p className="px-3 py-2 text-[11px] text-[var(--primary-alpha-42)]">
                    {t("tables.noneHere")}
                  </p>
                )}

                {zone.tables.map((t) => {
                const busy = isOccupied(t);
                const isConfirming = confirming?.localId === t.localId;
                return (
                  <div
                    key={t.localId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-[var(--primary-alpha-4)]"
                  >
                    <div
                      className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[13px] font-extrabold flex-shrink-0"
                      style={
                        busy
                          ? {
                              background: "linear-gradient(145deg,var(--theme-secondary),var(--theme-secondary-dark))",
                              color: "var(--color-white)",
                            }
                          : {
                              background: "var(--primary-alpha-6)",
                              color: "var(--theme-primary)",
                              border: "1.5px solid var(--primary-alpha-12)",
                            }
                      }
                    >
                      {tableLabel(t.tableNumber)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[var(--theme-primary-darker)] truncate">
                        Table {t.tableNumber}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[var(--primary-alpha-42)] font-medium">
                        <IcoUsers s={11} />
                        {t.seats} seats
                        {busy && (
                          <span className="ml-1.5 px-1.5 py-px rounded-full text-[9px] font-extrabold uppercase tracking-[0.08em] bg-[var(--secondary-alpha-10)] text-[var(--theme-secondary)]">
                            {t("tables.inUse")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/**
                     * Moving a table to another room.
                     *
                     * A plain select rather than a screen of its own: it is
                     * done once when the floor is first laid out and then
                     * almost never, and a wizard would be three taps where
                     * one will do. It only appears where there is somewhere
                     * else to move to.
                     */}
                    {zones.length > 1 && (
                      <select
                        value={t.zoneId || ""}
                        onChange={(e) => onMoveTable(t, e.target.value || null)}
                        aria-label={`Which part of the restaurant table ${t.tableNumber} is in`}
                        className="pos-inset h-8 max-w-[124px] rounded-[9px] px-2 text-[11px] font-semibold text-[var(--theme-primary)] cursor-pointer"
                      >
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.zone_name}
                          </option>
                        ))}
                      </select>
                    )}

                    {isConfirming ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[var(--theme-secondary)]">{t("tables.remove")}</span>
                        <button
                          type="button"
                          disabled={busyId === t.localId}
                          onClick={() => handleDelete(t)}
                          className="gf-metal-gold px-2.5 h-8 rounded-[9px] text-[11px] font-bold cursor-pointer disabled:opacity-50"
                        >
                          {busyId === t.localId ? "…" : "Yes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="px-2.5 h-8 rounded-[9px] text-[11px] font-bold cursor-pointer border-[1.5px] border-[var(--primary-alpha-12)] text-[var(--primary-alpha-62)] transition-all hover:bg-[var(--primary-alpha-5)]"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(t)}
                          aria-label={`Edit table ${t.tableNumber}`}
                          className="w-8 h-8 rounded-[9px] flex items-center justify-center cursor-pointer border-[1.5px] border-[var(--primary-alpha-12)] bg-[var(--primary-alpha-4)] text-[var(--theme-primary)] transition-all hover:bg-[var(--theme-primary)] hover:text-white hover:border-transparent"
                        >
                          <IcoPencil s={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(t)}
                          disabled={busy}
                          title={busy ? t("tables.hasRunningOrder") : t("tables.remove")}
                          aria-label={`Remove table ${t.tableNumber}`}
                          className={`w-8 h-8 rounded-[9px] flex items-center justify-center border-[1.5px] transition-all ${
                            busy
                              ? "opacity-40 cursor-not-allowed border-[var(--primary-alpha-10)] bg-[var(--primary-alpha-4)] text-[var(--primary-alpha-30)]"
                              : "cursor-pointer border-[var(--secondary-alpha-13)] bg-[var(--secondary-alpha-6)] text-[var(--secondary-alpha-55)] hover:bg-[var(--theme-secondary)] hover:text-[var(--theme-primary-darker)] hover:border-transparent"
                          }`}
                        >
                          <IcoTrash s={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
                })}

                {/* The new table knows where it is going, because of where
                    it was asked for. */}
                <button
                  type="button"
                  onClick={() => setCreating(zone.id)}
                  className="mt-1 ml-3 flex items-center gap-1.5 rounded-[9px] border border-dashed border-[var(--primary-alpha-20)] px-3 py-1.5 text-[11px] font-bold text-[var(--theme-primary)]/75 transition-all hover:border-[var(--theme-primary)]/40 hover:bg-[var(--primary-alpha-5)] hover:text-[var(--theme-primary)]"
                >
                  <IcoPlus s={11} />
                  Add a table to {zone.name}
                </button>
              </section>
            ))}

            {rows.length === 0 && search && (
              <div className="py-10 text-center text-[12px] text-[var(--primary-alpha-42)]">
                No table matches “{search}”
              </div>
            )}
          </div>
        </div>
      </div>

      {/* `creating` holds the id of the room it was asked for from, so the
          table lands where somebody tapped rather than in a default they
          then have to correct. */}
      {creating && (
        <AddNewTable
          zoneName={zones.find((z) => z.id === creating)?.zone_name}
          onClose={() => setCreating(null)}
          onSave={async (payload) => {
            // Anything that goes wrong is raised, and the form keeps itself
            // open to show it.
            await onCreate({ ...payload, zoneId: creating });
            setCreating(null);
          }}
        />
      )}

      {editing && (
        <AddNewTable
          table={editing}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            await onUpdate(editing.localId, payload);
            setEditing(null);
          }}
        />
      )}
    </>
  );
};

export default ManageTables;
