import { billTotals } from "../../utils/gst";
import { useT } from "../../i18n";
import { cur } from "../../utils/currency";
import React, { useMemo, useRef } from "react";
import Cart from "../../components/pos/dashboard/Cart";
import Header from "../../components/pos/dashboard/Header";
import CategoryRail, { FAVOURITES } from "../../components/pos/dashboard/CategoryRail";
import { useProductStore } from "../../store/useProductStore";
import { useEffect } from "react";
import { useState } from "react";
import ProductComp from "../../components/pos/dashboard/ProductComp";
import { Payment } from "../../components/pos/dashboard/Payment";
import { useNotification } from "../../hooks/useNotification";
import { useCartStore } from "../../store/useCartStore";
import { billMessage } from "../../utils/billMessage";
import PrintOrder from "../../components/pos/dashboard/PrintOrder";
import PhoneInputWithCode from "../../components/phoneCodeInput/PhoneInputWithCode";
import DashboardPopup from "../../components/pos/dashboard/dashboardPopup";
import { createOrder } from "../../utils/createOrder";
// import Retail from "./Retail";
import Retail from "./Retail";
import { useRetail } from "../../hooks/useRetail";
import { useFeatures } from "../../hooks/useFeatures";
import { useAuthStore } from "../../store/useAuthStore";
import { usePromotionStore } from "../../store/usePromotionStore";
import PettyCash from "../../components/pos/dashboard/PettyCash";
import api from "../../utils/api";
import { useSocket } from "../../socket/SocketProvider";
import LoadingBar from "../../components/common/LoadingBar/LoadingBar";
import { useResponsive } from "../../context/ResponsiveContext";
import { useLocation } from "react-router-dom";
import { useHoldOrderStore } from "../../store/useHoldOrderStore";
import { useCategoryStore } from "../../store/useCategoryStore";
import { discountRateOf } from "../../utils/discount";
import { readTillSettings } from "../../utils/tillSettings";
import { searchMenu } from "../../utils/menuSearch";
import { useTableStore } from "../../store/useTableStore";

