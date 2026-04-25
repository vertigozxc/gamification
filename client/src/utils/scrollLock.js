// Ref-counted body / html scroll lock.
//
// Multiple components can call lockBodyScroll independently — the
// actual `overflow: hidden` is only applied on the FIRST lock and
// only released when the LAST holder unlocks. The originally-saved
// overflow values are preserved across the entire lock window.
//
// Why: components that each saved + restored their own
// `prev = body.style.overflow` would step on each other when
// stacked (AnimatedOnboardingTour + OnboardingModal at login,
// for example). The second-to-mount component saved "hidden"
// (set by the first) and on its own unmount restored to "hidden",
// leaving the document scroll locked even though no component
// still wanted it locked. Reproduced as: skip the onboarding
// tour, then finish the setup modal → page scroll dead until
// reload.
//
// Other inline styles (position:fixed, top, width) used by the
// onboarding modal for iOS keyboard handling are NOT covered here
// — they're unique to that one surface and can stay where they
// are. This helper deals only with the shared overflow lock.

let lockCount = 0;
let savedBodyOverflow = "";
let savedHtmlOverflow = "";

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    savedBodyOverflow = document.body.style.overflow || "";
    savedHtmlOverflow = document.documentElement.style.overflow || "";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  lockCount += 1;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overflow = savedHtmlOverflow;
  }
}
