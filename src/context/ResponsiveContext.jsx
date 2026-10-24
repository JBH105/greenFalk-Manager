import React, { createContext, useContext, useState, useEffect } from 'react';

const ResponsiveContext = createContext();

export const ResponsiveProvider = ({ children }) => {
  const breakpoints = {
    mobile: 768,
    tablet: 1024,
    desktop: 1440,
  };

  const getScreenState = () => {
    const width = window.innerWidth;
    return {
      screenWidth: width,
      isMobile: width < breakpoints.mobile,
      isTablet: width >= breakpoints.mobile && width < breakpoints.tablet,
      isDesktop: width >= breakpoints.tablet,
      isSmallDesktop: width >= breakpoints.tablet && width < breakpoints.desktop,
      isLargeDesktop: width >= breakpoints.desktop,
      breakpoints
    };
  };

  const [screenState, setScreenState] = useState(getScreenState());

  useEffect(() => {
    const handleResize = () => setScreenState(getScreenState());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <ResponsiveContext.Provider value={screenState}>
      {children}
    </ResponsiveContext.Provider>
  );
};

export const useResponsive = () => {
  const context = useContext(ResponsiveContext);
  if (context === undefined) {
    throw new Error('useResponsive must be used within a ResponsiveProvider');
  }
  return context;
};
