import { useState, useRef, useEffect } from "react";
import { useT } from "../../../i18n";
import LoadingBar from "../../common/LoadingBar/LoadingBar";
import { tableLabel } from "../../../utils/kitchen";

/* ─── Color Palette (ONLY var(--theme-primary) & var(--theme-secondary) + derivatives) ──────────── */
const P = "var(--theme-primary)";
const R = "var(--theme-secondary)";
const C = {
  p900:"var(--theme-primary-darker)", p800:"var(--theme-primary-dark)", p700:"var(--theme-primary-light)", p500:P, p400:"var(--theme-primary-lighter)",
  p300:"var(--theme-primary-lightest)", p100:"var(--theme-primary-pale)", p75:"var(--theme-primary-paler)", p50:"var(--theme-primary-palest)", p25:"var(--theme-primary-ghost)",
  r700:"var(--theme-secondary-dark)", r600:"var(--theme-secondary-muted)", r500:R, r400:"var(--theme-secondary-light)", r100:"var(--theme-secondary-pale)", r50:"var(--theme-secondary-ghost)",
  border:"var(--primary-alpha-12)", borderFocus:P,
  text:"var(--theme-primary-darker)", textMid:"var(--primary-alpha-62)", textSub:"var(--primary-alpha-42)",
};

/* ─── Icons ──────────────────────────────────────────────────────────── */
const Svg = ({ size, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round"
    strokeLinejoin="round" style={{ flexShrink: 0, display: "block" }}>
    {children}
  </svg>
);
const IcoGrid    = ({ s = 17 }) => <Svg size={s}><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></Svg>;
const IcoHash    = ({ s = 15 }) => <Svg size={s}><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></Svg>;
const IcoUsers   = ({ s = 15 }) => <Svg size={s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></Svg>;
const IcoSave    = ({ s = 14 }) => <Svg size={s}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></Svg>;
const IcoRefresh = ({ s = 13 }) => <Svg size={s}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></Svg>;
const IcoX       = ({ s = 15 }) => <Svg size={s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>;
const IcoSpinner = ({ s = 14 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
    style={{ animation: "ant-spin 0.75s linear infinite", flexShrink: 0 }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

/* ─── Styles ─────────────────────────────────────────────────────────── */
const ANT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

.ant-root { font-family:'Outfit',sans-serif; }
.ant-root * { box-sizing:border-box; margin:0; padding:0; }

@keyframes ant-backdrop { from{opacity:0} to{opacity:1} }
@keyframes ant-modal    { from{opacity:0;transform:translateY(20px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes ant-spin     { from{transform:rotate(0)} to{transform:rotate(360deg)} }
@keyframes ant-shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes ant-glow-p   { 0%,100%{box-shadow:0 4px 16px var(--primary-alpha-40)} 50%{box-shadow:0 4px 24px var(--primary-alpha-60)} }

.ant-backdrop { animation:ant-backdrop 0.18s ease both; }
.ant-modal    { animation:ant-modal 0.24s cubic-bezier(0.34,1.3,0.64,1) both; }

/* ─ Accent bar ─ */
.ant-accent-bar {
  height:3px; border-radius:99px 99px 0 0;
  background:linear-gradient(90deg,${P},${R},${P});
  background-size:300% 100%;
  animation:ant-shimmer 4s linear infinite;
  flex-shrink:0;
}

/* ─ Close btn ─ */
.ant-close-btn {
  width:30px; height:30px; border-radius:8px;
  border:1.5px solid ${C.border}; background:${C.p50};
  color:${C.textSub}; cursor:pointer; display:flex;
  align-items:center; justify-content:center;
  transition:all 0.17s ease; flex-shrink:0;
}
.ant-close-btn:hover { background:${C.r50}; border-color:var(--secondary-alpha-25); color:${R}; transform:scale(1.04); }

/* ─ Label ─ */
.ant-label {
  display:flex; align-items:center; gap:6px;
  font-size:10.5px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase;
  color:${C.textSub}; margin-bottom:6px;
}

/* ─ Input wrap ─ */
.ant-input-wrap { position:relative; display:flex; align-items:center; }
.ant-input-ico  { position:absolute; left:13px; color:${C.textSub}; pointer-events:none; display:flex; align-items:center; transition:color 0.18s ease; }
.ant-input {
  width:100%; height:44px; padding:0 14px 0 40px;
  border-radius:11px; border:1.5px solid ${C.border};
  background:${C.p25}; color:${C.text};
  font-family:'Outfit',sans-serif; font-size:14px; font-weight:500;
  outline:none; transition:all 0.18s ease;
  -moz-appearance:textfield;
}
.ant-input::-webkit-outer-spin-button,
.ant-input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
.ant-input::placeholder { color:${C.textSub}; font-weight:400; }
.ant-input:focus { border-color:${P}; background:var(--primary-alpha-6); box-shadow:0 0 0 3px var(--primary-alpha-9); }
.ant-input-wrap:focus-within .ant-input-ico { color:${P}; }

/* ─ Preview card ─ */
.ant-preview {
  display:flex; align-items:center; gap:16px;
  padding:15px 16px; border-radius:14px;
  border:1.5px dashed var(--primary-alpha-18);
  background:${C.p25}; transition:all 0.22s ease;
}
.ant-preview.has-data {
  border-style:solid; border-color:var(--primary-alpha-25);
  background:var(--primary-alpha-4);
  box-shadow:0 4px 18px var(--primary-alpha-7);
}

/* ─ Preview surface ─ */
.ant-prev-surface {
  width:62px; height:54px; border-radius:12px; position:relative;
  display:flex; align-items:center; justify-content:center; flex-direction:column; gap:3px;
  flex-shrink:0; transition:all 0.24s ease;
  background:var(--primary-alpha-6); border:1.5px solid var(--primary-alpha-12);
}
.ant-preview.has-data .ant-prev-surface {
  background:linear-gradient(145deg,${P},${C.p800});
  border-color:transparent;
  box-shadow:0 6px 20px var(--primary-alpha-38);
  animation:ant-glow-p 3s ease infinite;
}
.ant-prev-chair { position:absolute; border-radius:4px; background:var(--primary-alpha-10); transition:background 0.24s ease; }
.ant-preview.has-data .ant-prev-chair { background:var(--overlay-white-22); }
.ant-prev-chair.ct { top:-7px; left:20%; width:60%; height:6px; }
.ant-prev-chair.cb { bottom:-7px; left:20%; width:60%; height:6px; }
.ant-prev-chair.cl { left:-7px; top:20%; width:6px; height:60%; }
.ant-prev-chair.cr { right:-7px; top:20%; width:6px; height:60%; }
.ant-prev-num {
  font-size:16px; font-weight:800; letter-spacing:-0.03em; color:var(--primary-alpha-30);
  line-height:1; transition:color 0.22s ease;
}
.ant-preview.has-data .ant-prev-num { color:var(--color-white); }
.ant-prev-sub {
  font-size:9.5px; font-weight:600; color:var(--primary-alpha-25);
  font-family:'JetBrains Mono',monospace; transition:color 0.22s ease;
}
.ant-preview.has-data .ant-prev-sub { color:var(--overlay-white-72); }

/* ─ Preview meta ─ */
.ant-prev-lbl { font-size:10px; font-weight:700; color:${C.textSub}; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:3px; }
.ant-prev-val { font-size:15px; font-weight:800; color:var(--primary-alpha-22); letter-spacing:-0.02em; transition:color 0.22s ease; line-height:1.2; }
.ant-preview.has-data .ant-prev-val { color:${C.p900}; }

/* ─ Buttons ─ */
.ant-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:7px;
  height:42px; padding:0 20px; border-radius:11px;
  font-family:'Outfit',sans-serif; font-size:13px; font-weight:700;
  cursor:pointer; transition:all 0.18s ease;
  border:1.5px solid transparent; letter-spacing:0.02em; white-space:nowrap;
}
.ant-btn-primary {
  background:linear-gradient(135deg,${P},${C.p800});
  color:var(--color-white); flex:1;
  box-shadow:0 3px 14px var(--primary-alpha-35);
}
.ant-btn-primary:hover:not(:disabled) { filter:brightness(1.09); transform:translateY(-1px); box-shadow:0 5px 20px var(--primary-alpha-48); }
.ant-btn-primary:active:not(:disabled) { transform:translateY(0); }
.ant-btn-primary:disabled { opacity:0.45; cursor:not-allowed; filter:none; transform:none; box-shadow:none; }

.ant-btn-ghost {
  background:${C.p25}; color:${C.textMid}; border-color:${C.border};
}
.ant-btn-ghost:hover { background:${C.p75}; border-color:var(--primary-alpha-26); color:${P}; transform:translateY(-1px); }
.ant-btn-ghost:active { transform:translateY(0); }

.ant-btn-cancel {
  background:var(--color-white); color:${C.textSub}; border-color:${C.border};
}
.ant-btn-cancel:hover { background:${C.r50}; border-color:var(--secondary-alpha-22); color:${R}; transform:translateY(-1px); }
.ant-btn-cancel:active { transform:translateY(0); }

/* ─ Divider ─ */
.ant-divider { height:1px; background:${C.border}; }
`;

/* ─── Component ──────────────────────────────────────────────────────── */
/**
 * The same form serves both jobs. Pass a `table` and it opens on that table's
 * details to be edited; leave it out and it is a blank new table.
 */
const AddNewTable = ({ onClose, onSave, table = null, zoneName = null }) => {
  const t = useT();

  const isEdit = Boolean(table);
  const [tableNumber, setTableNumber] = useState(table?.tableNumber ?? "");
  const [seats, setSeats] = useState(table?.seats ?? "");
  const [isLoading, setIsLoading] = useState(false);
  // Shown on the form rather than as a toast: a refusal the owner needs to act
  // on should not slide away after three seconds.
  const [error, setError] = useState("");
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, []);

  // Reset means "back to how it was" when editing, not "empty".
  const resetForm = () => {
    setTableNumber(table?.tableNumber ?? "");
    setSeats(table?.seats ?? "");
    firstInputRef.current?.focus();
  };

  const isSaveDisabled = !String(tableNumber).trim() || !seats;

  const handleCancel = () => { resetForm(); onClose(); };

  const handleSubmit = async e => {
    e.preventDefault();
    if (isSaveDisabled) return;
    setIsLoading(true);
    setError("");
    try {
      await onSave({ tableNumber: String(tableNumber).trim(), seats: Number(seats) });
      // An edit closes on success; a new table clears so the next one can be
      // typed straight away.
      if (!isEdit) resetForm();
    } catch (err) {
      setError(err?.message || t("tables.saveFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const hasData = !!(tableNumber || seats);

  return (
    <>
      <style>{ANT_CSS}</style>
      <div
        className="ant-root ant-backdrop"
        style={{
          // Above Manage Tables, which opens this one. They used to share a
          // layer, so the form appeared behind the list that had just opened
          // it and pressing New Table looked like it did nothing at all.
          position: "fixed", inset: 0, zIndex: 100000,
          background: "var(--primary-darker-alpha-45)",
          backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}
        onClick={handleCancel}
      >
        <LoadingBar isLoading={isLoading} />

        <form
          className="ant-modal"
          onSubmit={handleSubmit}
          onClick={e => e.stopPropagation()}
          style={{
            background: "var(--color-white)", borderRadius: "20px",
            width: "100%", maxWidth: "420px",
            boxShadow: `0 28px 70px var(--primary-darker-alpha-22), 0 2px 12px var(--primary-darker-alpha-10)`,
            border: `1.5px solid ${C.border}`,
            overflow: "hidden",
          }}
        >
          {/* Shimmer accent */}
          {/* <div className="ant-accent-bar" /> */}

          {/* ── Modal Header ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: `linear-gradient(145deg,${P},${C.p800})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--color-white)", boxShadow: `0 4px 16px var(--primary-alpha-42)`,
              }}>
                <IcoGrid s={17} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.p900, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
                  {isEdit
                    ? `${t("customers.edit")} ${t("tables.number")} ${table?.tableNumber ?? ""}`.trim()
                    : t("tables.newTable")}
                </div>
                <div style={{ fontSize: 10.5, color: C.textSub, fontWeight: 500, marginTop: 1, letterSpacing: "0.02em" }}>
                  // then found somewhere else is the kind of small surprise that
                  // makes people stop trusting a screen.
                  {zoneName && !isEdit ? `Goes in ${zoneName}` : t("tables.configure")}
                </div>
              </div>
            </div>

            <button type="button" className="ant-close-btn" onClick={handleCancel}>
              <IcoX s={15} />
            </button>
          </div>

          <div className="ant-divider" style={{ margin: "16px 0 0" }} />

          {/* ── Body ── */}
          <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Live preview */}
            <div className={`ant-preview ${hasData ? "has-data" : ""}`}>
              <div style={{ position: "relative", padding: "8px 9px", flexShrink: 0 }}>
                <div className="ant-prev-surface">
                  <span className="ant-prev-chair ct" />
                  <span className="ant-prev-chair cb" />
                  <span className="ant-prev-chair cl" />
                  <span className="ant-prev-chair cr" />
                  {/* Same rule as the table grid: do not paste a second T on
                      a name that already starts with one. */}
                  <div className="ant-prev-num">{tableNumber ? tableLabel(tableNumber) : "—"}</div>
                  {seats && <div className="ant-prev-sub">{seats}s</div>}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ant-prev-lbl">{t("tables.preview")}</div>
                <div className="ant-prev-val">
                  {tableNumber && seats
                    ? `Table ${tableNumber} · ${seats} Seats`
                    : tableNumber
                    ? `Table ${tableNumber}`
                    : seats
                    ? `${seats} Seats`
                    : t("tables.fillDetails")}
                </div>
              </div>
            </div>

            {/* Table Number */}
            <div>
              <div className="ant-label"><IcoHash s={12} />{t("tables.number")}</div>
              <div className="ant-input-wrap">
                <span className="ant-input-ico"><IcoHash s={15} /></span>
                {/* Text, not number: tables are called "T4" and "Patio 2" as
                    often as they are called "12", and the server keeps the
                    name as text. */}
                <input
                  type="text" ref={firstInputRef} placeholder={t("tables.numberExample")} maxLength={20}
                  value={tableNumber} onChange={e => setTableNumber(e.target.value)}
                  className="ant-input"
                />
              </div>
            </div>

            {/* Seats */}
            <div>
              <div className="ant-label"><IcoUsers s={12} />{t("tables.seats")}</div>
              <div className="ant-input-wrap">
                <span className="ant-input-ico"><IcoUsers s={15} /></span>
                <input
                  type="number" placeholder="e.g. 4" min="1"
                  value={seats} onChange={e => setSeats(e.target.value)}
                  className="ant-input"
                />
              </div>
            </div>

            {error && (
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "var(--theme-secondary-ghost)",
                  border: "1.5px solid var(--secondary-alpha-22)",
                  color: "var(--theme-secondary-dark)",
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
              >
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
              <button type="submit" disabled={isSaveDisabled || isLoading} className="ant-btn ant-btn-primary">
                {isLoading ? <IcoSpinner s={14} /> : <IcoSave s={14} />}
                {isLoading ? "Saving…" : isEdit ? t("tables.saveChanges") : t("tables.saveTable")}
              </button>
              <button type="button" onClick={resetForm} className="ant-btn ant-btn-ghost" style={{ paddingLeft: 14, paddingRight: 14 }}>
                <IcoRefresh s={13} />{t("tables.reset")}
              </button>
              <button type="button" onClick={handleCancel} className="ant-btn ant-btn-cancel" style={{ paddingLeft: 14, paddingRight: 14 }}>
                <IcoX s={13} />{t("common.cancel")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

export default AddNewTable;