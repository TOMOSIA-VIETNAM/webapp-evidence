// The runner's one npm dependency, held to the version package.json pins. Without an install next
// to this file, Node keeps looking — parent directories, NODE_PATH — and can pick up another tool's
// copy. A different version does not fail: the take succeeds and every video has a gray band along
// its bottom. So anything but the pinned version stops the run here, before a browser opens.
const path = require('path');

const PINNED = require('./package.json').dependencies['playwright-core'];

let manifest = null;
try {
  manifest = require.resolve('playwright-core/package.json');
} catch {
  // Not installed anywhere Node looks; reported below with the mismatch
}
const found = manifest && require(manifest).version;

if (found !== PINNED) {
  throw new Error(
    (found
      ? `playwright-core ${found} was loaded from ${path.dirname(manifest)}, but the runner is pinned to ${PINNED}.\n` +
        'A different version records without an error and leaves a gray band along the bottom of every video.\n'
      : `playwright-core is not installed; the runner is pinned to ${PINNED}.\n`) +
    `It belongs in ${path.join(__dirname, 'node_modules')}.`
  );
}

module.exports = require('playwright-core');
