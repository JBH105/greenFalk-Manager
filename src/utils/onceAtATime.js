/**
 * One request at a time for the same thing.
 *
 * Several parts of a screen want the same list. The bills badge in the side
 * bar, the floor plan and the cart all want the open bills; the menu and the
 * retail panel both want the dishes. Each asks as it mounts, all within the
 * same instant, and each guard of the form "have we loaded yet?" is still
 * false because none of the answers have come back — so the till asked the
 * server for the open bills four times over, on every screen, and the cashier
 * waited for all four.
 *
 * Whoever asks while a request is already in the air gets that request. The
 * slot is cleared the moment it settles, so this shares a request, it does not
 * cache an answer: the next ask is a fresh one.
 *
 * `force` is for the cases where sharing would be wrong. When the kitchen or
 * another till says something has changed, that refresh must not be handed the
 * answer to a question asked a moment before the change — it asks again.
 */
const inFlight = new Map();

/**
 * How long one forced refresh stands for all of them.
 *
 * A single thing happening at one table — a round sent, a dish ticked off —
 * reaches this browser as one event, and several parts of the screen each ask
 * for the same list again on the back of it. Because each of them asked
 * forcefully, each opened a request of its own: one event, the same list
 * fetched two and three times over, on every till in the shop at once.
 *
 * Forced asks that land within this window of one another now share, and the
 * window is short enough that they can only be answering the same event. An
 * ask that arrives later is a later event and still gets a request of its own,
 * which is the whole point of forcing.
 */
const SAME_EVENT_MS = 400;

const startedAt = new Map();

export const onceAtATime = (key, run, { force = false } = {}) => {
  const already = inFlight.get(key);

  if (already) {
    if (!force) return already;

    // Forced, but another forced ask for this very list is already on its way
    // and went out a moment ago — it is answering the same event as this one.
    const age = Date.now() - (startedAt.get(key) ?? 0);
    if (age < SAME_EVENT_MS) return already;
  }

  const attempt = Promise.resolve()
    .then(run)
    .finally(() => {
      // Only clear our own: a forced request started later must not have its
      // slot removed by an earlier one finishing.
      if (inFlight.get(key) === attempt) {
        inFlight.delete(key);
        startedAt.delete(key);
      }
    });

  inFlight.set(key, attempt);
  startedAt.set(key, Date.now());
  return attempt;
};
