var spawn = require('child_process').spawn;
var debug = require('debug')('browserify-server:spawn');
var shellQuote = require('shell-quote');

module.exports = function () {
  var args = Array.prototype.slice.apply(arguments);

  var error = [];

  return new Promise(function (fulfil, reject) {
    var shellCommand = shellQuote.quote([args[0]].concat(args[1]));
    debug(shellCommand);
    var ps = spawn.apply(undefined, args);
    ps.on('error', reject);
    ps.stdout.setEncoding('utf-8');
    ps.stdout.on('data', debug);
    ps.stderr.setEncoding('utf-8');
    ps.stderr.on('data', function (data) {
      error.push(data);
      debug(data);
    });
    ps.on('exit', function (code) {
      if (code == 0) {
        fulfil();
      } else {
        reject(new Error(error.join('')));
      }
    });
  });
}
