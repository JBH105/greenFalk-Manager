import { v4 as uuidv4 } from "uuid";
export const mapPromotionToApiPayload = (promotion) => ({
  promotion_id: promotion.promotion_id,
  promotion_name: promotion.promotion_name,
  type: promotion.type,
  mode: promotion.mode,
  value: promotion.value,
  outlet: promotion.outlet,
  category: promotion.category,
  product: promotion.product,
  promo_on: promotion.promo_on,
  priority: promotion.priority,
  condition_trigger: promotion.condition_trigger,
  condition_value: promotion.condition_value,
  schedule_type: promotion.schedule_type,
  schedule_mode: promotion.schedule_mode,
  schedule_start_date: promotion.schedule_start_date,
  schedule_end_date: promotion.schedule_end_date,
  schedule_start_day: promotion.schedule_start_day,
  schedule_end_day: promotion.schedule_end_day,
  schedule_end_time: promotion.schedule_end_time,
  free_item_id: promotion.free_item_id,
  is_active: promotion.is_active,
});

export const mapApiResponseToPromotion = (apiPromotion, localId = uuidv4()) => ({
  localId,
  serverId:
    apiPromotion.promotion_id ||
    apiPromotion.promotionId ||
    apiPromotion.id,

  promotion_id: apiPromotion.promotion_id,
  promotion_name: apiPromotion.promotion_name,
  is_active: apiPromotion.is_active,
  type: apiPromotion.type,
  mode: apiPromotion.mode,
  value: apiPromotion.value,

  outlet: apiPromotion.outlet || [],
  category: apiPromotion.category || [],
  product: apiPromotion.product || [],

  promo_on: apiPromotion.promo_on,
  priority: apiPromotion.priority,

  condition_trigger: apiPromotion.condition_trigger,
  condition_value: apiPromotion.condition_value,

  schedule_type: apiPromotion.schedule_type,
  schedule_mode: apiPromotion.schedule_mode,
  schedule_start_date: apiPromotion.schedule_start_date,
  schedule_end_date: apiPromotion.schedule_end_date,
  schedule_start_day: apiPromotion.schedule_start_day,
  schedule_end_day: apiPromotion.schedule_end_day,
  schedule_start_time: apiPromotion.schedule_start_time,
  schedule_end_time: apiPromotion.schedule_end_time,

  free_item_id: apiPromotion.free_item_id || [],

  isSynced: true,
  isDeleted: false,
  createdAt: Date.now(),
});
