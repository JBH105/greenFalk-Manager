import { v4 as uuidv4 } from "uuid";
/**
 * A table, on its way to the server.
 *
 * Which part of the restaurant it goes in travels with it. The server puts
 * a table with no room into the main one, so sending nothing is still
 * correct — but a table added from inside a room should land in that room,
 * rather than be created loose and moved there by a second request that
 * might not arrive.
 */
export const mapTableToApiPayload = (table) => ({
  table_number: String(table.tableNumber || ""),
  capacity: Number(table.seats || table.capacity || 0),
  ...(table.zoneId ? { zone_id: table.zoneId } : {}),
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

// Map API response to local table format
export const mapApiResponseToTable = (apiTable, existingLocalId = null, outletId = null) => {
  // Extract serverId from various possible fields
  const serverId = apiTable.id || apiTable.table_id || apiTable.tableId || apiTable._id;

  return {
    serverId: serverId,
    // Use existing localId if provided, otherwise generate one based on serverId
    localId: existingLocalId || (serverId ? `server-${serverId}` : uuidv4()),
    tableNumber: apiTable.table_number || apiTable.tableNumber || 0,
    // Map capacity from API to seats in local format
    seats: apiTable.capacity || apiTable.seats || 0,
    outletId: outletId || apiTable.outlet_id || apiTable.outletId || null,
    occupied: apiTable.status === 'occupied' || apiTable.occupied || false,

    /**
     * Which part of the restaurant this table stands in.
     *
     * Both the id and the name travel, because the floor plan groups by one
     * and prints the other, and re-reading the name out of a separate list
     * for every tile is a lookup on every render for a string the server
     * already sent. Null on a table nobody has sorted, which is every table
     * that existed before zones did.
     */
    zoneId: apiTable.zone_id || apiTable.zone?.id || null,
    zoneName: apiTable.zone?.zone_name || null,
    /* Carried alongside rather than instead: the floor plan picks one of the
       two when it draws, and a part with no Arabic name still has to show
       its English one. */
    zoneNameAr: apiTable.zone?.zone_name_ar || null,
    zoneSequence: apiTable.zone?.sequence ?? null,

    isSynced: true, // Data from server is always synced
    isDeleted: false,
    createdAt: dateToTimestamp(apiTable.created_at) || Date.now(),
    updatedAt: dateToTimestamp(apiTable.updated_at),
  };
};
