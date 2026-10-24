export const commonSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    borderRadius: "4px",
    border: state.isFocused 
      ? "2px solid var(--color-primary)" 
      : "2px solid var(--border-muted)",
    boxShadow: "none",
    "&:hover": {
      border: "2px solid var(--color-primary)",
    },
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected ? "var(--color-secondary)" : state.isFocused ? "var(--color-hover-color)" : "white",
    color: (state.isSelected || state.isFocused) ? "white" : "black",
    "&:hover": {
      backgroundColor: "var(--color-hover-color)",
      color: "white",
    },
  }),
};
