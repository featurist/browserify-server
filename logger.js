var onFinished = require('on-finished');
var onHeaders = require('on-headers');

module.exports = function(options) {
  var name = typeof options == 'object' && options.hasOwnProperty('name')? options.name: 'http';
  var debug = require('debug')(name);

  return function(req, res, next) {
    var startTime = process.hrtime();
    var duration;
    var method = req.method;
    var url = req.originalUrl;

    onHeaders(res, function () {
      duration = process.hrtime(startTime);
    });

    onFinished(res, function () {
      debug(method + ' ' + url + ' => ' + res.statusCode + ' (' + formatDuration(duration) + ')');
    });

    next();
  };
};

function formatDuration(duration) {
  return Math.round(duration[0] * 1e3 + duration[1] / 1e6) + 'ms';
}
