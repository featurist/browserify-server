var fs = require('fs-promise');
var spawn = require('./spawn');
var debug = require('debug')('browserify-server:bundle');

function index(modules) {
  return 'module.exports = {' +
    modules.moduleVersions.map(function (moduleVersion) {
      return JSON.stringify(moduleVersion.name) + ': require("' + moduleVersion.name + '")';
    }).join(',') +
    '};'
}

function writeIndex(modules, dir) {
  return fs.writeFile(dir + '/index.js', index(modules));
}

function argsFilename(modules, options) {
  var args = ['index.js'];

  var out = 'bundle';

  if (options) {
    if (options.debug) {
      args.push('-d');
      out += '-debug';
    }

    if (options.require) {
      modules.moduleVersions.forEach(function (moduleVersion) {
        args.push('-r', moduleVersion.name);
      });
      out += '-require';
    }
  }

  var filename = out + '.js';
  args.push('-o', filename);

  return {
    args: args,
    filename: filename
  };
}

function exists(filename) {
  return fs.exists(filename);
}

module.exports = function (modules, dir, options) {
  return writeIndex(modules, dir).then(function () {
    var argfn = argsFilename(modules, options);
    var filename = dir + '/' + argfn.filename;

    return exists(filename).then(function (bundleExists) {
      if (!bundleExists) {
        debug('not exists:', filename);
        return spawn('browserify', argfn.args, {cwd: dir}).then(function () {
          return filename;
        });
      } else {
        debug('exists:', filename);
        return filename;
      }
    });
  });
};
