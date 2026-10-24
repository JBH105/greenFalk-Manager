/**
 * A name for the screen this till is running on.
 *
 * It exists for one message: when someone is refused because their account is
 * open elsewhere, "already signed in on another device" sends them hunting,
 * and "already signed in on Chrome on Windows" tells them which screen to go
 * and close. That is the whole job - it is never used to decide anything.
 */
export const describeThisDevice = () => {
  if (typeof navigator === "undefined") return null;

  const agent = navigator.userAgent || "";

  // Order matters: Edge and Opera both claim to be Chrome, and Chrome claims
  // to be Safari, so the impostors have to be ruled out first.
  const browser =
    /Edg\//.test(agent) ? "Edge" :
    /OPR\//.test(agent) ? "Opera" :
    /Chrome\//.test(agent) ? "Chrome" :
    /Firefox\//.test(agent) ? "Firefox" :
    /Safari\//.test(agent) ? "Safari" :
    null;

  const platform =
    /Android/.test(agent) ? "Android" :
    /iPhone|iPad|iPod/.test(agent) ? "iPad" :
    /Windows/.test(agent) ? "Windows" :
    /Mac OS X/.test(agent) ? "Mac" :
    /Linux/.test(agent) ? "Linux" :
    null;

  if (browser && platform) return browser + " on " + platform;
  return browser || platform || null;
};
