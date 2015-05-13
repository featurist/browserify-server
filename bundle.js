var fs = require('fs-promise');
var spawn = require('./spawn');
var debug = require('debug')('browserify-server:bundle');

function index(modules) {
  return 'module.exports = {modules:{' +
    modules.moduleVersions.map(function (moduleVersion) {
      return JSON.stringify(moduleVersion.name) + ': require("' + moduleVersion.name + '")';
    }).join(',') +
    '},versions:' + JSON.stringify(modules.dependencies()) + '};';
}

function writeIndex(modules, dir) {
  return fs.writeFile(dir + '/index.js', index(modules));
}

function argsFilename(modules, options) {
  var args = [];

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
    } else {
      args.push('index.js');
      args.push('-s', 'bundle');
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
  var argfn = argsFilename(modules, options);
  var filename = dir + '/' + argfn.filename;

  function buildBundle() {
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
  }

  if (options && options.debug) {
    return buildBundle();
  } else {
    return writeIndex(modules, dir).then(buildBundle);
  }
};
