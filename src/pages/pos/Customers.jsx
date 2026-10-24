import React, { useEffect, useState } from "react";
import { useT } from "../../i18n";
import AddCustomersForm from "../../components/pos/customers/AddCustomersForm";
import CustomerList from "../../components/pos/customers/CustomerList";
import { useCustomerStore } from "../../store/useCustomerStore";
import { useCartStore } from "../../store/useCartStore";
import SearchBar from "../../components/searchBar/SearchBar";
import { countriesList } from "../../store/countryStore";
import { useAuthStore } from "../../store/useAuthStore";
import LoadingBar from "../../components/common/LoadingBar/LoadingBar";
import { useResponsive } from "../../context/ResponsiveContext";

const Customers = () => {
  const t = useT();

  const {
    customers,
    hydrate,
    hydrated,
    addCustomer,
    editCustomer,
    deleteCustomer,
  } = useCustomerStore();

  const { selectedCustomer, setSelectedCustomer } = useCartStore();
  const [focusedCustomer, setFocusedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const user = useAuthStore((u) => u.user);
  const outletId = user.outlet_id || user.outletId || null;
  const { isMobile, isTablet } = useResponsive();

  // Load customers from IndexedDB
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const filteredCustomers = React.useMemo(() => {
    const outletCustomers = customers.filter((customer) => {
      const customerOutletId = customer.outletId || customer.outlet_id;
      return String(customerOutletId) === String(outletId);
    });

    const search = searchTerm.toLowerCase();

    return outletCustomers
      .filter((customer) => {
        return (
          customer.firstName?.toLowerCase().includes(search) ||
          customer.lastName?.toLowerCase().includes(search) ||
          // customer.email?.toLowerCase().includes(search) ||
          customer.phone?.includes(search)
        );
      })
      .sort((a, b) => (a.localId > b.localId ? -1 : 1));
  }, [customers, searchTerm, outletId]);

  // Open modal when a customer is selected for editing
  const handleSelectEditCustomer = (customer) => {
    setFocusedCustomer(customer);
    setIsModalOpen(true);
  };

  // Open modal for adding a new customer
  const handleOpenAddModal = () => {
    setFocusedCustomer(null);
    setIsModalOpen(true);
  };

  // Close modal and clear selection
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFocusedCustomer(null);
  };

  if (!hydrated) return <LoadingBar />;

  return (
    <div className="h-screen w-full overflow-hidden bg-background flex flex-col">
      <LoadingBar isLoading={!hydrated} />

      {/* ── PAGE HEADER ── */}
      <div className="flex-none px-4 sm:px-6 pt-5 pb-4 border-b border-border-default/50 bg-background">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-text-secondary leading-tight">
              {t("customers.title")}
            </h2>
            <p className="text-text-muted text-xs sm:text-sm mt-0.5 hidden sm:block">
              {t("customers.subtitle")}
            </p>
          </div>

          {/* Add Customer Button — lives in the header */}
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 gf-metal-green
                       text-text-inverted text-sm font-semibold rounded-xl
                       hover:shadow-lg hover:scale-[1.03] active:scale-[0.98]
                       transform transition-all duration-200
                       focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2
                       whitespace-nowrap"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className={isMobile ? "hidden" : "inline"}>{t("customers.add")}</span>
            <span className={isMobile ? "inline" : "hidden"}>{t("common.add")}</span>
          </button>
        </div>

        {/* Search Bar below heading */}
        <div className="mt-3 sm:mt-4">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t("customers.search")}
            resultCount={filteredCustomers.length}
          />
        </div>
      </div>

      {/* ── CUSTOMER LIST ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-5 py-3">
        {filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
            <svg
              className="w-12 h-12 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="text-sm font-medium">{t("customers.none")}</p>
            <button
              onClick={handleOpenAddModal}
              className="text-xs text-primary hover:underline font-medium"
            >
              Add your first customer →
            </button>
          </div>
        ) : (
          <CustomerList
            customers={filteredCustomers}
            onSelectEditCustomer={handleSelectEditCustomer}
            onDeleteCustomer={deleteCustomer}
            setSelectedCustomer={setSelectedCustomer}
            selectedCustomer={selectedCustomer}
          />
        )}
      </div>

      {isModalOpen && (
        <div
          className={`fixed inset-0 z-50 flex justify-center
            ${isMobile ? "items-end" : "items-center px-4 py-6"}`}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`absolute inset-0 bg-black/40 ${isMobile ? "pos-bar-gap" : ""}`}
            onClick={handleCloseModal}
            aria-hidden="true"
          />

          <div
            className={`
              relative z-10 bg-surface flex flex-col overflow-hidden
              
              transition-all duration-300 ease-out
              ${isMobile
                ? /* mobile — bottom sheet, snug height */
                "w-full rounded-t-2xl max-h-[90dvh] pos-bar-gap"
                : isTablet
                  ? /* tablet — centred dialog */
                  "rounded-2xl w-full max-w-[480px] max-h-[85vh]"
                  : /* desktop — compact centred dialog */
                  "rounded-2xl w-full max-w-[550px] max-h-[82vh]"
              }
            `}
          >


            <AddCustomersForm
              focusedCustomer={focusedCustomer}
              clearSelection={handleCloseModal}
              onAddCustomer={addCustomer}
              onEditCustomer={editCustomer}
              countries={countriesList}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: var(--bg-light-gray);
          border-radius: 3px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--bg-medium-gray);
          border-radius: 3px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--bg-dark-gray);
        }

        @media (max-width: 640px) {
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
        }
      `}</style>
    </div>
  );
};

export default Customers;
