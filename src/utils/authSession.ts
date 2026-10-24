/**
 * Where the signed-in session lives between page loads.
 *
 * The till is an online-only app, so this is plain browser storage — enough to
 * survive a refresh or a relaunch of the installed PWA. It is deliberately not
 * an offline store: nothing here lets the app work without the server.
 *
 * It is written to two places, and the order they are read in is the whole
 * point of this file.
 *
 * localStorage is shared by every window of one browser. With the session
 * kept only there, a counter and a kitchen screen opened side by side on the
 * same machine were one session between them: signing in as the chef in the
 * second window replaced the cashier in the first, and the moment the cashier's
 * window wrote anything the chef's window went back to being the cashier on
 * its next refresh. Two people, one identity, swapping without warning —
 * and the bills carrying whichever name happened to be stored at the time.
 *
 * sessionStorage belongs to one window and survives a refresh, so that is
 * where a window's own session goes. localStorage keeps the last one as well,
 * which is what lets a till that was closed for the night open in the morning
 * already signed in.
 *
 * So: a window that has signed in keeps its own account however many other
 * windows are open, and a window that has not signed in yet falls back to the
 * last account used on this machine.
 */

const SESSION_KEY = "pos-auth-session";

/** This window's own session. Empty in a browser that forbids it. */
const thisWindow = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const thisMachine = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function saveAuth(data: any) {
  const text = JSON.stringify(data);
  try {
    // This window first: it is the one that must not be overwritten by
    // another window signing in as somebody else.
    thisWindow()?.setItem(SESSION_KEY, text);
  } catch {
    /* private mode, or storage full — the session just won't survive a reload */
  }
  try {
    thisMachine()?.setItem(SESSION_KEY, text);
  } catch {
    /* the same, and this one only costs us "stay signed in" */
  }
}

export function getAuth() {
  // This window's own account wins. Only a window that has never signed in
  // falls back to whoever used this machine last.
  try {
    const mine = thisWindow()?.getItem(SESSION_KEY);
    if (mine) return JSON.parse(mine);
  } catch {
    /* fall through to the machine's */
  }

  try {
    const lastUsed = thisMachine()?.getItem(SESSION_KEY);
    if (!lastUsed) return null;

    // Adopted, and copied into this window, so that from now on this window
    // keeps its own account whatever the others do.
    try { thisWindow()?.setItem(SESSION_KEY, lastUsed); } catch { /* not important */ }
    return JSON.parse(lastUsed);
  } catch {
    return null;
  }
}

export function clearAuth() {
  // Signing out is meant for this window. The machine's copy goes too,
  // otherwise the next refresh would sign the person straight back in.
  try { thisWindow()?.removeItem(SESSION_KEY); } catch { /* ignore */ }
  try { thisMachine()?.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
