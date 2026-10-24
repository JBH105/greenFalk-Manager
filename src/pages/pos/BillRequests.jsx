import Invoices from "./Invoices";

/**
 * The tables a captain has closed off and sent to the till.
 *
 * This is the screen a cashier stands on when a guest walks up and says "table
 * three" — so it gets its own place in the sidebar rather than being one tab
 * among five inside Invoices. It is the same list, pinned to that one view.
 */
const BillRequests = () => <Invoices only="billRequestBTN" />;

export default BillRequests;
