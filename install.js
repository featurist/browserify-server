var tmp = require('tmp');
var spawn = require('child_process').spawn;
var fs = require('fs-promise');
var promisify = require('./promisify');
var spawn = require('./spawn');
var crypto = require('crypto');
var httpism = require('httpism');
var debug = require('debug')('browserify-server:install');
var rimraf = require('rimraf');

function packageDirectory(modules) {
  var dirName = 'packages/' + modules.hash();

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

function tempDirectory() {
  return promisify(function (cb) {
    return tmp.dir({dir: 'packages'}, cb);
  });
}

function npmInstall(dir) {
  return spawn('npm', ['install', '--production'], {cwd: dir});
}

function writePackage(modules, dir) {
  var package = {
    dependencies: modules.dependencies()
  };

  var packageFilename = dir + '/package.json';
  debug('writing package', packageFilename);
  return fs.writeFile(packageFilename, JSON.stringify(package, null, 2));
}

function mkdirPackages() {
  return promisify(function (cb) {
    fs.exists('packages', function (exists) {
      if(!exists) {
        fs.mkdir('packages', cb);
      } else {
        cb();
      }
    });
  });
}

module.exports = function (modules) {
  return mkdirPackages().then(function () {
    return packageDirectory(modules).then(function (dir) {
      if (dir.exists) {
        return dir.path;
      } else {
        return writePackage(modules, dir.path).then(function () {
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
};
