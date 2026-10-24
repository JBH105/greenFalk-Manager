/**
 * Which sign-in this screen is holding.
 *
 * The token carries the id of the session it was issued for. The server
 * announces a forced sign-out to everyone, because sockets are not signed
 * in, so a screen needs this to know whether it is the one being closed —
 * without it, a screen that had just signed in matched on the user id and
 * threw itself out again.
 *
 * A token is three dot-separated parts and the middle one is plain JSON in
 * base64. Nothing is verified here: this decides what to ignore, never what
 * to allow.
 */
export const sessionOfToken = (token) => {
  if (!token || typeof token !== "string") return null;

  try {
    const middle = token.split(".")[1];
    if (!middle) return null;

    const json = atob(middle.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json)?.sid || null;
  } catch (err) {
    return null;
  }
};

/**
 * Whether a forced sign-out is about this screen.
 *
 * Older servers named only the user, so fall back to that; a server that
 * names the sessions is believed over the user id.
 */
export const meansThisScreen = (event, { userId, token }) => {
  if (!event) return false;

  if (Array.isArray(event.sessionIds)) {
    const mine = sessionOfToken(token);
    return Boolean(mine) && event.sessionIds.includes(mine);
  }

  return Boolean(userId) && event.userId === userId;
};
