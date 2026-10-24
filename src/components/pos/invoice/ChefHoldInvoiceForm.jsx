import HoldInvoiceFrom from "./HoldInvoiceForm";

const ChefHoldInvoiceForm = ({ selectedHoldOrder }) => {
  return (
    <HoldInvoiceFrom
      selectedHoldOrder={selectedHoldOrder}
      onAddToCart={() => {}}
      onDelete={() => {}}
      role="chef"
    />
  );
};

export default ChefHoldInvoiceForm;
