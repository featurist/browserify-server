var fs = require('fs-promise');
var debug = require('debug')('browserify-server:bundle');
var cache = require('./cache');
var rimrafCb = require('rimraf');
var promisify = require('./promisify');
var pathUtils = require('path');
var UglifyJS = require('uglify-js');
var browserify = require('browserify');
var exorcist = require('exorcist');

function pushd(dir, fn) {
  var oldDir = process.cwd();
  var sync = true;

  function back() {
    process.chdir(oldDir);
  }

  process.chdir(dir);
  try {
    var result = fn();

    if (typeof result.then === 'function') {
      sync = false;
      return result.then(back, back);
    } else {
      return result;
    }
  } finally {
    if (sync) {
      back();
    }
  }
}

function rimraf(dir) {
  return promisify(function (cb) {
    rimrafCb(dir, cb);
  });
}

var bundleCache = cache();

function createBundle(modules) {
  var b = browserify({
    debug: true
  });

  b.require('./package.json', {expose: 'package.json'});
  modules.requires().forEach(function (moduleName) {
    b.require(moduleName);
  });

  return b;
}

function exists(filename) {
  return fs.exists(filename);
}

function bundlePath(dir) {
  return dir + '/bundle.js'
}

function writeBundle(modules, dir, options) {
  return pushd(dir, function () {
    return new Promise(function (fulfil, reject) {
      var b = createBundle(modules);
      var bundle = b.bundle();
      bundle.on('error', reject);

      var outputFilename = 'bundle.js';
      var mapFilename = outputFilename + '.map';

      bundle.pipe(exorcist(mapFilename, options.basePath + '/bundle.js.map')).pipe(fs.createWriteStream(outputFilename)).on('finish', function () {
        debug(`browserify => ${outputFilename}, ${mapFilename}`);
        fulfil({
          js: outputFilename,
          map: mapFilename
        });
      });
    }).then(function (output) {
      return uglify(output.js, {sourceMap: output.map, basePath: options.basePath});
    });
  });
}

function uglify(js, options) {
  var sourceMap = typeof options == 'object' && options.hasOwnProperty('sourceMap')? options.sourceMap: undefined;
  var ext = typeof options == 'object' && options.hasOwnProperty('ext')? options.ext: '';

  var minJs = pathUtils.join(pathUtils.dirname(js), pathUtils.basename(js, '.js') + ext + '.min.js');
  var minJsMap = pathUtils.join(pathUtils.dirname(sourceMap), pathUtils.basename(sourceMap, '.js.map') + ext + '.min.js.map');

  var result = UglifyJS.minify(js, {
    inSourceMap: sourceMap,
    outSourceMap: options.basePath + '/bundle.min.js.map',
    sourceMapIncludeSources: true
  });

  return Promise.all([
    fs.writeFile(minJs, result.code),
    fs.writeFile(minJsMap, result.map)
  ]).then(function () {
    return fs.readFile(sourceMap, 'utf-8').then(function (sourceMapContents) {
      var sourceMapJson = JSON.parse(sourceMapContents);

      return fs.readFile(minJsMap, 'utf-8').then(function (minJsMapContents) {
        var minJsMapJson = JSON.parse(minJsMapContents);

        var sources = {};
        sourceMapJson.sources.forEach(function (source, index) {
          sources[source] = sourceMapJson.sourcesContent[index];
        });

        minJsMapJson.sources.forEach(function (source, index) {
          minJsMapJson.sourcesContent[index] = sources[source] || "";
        });

        return fs.writeFile(minJsMap, JSON.stringify(minJsMapJson));
      });
    });
  });
}

function createBundles(modules, dir, options) {
  var filename = bundlePath(dir);

  return exists(filename).then(function (bundleExists) {
    if (!bundleExists) {
      debug('not exists:', filename);
      return writeBundle(modules, dir, options).then(function () {
        return removeNodeModules(dir);
      }).then(function () {
        return dir;
      });
    } else {
      debug('exists:', filename);
      return dir;
    }
  });
}

function removeNodeModules(dir) {
  var nodeModulesDir = dir + '/node_modules';
  return rimraf(nodeModulesDir);
}

module.exports = function (modules, dir, options) {
  return bundleCache.cacheBy(modules.hash(), function () {
    return createBundles(modules, dir, options);
  });
};

module.exports.clearCache = function () {
  bundleCache.clear();
};
