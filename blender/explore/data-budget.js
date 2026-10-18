// One rule for everything in the Inn that downloads a lot (panoramas, the door film, sound): adapt quietly, never warn.
// navigator.connection only exists in Chromium browsers (not iOS Safari), so iPhones always take the normal path,
// which is already phone-sized.
//
//   saveData: the visitor turned on Data Saver, or the browser rates the connection 2G. Take the smallest of everything:
//             panoramas stay at the 2048 preview, no door film (the picture fades into the hall), nothing optional preloaded.
//   slowLink: saveData, or a 3G-rated connection. Skip anything the visitor would have to wait for in the foreground
//             (the door film: ~1.4 MB is ~16 s at 3G). Background loads that follow a visible preview are fine.
const c = navigator.connection;
export const saveData = c?.saveData === true || ['slow-2g', '2g'].includes(c?.effectiveType);
export const slowLink = saveData || c?.effectiveType === '3g';
