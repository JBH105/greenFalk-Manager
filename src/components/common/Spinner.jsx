import React from "react";

/**
 * The till is working on it.
 *
 * Drawn in `currentColor` and nothing else, so it takes the colour of whatever
 * it sits inside. The outlet picks one of seven themes and a spinner with a
 * colour of its own would be wrong in six of them.
 *
 * A ring with one quarter missing, rather than three bouncing dots: it reads
 * as one object turning, which is what "wait, this is in hand" looks like. The
 * missing quarter is what makes the turning visible at all.
 *
 * Where somebody has asked their machine to stop animating, it stops — and
 * stays a visible ring rather than vanishing, because the point of it is to
 * say that something is happening.
 */
const Spinner = ({ size = 16, className = "", label = "Working" }) => {
  const thickness = Math.max(2, Math.round(size / 8));

  return (
    <span
      role="status"
      aria-label={label}
      className={`pos-spinner inline-block shrink-0 rounded-full align-[-0.125em] ${className}`}
      style={{
        width: size,
        height: size,
        borderStyle: "solid",
        borderWidth: thickness,
        borderColor: "currentColor",
        borderTopColor: "transparent",
      }}
    />
  );
};

export default Spinner;
