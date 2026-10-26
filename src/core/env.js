// environment flags read across the app
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const lowPower = matchMedia('(pointer: coarse)').matches;
// set every frame by the loop: true while a ripple or a time-of-day change is animating
export const busy = { anim: false };
