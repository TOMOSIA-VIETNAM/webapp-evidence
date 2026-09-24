// The configuration behind the recording this site shows of itself.
//
// The runner writes the video at the size of the viewport, so the viewport sets the resolution of
// the take. Full HD, because the web copy is made by scaling it down, and scaling down keeps text
// sharp. crf 18: the page is flat colour and large type, where h264 ringing shows first.
//
// The base URL is the local preview demo/record.sh starts; BASE_URL points a run at a deployment.
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
