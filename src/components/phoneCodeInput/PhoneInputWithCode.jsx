import React from "react";
import { useT } from "../../i18n";
import Select from "react-select";
import { countriesList } from "../../store/countryStore";

const PhoneInputWithCode = ({ formData, setFormData, onPhoneChange }) => {
  const t = useT();
  const countryCodeOptions = countriesList.map((country) => ({
    label: `${country.name}`,
    value: country.code,
  }));

  return (
    <div className="flex gap-4">
      {/* Country Code */}
      <div className="code w-1/4 flex flex-col">
        <label className="text-text-secondary text-sm font-semibold mb-[5px]">
          {t("phone.code")} <span className="text-red-600">*</span>
        </label>

        <Select
          placeholder={t("phone.code")}
          options={countryCodeOptions}
          value={formData.phoneCode}
          onChange={(option) =>
            setFormData((prev) => ({ ...prev, phoneCode: option }))
          }
          isClearable={false}
          components={{
            IndicatorSeparator: () => null,
          }}
          formatOptionLabel={
            (option, { context }) =>
              context === "menu"
                ? `${option.label} ${option.value}` // dropdown
                : option.value // selected
          }
          styles={{
            control: (provided) => ({
              ...provided,
              fontSize: "14px",
              height: "36px",
              marginTop: "2px",
              color: "var(--text-secondary)",
              borderRadius: "6px",
              border: "none",
              outline: "1px",
              "&:focus, &:focus-within": {
                outlineWidth: "2px",
                outlineColor: "var(--color-primary)",
              },
              padding: "0px",
              backgroundColor: "var(--bg-main)",
              boxShadow: "0 0 3px var(--shadow-soft-hex)",
            }),
            singleValue: (provided) => ({
              ...provided,
              fontWeight: "500",
              color: "var(--text-secondary)",
            }),
            menu: (provided) => ({
              ...provided,
              width: "15rem",
              fontWeight: "600", // ⬅ dropdown width
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
              padding: "0",
            }),
            option: (provided, state) => ({
              ...provided,
              backgroundColor: state.isFocused
                ? "var(--color-secondary)"
                : state.isSelected
                  ? "var(--color-secondary)"
                  : "white",
              color: state.isFocused || state.isSelected ? "white" : "black",
              "&:hover": {
                backgroundColor: "var(--color-secondary)",
                color: "white",
              },
            }),
          }}
        />
      </div>

      {/* Phone Number */}
      <div className="w-3/4">
        <div className="first-name flex flex-col w-full">
          <label className="text-text-secondary text-sm font-semibold">
            {t("phone.number")} <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={onPhoneChange}
            placeholder={t("phone.enterNumber")}
            className="p-2 border-0 border-border-default rounded-md bg-background outline-none placeholder:text-text-muted mt-2 shadow-[0_0_3px_var(--shadow-soft-hex)] focus:outline-primary text-sm "
          />
        </div>
      </div>
    </div>
  );
};

export default PhoneInputWithCode;
