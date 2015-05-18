module.exports = function () {
  return 'browserify-server-test-peer-dep';
};

module.exports.peerDependency = require('browserify-server-test');