const Dashboard = () => {
  const t = useT();

  const socket = useSocket();
  const location = useLocation();

  const { products, hydrate, hydrated } = useProductStore();
  const [filters, setFilters] = useState({
    product: "",
    category: "",
  });
  const [filteredProducts, setFilteredProducts] = useState([]);
  const productListLength = filteredProducts.length;

  /**
   * Does this menu have photographs in it?
   *
   * One answer for the whole grid, not one per dish. A row where some cards
   * carry a thumbnail and the rest carry a gap reads as something broken,
   * and most of a menu is typed in without pictures — so until a single dish
   * has one, every card keeps the shape it has always had, and from the
   * moment one does, they all make room together.
   *
   * `some` stops at the first hit, so on a menu with no pictures this costs
   * one comparison and on a menu with them it costs almost nothing.
   */
  const showPhotos = filteredProducts.some((p) => Boolean(p?.img));

  // The strip only offers a Favourites section when this outlet has marked
  // something; an empty section is a dead end.
  const favouriteCount = useMemo(
    () => products.filter((p) => p.isFavourite).length,
    [products],
  );
  const [cartProducts, setCartProducts] = useState([]);
  const [mute, setMute] = useState(false);
  const [tick, setTick] = useState(0); // Ticker for live promo updates
  const [payToProceed, setPayToProceed] = useState(false);
  const { notifyError, notifySuccess } = useNotification();
  const [activePopup, setActivePopup] = useState(null); // 'receipt', 'customer', or null
  const [orderId, setOrderId] = useState(null);
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    phoneCode: { value: "+91" },
    phone: "",
  });
  // const { orderData, setOrderData } = useCartStore();
  const orderData = useCartStore((state) => state.orderData);
  const setOrderData = useCartStore((state) => state.setOrderData);
  const productStore = useProductStore.getState();

  const [isPrinting, setIsPrinting] = useState(false);
  /**
   * Named one at a time, not pulled off the store in one go.
   *
   * `useCartStore()` with nothing in the brackets subscribes to everything
   * in it, so this screen re-rendered on changes it does not show — and it
   * carries the whole menu with it when it does.
   */
  const cartData = useCartStore((state) => state.cartData);
  const setCartData = useCartStore((state) => state.setCartData);
  const resetCart = useCartStore((state) => state.resetCart);
  const selectedCustomer = useCartStore((state) => state.selectedCustomer);
  const selectedTable = useCartStore((state) => state.selectedTable);
  const orderType = useCartStore((state) => state.orderType);
  const ownerDiscount = useCartStore((state) => state.ownerDiscount);
  const { isRetail, isRetailOpen } = useRetail();
  const features = useFeatures();
  const [isPettyClicked, setIsPettyClicked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { isMobile } = useResponsive();
  const [showCart, setShowCart] = useState(false);

  //promotions
  const user = useAuthStore((state) => state.user);
  const outletId = user?.outlet_id;
  const {
    promotions,
    hydrate: promoHydrate,
    hydrated: promoHydarated,
  } = usePromotionStore();

  // for hold order
  const activeHoldOrder = useCartStore((state) => state.activeHoldOrder);
  const orderId2 = activeHoldOrder?.id;
  const holdOrders = useHoldOrderStore((state) => state.holdOrders);
  const matchedHoldOrder = holdOrders?.find((order) => {
    const t = order;
    return t?.localId === orderId2;
  });

  // condition for open the retail section
  const whenToOpenRetail = payToProceed ? false : isRetail || isRetailOpen;

  useEffect(() => {
    if (location.state?.payToProceed && cartData.length > 0) {
      setPayToProceed(true);
    }
  }, [location.state, cartData.length]);

  const { categories, hydrated: categoriesHydrated } = useCategoryStore();

  // The opening section is chosen once, and only once the menu is in hand —
  // deciding earlier meant counting favourites before any dish had arrived.
  const hasChosenSection = useRef(false);

  useEffect(() => {
    if (!categoriesHydrated || categories.length === 0) return;
    if (!hydrated) return;

    const firstSection = categories[0].category_name;
    const preferred = favouriteCount > 0 ? FAVOURITES : firstSection;

    if (!hasChosenSection.current) {
      hasChosenSection.current = true;
      setFilters((prev) => ({ ...prev, category: preferred }));
      return;
    }

    // From here the cashier is driving. Only step in when what they are
    // standing on has stopped existing.
    const onFavourites =
      (filters.category || "").toLowerCase() === FAVOURITES.toLowerCase();
    const sectionExists =
      filters.category &&
      categories.some(
        (c) => c.category_name?.toLowerCase() === filters.category.toLowerCase(),
      );

    if (onFavourites && favouriteCount === 0) {
      setFilters((prev) => ({ ...prev, category: firstSection }));
    } else if (!onFavourites && !sectionExists) {
      setFilters((prev) => ({ ...prev, category: preferred }));
    }
  }, [categories, categoriesHydrated, hydrated, filters.category, favouriteCount]);

  // // 1️⃣ Restore from store
  // useEffect(() => {
  //   if (cartData && cartData.length > 0) {
  //     setCartProducts(cartData);
  //   }
  // }, []);

  // Sync cart prices when promotions change or time passes
  useEffect(() => {
    if (!hydrated || !promoHydarated || cartData.length === 0) return;

    let hasChanged = false;
    const updatedCart = cartData.map((item) => {
      const product = products.find((p) => p.serverId === item.id);
      if (!product) return item;

      const newPrice = getFinalProductPrice({
        product,
        promotions,
        outletId,
      });

      const calculatedPrice = Number(newPrice);
      const currentPrice = Number(item.price);

      if (Math.abs(calculatedPrice - currentPrice) > 0.001) {
        hasChanged = true;
        const basePrice = item.originalPrice || product.sellingPrice;
        const itemDiscount =
          calculatedPrice < basePrice ? basePrice - calculatedPrice : 0;

        console.log(
          `[Sync] Updating Cart Item: ${item.name} | ${currentPrice} -> ${calculatedPrice}`,
        );
        return {
          ...item,
          price: calculatedPrice,
          discount: itemDiscount,
        };
      }
      return item;
    });

    if (hasChanged) {
      setCartData(updatedCart);
    }
  }, [
    tick,
    promotions,
    products,
    hydrated,
    promoHydarated,
    outletId,
    cartData,
  ]); // Using cartData instead of length for full sync

  // A tick exists only to catch a promotion starting or ending while the
  // till sits idle — every real change (a dish added, a price edited, a new
  // promotion pushed down the socket) already re-runs the sync on its own.
  // It was firing every second against a comment that said five, and each one
  // re-rendered the whole screen.
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // // 2️⃣ Sync local → store
  // useEffect(() => {
  //   if (cartProducts.length > 0) {
  //     setCartData(cartProducts);
  //   }
  // }, [cartProducts]);

  /**
   * What the till does once the money is in.
   *
   * The bill number is kept either way — a reprint from Invoices needs it.
   * The panel offering Print and WhatsApp is what a counter can do without:
   * at a queue the cashier is already serving the next person, and a box
   * waiting to be dismissed is one more tap per sale. A restaurant leaves it
   * on and hands the guest their bill.
   */
  const openPaySuccess = (id) => {
    setOrderId(id);
    if (readTillSettings().showPrintPopup) setActivePopup("receipt");
  };

  useEffect(() => {
    if (!socket) return;
    setIsLoading(true);
    const handleOrderRefresh = (payload) => {
      if (payload?.type !== "REFETCH_STOCK_LIST_FOR_CASHIER") return;

        // A live event: ask again rather than taking an answer
      // fetched just before the thing changed.
      useProductStore.getState().fetchProductsFromAPI({ force: true });
    };

    const handlePromotionRefresh = (payload) => {
      // Refresh the promotion store
        // A live event: ask again rather than taking an answer
      // fetched just before the thing changed.
      usePromotionStore.getState().fetchPromotionsFromAPI({ force: true });
    };

    const handleTableRefresh = (payload) => {
        // A live event: ask again rather than taking an answer
      // fetched just before the thing changed.
      useTableStore.getState().fetchTablesFromAPI({ force: true });
    };

    /**
     * The kitchen has started or finished a dish.
     *
     * This screen is the bill itself — the captain and the cashier are looking
     * at the very items the chef is ticking off. Without this the cart went on
     * showing everything as still cooking until somebody reloaded the page.
     */
    const handleKitchenProgress = async () => {
      if (!outletId) return;

      try {
        await useHoldOrderStore.getState().fetchHoldOrders(outletId, { force: true });
      } catch (err) {
        console.error("Kitchen progress refresh failed:", err);
        return;
      }

      // Only the bill this till currently has open needs folding in; the rest
      // of the outlet's tables are redrawn from the store by the screens that
      // show them.
      const openBillId = useCartStore.getState().activeHoldOrder?.id;
      if (!openBillId) return;

      const bill = useHoldOrderStore
        .getState()
        .holdOrders.find((o) => o.serverId === openBillId || o.localId === openBillId);

      if (bill?.cartData?.orderItems?.length) {
        useCartStore.getState().syncKitchenProgress(bill.cartData.orderItems);
      }
    };

    socket.on("purchase:product", handleOrderRefresh);
    socket.on("promotion:refresh", handlePromotionRefresh);
    socket.on("table:refresh", handleTableRefresh);
    socket.on("holdOrderUpdated", handleKitchenProgress);
    setIsLoading(false);
    return () => {
      socket.off("purchase:product", handleOrderRefresh);
      socket.off("promotion:refresh", handlePromotionRefresh);
      socket.off("table:refresh", handleTableRefresh);
      socket.off("holdOrderUpdated", handleKitchenProgress);
    };
  }, [socket, outletId]);

  useEffect(() => {
    let filtered = [...products];

    const query = (filters.product || "").toLowerCase().trim();

    if (query) {
      // By name or by the dish's own number — see searchMenu.
      filtered = searchMenu(filtered, query);
    } else if (filters.category) {
      // Favourites is a section chosen by a mark rather than by a category.
      filtered =
        filters.category.toLowerCase() === FAVOURITES.toLowerCase()
          ? filtered.filter((p) => p.isFavourite)
          : filtered.filter(
              (p) => p.categoryName?.toLowerCase() === filters.category.toLowerCase(),
            );
    }

    // --- NEW: Alphabetical Sorting ---
    filtered.sort((a, b) => {
      // localeCompare is the safest way to sort strings (handles case and accents)
      return a.name.localeCompare(b.name);
    });

    setFilteredProducts(filtered);
    // Deliberately not on `tick`: this reads none of it. Re-running on the
    // clock re-filtered and re-sorted the whole menu — localeCompare across
    // every dish — once a second, and redrew the product grid each time.
    // That was the lag on a tablet.
  }, [filters, products, promotions]);
  useEffect(() => {
    hydrate();
    promoHydrate();
  }, [hydrate, promoHydrate]);

  useEffect(() => {
    console.log("✅ orderData updated:", orderData);
  }, [orderData]);

  // if (!hydrated || !promoHydarated) {
  //   return <OfflineLoader />;
  // }

  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    setCustomerDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * A sale the till is taking money for now, rather than one it held earlier
   * and is coming back to settle.
   *
   * A parcel is always one of these. So is everything sold over a counter,
   * both the kind eaten standing there and the kind bagged to go — a shop
   * with no tables has nothing to hold an order against, so the money and the
   * kitchen ticket go together either way. This is what tells the server to
   * write the kitchen's ticket with the sale.
   */
  const isParcelSale =
    !activeHoldOrder?.id &&
    ((orderType || "DINE_IN") === "PARCEL" || !features.table_service_enabled);

  // What the counter will call out. The guest may not have given a name.
  const parcelName =
    [selectedCustomer?.firstName, selectedCustomer?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "Parcel";

  const handlePay = async (finalOrderData) => {
    setIsLoading(true);
    try {
      const result = await createOrder({
        cartData,
        customer: selectedCustomer || null,
        table: selectedTable || null,
        orderType: orderType || "DINE_IN",
        totals: {
          subtotal,
          tax,
          // Net of tax where the menu price carried it, so that the server
          // stores figures which still add up: subtotal − discount + tax.
          discount: discountAmount,
          discount_percentage: discountRate * 100,
          total,
        },
        paymentMethods: finalOrderData?.paymentMethods || [],
        tenderedAmount: finalOrderData?.tenderedAmount || 0,
        cashReturned: finalOrderData?.cashReturned || 0,
        holdOrderId: activeHoldOrder?.id || null,

        // A fresh parcel goes to the kitchen as it is paid for. One resumed
        // from a held round was sent long ago and must not be sent twice.
        sendToKitchen: isParcelSale,
        customerName: parcelName,
      });
      // The table and the kind of sale are the till's own knowledge: the
      // saved order names a table by its id, and the bill has to print the
      // number a guest would recognise.
      setOrderData({
        ...result.order,
        order_type: result.order?.order_type || orderType || "DINE_IN",
        table: selectedTable || null,
      });
      openPaySuccess(result.order.display_id || result.order.displayId);
      notifySuccess(t("order.created"));

      await productStore.fetchProductsFromAPI();

      resetCart();
      setPayToProceed(false);
    } catch (err) {
      // The sale only exists if the server took it, so say plainly that it did
      // not — the cart is left untouched so the cashier can try again.
      const reason = err?.response?.data?.message;
      notifyError(reason ? `Order failed: ${reason}` : t("order.failed"));
      console.error("Error creating order:", err);
    } finally {
      setIsLoading(false);
    }
  };
  // What the menu says this food costs, before anything is done about tax or
  // discount. In a country where the menu price already carries the tax, this
  // is also what the guest will end up paying.
  const menuTotal = cartData.reduce(
    (sum, p) => sum + Number(p.price || 0) * Number(p.quantity || 1),
    0,
  );
  const discount = ownerDiscount;
  // discountRate is always 0–1 (fraction of the food to remove)
  const discountRate = discountRateOf(menuTotal, discount);

  /**
   * One sum, worked out in one place, whichever country this till is in.
   *
   * Tax is charged once on the whole bill at the tenant's own rate, on what
   * is left after the discount — and whether that rate is added to the menu
   * price or taken out of it is the country's answer, not this screen's. See
   * gst.js.
   *
   * `subtotal` is the food net of tax either way, so SUBTOTAL, tax and TOTAL
   * on the slip always add up to one another.
   */
  const bill = billTotals(menuTotal, discount);
  const subtotal = bill.subtotal;
  const discountAmount = bill.discount;
  const tax = bill.taxAmount;
  const total = bill.total;

  //promotion functions

  const getBotswanaTime = () => {
    const now = new Date();

    // This produces a string like "2024-05-20 14:30:05" in Botswana's timezone
    const tzString = now.toLocaleString("en-US", {
      timeZone: "Africa/Gaborone",
    });
    return new Date(tzString);
  };

  const normalizeId = (v) => (v == null ? "" : String(v));
  const includesId = (arr, id) => {
    if (!Array.isArray(arr) || !arr.length) return false;
    const needle = normalizeId(id);
    return arr.some((x) => normalizeId(x) === needle);
  };

  const isScopeValid = (promo, outletId, product) => {
    // Outlet
    if (
      Array.isArray(promo.outlet) &&
      promo.outlet.length &&
      !includesId(promo.outlet, outletId)
    ) {
      return false;
    }

    // PRODUCT promo
    if (promo.promo_on === "PRODUCT") {
      const match = includesId(promo.product, product.serverId);
      // if (!match) console.log(`[Scope Bypass] Product ID mismatch: ${product.serverId} not in ${promo.product}`);
      return match;
    }

    // CATEGORY promo
    if (promo.promo_on === "CATEGORY") {
      const match = includesId(promo.category, product.categoryId);
      // if (!match) console.log(`[Scope Bypass] Category ID mismatch: ${product.categoryId} not in ${promo.category}`);
      return match;
    }

    return false;
  };

  const isScheduleValid = (promo, now) => {
    const jsDay = now.getDay();
    const currentDay = jsDay === 0 ? 7 : jsDay; // Mon:1, Tue:2 ... Sun:7
    const yesterdayDay = currentDay === 1 ? 7 : currentDay - 1;

    const currentTime = now.toTimeString().slice(0, 5); // "HH:mm"

    // 1. Midnight Timestamps for Date Range
    const todayAtMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const yesterdayAtMidnight = todayAtMidnight - 24 * 60 * 60 * 1000;

    const parseToMidnight = (dateStr) => {
      if (!dateStr) return 0;
      // Force local midnight by parsing components
      const parts =
        typeof dateStr === "string" ? dateStr.split("T")[0].split("-") : [];
      if (parts.length === 3) {
        return new Date(
          Number(parts[0]),
          Number(parts[1]) - 1,
          Number(parts[2]),
        ).getTime();
      }
      const d = new Date(dateStr);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };

    // Helper to check if a promotion is configured to be overnight
    const startForConfig = (promo.schedule_start_time || "00:00").slice(0, 5);
    const endForConfig = (promo.schedule_end_time || "00:00").slice(0, 5);
    const isOvernightConfig =
      promo.schedule_mode === "TIME_RANGE" && startForConfig > endForConfig;

    // 1. Handle the new CONTINUOUS "BETWEEN_DAYS" logic
    if (promo.schedule_type === "BETWEEN_DAYS") {
      const startDay = Number(promo.schedule_start_day);
      const endDay = Number(promo.schedule_end_day);
      const startTime = (promo.schedule_start_time || "00:00").slice(0, 5);
      const endTime = (promo.schedule_end_time || "23:59").slice(0, 5);

      // Create a "comparable" value by combining Day + Time (e.g., Mon 11:00 becomes 111:00)
      const currentWeight = `${currentDay}${currentTime}`;
      const startWeight = `${startDay}${startTime}`;
      const endWeight = `${endDay}${endTime}`;

      if (startDay <= endDay) {
        // Standard: Mon to Wed
        return currentWeight >= startWeight && currentWeight <= endWeight;
      } else {
        // Wrapped: Sat to Tue
        return currentWeight >= startWeight || currentWeight <= endWeight;
      }
    }

    // 2. Handle the new CONTINUOUS "BETWEEN_DATES" logic
    if (promo.schedule_type === "BETWEEN_DATES") {
      // Construct full JS Dates for start and end
      const startDate = new Date(promo.schedule_start_date);
      const [sH, sM] = (promo.schedule_start_time || "00:00").split(":");
      startDate.setHours(Number(sH), Number(sM), 0, 0);

      const endDate = new Date(promo.schedule_end_date);
      const [eH, eM] = (promo.schedule_end_time || "23:59").split(":");
      endDate.setHours(Number(eH), Number(eM), 59, 999);

      return now >= startDate && now <= endDate;
    }

    /* -------- DAILY -------- */
    if (promo.schedule_type === "DAILY") {
      return isTimeAllowed(promo, currentTime);
    }

    /* -------- WEEKLY -------- */
    if (promo.schedule_type === "WEEKLY") {
      if (promo.schedule_start_day == null || promo.schedule_end_day == null)
        return false;

      const endLimit = (promo.schedule_end_time || "00:00").slice(0, 5);
      // If it's early morning and the promo is overnight, check if YESTERDAY was a valid promo day
      if (isOvernightConfig && currentTime <= endLimit) {
        if (
          !isDayBetween(
            yesterdayDay,
            promo.schedule_start_day,
            promo.schedule_end_day,
          )
        ) {
          // console.log(`[Schedule Bypass] Weekly Day mismatch (Yesterday): ${yesterdayDay}`);
          return false;
        }
      } else {
        // Otherwise, check if TODAY is a valid promo day
        if (
          !isDayBetween(
            currentDay,
            promo.schedule_start_day,
            promo.schedule_end_day,
          )
        ) {
          // console.log(`[Schedule Bypass] Weekly Day mismatch (Today): ${currentDay}`);
          return false;
        }
      }

      return isTimeAllowed(promo, currentTime);
    }

    /* -------- DATE RANGE -------- */
    if (promo.schedule_type === "DATE_RANGE") {
      if (!promo.schedule_start_date || !promo.schedule_end_date) return false;

      const startTimestamp = parseToMidnight(promo.schedule_start_date);
      const endTimestamp = parseToMidnight(promo.schedule_end_date);
      const endLimit = (promo.schedule_end_time || "00:00").slice(0, 5);

      if (isOvernightConfig && currentTime <= endLimit) {
        // Check if yesterday was within the date range
        if (
          !(
            yesterdayAtMidnight >= startTimestamp &&
            yesterdayAtMidnight <= endTimestamp
          )
        ) {
          // console.log(`[Schedule Bypass] Date mismatch (Yesterday): ${new Date(yesterdayAtMidnight).toDateString()}`);
          return false;
        }
      } else {
        // Check if today is within the date range
        if (
          !(
            todayAtMidnight >= startTimestamp && todayAtMidnight <= endTimestamp
          )
        ) {
          // console.log(`[Schedule Bypass] Date mismatch (Today): ${new Date(todayAtMidnight).toDateString()}`);
          return false;
        }
      }

      return isTimeAllowed(promo, currentTime);
    }

    return false;
  };

  const isTimeAllowed = (promo, currentTime) => {
    if (promo.schedule_mode === "ALWAYS" || promo.schedule_mode === "FULL_DAY")
      return true;

    if (promo.schedule_mode === "TIME_RANGE") {
      const start = (promo.schedule_start_time || "00:00").slice(0, 5);
      const end = (promo.schedule_end_time || "23:59").slice(0, 5);

      if (start <= end) {
        return currentTime >= start && currentTime <= end;
      }
      // Overnight: 22:00 to 04:00
      return currentTime >= start || currentTime <= end;
    }
    return false;
  };

  const isDayBetween = (cur, start, end) => {
    if (start <= end) return cur >= start && cur <= end;
    return cur >= start || cur <= end; // Fri → Mon
  };

  const selectBestPromotion = (promotions) => {
    return promotions.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  };

  const applyPromotion = (price, promo) => {
    if (!promo) return price;

    if (promo.type === "FREE") return 0;

    // Treat type === "HIKE" as price increase, everything else as discount
    const isHike = promo.type === "HIKE";

    if (promo.mode === "PERCENT") {
      const delta = (price * Number(promo.value || 0)) / 100;
      const newPrice = isHike ? price + delta : price - delta;
      return Math.max(newPrice, 0);
    }

    if (promo.mode === "FLAT") {
      const delta = Number(promo.value || 0);
      const newPrice = isHike ? price + delta : price - delta;
      return Math.max(newPrice, 0);
    }

    return price;
  };

  const getFinalProductPrice = ({
    product,
    promotions: manualPromos,
    outletId: manualOutletId,
  }) => {
    const activePromos = manualPromos ?? promotions;
    const activeOutletId = manualOutletId ?? outletId;
    if (!product) {
      console.warn("⚠️ Product missing at pricing stage");
      return product?.sellingPrice ?? 0;
    }

    // const now = new Date();
    const now = getBotswanaTime();

    const applicablePromos = activePromos.filter((p) => {
      // Robust is_active check
      const activeProp = p.is_active;
      const isActive =
        activeProp !== false &&
        activeProp !== 0 &&
        activeProp !== "0" &&
        String(activeProp).toLowerCase() !== "false";

      if (!isActive) return false;

      const match =
        isScopeValid(p, activeOutletId, product) && isScheduleValid(p, now);

      if (match) {
        // console.log(`%c [Live Match!] ${p.promotion_name} (ID: ${p.serverId}) at ${now.toLocaleTimeString()}`, "color: var(--success-bright); font-weight: bold;");
      }
      return match;
    });

    if (!applicablePromos.length) {
      return product.sellingPrice;
    }

    const bestPromo = selectBestPromotion(applicablePromos);

    return applyPromotion(product.sellingPrice, bestPromo);
  };

  //whats app
  const handleWhatsApp = async () => {
    setIsLoading(true);
    try {
      // To safely concatenate phone code and phone number, ensure both exist, then fallback if missing.
      let finalphone =
        orderData?.customer?.phone_code && orderData?.customer?.phone_number
          ? `${orderData.customer.phone_code}${orderData.customer.phone_number}`
          : `${customerDetails.phoneCode?.value ?? ""}${customerDetails.phone ?? ""}`;

      let customerName =
        orderData?.customer?.first_name && orderData?.customer?.last_name
          ? `${orderData.customer.first_name} ${orderData.customer.last_name}`
          : customerDetails.name || "Customer";
      finalphone = finalphone.trim().replace(/\D/g, ""); // keep digits only

      if (!finalphone) return;

      if (finalphone.length < 10) {
        alert(t("wa.invalidPhone"));
        return;
      }

      /**
       * The same bill the printer would hand them.
       *
       * This was written against field names the saved order does not use —
       * `orderItems` where it sends `order_items`, `display_id` where it
       * sends `displayId`, a total per line where it sends a price and a
       * count. Nothing threw; every message simply went out saying
       * "Order No: undefined" above the words "No items".
       */
      const message = billMessage(
        orderData,
        { name: user?.outlet_name },
        customerName
      );
      // Send the message through backend
      const res = await api.post(
        "/tenant/whatsapp/send",
        {
          // event_key: "ORDER_PLACED",
          phone: finalphone,
          message: message,
        },
        // {
        //   headers: {
        //     "x-tenant-id": orderData.tenant_id,
        //   },
        // }
      );

      if (res?.data?.success) {
        notifySuccess("WhatsApp message sent successfully!");
        setActivePopup("receipt");
        setCustomerDetails({
          name: "",
          phoneCode: { value: "+91" },
          phone: "",
        });
      } else {
        notifyError(t("wa.failed"));
      }
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      notifyError(t("wa.notConnected"));
    } finally {
      setIsLoading(false);
    }
  };

  const totalItems = cartData.reduce(
    (sum, p) => sum + (Number(p.quantity) || 1),
    0,
  );

  return (
    <div className="flex overflow-hidden h-full w-full ">
      <LoadingBar isLoading={!hydrated || !promoHydarated || isLoading} />
      <div className="home flex-1 bg-background flex flex-col h-full w-0 min-w-0 p-2 sm:p-3 gap-2">
        {payToProceed ? (
          <Payment
            setPayToProceed={setPayToProceed}
            total={parseFloat(total).toFixed(2)}
            onPay={handlePay}
            tax={parseFloat(tax).toFixed(2)}
            discount={parseFloat(discount).toFixed(2)}
            subtotal={parseFloat(subtotal).toFixed(2)}
            cartProducts={cartData}
            orderId={matchedHoldOrder}
          />
        ) : (
          <>
            <div className="header">
              <Header
                filters={filters}
                setFilters={setFilters}
                productListLength={productListLength}
                mute={mute}
                setMute={setMute}
                isPettyClicked={isPettyClicked}
                setIsPettyClicked={setIsPettyClicked}
              />
            </div>
            {/* The categories stand beside the dishes from `lg` up and above
                them below it, where the cart has already taken nearly half
                the screen and there is no column to give away. */}
            <div className="product-list-container flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-3 lg:gap-4 overflow-hidden">
              <CategoryRail
                filters={filters}
                setFilters={setFilters}
                favouriteCount={favouriteCount}
              />

              {/* ── Scrollable area ── */}
              <div className="flex-1 min-w-0 overflow-y-auto pr-1 no-scrollbar pb-12">
                {/* The grid is fitted to the width that is left rather than to
                    the screen's own breakpoints: the rail beside it takes some
                    of that width on a till and none on a phone, and a fixed
                    column count had no way to know which. A card gets at least
                    240px or it gets a row to itself. */}
                {filteredProducts.length > 0 && (
                  <div
                    /* `pos-grid-photos` widens the cards by the width of a
                       thumbnail and its gap, and only when this menu has
                       photographs in it. Without that the name on a card at
                       the minimum width lost most of its room to the picture
                       — and a menu with no pictures must keep exactly the
                       cards it has today. */
                    className={`
                  grid
                  gap-3
                  sm:gap-4
                  grid-cols-[repeat(auto-fill,minmax(var(--pos-dish-min),1fr))]
                  pt-2
                  items-stretch
                  ${showPhotos ? "pos-grid-photos" : ""}
                  `}
                  >
                    {filteredProducts
                      .map((p) => {
                        const price = getFinalProductPrice({
                          product: p,
                          promotions,
                          outletId,
                        });
                        const discount =
                          price < p.sellingPrice ? p.sellingPrice - price : 0;

                        return (
                          <div
                            key={p.serverId ?? p.localId}
                            className="w-full "
                          >
                            <ProductComp
                              key={p.serverId ?? p.localId}
                              id={p.serverId}
                              img={p.img}
                              showPhoto={showPhotos}
                              name={p.name}
                              nameAr={p.nameAr}
                              code={p.code}
                              price={price}
                              originalPrice={p.sellingPrice}
                              discount={discount}
                              unit={p.unit}
                              foodType={p.foodType}
                              jainAvailable={p.jainAvailable}
                              stock={p.stock}
                              stockQueue={p.stockQueue}
                              categoryName={p.categoryName}
                              mute={mute}
                              tax={p.tax}
                              isautoFill={p.isautoFillVolumeDetails}
                              isDisabled={p.isDisabled === true}
                              extraCartFields={{
                                originalPrice: p.sellingPrice,
                                discount,
                              }}
                            />
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Only once the menu is actually known to be empty.

                    The dishes arrive a moment after the screen does, and this
                    used to fill that moment with a box saying there were none
                    — so every time the menu was opened, a cashier was told the
                    restaurant had nothing to sell, and then the food appeared.
                    Until the list has loaded, the honest thing to show is the
                    loading bar that is already running. */}
                {hydrated && filteredProducts.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-text-muted">
                    <div className="text-6xl mb-4">📦</div>
                    <p className="text-xl font-semibold">{t("menu.noResults")}</p>
                    <p className="text-sm text-text-muted mt-1">
                      {t("menu.tryChanging")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {!isMobile && (
        <div className="w-[50vw] sm:w-[45vw] lg:w-[35vw] h-full">
          <Cart
            setPayToProceed={setPayToProceed}
            payToProceed={payToProceed}
            subtotal={subtotal}
            tax={tax}
            discount={discount}
            discountAmount={discountAmount}
            total={total}
          />
        </div>
      )}
      {/* Not while taking payment: on a phone this pill sat on top of the Pay
          button and covered how much was still to collect. */}
      {isMobile && !showCart && !payToProceed && (
        <div className="fixed pos-above-bar left-1/2 -translate-x-1/2 z-[50]">
          <button
            onClick={() => setShowCart(true)}
            /* The brand's polished emerald, the same metal as the Pay key
               and the rail. It used to run `from-primary` through gold to
               `to-secondary`: deep green blended into gold turns olive
               halfway across, which is the muddy brass this pill was. Green
               and gold are both ours; the blend between them is not, so the
               two never share a gradient. The gold stays as a hairline. */
            className="gf-metal-green group relative flex items-center gap-2 px-4 py-1.5 rounded-full text-white text-sm font-semibold shadow-lg border border-[var(--gold-hair)] active:scale-[0.98] transition-all duration-300 ease-out hover:shadow-[0_20px_40px_var(--primary-alpha-30)] hover:border-[var(--theme-secondary)]/55 min-w-[140px]
            before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-br before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300
            animate-pulse-slow"
          >
            {/* Glow effect — one colour. A two-stop green-to-gold blur under
                a green pill put the olive back by the side door. */}
            <div className="absolute inset-0 rounded-full bg-[var(--theme-primary)]/50 blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>

            {/* Cart Icon with animation */}
            <div className="relative flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:scale-110"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 6h13M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z"
                />
              </svg>

              {/* Badge for items */}
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg border-2 border-primary animate-bounce">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </div>

            <span className="relative z-10 tracking-wide">{t("cart.title")}</span>

            {/* Price display */}
            <span className="relative z-10 font-bold bg-white/20 backdrop-blur-sm px-2 py-1 rounded-xl text-white border border-white/30 min-w-[50px] text-center">
              {cur()}{total.toFixed(0)}
            </span>

            {/* Shimmer effect */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
            </div>
          </button>
        </div>
      )}

      {isMobile && showCart && (
        <div className="pos-sheet-on-bar fixed inset-0 z-[60] flex flex-col justify-end">
          {/* pos-sheet-on-bar, not a number: the bar knows how tall it is, and
              a hard 13.5 here was the height it used to be. When the bar grew
              to keep clear of the phone's gesture line, this drawer stayed
              where it was and sat across the icons, cutting them in half. */}
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCart(false)}
          />

          {/* Drawer */}
          <div className="relative bg-surface rounded-t-2xl h-[97%] sm:h-[90%]  flex flex-col animate-slide-up">
            {/* Header */}
            <div className="px-4 py-2 border-b border-primary/10 flex justify-between items-center text-primary">
              <h2 className="font-bold text-xl">{t("cart.yours")}</h2>
              <button
                onClick={() => setShowCart(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors font-bold cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Cart Content */}
            <div className="flex-1 overflow-y-auto w-full max-h-full">
              <Cart
                setPayToProceed={(val) => {
                  setPayToProceed(val);
                  setShowCart(false);
                }}
                subtotal={subtotal}
                tax={tax}
                discount={discount}
                discountAmount={discountAmount}
                total={total}
              />
            </div>
          </div>
        </div>
      )}
      <DashboardPopup
        activePopup={activePopup}
        setActivePopup={setActivePopup}
        orderId={orderId}
        isPrinting={isPrinting}
        setIsPrinting={setIsPrinting}
        orderData={orderData}
        customerDetails={customerDetails}
        setCustomerDetails={setCustomerDetails}
        handleCustomerChange={handleCustomerChange}
        resetCart={resetCart}
        setCartProducts={setCartProducts}
        setPayToProceed={setPayToProceed}
        handleWhatsApp={handleWhatsApp}
      />
      {whenToOpenRetail && (
        <Retail
          setPayToProceed={setPayToProceed}
          getFinalProductPrice={getFinalProductPrice}
          setIsPettyClicked={setIsPettyClicked}
          mute={mute}
          setMute={setMute}
        />
      )}
      {isPettyClicked && <PettyCash setIsPettyClicked={setIsPettyClicked} />}
    </div>
  );
};

export default Dashboard;
