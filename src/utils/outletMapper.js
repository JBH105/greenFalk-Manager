/* ================= API → LOCAL ================= */

export const mapApiResponseToOutlet = (apiOutlet) => ({
    /** IDs */
    id:
        apiOutlet.id ||
        apiOutlet.outlet_id ||
        apiOutlet._id,

    tenant_id: apiOutlet.tenant_id || apiOutlet.tenantId || null,

    /** Basic Info */
    outlet_name: apiOutlet.outlet_name || apiOutlet.name || "",
    outlet_code: apiOutlet.outlet_code || apiOutlet.code || null,

    /** Address */
    address: apiOutlet.address || "",
    city: apiOutlet.city || "",
    state: apiOutlet.state || "",

    /** Contact */
    phone_code: apiOutlet.phone_code || apiOutlet.phoneCode || null,
    contact_number:
        apiOutlet.contact_number || apiOutlet.contactNumber || null,

    /** Relations */
    outlet_type_id:
        apiOutlet.outlet_type_id || apiOutlet.outletTypeId || null,

    country_id:
        apiOutlet.country_id || apiOutlet.countryId || null,

    /** Status */
    is_active:
        typeof apiOutlet.is_active === "boolean"
            ? apiOutlet.is_active
            : true,

    /** Audit */
    created_by: apiOutlet.created_by || null,
    updated_by: apiOutlet.updated_by || apiOutlet.update_by || null,

    /** Timestamps (normalized for IndexedDB) */
    createdAt: apiOutlet.createdAt
        ? new Date(apiOutlet.createdAt).getTime()
        : Date.now(),

    updatedAt: apiOutlet.updatedAt
        ? new Date(apiOutlet.updatedAt).getTime()
        : Date.now(),
});
