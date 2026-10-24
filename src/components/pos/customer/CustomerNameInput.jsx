import React, { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../../../i18n";
import { useCustomerStore } from "../../../store/useCustomerStore";

/**
 * The customer's name, with the people who have eaten here before.
 *
 * A regular is typed in again every time they come: the same person ends up in
 * the list four times, spelled four ways, and the history of what they order
 * is split across all four. Worse, the till refuses to save the fourth — it
 * rejects a repeated phone number — so the cashier is stopped at the counter
 * with a guest waiting and no obvious way forward.
 *
 * So typing a name now shows who is already known by it. Picking one attaches
 * that record to the order: no second copy is made, the phone number comes
 * with them, and the bill carries the name the guest was given last time.
 *
 * Typing a name nobody answers to still works exactly as before — most guests
 * at a counter are new, and they must not be made to wait for a list.
 */
const CustomerNameInput = ({
  value,
  onChange,
  onPick,
  /* No English default here: a default prop cannot ask for a translation,
     and the one that was here showed through on any screen that left the
     placeholder to the component. It is filled in below instead. */
  placeholder,
  className = "",
  inputRef,
  required = false,
  name = "name",
  autoFocus = false,
}) => {
  const t = useT();
  const hint = placeholder ?? t("customer.nameLabel");
  const customers = useCustomerStore((s) => s.customers);
  const hydrate = useCustomerStore((s) => s.hydrate);
  const hydrated = useCustomerStore((s) => s.hydrated);

  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const box = useRef(null);

  useEffect(() => {
    if (!hydrated) hydrate?.();
  }, [hydrated, hydrate]);

  const fullName = (c) => [c.firstName, c.lastName].filter(Boolean).join(" ").trim();

  const matches = useMemo(() => {
    const typed = String(value || "").trim().toLowerCase();
    if (typed.length < 2) return [];

    const scored = [];
    for (const c of customers || []) {
      const nm = fullName(c).toLowerCase();
      const ph = String(c.phone || "");
      if (!nm && !ph) continue;

      // Someone who starts with what was typed is almost always the one meant,
      // so they come first; the rest are still offered in case the cashier is
      // halfway through a surname.
      const where = nm.startsWith(typed) ? 0 : nm.includes(typed) ? 1 : ph.includes(typed) ? 2 : -1;
      if (where === -1) continue;
      scored.push({ c, where });
    }

    scored.sort((a, b) => a.where - b.where || fullName(a.c).localeCompare(fullName(b.c)));
    // A cashier scans a short list; a long one is slower than typing the name.
    return scored.slice(0, 6).map((s) => s.c);
  }, [customers, value]);

  useEffect(() => { setHighlighted(0); }, [value]);

  // A tap anywhere else means they are done with the list.
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
    };
  }, []);

  const choose = (customer) => {
    setOpen(false);
    onPick?.(customer);
  };

  const onKeyDown = (e) => {
    if (!open || !matches.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((i) => (i + 1) % matches.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((i) => (i - 1 + matches.length) % matches.length); }
    else if (e.key === "Enter" && matches[highlighted]) {
      // Enter would otherwise submit the form with the half-typed name.
      e.preventDefault();
      choose(matches[highlighted]);
    } else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div className="relative" ref={box}>
      <input
        ref={inputRef}
        type="text"
        name={name}
        required={required}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={hint}
        value={value}
        onChange={(e) => { setOpen(true); onChange?.(e); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={className}
      />

      {open && matches.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full mt-1 z-[100000] max-h-56 overflow-y-auto rounded-md border border-primary/20 bg-surface shadow-xl"
          role="listbox"
          aria-label={t("customer.previousGuests")}
        >
          {matches.map((c, i) => (
            <li key={c.localId || c.serverId || i}>
              {/* pointer-down, not click: on a touch screen the input blurs
                  first and the list is gone before the tap lands */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                onTouchStart={(e) => { e.preventDefault(); choose(c); }}
                onMouseEnter={() => setHighlighted(i)}
                className={
                  "w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 " +
                  (i === highlighted ? "bg-primary/10" : "hover:bg-background")
                }
              >
                <span className="font-semibold text-text-primary truncate">{fullName(c) || "(no name)"}</span>
                {c.phone ? <span className="text-xs text-text-muted shrink-0">{c.phone}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomerNameInput;
