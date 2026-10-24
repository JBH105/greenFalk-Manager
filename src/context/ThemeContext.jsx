import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

/**
 * The theme picker was taken off the POS: outlets ship on the brand theme.
 *
 * The provider is kept so the rest of the app keeps working, but it now pins
 * the default theme and clears any theme a till had saved earlier — otherwise
 * a machine left on "green" would have no way back. The alternate palettes are
 * still in colors.css if the picker is ever wanted again.
 */
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("default");

  useEffect(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem("app-theme");
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
