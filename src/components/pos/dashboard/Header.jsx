import React, { useState, useEffect } from "react";
import { useT } from "../../../i18n";
import brandLogo from "../../../assets/images/greenfalk-logo.png";
import fullScreenIcon from "../../../assets/icons/full-screen.svg";
import exitFullScreenIcon from "../../../assets/icons/close-full-screen.svg";
import speakerIcon from "../../../assets/icons/speaker.svg";
import muteIcon from "../../../assets/icons/mute.svg";
import { useRetail } from "../../../hooks/useRetail";
import { useAuthStore } from "../../../store/useAuthStore";
import { useNotification } from "../../../hooks/useNotification";
import Select from 'react-select';
import { commonSelectStyles } from "../../common/select/selectStyle";

/* --- Helper for underlining shortcut letters --- */
const ShortcutLabel = ({ text, char }) => {
  const index = text.toLowerCase().indexOf(char.toLowerCase());
  if (index === -1) return <span>{text}</span>;
  return (
    <span>
      {text.substring(0, index)}
      <span className="underline decoration-1 underline-offset-2">{text[index]}</span>
      {text.substring(index + 1)}
    </span>
  );
};

const Header = ({ filters, setFilters, productListLength, mute, setMute, isPettyClicked, setIsPettyClicked }) => {
  const t = useT();

  const { setIsRetail, setIsRetailOpen } = useRetail();
  const { notifyError, notifySuccess } = useNotification();
  const [isFullScreen, setIsFullScreen] = useState(
    !!document.fullscreenElement
  );
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const handleFullscreenChange = () => {
      // Check if there is currently an element in fullscreen
      setIsFullScreen(!!document.fullscreenElement);
    };

    // Listen for the change event
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Clean up the listener when the component unmounts
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Ignore if user is typing in an input, textarea, or a select dropdown
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // P for Petty Cash
      if (key === "p") {
        e.preventDefault();
        if (user?.role?.name !== "captain") {
          setIsPettyClicked(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filters.category, setIsPettyClicked]);

  return (
    <div className="header">
      {/* The categories used to sit here, above the search box. They are a
          column down the left of the menu now — see CategoryRail. */}
      <div className="flex justify-between pl-2 items-center search-button-group gap-4 w-full">
        <div className="search-button-group flex gap-2 items-center w-full">
          <div className="search relative flex items-center flex-1 w-full min-w-0">
            <svg
              className="absolute left-3 top-3.5 w-4 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder={t("menu.search")}
              /* Set into the page rather than sitting on it: the inner
                 shadow at the top reads as a recess, which is the opposite
                 of the raised keys beside it. A till should look like
                 things you press and things you type into, and the two
                 should not look the same. */
              className="pos-inset p-2.5 pl-10 w-full rounded-[9px] outline-0 cursor-text text-[14px] placeholder:text-[13px] placeholder:text-text-muted/70"
              value={filters.product ?? ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  product: e.target.value,
                }))
              }
            />
          </div>
          <div className="button-group flex gap-2">
            {/* <div onClick={() => setIsPettyClicked(true)} className="reset-icons border border-border-default rounded-md bg-surface text-text-secondary cursor-pointer ">
              <p className="text-xl py-1.5 px-3.5"><ShortcutLabel text="P" char="p" /></p>
            </div>
            <div
              onClick={toggleFullscreen}
              className="full-screen-icons p-2 border border-border-default rounded-md bg-surface text-text-secondary cursor-pointer"
            >
              <img
                src={isFullScreen ? exitFullScreenIcon : fullScreenIcon}
                alt={t("common.fullScreen")}
              />
            </div> */}
            <div
              onClick={() => setMute(!mute)}
              className="reset-icons p-2 border border-border-default rounded-md bg-surface text-text-secondary cursor-pointer"
            >
              <img src={mute ? muteIcon : speakerIcon} alt={t("common.speaker")} />
            </div>
            {/* <div className="cart-icons text-text-secondary px-1.75 flex items-center border border-border-default rounded-md bg-surface cursor-pointer" onClick={() => { setIsRetail(true); setIsRetailOpen(true) }}>
              <svg
                viewBox="0 0 1024 1024"
                focusable="false"
                data-icon="shopping-cart"
                width="26"
                height="26"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M120 160H72c-4.4 0-8 3.6-8 8v688c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V168c0-4.4-3.6-8-8-8zm833 0h-48c-4.4 0-8 3.6-8 8v688c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V168c0-4.4-3.6-8-8-8zM200 736h112c4.4 0 8-3.6 8-8V168c0-4.4-3.6-8-8-8H200c-4.4 0-8 3.6-8 8v560c0 4.4 3.6 8 8 8zm321 0h48c4.4 0 8-3.6 8-8V168c0-4.4-3.6-8-8-8h-48c-4.4 0-8 3.6-8 8v560c0 4.4 3.6 8 8 8zm126 0h178c4.4 0 8-3.6 8-8V168c0-4.4-3.6-8-8-8H647c-4.4 0-8 3.6-8 8v560c0 4.4 3.6 8 8 8zm-255 0h48c4.4 0 8-3.6 8-8V168c0-4.4-3.6-8-8-8h-48c-4.4 0-8 3.6-8 8v560c0 4.4 3.6 8 8 8zm-79 64H201c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h112c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zm257 0h-48c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zm256 0H648c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h178c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zm-385 0h-48c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8z"></path>
              </svg>
            </div> */}
          </div>
        </div>
        <div className="product-length w-20">
          <h2 className="text-sm">{t("menu.results", { count: productListLength })}</h2>
        </div>
      </div>
    </div>
  );
};

export default Header;
