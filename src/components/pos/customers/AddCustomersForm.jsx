import React from "react";
import { useT } from "../../../i18n";
import Select from "react-select";
// import { commonSelectStyles } from "../../common/select/selectStyle";
import { useState, useEffect } from "react";
import { useNotification } from "../../../hooks/useNotification.jsx";
// import PhoneInputWithCode from "../../phoneCodeInput/PhoneInputWithCode.jsx";
import LoadingBar from "../../common/LoadingBar/LoadingBar.jsx";

const InputComp = ({
  label,
  placeholder,
  isRequired = false,
  type,
  name,
  value,
  onChange,
  maxLength,
}) => {
  return (
    <div className="flex flex-col w-full gap-1.5">
      <label className="text-text-secondary text-xs sm:text-sm font-semibold tracking-wide">
        {label}
        {isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full px-3 sm:px-4 py-2 border border-border-default rounded-xl
                   bg-background outline-none placeholder:text-text-muted/70 transition-all duration-200
                   focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-sm
                   text-sm text-text-secondary"
      />
    </div>
  );
};

const SectionTitle = ({ icon, title }) => (
  <div className="flex items-center gap-2 mb-2.5">
    <span className="text-primary">{icon}</span>
    <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
      {title}
    </span>
    <div className="flex-1 h-px bg-border-default/50 ml-1" />
  </div>
);

const AddCustomersForm = ({
  focusedCustomer,
  clearSelection,
  onAddCustomer,
  onEditCustomer,
  countries,
}) => {
  const t = useT();

  const { notifySuccess, notifyError } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const defaultCodeOption = {
    label: t("customer.selectCode"),
    value: "",
  };

  const codeOptions = countries.map((c) => ({
    label: c.name,
    value: c.code,
  }));

  // const defaultCountryOption = {
  //   label: "Select Country",
  //   value: "",
  // };

  // const countryOptions = countries.map((c) => ({
  //   label: c.name,
  //   value: c.name,
  // }));

  const parseName = (fullName) => {
    const trimmed = (fullName || "").trim();
    if (!trimmed) return { firstName: "", lastName: "" };
    const parts = trimmed.split(/\s+/);
    const firstName = parts[0];
    // A one-word name has no surname — see the note in DiscountHoldOrderPopup.
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
    return { firstName, lastName };
  };

  const initialFormData = {
    name: "",
    phone: "",
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (focusedCustomer) {
      const combinedName = [focusedCustomer.firstName, focusedCustomer.lastName]
        .filter(Boolean)
        .join(" ");
      const displayName =
        focusedCustomer.firstName && focusedCustomer.firstName === focusedCustomer.lastName
          ? focusedCustomer.firstName
          : combinedName;
      setFormData({
        name: displayName || "",
        phone: focusedCustomer.phone || "",
      });
    } else {
      setFormData(initialFormData);
    }
  }, [focusedCustomer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
      setFormData((prev) => ({ ...prev, phone: digitsOnly }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = (data) => {
    if (!data.name.trim()) {
      notifyError(t("customers.nameRequired"), t("customers.requiredMissing"));
      return false;
    }
    if (data.phone.trim() && data.phone.trim().length !== 10) {
      notifyError(t("customers.mobile10"), t("customers.mobile10"));
      return false;
    }
    return true;
  };

  const handleCancel = (e) => {
    e.preventDefault();
    setFormData(initialFormData);
    clearSelection(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(formData)) return;

    const { firstName, lastName } = parseName(formData.name);

    const payload = {
      firstName,
      lastName,
      phoneCode: "+91",
      phone: formData.phone.trim(),
      email: "",
      address1: "",
      address2: "",
      country: "",
      state: "",
      city: "",
      pincode: "",
    };
    setIsLoading(true);

    try {
      if (focusedCustomer) {
        await onEditCustomer(payload);
        notifySuccess(t("customers.edited"));
      } else {
        await onAddCustomer(payload);
        notifySuccess(t("customers.added"));
      }
      setFormData(initialFormData);
      clearSelection();
    } catch (error) {
      notifyError(t("common.tryAgain"));
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const phoneCodeStyles = {
    control: (provided, state) => ({
      ...provided,
      minHeight: "40px",
      borderRadius: "0.75rem",
      border: state.isFocused
        ? "1px solid var(--color-primary)"
        : "1px solid var(--border-default)",
      backgroundColor: "var(--bg-main)",
      boxShadow: state.isFocused ? "0 0 0 3px var(--overlay-indigo-10)" : "none",
      fontSize: "0.875rem",
      transition: "all 0.2s ease",
    }),
    menuPortal: (provided) => ({
      ...provided,
      zIndex: 9999,
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999,
      fontSize: "0.875rem",
    }),
    option: (provided, state) => ({
      ...provided,

      backgroundColor:
        state.isSelected || state.isFocused
          ? "var(--color-secondary)" // 🔥 hover + selected same color
          : "white",
      color: state.isSelected || state.isFocused ? "white" : "var(--gray-700)",
      cursor: "pointer",
    }),
  };

  return (
    <div className="h-full bg-surface flex flex-col overflow-hidden">
      <LoadingBar isLoading={isLoading} />

      {/* ── MODAL HEADER ── */}
      <div className="flex-none px-5 pt-4 pb-3.5 border-b border-border-default/50 bg-surface">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent leading-tight">
              {focusedCustomer ? t("customers.editTitle") : t("customers.addTitle")}
            </h2>
            <p className="text-text-muted text-xs mt-0.5">
              {focusedCustomer
                ? t("customers.editHint")
                : t("customers.addHint")}
            </p>
          </div>

          {/* Close / X button */}
          <button
            type="button"
            onClick={handleCancel}
            className="flex-none flex items-center justify-center w-8 h-8 rounded-lg
                       text-text-muted hover:text-text-secondary hover:bg-gray-100
                       transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gray-300"
            aria-label={t("common.close")}
          >
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ── SCROLLABLE FORM BODY ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="px-5 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <SectionTitle
                icon={
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                }
                title={t("order.customerDetails")}
              />
              <div className="space-y-3">
                <InputComp
                  label={t("customer.nameLabel")}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={t("customer.fullName")}
                  isRequired={true}
                  type={"text"}
                />
                <InputComp
                  label={t("customer.mobile")}
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder={t("customer.enterMobile")}
                  type={"tel"}
                  maxLength={10}
                />
              </div>
            </div>

            {/* Spacer so last field isn't hidden behind sticky footer */}
            <div className="h-1" />
          </form>
        </div>
      </div>

      {/* ── STICKY FOOTER ACTIONS ── */}
      <div className="flex-none px-5 py-3.5 border-t border-border-default/50 bg-surface">
        <div className="flex flex-row gap-2.5">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2
                       px-5 py-2.5 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)]
                       text-text-inverted font-semibold rounded-xl text-sm
                       hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
                       transform transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                       focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving…
              </>
            ) : focusedCustomer ? (
              t("customers.update")
            ) : (
              t("customers.save")
            )}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 sm:flex-none sm:w-auto px-5 py-2.5
                       bg-surface border border-border-default
                       text-text-secondary font-semibold rounded-xl text-sm
                       hover:bg-gray-50 hover:border-border-default/80
                       transition-all duration-200
                       focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
          >
            {focusedCustomer ? t("common.cancel") : t("tables.reset")}
          </button>
        </div>
      </div>

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

export default AddCustomersForm;
