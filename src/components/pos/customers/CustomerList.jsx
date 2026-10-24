import React from "react";
import { useT } from "../../../i18n";
import {
  AiOutlineEdit,
  AiOutlineDelete,
  AiOutlineCheck,
  AiOutlinePhone,
} from "react-icons/ai";
import userImg from "../../../assets/images/user.png";
import { useNavigate } from "react-router-dom";

const CustomerList = ({

  customers,
  onSelectEditCustomer,
  onDeleteCustomer,
  setSelectedCustomer,
  selectedCustomer,
}) => {
  const t = useT();
  const navigate = useNavigate();

  return (
    <div className="w-full bg-background pb-2">
      {customers.map((customer) => {
        const isSelected = selectedCustomer?.localId === customer.localId;

        return (
          <div
            key={customer.localId}
            className={`
              group relative flex items-center justify-between gap-3
              rounded-xl px-3 py-3 mb-2.5
              bg-surface border transition-all duration-200
              ${
                isSelected
                  ? "border-primary/40 shadow-[0_0_0_2px_var(--color-primary)/15] bg-primary/[0.03]"
                  : "border-border-default/60 shadow-[0_1px_4px_var(--overlay-black-6)] hover:shadow-[0_2px_8px_var(--overlay-black-10)] hover:border-border-default"
              }
            `}
          >
            {/* Selected indicator bar */}
            {isSelected && (
              <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-primary" />
            )}

            {/* ── LEFT: Avatar + Info ── */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <img
                  src={userImg}
                  alt={`${customer.firstName} ${customer.lastName}`}
                  className={`
                    w-10 h-10 rounded-full object-cover
                    ring-2 transition-all duration-200
                    ${isSelected ? "ring-primary/50" : "ring-border-default/50"}
                  `}
                />
                {isSelected && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                    <AiOutlineCheck className="text-white text-[9px]" />
                  </span>
                )}
              </div>

              {/* Name + Contact */}
              <div className="min-w-0">
                <p
                  className={`
                    font-semibold text-sm leading-tight truncate
                    ${isSelected ? "text-primary" : "text-text-secondary"}
                  `}
                >
                  {customer.firstName} {customer.lastName}
                </p>

                <div className="flex flex-col gap-0.5 mt-1">
                  <span className="flex items-center gap-1.5 text-xs text-text-muted">
                    <AiOutlinePhone className="flex-shrink-0 text-text-muted/70" />

                    {customer.phone ? (
                      <a
                        href={`tel:${customer.phone}`}
                        className="tap-target inline-flex items-center hover:text-primary"
                      >
                        {customer.phoneCode ? `${customer.phoneCode}-` : ""}
                        {customer.phone}
                      </a>
                    ) : (
                      <span>{t("customers.noMobile")}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Action Buttons ── */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Edit */}
              <button
                onClick={() => onSelectEditCustomer(customer)}
                title={t("customers.edit")}
                className="tap-target flex items-center justify-center w-8 h-8 rounded-lg
                           text-text-muted bg-transparent border border-transparent
                           hover:text-text-secondary hover:bg-gray-100 hover:border-border-default/50
                           transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <AiOutlineEdit className="text-base" />
              </button>

              {/* Delete */}
              <button
                onClick={() => onDeleteCustomer(customer.localId)}
                title={t("customers.delete")}
                className="tap-target flex items-center justify-center w-8 h-8 rounded-lg
                           text-red-400 bg-transparent border border-transparent
                           hover:text-red-600 hover:bg-red-50 hover:border-red-200
                           transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                <AiOutlineDelete className="text-base" />
              </button>

              {/* Set / Unset customer */}
              <button
                onClick={
                  isSelected
                    ? () => setSelectedCustomer({})
                    : () => {
                        setSelectedCustomer(customer);
                        navigate("/pos/dashboard");
                      }
                }
                title={
                  isSelected ? t("customers.unset") : t("customers.setCurrent")
                }
                className={`
                  tap-target flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold
                  border transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-offset-1
                  whitespace-nowrap
                  ${
                    isSelected
                      ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100 focus:ring-green-300"
                      : "bg-surface border-border-default text-text-secondary hover:bg-gray-50 hover:border-border-default/80 focus:ring-gray-300"
                  }
                `}
              >
                <AiOutlineCheck
                  className={`text-sm flex-shrink-0 ${isSelected ? "text-green-600" : "text-text-muted"}`}
                />
                <span className="hidden sm:inline">
                  {isSelected ? "Selected" : "Select"}
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CustomerList;
