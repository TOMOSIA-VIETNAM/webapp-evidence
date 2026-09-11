// Configuration for the native-UI check only, passed with EVIDENCE_CONFIG. Named so the runner's
// own config search cannot find it: see window-capture.config.js for why that matters.
module.exports = {
  defaultApp: 'demo',
  apps: {
    demo: { baseUrl: process.env.BASE_URL },
  },
  recording: {
    capture: 'window',
    captions: { enabled: false, locale: 'en' },
    // Small enough that the window fits on any display the check might run on. DevTools takes
    // its room out of the page area, so there has to be room to give.
    viewport: { width: 800, height: 480 },
    devtools: process.env.DEVTOOLS === '1',
    speed: 'fast',
  },
};
