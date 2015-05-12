var crypto = require('crypto');
var httpism = require('httpism');
var debug = require('debug')('browserify-server:dependencies');

function hasExactVersion(version) {
  return /^[0-9]+\.[0-9]+\.[0-9]+/.test(version);
}

function parseVersions(modules) {
  return modules.map(function (name) {
    var nameVersion = name.split('@');
    return {
      name: nameVersion[0],
      version: nameVersion[1] || 'latest'
    };
  });
};

function Modules(modules) {
  this.modules = modules.slice().sort();
  this.moduleVersions = parseVersions(this.modules);
}

Modules.prototype.hasExactVersions = function () {
  return !this.moduleVersions.some(function (moduleVersion) {
    return !hasExactVersion(moduleVersion.version);
  });
};

Modules.prototype.resolveVersions = function (modules) {
  function renderModuleVersion(name, version) {
    return name + '@' + version;
  }

  return Promise.all(this.moduleVersions.map(function (moduleVersion) {
    if (hasExactVersion(moduleVersion.version)) {
      return renderModuleVersion(moduleVersion.name, moduleVersion.version);
    } else {
      return httpism.get('https://registry.npmjs.org/' + moduleVersion.name + '/' + moduleVersion.version).then(function (response) {
        return renderModuleVersion(moduleVersion.name, response.body.version);
      });
    }
  })).then(function (modules) {
    return new Modules(modules);
  });
};

Modules.prototype.dependencies = function () {
  var deps = {};

  this.moduleVersions.forEach(function (moduleVersion) {
    deps[moduleVersion.name] = moduleVersion.version;
  });

  return deps;
};

Modules.prototype.hash = function () {
  if (!this._hash) {
    var normalised = this.moduleVersions.map(function (moduleVersion) {
      return moduleVersion.name + '@' + moduleVersion.version;
    }).sort().join();

    debug('modules', normalised);

    var sha1 = crypto.createHash('sha1');
    sha1.update(normalised);

    this._hash = sha1.digest('hex');
  }

  return this._hash;
};

module.exports = function (modules) {
  return new Modules(modules);
};
