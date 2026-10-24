/**
 * One place that says what each role is called, what colour marks it, and what
 * it is allowed to do.
 *
 * The till and the captain's tablet run the same screens, and on a busy floor
 * staff could not tell which one they were holding. Each role now carries its
 * own accent colour and badge. The colours are fixed rather than theme
 * variables on purpose: the badge has to mean the same thing whichever theme
 * the outlet picks.
 */

/**
 * Four roles, four colours — all of them from the same family.
 *
 * They used to be a blue, a teal, an orange and a violet: four colours
 * chosen only to be far apart from each other, picked when the brand was
 * purple and nothing else on the screen was going to argue. On the green
 * and gold they argued with everything. A royal blue CSH badge sitting on
 * the green rail was the single loudest wrong note on the till.
 *
 * They are now four steps around the brand's own two colours — a deep
 * green, a bright green, a terracotta and a bronze. Still four things
 * nobody could mistake for one another across a room, which is the whole
 * job, and now four things that look like they belong to the same software.
 */
const ROLE_UI = {
  captain: {
    label: "Captain",
    short: "CPT",
    // A lighter green than the rail, so the badge lifts off it.
    accent: "#10B981",
    accentSoft: "rgba(16, 185, 129, 0.14)",
    canBill: false,
    // The floor takes orders and carries food. Wiping a table's running
    // order, and printing something a guest would read as their bill, are
    // both the till's to answer for.
    canVoidHold: false,
    canPrintHold: false,
  },
  cashier: {
    label: "Cashier",
    short: "CSH",
    // The brand green itself. The till is the default screen, so it wears
    // the house colour.
    accent: "#064E3B",
    accentSoft: "rgba(6, 78, 59, 0.12)",
    canBill: true,
    canVoidHold: true,
    canPrintHold: true,
  },
  chef: {
    label: "Kitchen",
    short: "KIT",
    // Terracotta — warm, and the only one of the four that is not green, so
    // the kitchen screen is told apart instantly from a floor tablet.
    accent: "#a64b2a",
    accentSoft: "rgba(166, 75, 42, 0.14)",
    canBill: false,
    canVoidHold: false,
    canPrintHold: false,
  },
  owner: {
    label: "Owner",
    short: "OWN",
    // Bronze: the gold taken down far enough to carry white letters.
    accent: "#8C6112",
    accentSoft: "rgba(140, 97, 18, 0.14)",
    // The owner supervises rather than works the till; the Pay button has
    // always been closed to them.
    canBill: false,
    canVoidHold: true,
    canPrintHold: true,
  },
};

const FALLBACK = {
  label: "Staff",
  short: "STF",
  accent: "#475569",
  accentSoft: "rgba(71, 85, 105, 0.12)",
  canBill: false,
  canVoidHold: false,
  canPrintHold: false,
};

/** Look up the badge and permissions for a role name. */
export const roleUi = (roleName) => ROLE_UI[String(roleName || "").toLowerCase()] || FALLBACK;

/** Whether this role may take payment and close a bill. */
export const canBill = (roleName) => roleUi(roleName).canBill;

/** Whether this role may throw away a whole running order, kitchen and all. */
export const canVoidHold = (roleName) => roleUi(roleName).canVoidHold;

/** Whether this role may print a running order as a bill slip. */
export const canPrintHold = (roleName) => roleUi(roleName).canPrintHold;
