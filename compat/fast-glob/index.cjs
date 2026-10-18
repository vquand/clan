// oxlint-disable-next-line typescript/no-require-imports -- Upstream consumers require CommonJS.
const tinyglobby = require('tinyglobby');

function globOptions(options) {
  return {
    ...options,
    // fast-glob does not expand bare directories and counts the root as level 1.
    expandDirectories: false,
    ...(options.deep === undefined
      ? {}
      : { deep: Math.max(0, options.deep - 1) }),
  };
}

async function fastGlob(patterns, options = {}) {
  return tinyglobby.glob(patterns, globOptions(options));
}

fastGlob.sync = (patterns, options = {}) =>
  tinyglobby.globSync(patterns, globOptions(options));
fastGlob.glob = fastGlob;
fastGlob.globSync = fastGlob.sync;

module.exports = fastGlob;
