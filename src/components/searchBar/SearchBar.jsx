import React from "react";

/**
 * The search box that sits above every list.
 *
 * The count of what was found used to have a row of its own underneath, so a
 * screen gave up a whole band of height to say "22 Results" — on a phone that
 * is a row of customers lost. It sits inside the field now, at the end, where
 * it reads as part of the search rather than as a separate announcement.
 */
const SearchBar = ({
  value,
  onChange,
  placeholder = "Search...",
  resultCount = 0,
}) => {
  const found = `${resultCount} ${resultCount === 1 ? "result" : "results"}`;

  return (
    <div className="flex flex-col gap-2 w-full max-w-full">
      <div className="relative w-full mt-2">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          /* Room on the right for the count, and a little more of it once the
             number grows, so a four-figure list never runs under the text. */
          className="w-full h-[40px] py-2 pl-9 pr-[92px] bg-surface border border-border-default rounded-lg shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-text-muted text-sm"
        />

        <span
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none select-none
                     rounded-full bg-primary/8 px-2.5 py-[3px] text-[12px] font-semibold
                     text-text-muted whitespace-nowrap tabular-nums"
          title={found}
        >
          {found}
        </span>
      </div>
    </div>
  );
};

export default SearchBar;
