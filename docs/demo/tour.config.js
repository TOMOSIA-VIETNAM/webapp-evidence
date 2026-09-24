// The configuration behind the recording the README and the site show.
//
// Not named evidence.config.js on purpose: the runner discovers that name by scanning the
// repository, and every other recording made here — the end-to-end check first — would pick this one
// up. docs/demo/record.sh passes it by path.
//
// The runner writes the video at the size of the viewport, so the viewport sets the resolution of
// the take. Full HD, because the web copy is made by scaling it down, and scaling down keeps text
// sharp. crf 18: the page is flat colour and large type, where h264 ringing shows first.
//
// The base URL is the local preview docs/demo/record.sh starts; BASE_URL points a run at a deployment.
module.exports = {
  defaultApp: 'site',

  recording: {
    locale: 'en-US',
    viewport: { width: 1920, height: 1080 },
    video: { crf: 18, preset: 'slow' },
    speed: 'normal',
  },

  output: {
    overwrite: true,
  },

  apps: {
    site: {
      baseUrl: 'http://localhost:4321',
    },
  },
};
