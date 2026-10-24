import { useSyncExternalStore } from "react";
import { getFeatures, onFeaturesChanged } from "../utils/features";

/**
 * What this outlet may do, as a screen can watch it.
 *
 * getFeatures reads storage, and storage does not tell anybody when it
 * changes. A screen that called it during render would show whatever was true
 * when it last happened to re-render — so a switch turned on at head office
 * reached a till that had been sitting on the same screen all evening only
 * when something else made it redraw.
 *
 * Kept as one shared object so the comparison React does is cheap and stable:
 * a fresh object every read would be a new answer every time and redraw the
 * screen for ever.
 */

let current = null;
let currentText = "";

/**
 * The same object back every time, until the answer genuinely changes.
 *
 * React compares snapshots by identity, so handing back a fresh object on
 * every read would redraw the screen for ever. But a cache that is only ever
 * refreshed when a watcher fires goes stale whenever nothing is watching —
 * between one screen unmounting and the next mounting, a change would be
 * written to storage with nobody listening, and the new screen would open on
 * the old answer.
 *
 * So the real answer is read each time and compared. Reading it is one small
 * value out of storage; being wrong about what a shop may do is a screen
 * showing a button its outlet does not have.
 */
const snapshot = () => {
  const fresh = getFeatures();
  const text = JSON.stringify(fresh);

  if (text !== currentText) {
    current = fresh;
    currentText = text;
  }

  return current;
};

const subscribe = (notify) => onFeaturesChanged(notify);

export const useFeatures = () => useSyncExternalStore(subscribe, snapshot, snapshot);

export default useFeatures;
