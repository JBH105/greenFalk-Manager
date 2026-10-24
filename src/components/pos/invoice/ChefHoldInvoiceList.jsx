import HoldInvoiceList from "./HoldInvoiceList";

const ChefHoldInvoiceList = ({
  orders,
  selectedHoldOrder,
  setSelectedHoldOrder,
  searchTerm,
  setSearchTerm,
}) => {
  return (
    <HoldInvoiceList
      orders={orders}
      selectedHoldOrder={selectedHoldOrder}
      setSelectedHoldOrder={setSelectedHoldOrder}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      role="chef"
    />
  );
};

export default ChefHoldInvoiceList;
