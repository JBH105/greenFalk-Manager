// Map local order format to API payload format
export const mapOrderToApiPayload = (order, userId) => {
  return {
    outlet_id: order.outlet_id,
    customer: order.customer || null,
    table_id: order.table_id || null,
    order_type: order.order_type || order.orderType || "DINE_IN",
    
    // Discount fields
    discount_percentage: order.discount_percentage || null,
    discountAmount: order.discountAmount || order.discount || 0,
    
    // Amount fields
    subtotal: order.subtotal || 0,
    taxAmount: order.taxAmount || order.tax || 0,
    amount: order.amount || order.total || 0,
    
    // Order items - map from items array
    orderItems: (order.orderItems || []).map(item => ({
      productId: item.productId || item.id,
      product_name: item.product_name,
      unitPrice: item.unitPrice || item.price || 0,
      quantity: item.quantity || 0,
      unit: item.unit || null,
      discount: item.discount || 0,
      tax_percentage_per_product: Number(item.tax_percentage_per_product || item.taxPercentage || 0),
    })),
    
    // Payment methods
    paymentMethods: order.payments || [],
    
    // Payment details
    tenderedAmount: order.tenderedAmount || 0,
    cashReturned: order.cashReturned || 0,
  };
};
