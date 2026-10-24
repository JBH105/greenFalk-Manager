import React, { createContext, useState, useContext } from 'react';

const RetailContext = createContext();

export const RetailProvider = ({ children }) => {
  // This is your global boolean variable
  const [isRetail, setIsRetail] = useState(false);
  const [isRetailOpen, setIsRetailOpen] = useState(false);

  return (
    <RetailContext.Provider value={{ isRetail, setIsRetail, isRetailOpen, setIsRetailOpen }}>
      {children}
    </RetailContext.Provider>
  );
};

// Custom hook for easy access
export const useRetail = () => useContext(RetailContext);