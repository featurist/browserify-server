var fs = require('fs-promise');
var promisify = require('./promisify');
var spawn = require('./spawn');
var debug = require('debug')('browserify-server:install');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var cache = require('./cache');

var packagesCache = cache();

function packageDirectory(packagesDir, modules) {
  var dirName = packagesDir + '/' + modules.hash();

  return fs.exists(dirName).then(function (exists) {
    if (!exists) {
      return fs.mkdir(dirName).then(function () {
        return {
          exists: false,
          path: dirName
        };
      });
    } else {
      return {
        exists: true,
        path: dirName
      };
    }
  });
}

function npmInstall(dir) {
  return spawn('npm', ['install', '--production', '--ignore-scripts'], {cwd: dir});
}

function writePackage(modules, dir) {
  var package = {
    dependencies: modules.dependencies()
  };

  var packageFilename = dir + '/package.json';
  debug('writing package', packageFilename, package);
  return fs.writeFile(packageFilename, JSON.stringify(package, null, 2));
}

function mkdirPackages(packagesDir) {
  return promisify(function (cb) {
    mkdirp(packagesDir, cb);
  });
}

module.exports = function (packagesDir, modules) {
  return packagesCache.cacheBy(modules.hash(), function () {
    return mkdirPackages(packagesDir).then(function () {
      return packageDirectory(packagesDir, modules).then(function (dir) {
        if (dir.exists) {
          debug('directory ' + dir.path + ' exists for modules: ' + modules.modules.join(','));
          return dir.path;
        } else {
          return writePackage(modules, dir.path).then(function () {
            debug('npm install in directory ' + dir.path + ' for modules: ' + modules.modules.join(','));
            return npmInstall(dir.path).then(function () {
              return dir.path;
            });
          }).then(undefined, function (error) {
            return promisify(function (cb) {
              rimraf(dir.path, cb);
            }).then(function () {
              throw error;
            });
          });
        }
      });
    });
  });
};

module.exports.clearCache = function () {
  packagesCache.clear();
};
