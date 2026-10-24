import { useAuthStore } from "../store/useAuthStore";
import { useOutletStore } from "../store/useOutletStore";
import { useOrderStore } from "../store/useOrderStore";
import { useEffect } from "react";

export const generateNextOrderId = () => {
  // Access state directly (Works inside or outside components)
  const user = useAuthStore.getState().user;
  const { outlets } = useOutletStore.getState();
  const { orders } = useOrderStore.getState();

  // 1. Find Outlet Code
  const userOutlet = outlets.find((o) => o.id === user?.outlet_id);
  
  const outletCode = userOutlet?.outlet_code || "NA";
  

  // 2. Calculate Next Number
  let nextNumber = 1;
  if (orders && orders.length > 0) {
    // Look at display_id suffix (#31) to find max, 
    // or use a dedicated 'orderNumber' field if you have it
    const orderNumbers = orders.map((o) => {
      if (o.orderNumber) return Number(o.orderNumber);
      const match = o.display_id?.match(/#(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    nextNumber = Math.max(...orderNumbers, 0) + 1;
  }

  // 3. Format Date
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  }).replace(/\//g, "-");

  return {
    displayId: `INV-${dateStr}@${outletCode}#${nextNumber}`,
    orderNumber: nextNumber
  };
};