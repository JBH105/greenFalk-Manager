import { v4 as uuidv4 } from "uuid";

export const mapCustomerToApiPayload = (customer) => ({
  first_name: customer.firstName,
  last_name: customer.lastName,
  outlet_id: customer.outlet_id,
  phone_code: customer.phoneCode,
  phone_number: customer.phone,
  email: customer.email,
  address_line_1: customer.address1,
  address_line_2: customer.address2,
  city: customer.city,
  state: customer.state,
  pincode: customer.pincode,
  country: customer.country,
});

// Helper function to convert date to timestamp
const dateToTimestamp = (dateValue) => {
  if (!dateValue) return null;
  if (typeof dateValue === 'number') return dateValue;
  try {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date.getTime();
  } catch {
    return null;
  }
};

/**
 * The server does not answer in one voice.
 *
 * Listing customers returns snake_case rows straight from the table, while
 * creating one returns a hand-built camelCase object (`firstName`,
 * `phoneNumber`, `customerId`). This used to read snake_case only, so a
 * customer who had just been created came back with an empty `firstName` —
 * and the bill that was placed in the same breath fell through to "Guest"
 * even though the guest had been named and saved a moment earlier.
 *
 * Both spellings are accepted, snake_case first since that is what a listing
 * sends.
 */
const pick = (obj, ...keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

// Map an API response (either spelling) to the local camelCase format.
export const mapApiResponseToCustomer = (apiCustomer, existingLocalId = null) => {
  // Extract serverId from various possible fields (check in order of likelihood)
  const serverId = apiCustomer.id || apiCustomer.customer_id || apiCustomer.customerId || apiCustomer._id;

  return {
    serverId: serverId,
    // Use existing localId if provided, otherwise generate one based on serverId
    localId: existingLocalId || (serverId ? `server-${serverId}` : uuidv4()),
    firstName: pick(apiCustomer, "first_name", "firstName") || "",
    lastName: pick(apiCustomer, "last_name", "lastName") || "",
    phoneCode: pick(apiCustomer, "phone_code", "phoneCode") || "",
    phone: pick(apiCustomer, "phone_number", "phoneNumber", "phone") || "",
    email: apiCustomer.email || "",
    address1: pick(apiCustomer, "address_line_1", "addressLine1") || "",
    address2: pick(apiCustomer, "address_line_2", "addressLine2") || "",
    city: apiCustomer.city || "",
    state: apiCustomer.state || "",
    outlet_id: apiCustomer.outlet_id || null,
    pincode: apiCustomer.pincode || "",
    country: apiCustomer.country || "",
    isSynced: true, // Data from server is always synced
    isDeleted: false,
    createdAt: dateToTimestamp(pick(apiCustomer, "created_at", "createdAt")) || Date.now(),
    updatedAt: dateToTimestamp(pick(apiCustomer, "updated_at", "updatedAt")),
  };
};