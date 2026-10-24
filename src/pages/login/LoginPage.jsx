import React, { useEffect, useState } from "react";
import { useT } from "../../i18n";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import logoImage from "../../assets/images/greenfalk-logo.png";
import { useCartStore } from "../../store/useCartStore";
import { FaEye, FaEyeSlash, FaUtensils, FaDesktop } from "react-icons/fa";
import { homeForRole } from "../../utils/homeForRole";

const LoginPage = () => {
  const t = useT();

  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /**
   * Set when the account is already open on another screen: holds that
   * screen's name, and puts the question up. Null the rest of the time.
   */
  const [askTakeOver, setAskTakeOver] = useState(null);
  const navigate = useNavigate();
  const loginWithCredentials = useAuthStore((s) => s.loginWithCredentials);
  const resetCart = useCartStore((s) => s.resetCart);

  /**
   * Already signed in on this device? Then go straight to work.
   *
   * The session has survived on this device all along — what did not was
   * this screen stepping aside. The till was closed at the end of service
   * and opened at the start of the next one on "/", which is this page, and
   * it asked for a password it already had the answer to.
   *
   * The app holds the whole screen until the saved session has been read,
   * so by the time this runs the answer is known and there is no flicker of
   * a login form on the way past.
   */
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const whoIsOnShift = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!signedIn || !whoIsOnShift) return;
    navigate(homeForRole(whoIsOnShift?.role?.name), { replace: true });
  }, [signedIn, whoIsOnShift, navigate]);

  /**
   * @param takeOver the person has been asked about the screen this account
   *        is already open on and has said to sign in here anyway.
   */
  const signIn = async (takeOver = false) => {
    setError("");
    setLoading(true);

    if (!credentials.username || !credentials.password) {
      setError(t("login.bothFields"));
      setLoading(false);
      return;
    }

    try {
      const user = await loginWithCredentials(credentials, { takeOver });
      setAskTakeOver(null);
      const role = user?.role?.name;
      console.log("User role:", role);
      // Navigate to POS dashboard on success

      // A fresh sign-in starts with an empty cart; whatever was in it
      // belonged to whoever was on the previous shift.
      if (role === "cashier" || role === "captain") resetCart();

      // An owner of several shops is signed in but standing in none of them.
      // Nothing on the till means anything until they say which, so that is
      // the next screen rather than a menu for a shop nobody has picked.
      if (user?.needsOutlet) {
        navigate("/select-outlet", { replace: true });
        return;
      }

      navigate(homeForRole(role), { replace: true });
    } catch (err) {
      /**
       * Being open on another screen is a question, not a failure - the
       * password was right, and only the person holding this tablet knows
       * whether the other screen still matters.
       *
       * Asked once only: if the take-over itself comes back refused, that
       * is a real error and shows as one.
       */
      if (!takeOver && err?.response?.data?.errorCode === "already_signed_in") {
        setAskTakeOver(err?.response?.data?.signedInOn || "another device");
        setLoading(false);
        return;
      }

      setAskTakeOver(null);
      // "Login failed. Please try again." was wrong for every refusal that
      // trying again cannot fix. Whatever the server says is more use than
      // anything made up here.
      setError(
        err?.response?.data?.message ||
          err?.message ||
          t("login.failed")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    signIn();
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value,
    });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login relative overflow-hidden bg-gradient-to-br from-[#f8faf7] via-[#eef3ef] to-[#dfeae4] min-h-screen flex items-center justify-center">
      {/* Decorative restaurant-themed background elements */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.03]">
        <FaUtensils className="w-[800px] h-[800px] text-primary transform -rotate-12" />
      </div>
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-secondary to-primary z-10" />

      <div className="card relative z-10 bg-surface shadow-lg py-7 px-10 rounded-4xl w-[415px] transform transition-all duration-300 hover:shadow-2xl">
        <h1 className="text-2xl font-semibold mb-5 text-center">
          {t("login.welcome")}
        </h1>
        {/**
         * The lockup, on a plate of its own.
         *
         * The wordmark is gold throughout, and gold on white is the weakest
         * pairing in this palette — on the white card it came out looking
         * washed out and faintly cheap, which is the opposite of what gold
         * is for. On the brand's own dark emerald it does what it was drawn
         * to do.
         */}
        <div className="gf-brand-plate mb-6 flex justify-center px-7 py-5">
          <img
            src={logoImage}
            alt="GreenFalk"
            className="w-full max-w-[230px] object-contain"
          />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 justify-center items-center font-semibold"
          autoComplete="off"
        >
          <div className="username flex flex-col w-full">
            <label className="text-sm font-medium text-text-secondary mb-1 text-left w-full">
              {t("login.usernameOrEmail")}
            </label>
            <input
              type="text"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              autoFocus
              disabled={loading}
              autoComplete="off"
              className="border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 p-2 rounded-xl text-text-primary w-full outline-none transition-all duration-200 disabled:opacity-50"
              placeholder={t("login.enterUsername")}
            />
          </div>

          <div className="password flex flex-col w-full">
            <label className="text-sm font-medium text-text-secondary mb-1 text-left w-full">
              {t("login.password")}
            </label>
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={credentials.password}
                onChange={handleChange}
                disabled={loading}
                autoComplete="off"
                className="border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 p-2 rounded-xl text-text-primary w-full outline-none transition-all duration-200 disabled:opacity-50 pr-12"
                placeholder={t("login.enterPassword")}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                className="tap-target absolute right-1 top-1/2 flex -translate-y-1/2 transform items-center justify-center text-gray-500 hover:text-primary transition-colors duration-200 focus:outline-none"
                disabled={loading}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center w-full bg-red-50 p-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] hover:from-primary/90 hover:to-secondary/90 text-text-inverted p-2 rounded-xl transition-all duration-200 w-full font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {t("login.loggingIn")}
              </div>
            ) : (
              t("login.logIn")
            )}
          </button>
        </form>

        <div className="text-center mt-4 text-sm font-medium text-text-secondary">
          {t("login.thanks")}
        </div>
      </div>

      {/* Open on another screen: the person decides which one gives way.
          Buttons are full-width and tall because this is answered with a
          thumb on a tablet, often in a hurry. */}
      {askTakeOver && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-[420px] rounded-2xl bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--secondary-alpha-13)]">
                <FaDesktop className="h-5 w-5 text-[var(--theme-secondary-dark)]" />
              </span>
              <h2 className="text-lg font-bold text-text-primary">
                {t("login.alreadySignedIn")}
              </h2>
            </div>

            <p className="mb-1 text-sm text-text-secondary">
              {t("login.signedInOn")}{" "}
              <span className="font-semibold text-text-primary">
                {askTakeOver}
              </span>
              . {t("login.logInHereInstead")}
            </p>
            <p className="mb-5 text-sm text-text-muted">
              {t("login.otherDeviceOut")}
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={() => setAskTakeOver(null)}
                className="tap-target rounded-xl border border-border-default bg-surface px-6 py-3 font-semibold text-text-secondary disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => signIn(true)}
                className="tap-target rounded-xl bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] px-6 py-3 font-semibold text-text-inverted shadow-md disabled:opacity-50"
              >
                {loading ? t("login.loggingIn") : t("login.logInHere")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Removed floating items animation CSS */}
    </div>
  );
};

export default LoginPage;