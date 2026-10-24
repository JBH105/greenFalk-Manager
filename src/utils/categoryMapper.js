/* ================= API → LOCAL ================= */

export const mapApiResponseToCategory = (apiCategory) => ({
  id:
    apiCategory.id ||
    apiCategory.category_id ||
    apiCategory._id,

  category_name: apiCategory.category_name || apiCategory.name,
  category_name_ar: apiCategory.category_name_ar || null,
  description: apiCategory.description || "",
  img_url: apiCategory.img_url || apiCategory.image_url || null,

  // sequence_number drives the POS category tab ordering.
  // The outlet-wise API returns categories already sorted, but we store the
  // number so the offline load (from IndexedDB) preserves the correct order.
  sequence_number: apiCategory.sequence_number ?? 0,

  created_by: apiCategory.created_by || null,
  updated_by: apiCategory.updated_by || null,

  createdAt: apiCategory.createdAt
    ? new Date(apiCategory.createdAt).getTime()
    : Date.now(),

  updatedAt: apiCategory.updatedAt
    ? new Date(apiCategory.updatedAt).getTime()
    : Date.now(),
});

