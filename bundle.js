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

function moduleVersions(modules) {
  return 'module.exports = ' + JSON.stringify(modules.dependencies()) + ';';
}

function writeModuleVersions(modules, dir) {
  return fs.writeFile(dir + '/module-versions.js', moduleVersions(modules));
}

function argsFilename(modules, options) {
  var args = [];

  if (options) {
    if (options.debug) {
      args.push('-d');
    }

    args.push('-r', './module-versions.js:module-versions');
    modules.requires().forEach(function (moduleName) {
      args.push('-r', moduleName);
    });
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
    + '.js'
}

function createBundle(modules, dir, options) {
  var argfn = argsFilename(modules, options);
  var filename = dir + '/' + argfn.filename;

  return writeModuleVersions(modules, dir).then(function () {
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
  });
};

function removeNodeModules(dir) {
  var nodeModulesDir = dir + '/node_modules';
  return rimraf(nodeModulesDir);
}

module.exports = function (modules, dir, options) {
  return bundleCache.cacheBy(modules.hash(), function () {
    return Promise.all([
      createBundle(modules, dir, {debug: false}),
      createBundle(modules, dir, {debug: true})
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
