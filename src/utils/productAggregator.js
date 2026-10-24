export const aggregateInventoryToProducts = (apiData, outletId) => {
  const map = new Map();

  for (const item of apiData) {
    const productId = item.product_id;

    if (!map.has(productId)) {
      map.set(productId, {
        localId: `product-${productId}`,   //deterministic key
        serverId: productId,
        outletId,

        name: item.product.product_name,

        /* The same dish in Arabic, where somebody has typed one. Carried
           beside the English name rather than instead of it: which of the
           two a screen shows is the restaurant's setting, not the data's. */
        nameAr: item.product.name_ar || null,

        /**
         * The short number a dish is known by — "one twenty-three, please".
         *
         * Stored in the column called barcode, which is what it was built
         * for and what the retail counter still scans into. A restaurant
         * uses the same field for the number printed beside the dish on the
         * menu card, so it is called what it is here: a code.
         */
        code: item.product.barcode,
        barcode: item.product.barcode,
        categoryId: item.product.category_id,
        categoryName: item.product.category_name,
        img: item.product.image_url,

        // What the dish is, and whether the kitchen can make it Jain. Shown
        // on the card, carried into the cart, printed on the ticket.
        foodType: item.product.food_type || "VEG",
        jainAvailable: item.product.jain_available === true,

        unit: item.unit,
        tax: item.addedTaxPercentageToSalesPrice || 0,
        purchasePriceTaxType: item.purchasePriceTaxType || false,
        // false = sold straight from the catalogue, no stock kept for it
        trackStock: item.track_stock !== false,
        stock: Number(item.quantity || 0),
        stockQueue: Number(item.remaining_quantity || 0),
        purchasePriceTaxPercentage: String(item.purchasePriceTaxPercentage || "0.00"),
        isautoFillVolumeDetails: item.is_auto_fill_volume_details || false,
        is_tax_inclusive_for_unit_sales_price: item.is_tax_inclusive_for_unit_sales_price || false,
        bottleVolumeML: item.bottle_volume_ml || null,
        pricePerML: item.price_per_ml || null,
        purchasePricePerShot: item.purchase_price_per_shot || null,
        sellingPricePerShotMarkupPercentage: item.selling_price_per_shot_markup_percentage || null,
        sellingPricePerShot: item.selling_price_per_shot || null,
        lowStockThreshold: item.low_stock_threshold || 5,
        sellingPrice: Number(item.selling_price),


        isDisabled: item.is_disabled === true,

        // The owner has put this dish at the front of this outlet's till.
        isFavourite: item.is_favourite === true,

        updatedAt: Date.now(),
      });
    } else {
      //aggregate batches
      map.get(productId).stock += Number(item.remaining_quantity || 0);
    }
  }

  return Array.from(map.values()).map(p => ({
    ...p,
    isLowStock: p.trackStock ? p.stock <= p.lowStockThreshold : false,
  }));
};

