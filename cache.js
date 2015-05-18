var debug = require('debug')('browserify-server:cache');

module.exports = function() {
  var cache = {};

  return {
    cacheBy: function(key, block) {
      var value = cache[key];

      if (!value) {
        debug('cache miss: ', key);
        return cache[key] = block();
      } else {
        debug('cache hit: ', key);
        return value;
      }
    },

    add: function (key, value) {
      cache[key] = value;
    },

    onceBy: function(key, block) {
      var value = cache[key];

      if (!value) {
        cache[key] = true;
        return block();
      }
    },

    clear: function() {
      cache = {};
    }
  };
};
