import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ensureCartEntryKeys,
  getCompletedQuantity,
  isEditableCartItem,
  isCompletedCartItem,
  isKitchenStarted,
} from "../utils/cartItemStatus";

const createCartKey = (product) =>
  `${product.id || product.productId || "item"}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

// A line the kitchen has started is not the till's to remove. Asked here
// as well as at the button, because the button is not the only way in.
const isLockedCartItem = (item) => isKitchenStarted(item);

const notSentYet = (item) => !(Number(item?.sentQuantity) > 0);

/**
 * Two lines the guest thinks of as one order.
 *
 * "Five paneer tikka, two of them Jain" is one thing said across the counter
 * and two dishes in the kitchen, so it is written on two lines. They belong
 * together: the same dish, neither of them sent yet, and the same note — a
 * line carrying "less spicy" is a different order and keeps to itself.
 */
const sameJainGroup = (a, b) =>
  Boolean(a?.jainAvailable) &&
  Boolean(b?.jainAvailable) &&
  a.id === b.id &&
  notSentYet(a) &&
  notSentYet(b) &&
  String(a.note || "") === String(b.note || "");

/**
 * What the group adds up to, seen from one of its lines.
 *
 * The cart asks for the Jain count once, on the first line of the group, and
 * reads it against the whole order. Asked of the line alone it said "0 / 3"
 * with two more of the same dish sitting underneath, and a second tap on +
 * opened a third line instead of moving one across.
 */
export const jainGroupSummary = (cartData, line) => {
  if (!line?.jainAvailable || !notSentYet(line)) return null;

  const rows = cartData || [];
  const members = rows.filter((p) => sameJainGroup(p, line));
  if (!members.length) return null;

  return {
    // By identity, not by key: a line the cart has not named yet would
    // otherwise pass for its own sibling.
    isLead: rows.findIndex((p) => sameJainGroup(p, line)) === rows.indexOf(line),
    total: members.reduce((n, p) => n + (Number(p.quantity) || 0), 0),
    jainCount: members.reduce(
      (n, p) => n + (p.jain ? Number(p.quantity) || 0 : 0),
      0,
    ),
    memberKeys: members.map((p) => p.cartKey || p.id),
  };
};

export const ORDER_TYPE = {
  DINE_IN: "DINE_IN",
  PARCEL: "PARCEL",
};

export const normalizeOrderType = (value) => {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]/g, "_");
  if (
    raw === ORDER_TYPE.PARCEL ||
    raw === "TAKEAWAY" ||
    raw === "TAKE_AWAY" ||
    raw === "PICKUP"
  ) {
    return ORDER_TYPE.PARCEL;
  }
  return ORDER_TYPE.DINE_IN;
};

export const hasSelectedTable = (table) =>
  Boolean(
    table?.tableNumber || table?.serverId || table?.id || table?.localId
  );

export const useCartStore = create(
  persist(
    (set, get) => ({
      // ===== DATA =====
      selectedCustomer: null,
      selectedTable: null,
      orderType: ORDER_TYPE.DINE_IN,
      cartData: [], // SINGLE SOURCE OF TRUTH
      orderData: {},
      ownerDiscount: 0,
      activeHoldOrder: null,

      // ===== CART ACTIONS =====
      // addToCart: (product) => {
      //   console.log(product);

      //   const state = get();
      //   const existing = state.cartData.find(p => p.id === product.id);
      //   set(() => {
      //     if (existing) {
      //       return {
      //         cartData: state.cartData.map(p =>
      //           p.id === product.id
      //             : p
      //         ),
      //       };
      //     }

      //     return {
      //       cartData: [...state.cartData, { ...product, quantity: product.quantity || 1 }],
      //     };
      //   });

      //   return { success: true };
      // },

      // removeFromCart: (id) =>
      //   set((state) => {
      //     const newCartData = state.cartData.filter((p) => p.id !== id);
      //     return {
      //       cartData: newCartData,
      //       // If newCart is empty, reset ownerDiscount
      //       ownerDiscount: newCartData.length === 0 ? 0 : state.ownerDiscount,
      //     };
      //   }),

      // updateQuantity: (id, quantity) =>
      //   set((state) => {
      //     return {
      //       cartData: state.cartData.map(p => {
      //         if (p.id !== id) return p;

      //         // ⛔ STOCK GUARD
      //         const safeQty = Math.min(
      //           Math.max(1, quantity), // minimum 1
      //           p.stock + p.stockQueue               // maximum stock
      //         );

      //         return { ...p, quantity: safeQty };
      //       }),
      //     };
      //   }),
      // useCartStore.ts

      addToCart: (product) => {
        const state = get();

        /**
         * A tap on the menu adds a plain one, and joins the plain line.
         *
         * A dish can sit on the cart twice over — three as they come and two
         * made Jain — and the two lines are the same product. Without this,
         * the sixth tap landed on whichever of them happened to be first,
         * so ringing up one more paneer tikka could quietly make it Jain.
         */
        const matchingItems = state.cartData.filter(
          (p) => p.id === product.id && !p.jain
        );
        const existing =
          matchingItems.find((p) => isEditableCartItem(p)) || matchingItems[0];

        set(() => {
          if (existing) {
            return {
              cartData: state.cartData.map((p) =>
                p === existing
                  ? {
                      ...p,
                      cartKey: p.cartKey || createCartKey(p),
                      quantity: p.quantity + 1,
                    }
                  : p,
              ),
            };
          }
          return {
            cartData: [
              ...state.cartData,
              {
                ...product,
                cartKey: createCartKey(product),
                quantity: product.quantity || 1,
              },
            ],
          };
        });

        return { success: true };
      },

      /**
       * Ask for this line to be made Jain, or stop asking.
       *
       * Only while the kitchen has not been told. Once even one plate of
       * this line has gone in, it is already being cooked the way it was
       * asked for, and flipping the flag here would change the ticket for
       * food that is on the pass. A guest who changes their mind after the
       * order has gone gets a new line, which is also what the kitchen needs
       * to see.
       */
      /**
       * How many of this dish are to be made Jain.
       *
       * A guest orders five paneer tikka and two of them Jain, which is one
       * order and two different dishes as far as the kitchen is concerned.
       * Jain used to be a yes or no for a whole line, so the counter had to
       * ring the dish twice under two names or give the whole table onion.
       *
       * The count is of the whole order, not of the line it was asked on.
       * However the five happen to be split at that moment, they are gathered
       * back up and laid out again as at most two lines — what is left as it
       * comes, and the Jain ones underneath — so five stay five. Before this,
       * each answer split whichever line was asked, and five became 3 + 1 + 1.
       * None of them, or all of them, leaves a single line.
       *
       * Each half keeps the key it already had, so a note being typed into one
       * of them, or a row opened out, stays with the right line; only a half
       * that did not exist before is given a new one.
       */
      setJainCount: (cartKey, count) =>
        set((state) => {
          const index = state.cartData.findIndex((p) =>
            p.cartKey ? p.cartKey === cartKey : p.id === cartKey
          );
          if (index < 0) return {};

          const line = state.cartData[index];
          if (!line.jainAvailable) return {};

          // Once a round is with the kitchen it is being made the way it was
          // asked for. Changing it here would change the bill and not the pan.
          if (Number(line.sentQuantity) > 0) return {};

          const members = state.cartData.filter((p) => sameJainGroup(p, line));
          const total = members.reduce(
            (n, p) => n + (Number(p.quantity) || 0),
            0,
          );
          const wanted = Math.max(0, Math.min(total, Number(count) || 0));

          const plainSeed = members.find((p) => !p.jain) || members[0];
          const jainSeed = members.find((p) => p.jain) || members[0];

          const taken = new Set();
          const keyFor = (seed) => {
            const held = seed.cartKey;
            const key = held && !taken.has(held) ? held : createCartKey(seed);
            taken.add(key);
            return key;
          };

          const rebuilt = [];
          if (total - wanted > 0) {
            rebuilt.push({
              ...plainSeed,
              cartKey: keyFor(plainSeed),
              quantity: total - wanted,
              jain: false,
            });
          }
          if (wanted > 0) {
            rebuilt.push({
              ...jainSeed,
              cartKey: keyFor(jainSeed),
              quantity: wanted,
              jain: true,
            });
          }

          // Back where the group was standing, so the order does not rearrange
          // itself under the hand that is using it.
          const leadAt = state.cartData.findIndex((p) => sameJainGroup(p, line));
          const next = [];
          state.cartData.forEach((p, at) => {
            if (!sameJainGroup(p, line)) {
              next.push(p);
              return;
            }
            if (at === leadAt) next.push(...rebuilt);
          });

          return { cartData: next };
        }),

      updateQuantity: (id, quantity, note) =>
        set((state) => {
          let updatedOne = false;

          return {
            cartData: state.cartData.map((p) => {
              const isMatch =
                !updatedOne && (p.cartKey ? p.cartKey === id : p.id === id);
              if (!isMatch) return p;

              updatedOne = true;
              // The only floor is what the kitchen has already cooked — a
              // waiter cannot order fewer than the plates that are out. There
              // is no ceiling: the kitchen cooks what is asked for.
              const minQty = Math.max(1, getCompletedQuantity(p));
              const safeQty = Math.max(minQty, Number(quantity) || minQty);

              return {
                ...p,
                cartKey: p.cartKey || createCartKey(p),
                quantity: safeQty,
                ...(note !== undefined && { note }),
              };
            }),
          };
        }),

      // removeFromCart works with cartKey.
      removeFromCart: (id, cartKey) =>
        set((state) => {
          let removedOne = false;
          const newCartData = state.cartData.filter((p) => {
            if (isLockedCartItem(p)) return true;

            const isMatch = cartKey ? p.cartKey === cartKey : p.id === id;
            if (!isMatch || removedOne) return true;

            removedOne = true;
            return false;
          });

          return {
            cartData: newCartData,
            ownerDiscount:
              newCartData.length === 0 ? 0 : state.ownerDiscount,
          };
        }),
      setCartData: (data) => set({ cartData: ensureCartEntryKeys(data) }),

      /**
       * Folds what the kitchen has cooked into the cart on screen.
       *
       * Only prepared_quantity and status are taken. The waiter may have added
       * a dish since this bill was opened, and may be halfway through changing
       * a quantity — replacing the cart with the server's copy would throw
       * that away mid-keystroke, so every other field is left exactly as it is.
       *
       * Items are matched on their cart key first. A bill can hold the same
       * dish twice (one plain, one with a note), and matching on the product
       * alone would mark the wrong line done.
       */
      syncKitchenProgress: (serverItems = []) =>
        set((state) => {
          if (!state.cartData.length || !serverItems.length) return {};

          const byKey = new Map();
          const byProduct = new Map();

          serverItems.forEach((item, index) => {
            const key =
              item?.cartKey ||
              (item?.id != null ? `${item.id}_${index}` : null);
            if (key) byKey.set(key, item);

            const productId = item?.id || item?.product_id || item?.serverId;
            if (!productId) return;
            if (!byProduct.has(productId)) byProduct.set(productId, []);
            byProduct.get(productId).push(item);
          });

          const taken = new Set();
          let changed = false;

          const next = state.cartData.map((item) => {
            let match = item?.cartKey ? byKey.get(item.cartKey) : undefined;

            if (!match) {
              // A line added since the bill was opened has no counterpart on
              // the server yet; the first unclaimed copy of the dish is the
              // nearest honest guess.
              const productId = item?.id || item?.product_id || item?.serverId;
              const candidates = byProduct.get(productId) || [];
              match = candidates.find((c) => !taken.has(c));
            }

            if (!match) return item;
            taken.add(match);

            const prepared = Number(match.prepared_quantity) || 0;
            const status = match.status ?? item.status;

            if (
              (Number(item.prepared_quantity) || 0) === prepared &&
              item.status === status
            ) {
              return item;
            }

            changed = true;
            return { ...item, prepared_quantity: prepared, status };
          });

          // Zustand replaces the array on every set, and the cart is rendered
          // from it — returning an unchanged one would redraw the whole bill
          // on every kitchen tap anywhere in the outlet.
          return changed ? { cartData: next } : {};
        }),
      setCartFromHold: (cartData) => {
        // Determine the correct ownerDiscount value
        // Dashboard expects: < 1 = percentage fraction (e.g. 0.1 for 10%), >= 1 = fixed amount
        let discountVal = 0;
        const d = cartData?.discount;
        if (d) {
          if (d.type === "PERCENT") {
            discountVal = (d.value || 0) / 100; // 10 → 0.1
          } else if (d.type === "FIXED") {
            discountVal = d.value || 0;
          } else {
            // API-fetched hold orders have no type — treat as percentage (fixed is currently disabled)
            discountVal = (d.value || 0) / 100; // 10 → 0.1
          }
        }

        // These items have already gone to the kitchen on an earlier KOT.
        // Remember how much was sent so the next Hold only sends what the
        // waiter has added since — otherwise the kitchen would cook the whole
        // table again every time someone orders one more roti.
        const resumed = ensureCartEntryKeys(cartData.orderItems).map((item) => ({
          ...item,
          sentQuantity: Number(item.quantity) || 0,
        }));

        set({
          cartData: resumed,
          selectedCustomer: cartData.customer || null,
          selectedTable: cartData.table || null,
          orderType: normalizeOrderType(cartData.orderType || cartData.order_type),
          ownerDiscount: discountVal,
        });
      },
      // ===== OTHER =====
      setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),
      setSelectedTable: (table) =>
        set((state) => {
          const idOf = (t) => t?.serverId || t?.localId || t?.id || null;
          const leaving = idOf(state.selectedTable);
          const arriving = idOf(table);

          // A bill belongs to its table. Walking from one table to another used
          // to leave the first table's items sitting in the cart, so they were
          // billed to whoever was sitting at the second one — and because
          // activeHoldOrder still pointed at the table just left, the next Hold
          // was added to that table's bill instead.
          //
          // Only a real move clears it: arriving at a table with nothing open
          // behind you (a parcel being built, the first table of the shift)
          // keeps whatever is already in the cart.
          const movedToAnotherTable =
            Boolean(arriving) &&
            arriving !== leaving &&
            (Boolean(leaving) || Boolean(state.activeHoldOrder));

          return {
            selectedTable: table,
            ...(table && hasSelectedTable(table)
              ? { orderType: ORDER_TYPE.DINE_IN }
              : {}),
            ...(movedToAnotherTable
              ? {
                  cartData: [],
                  activeHoldOrder: null,
                  selectedCustomer: null,
                  ownerDiscount: 0,
                }
              : {}),
          };
        }),
      setOrderType: (orderType) => {
        const normalized = normalizeOrderType(orderType);
        set((state) => ({
          orderType: normalized,
          selectedTable: normalized === ORDER_TYPE.PARCEL ? null : state.selectedTable,
        }));
      },
      setOrderData: (data) => set({ orderData: data }),
      setOwnerDiscount: (data) => set({ ownerDiscount: data }),

      resetCart: () =>
        set({
          selectedCustomer: null,
          selectedTable: null,
          orderType: ORDER_TYPE.DINE_IN,
          cartData: [],
          //orderData: {},
          ownerDiscount: 0,
          activeHoldOrder: null,
        }),
      clearOrderData: () => set({ orderData: null }),

      // Resume Order (add to cart button)
      setActiveHoldOrder: (order) =>
        set({
          activeHoldOrder: {
            id: order.serverId || order.localId,
            customerName: order.note,
            isResume: true,
            isUpdate: true,
          },
        }),

      clearActiveHoldOrder: () => set({ activeHoldOrder: null }),
    }),
    {
      name: "pos-storage",
    },
  ),
);
