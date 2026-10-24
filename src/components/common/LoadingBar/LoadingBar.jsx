import React from "react";

const LoadingBar = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-[3px] z-[9999] overflow-hidden bg-transparent">
      <style>
        {`
          @keyframes line-flow {
            0% {
              left: -10%;
              width: 5%;
            }
            /* Stretch in the middle */
            50% {
              width: 50%;
            }
            /* Unstretch (shrink) as it hits the end */
            100% {
              left: 100%;
              width: 2%;
            }
          }

          .animate-unstretch {
            /* 3 seconds duration for a much slower, premium feel */
            animation: line-flow 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
          }
        `}
      </style>

      {/* The Animated Bar */}
      <div className="absolute h-full bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] animate-unstretch" />
      
      {/* Background track for better visibility */}
      <div className="absolute top-0 left-0 w-full h-full bg-secondary/5" />
    </div>
  );
};

export default LoadingBar;