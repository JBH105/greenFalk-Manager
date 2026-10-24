import { Outlet } from "react-router-dom";
import SideHeader from "./SideHeader";
import LogoutPopUp from "./LogoutPopUp";
import { useState } from "react";
import { useResponsive } from "../../context/ResponsiveContext";

export default function PosLayout() {
  const [isLogoutClicked, setIsLogoutClicked] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isMobile, isTablet, screenWidth } = useResponsive();

  // Decide responsive sidebar behavior: original used < 900
  const isCompact = isMobile || screenWidth < 900;

  return (
    <div className="pos-shell flex h-screen overflow-hidden">
      {/* Sidebar – fixed, width changes */}
      <SideHeader
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        setIsLogoutClicked={setIsLogoutClicked}
      />

      {/* Main content area – shifts right when sidebar is open */}
      <div
        className={`
    flex flex-col flex-1 min-w-0 transition-all duration-400 ease-in-out
    ${isCompact ? "ml-0 pos-bar-gap" : isSidebarOpen ? "md:ml-[192px]" : "md:ml-[80px]"}
  `}
      >
        {/* The cream at full strength. It was at four tenths, which on a
            white page underneath came out as almost-white — the whole point
            of the cream is that the white cards on it have an edge without
            needing a shadow to find one. */}
        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>

      {isLogoutClicked && (
        <LogoutPopUp setIsLogoutClicked={setIsLogoutClicked} />
      )}
    </div>
  );
}
