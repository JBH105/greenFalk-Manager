import toast from 'react-hot-toast';

/**
 * Compact, non-blocking notifications for the POS.
 *
 * Design notes:
 * - Renders bottom-left so it never covers the cart panel on the right,
 *   nor the floating cart button at bottom-center.
 * - Neutral surface with a coloured rail + icon, instead of a large
 *   saturated block. Reads as a status line, not an alert.
 * - Single pill, ~34px tall. Click anywhere on it to dismiss early.
 * - Repeating the same message replaces the existing toast rather than
 *   stacking a wall of them.
 * - All colours come from the theme tokens in colors.css, so this works
 *   unchanged across light / dark / wood / green / mahogany / maroon.
 */

// Errors and warnings stay a little longer than confirmations.
const DURATION = {
  success: 1800,
  info: 1800,
  warning: 2800,
  error: 2800,
};

const TYPES = {
  success: {
    accent: 'var(--success-main)',
    // check
    path: 'M20 6 9 17l-5-5',
  },
  error: {
    accent: 'var(--error-main)',
    // cross
    path: 'M18 6 6 18M6 6l12 12',
  },
  warning: {
    accent: 'var(--warning-main)',
    // exclamation
    path: 'M12 5v9M12 18.5v.5',
  },
  info: {
    accent: 'var(--info-main)',
    // lowercase i
    path: 'M12 10.5v7M12 6.5v.5',
  },
};

export const useNotification = () => {
  const showNotification = (message, type = 'success', detail) => {
    const { accent, path } = TYPES[type] ?? TYPES.info;
    const duration = DURATION[type] ?? 2000;

    toast.custom(
      (t) => (
        <div
          role="status"
          aria-live="polite"
          onClick={() => toast.dismiss(t.id)}
          title={detail ? `${message} — ${detail}` : message}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            maxWidth: '340px',
            padding: '8px 14px 9px 11px',
            background: 'var(--color-surface, var(--color-white))',
            color: 'var(--color-black)',
            border: '1px solid var(--border-default)',
            borderLeft: `3px solid ${accent}`,
            borderRadius: '8px',
            boxShadow: '0 4px 14px var(--overlay-black-15)',
            overflow: 'hidden',
            cursor: 'pointer',
            userSelect: 'none',
            pointerEvents: 'auto',

            // Enter: rise from below-left. Exit: settle back down and fade.
            opacity: t.visible ? 1 : 0,
            transform: t.visible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 180ms ease-out, transform 180ms ease-out',
          }}
        >
          {/* Status icon */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accent}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
            aria-hidden="true"
          >
            <path d={path} />
          </svg>

          {/* Message — clamped to two lines so a long error can never grow tall */}
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {message}
            {detail ? (
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                {' · '}
                {detail}
              </span>
            ) : null}
          </span>

          {/* Hairline timer along the bottom edge */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              height: '2px',
              background: accent,
              opacity: 0.55,
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      ),
      {
        duration,
        position: 'bottom-left',
        // Same message fired twice replaces itself instead of stacking.
        id: `${type}:${message}`,
      }
    );
  };

  return {
    notifySuccess: (msg, detail) => showNotification(msg, 'success', detail),
    notifyError: (msg, detail) => showNotification(msg, 'error', detail),
    notifyWarning: (msg, detail) => showNotification(msg, 'warning', detail),
    notifyInfo: (msg, detail) => showNotification(msg, 'info', detail),
  };
};
