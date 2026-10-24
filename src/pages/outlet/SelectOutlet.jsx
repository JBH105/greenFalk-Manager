import { useOutletStore } from "../../store/useOutletStore";
import { useT } from "../../i18n";
import { useAuthStore } from "../../store/useAuthStore";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useCartStore } from "../../store/useCartStore";

/**
 * Ambient shapes drifting behind the outlet card.
 *
 * This used to float 12 liquor-brand bottles, which is wrong for a restaurant.
 * Neutral translucent tiles keep the same motion without the branding. To use
 * imagery again, import the files and list them in `images`.
 */
const FLOATING_CONFIG = {
    quantity: 26,
    images: [],
};

/** Returns a random number in [min, max) (or [min, max] if integers). */
function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

/** Shuffles array in place (Fisher–Yates). */
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Builds a shuffled list of image indices so each image is used roughly equally (no one image dominating). */
function buildShuffledImageIndices(quantity, imageCount) {
    const indices = [];
    for (let i = 0; i < quantity; i++) {
        indices.push(i % imageCount);
    }
    return shuffleArray(indices);
}

/** Generates floating item entries with full randomness: positions, size, timing, rotation. Covers entire screen; no predictable pattern. */
function generateFloatingItems({ quantity, images }) {
    if (!quantity) return [];
    const items = [];
    const useImages = Array.isArray(images) && images.length > 0;
    const imageIndices = useImages ? buildShuffledImageIndices(quantity, images.length) : [];

    for (let i = 0; i < quantity; i++) {
        // Full screen: random left/bottom with margin so nothing sits exactly on 0 or edge
        const left = randomBetween(1, 95);
        const bottom = randomBetween(1, 95);
        // Size: random in range for variety
        const size = Math.round(randomBetween(46, 104));
        // Duration & delay: random so no synced wave; no zero delay
        const duration = randomBetween(10, 20);
        const delay = randomBetween(-18, 10);
        const rotate = Math.round(randomBetween(-15, 15));
        const src = useImages ? images[imageIndices[i]] : null;

        items.push({
            type: useImages ? "img" : "box",
            size,
            left: `${left}%`,
            bottom: `${bottom}%`,
            duration,
            delay,
            rotate,
            src,
        });
    }
    return items;
}

const FLOATING_ITEMS_CONFIG = generateFloatingItems(FLOATING_CONFIG);

const FloatingItem = ({ item, index }) => {
    const startRotate = item.rotate ?? 0;
    const endRotate = startRotate + 15;
    const style = {
        left: item.left,
        bottom: item.bottom ?? "0%",
        width: item.size,
        height: item.size,
        // Start at animation "from" state so no diagonal flash on load/reload
        transform: `translateY(100vh) rotate(${startRotate}deg)`,
        opacity: 0.8,
        animation: `float-up ${item.duration}s ease-in-out infinite`,
        animationDelay: `${item.delay}s`,
        ["--start-rotate"]: `${startRotate}deg`,
        ["--end-rotate"]: `${endRotate}deg`,
    };
    return (
        <div
            className="login-float absolute opacity-80 pointer-events-none"
            style={style}
            aria-hidden
        >
            {item.type === "box" ? (
                <div className="w-full h-full bg-surface/40 border border-white/60" />
            ) : (
                <img
                    src={item.src}
                    alt={item.alt ?? ""}
                    className="w-full h-full object-contain rounded-lg"
                />
            )}
        </div>
    );
};

const SelectOutlet = () => {
  const t = useT();
    // The shops this person actually works at, handed over by the sign-in.
    // The store below holds every outlet the company has, which is not the
    // same list — an owner could be shown, and could pick, a shop they have
    // not been given.
    const mine = useAuthStore((s) => s.outletsToChoose);
    const { outlets, hydrate } = useOutletStore();
    const setOutlet = useAuthStore((s) => s.setOutlet);
    const user = useAuthStore((s) => s.user);
    const navigate = useNavigate();
    const resetCart = useCartStore((s) => s.resetCart);
    const userTenantId = user?.tenantId || user?.tenant_id || null;

    const tenantOutlet = mine.length
      ? mine
      : outlets.filter((outlet) => {
          const outletTenantId = outlet.tenantId || outlet.tenant_id;
          return String(outletTenantId) === String(userTenantId);
        });

    useEffect(() => {
        if (!mine.length) hydrate();
    }, [hydrate, mine.length]);


    const handleSelectOutlet = async (outletId, outletName) => {
        await setOutlet(outletId, outletName);   // save to IndexedDB + Zustand
        resetCart(); // Clear any existing cart data on outlet change
        if (user?.role?.name === "cashier" || user?.role?.name === "captain") {
            navigate("/pos/tables");
        } else {
            navigate("/pos/dashboard");
        }
    };

    return (
        <div className="login relative overflow-hidden bg-linear-to-b from-[var(--theme-primary)] to-[var(--theme-primary-light)] min-h-screen flex items-center justify-center">
            {/* Ambient shapes behind the card — see FLOATING_CONFIG to swap in imagery */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                {FLOATING_ITEMS_CONFIG.map((item, index) => (
                    <FloatingItem key={index} item={item} index={index} />
                ))}
            </div>
            <div className="card relative z-10 text-text-secondary bg-surface shadow-lg py-16 px-20">
                <h1 className="mb-10 text-3xl font-bold text-center">
                    {t("outlet.select")}
                </h1>
                <div className="">
                    {tenantOutlet.map((outlet) => (
                        <div
                            key={outlet.id}
                            className="text-sm cursor-pointer border-b border-primary hover:bg-[var(--theme-primary)] hover:text-text-inverted transition-colors"
                            onClick={() => handleSelectOutlet(outlet.id, outlet.outlet_name)}
                        >
                            <p className="p-3">
                                {outlet.outlet_name} - ({outlet.city})
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SelectOutlet;
