// environment flags read across the app
// (outside a browser, e.g. in tests, there is no matchMedia: full motion, full detail)
const media = q => typeof matchMedia === 'function' && matchMedia(q).matches;
export const reduceMotion = media('(prefers-reduced-motion: reduce)');
export const lowPower = media('(pointer: coarse)');
// set every frame by the loop: true while a ripple or a time-of-day change is animating
export const busy = { anim: false };
