var fs = require('fs-promise');
var spawn = require('./spawn');
var debug = require('debug')('browserify-server:bundle');
var cache = require('./cache');
var rimrafCb = require('rimraf');
var promisify = require('./promisify');
var pathUtils = require('path');

function rimraf(dir) {
  return promisify(function (cb) {
    rimrafCb(dir, cb);
  });
}

var bundleCache = cache();

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

  if (options) {
    if (options.debug) {
      args.push('-d');
    }

    if (options.require) {
      modules.moduleVersions.forEach(function (moduleVersion) {
        args.push('-r', moduleVersion.name);
      });
    } else {
      args.push('index.js');
      args.push('-s', 'bundle');
    }
  }

  var filename = bundleFilename(options);
  args.push('-o', filename);

  return {
    args: args,
    filename: filename
  };
}

function exists(filename) {
  return fs.exists(filename);
}

function bundleFilename(options) {
  return 'bundle'
    + (options.debug? '-debug': '')
    + (options.require? '-require': '')
    + '.js'
}

function createBundle(modules, dir, options) {
  var argfn = argsFilename(modules, options);
  var filename = dir + '/' + argfn.filename;

  function buildBundle() {
    return exists(filename).then(function (bundleExists) {
      if (!bundleExists) {
        debug('not exists:', filename);
        var browserifyPath = pathUtils.relative(dir, process.cwd() + '/node_modules/.bin/browserify')
        return spawn(browserifyPath, argfn.args, {cwd: dir}).then(function () {
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

function removeNodeModules(dir) {
  var nodeModulesDir = dir + '/node_modules';
  debug('not removing ', nodeModulesDir);
  // return rimraf(nodeModulesDir);
}

module.exports = function (modules, dir, options) {
  return bundleCache.cacheBy(modules.hash(), function () {
    return Promise.all([
      createBundle(modules, dir, {debug: false, require: false}),
      createBundle(modules, dir, {debug: false, require: true}),
      createBundle(modules, dir, {debug: true, require: false}),
      createBundle(modules, dir, {debug: true, require: true})
    ]).then(function () {
      return removeNodeModules(dir);
    });
  }).then(function () {
    return dir + '/' + bundleFilename(options);
  });
};

module.exports.clearCache = function () {
  bundleCache.clear();
};
