// The configuration behind the recording in the README.
//
// The page-content recorder writes the video at the size of the viewport, so the viewport is what
// sets the resolution of the take. Full HD, because the gif in the README is built by scaling this
// down: scaling down keeps text sharp, and a browser scaling a narrow gif UP is what makes a
// recording look soft.
//
// crf 18 rather than the runner's default 26: the page is flat colour and large type, and h264
// ringing around headings is the first artefact to show on that kind of screen.
module.exports = {
  defaultApp: 'site',

  recording: {
    locale: 'en-US',
    viewport: { width: 1920, height: 1080 },
    video: { crf: 18, preset: 'slow' },
    speed: 'normal',
  },

  output: {
    overwrite: false,
  },

  apps: {
    site: {
      baseUrl: 'https://open-pr.vercel.app',
    },
  },
};
