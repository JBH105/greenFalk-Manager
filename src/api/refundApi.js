import api from "../utils/api";
import { t } from "../i18n";

export const refundOrderAPI = async (refundData) => {
  try {
    const res = await api.post("/refund-item/create", refundData);

    return res.data;
  } catch (error) {
    // 🔴 Log for debugging
    console.error("❌ Refund API failed:", error);

    // 🔴 Normalize error message
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      t("refund.failed");

    // 🔴 Throw so UI can catch it
    throw new Error(message);
  }
};
