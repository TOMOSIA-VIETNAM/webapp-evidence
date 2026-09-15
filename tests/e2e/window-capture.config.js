// Configuration for the window-capture check only, passed with EVIDENCE_CONFIG.
//
// Deliberately not called evidence.config.js: the other end-to-end check records with no config
// at all, which is the path someone outside a codebase takes, and the runner scans a few levels
// down for that filename when nothing else turns up. A file with this name cannot be found that
// way, so the two checks stay independent.
module.exports = {
  defaultApp: 'demo',
  apps: {
    demo: { baseUrl: process.env.BASE_URL },
  },
  recording: {
    capture: 'window',
    captions: { enabled: false, locale: 'en' },
    // Small enough that the window — this plus the browser's own chrome — fits on any display
    // the check might run on. The frame being recorded is the window, and a window hanging off
    // the bottom of the screen would be recorded clipped.
    viewport: { width: 900, height: 600 },
    speed: 'fast',
  },
};
