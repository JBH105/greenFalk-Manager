import { io } from 'socket.io-client';

let socket = null;

/** Whatever we last announced, so a reconnect can re-join the same rooms. */
let joined = { outletId: null, tenantId: null };

/**
 * The table this device is standing at, if any.
 *
 * Kept here for the same reason the rooms are: a dropped connection loses
 * the claim on the server, and the first thing that happens after a
 * reconnect has to be saying it again — otherwise the table shows as free to
 * everyone else while a captain is still writing the order on it.
 */
let heldTable = null;

const sendJoin = () => {
  if (!socket || (!joined.outletId && !joined.tenantId)) return;
  socket.emit('outlet:join', joined);
  sendClaim();
};

const sendClaim = () => {
  if (!socket || !heldTable) return;
  socket.emit('table:claim', heldTable);
};

/**
 * Say this device has opened a table.
 *
 * Safe to call over and over: repeating the same claim is how the server is
 * told the device has not wandered off.
 */
export const claimTable = (claim) => {
  heldTable = claim || null;
  getSocket();
  sendClaim();
};

/** Say it has let the table go — the order is in, or they walked away. */
export const releaseTable = () => {
  const letting = heldTable;
  heldTable = null;
  if (!socket || !letting) return;
  socket.emit('table:release', {
    outletId: letting.outletId,
    tableId: letting.tableId,
  });
};

/**
 * The live events the screens act on. Anything sent while this till was
 * disconnected is lost, so after a gap each of these is handed to whoever was
 * listening for it, which makes them reload from the server.
 */
const RESYNC_EVENTS = [
  'holdOrderUpdated',
  'table:refresh',
  'promotion:refresh',
  'purchase:product',
];

/*
 * table:claims is deliberately not in that list.
 *
 * The others are nudges: the screen hears one and goes and reloads. This
 * one carries the answer itself — the whole list of who is standing at
 * which table. Handing it the made-up payload below, which has no list in
 * it, told every screen that nobody was at any table: a phone waking from
 * sleep wiped the floor clean until the next thing happened to move. It is
 * asked for properly in resync() instead.
 */

/** The first connect needs no catching up — the screens are loading anyway. */
let hasConnectedBefore = false;

const resync = (why) => {
  if (!socket) return;

  // Re-announcing the rooms makes the server send this screen the floor as
  // it stands right now, and says again which table this device is on.
  sendJoin();

  let told = 0;
  for (const event of RESYNC_EVENTS) {
    for (const listener of socket.listeners(event)) {
      try {
        // Shaped like the server's own payload: the screens check the outlet
        // before acting, and would drop a bare one.
        listener({ outlet_id: joined.outletId, resync: why });
        told += 1;
      } catch (err) {
        console.error('Resync listener failed for ' + event + ':', err);
      }
    }
  }
  console.log('Catching up after ' + why + ': told ' + told + ' listener(s)');
};

/**
 * Coming back to the app, or back onto a network, is the moment a phone is
 * most likely to be holding a stale screen — the socket may not even have
 * noticed it was dropped yet. Ask for the truth either way.
 */
const watchDevice = () => {
  if (typeof window === 'undefined' || watchDevice.done) return;
  watchDevice.done = true;

  window.addEventListener('online', () => {
    if (socket && !socket.connected) socket.connect();
    resync('the network came back');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (socket && !socket.connected) {
      // connect() will fire 'connect', which resyncs on its own.
      socket.connect();
      return;
    }
    resync('the screen woke up');
  });
};

export const getSocket = () => {
  if (!socket) {
    console.log('Creating socket connection...');

    watchDevice();

    socket = io(import.meta.env.VITE_SOCKET_URL, {
      // Connect over plain HTTP first, then upgrade to a WebSocket if the
      // network allows one. Websocket-only left tills on restrictive networks
      // — hotel wifi, captive portals, inspecting proxies — with no live
      // orders at all and no way to fall back. See the note in socket.init.ts.
      transports: ['polling', 'websocket'],
      autoConnect: true,

      // A till must never give up: a restaurant's wifi drops for minutes at a
      // time and nobody is going to reload the tablet mid-service.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      // The server drops room membership when a socket goes away, so announce
      // ourselves again on every (re)connect rather than only at login.
      sendJoin();

      if (hasConnectedBefore) resync('a reconnect');
      hasConnectedBefore = true;
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
  }

  return socket;
};

/**
 * Tell the server which outlet (and tenant) this till is on, so it only
 * receives live events meant for it. Safe to call repeatedly — switching
 * outlet replaces the previous rooms.
 */
export const joinOutletRoom = ({ outletId, tenantId }) => {
  joined = { outletId: outletId || null, tenantId: tenantId || null };
  getSocket();
  sendJoin();
};

/** Called on logout so a signed-out till stops receiving the outlet's events. */
export const leaveOutletRoom = () => {
  // Signing out gives up the table too, or the next person is told it is
  // busy by a screen nobody is standing at.
  releaseTable();
  joined = { outletId: null, tenantId: null };
  if (socket) socket.emit('outlet:join', joined);
};
