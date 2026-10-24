/**
 * What a dish is: veg, non-veg or egg.
 *
 * The mark a guest in India looks for before anything else, so it travels
 * with the dish from the menu to the ticket to the bill, and is drawn the same
 * way in all three. One place decides the colours and the wording, because
 * three screens drifting apart on this is three screens telling a guest
 * different things about the same plate.
 *
 * The square-with-a-dot is the mark people already read without being taught
 * it, in the colours the FSSAI mark uses.
 */
const MARKS = {
  VEG: { label: "Veg", colour: "#15803d" },
  NONVEG: { label: "Non-veg", colour: "#b91c1c" },
  EGG: { label: "Egg", colour: "#b45309" },
};

export const foodMark = (type) => MARKS[type] || MARKS.VEG;

/**
 * A dish ordered without onion, garlic or root vegetables.
 *
 * Kept next to the mark because the two are always read together, but it is
 * not one of them: Jain is how this plate is being made today, not what the
 * dish is.
 */
export const JAIN_COLOUR = "#7c3aed";
