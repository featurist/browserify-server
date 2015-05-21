var crypto = require('crypto');
var httpism = require('httpism');
var debug = require('debug')('browserify-server:dependencies');

function hasExactVersion(version) {
  return /^[0-9]+\.[0-9]+\.[0-9]+/.test(version);
}

function parseVersions(dependencies) {
  return Object.keys(dependencies).map(function (name) {
    return {
      name: name,
      version: dependencies[name]
    };
  });
};

function Modules(modules) {
  this.modules = modules.slice().sort();
  this.moduleVersions = parseVersions(this.dependencies());
}

Modules.prototype.hasExactVersions = function () {
  return !this.moduleVersions.some(function (moduleVersion) {
    return !hasExactVersion(moduleVersion.version);
  });
};

function npmUrl(moduleVersion) {
  return 'https://registry.npmjs.org/' + moduleVersion.name + '/' + moduleVersion.version;
}

Modules.prototype.resolveVersions = function () {
  function renderModuleVersion(name, version) {
    return name + '@' + version;
  }

  var self = this;

  return Promise.all(this.moduleVersions.map(function (moduleVersion) {
    if (hasExactVersion(moduleVersion.version)) {
      return renderModuleVersion(moduleVersion.name, moduleVersion.version);
    } else {
      return httpism.get(npmUrl(moduleVersion)).then(function (response) {
        return renderModuleVersion(moduleVersion.name, response.body.version);
      });
    }
  })).then(function (modules) {
    return new Modules(modules.concat(self.pathRequires()));
  });
};

Modules.prototype.pathRequires = function () {
  return this.modules.filter(function (module) {
    return module.split('/')[1];
  });
};

Modules.prototype.verifyVersions = function () {
  return Promise.all(this.moduleVersions.map(function (moduleVersion) {
    return httpism.get(npmUrl(moduleVersion));
  }));
};

Modules.prototype.dependencies = function () {
  if (!this._dependencies) {
    var self = this;
    this._dependencies = {};

    this.modules.map(function (module) {
      return module.split('/')[0];
    }).forEach(function (module) {
      var nameVersion = module.split('@');
      var name = nameVersion[0];
      var version = nameVersion[1];
      self._dependencies[name] = version || 'latest';
    });
  }

  return this._dependencies;
};

Modules.prototype.requires = function () {
  return this.modules.map(function (m) {
    return m.split('@')[0];
  });
};

Modules.prototype.hash = function () {
  if (!this._hash) {
    var normalised = this.modules.join(',');

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
