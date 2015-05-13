var spawn = require('child_process').spawn;
var debug = require('debug')('browserify-server:spawn');
var shellQuote = require('shell-quote');

module.exports = function (cmd, args, options) {
  var stream;

  if (options && options.stream) {
    stream = options.stream;
    delete options.stream;
  }

  var error = [];

  return new Promise(function (fulfil, reject) {
    var shellCommand = shellQuote.quote([cmd].concat(args));
    debug(shellCommand);
    var ps = spawn(cmd, args, options);
    ps.on('error', reject);

    if (stream) {
      ps.stdout.pipe(stream, {end: false});
    } else {
      ps.stdout.setEncoding('utf-8');
      ps.stdout.on('data', debug);
    }

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
