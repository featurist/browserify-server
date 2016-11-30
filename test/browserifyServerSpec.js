var rimrafCb = require('rimraf');
var expect = require('chai').expect;
var promisify = require('../promisify');
var app = require('../app');
var httpism = require('httpism');
var client = require('../client');
var fs = require('fs-promise');
var retry = require('trytryagain');
var sourceMap = require('source-map');

function rimraf(dir) {
  return promisify(function (cb) {
    rimrafCb(dir, cb);
  });
}

var testVersion = '1.1.0';
var testPeerDepVersion = '1.0.0';

describe('browserify server', function () {
  var packagesDir = 'test/packages';
  var server;
  var api;
  var port = 34567;
  var npmApi;

  beforeEach(function () {
    return rimraf(packagesDir).then(function () {
      app.set('packages directory', packagesDir);
      app.clearCache();
      server = app.listen(port);
      api = httpism.api('http://localhost:' + port);
    });
  });

  afterEach(function () {
    server.close();
  });

  function verifyVersion(version) {
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      throw new Error('expected NPM package version to be n.n.n');
    } else {
      return version;
    }
  }

  describe('resolving versions', function () {
    var proteLatest, expressRc;

    before(function () {
      npmApi = httpism.api('http://registry.npmjs.org');

      return Promise.all([
        npmApi.get('prote/latest'),
        npmApi.get('express/rc')
      ]).then(function (responses) {
        var versions = responses.map(function (response) {
          return response.body.version;
        });

        proteLatest = verifyVersion(versions[0]);
        expressRc = verifyVersion(versions[1]);
      });
    });

    it('will redirect to the latest versions if none specified', function () {
      return api.get('/modules/prote', {redirect: false}).then(function (response) {
        var redirectLocation = response.headers.location;
        expect(redirectLocation).to.equal('/modules/' + encodeURIComponent('prote@' + proteLatest));
      });
    });

    it('will redirect to the latest versions maintaining bundle path', function () {
      return api.get('/modules/prote/bundle.js', {redirect: false}).then(function (response) {
        var redirectLocation = response.headers.location;
        expect(redirectLocation).to.equal('/modules/' + encodeURIComponent('prote@' + proteLatest) + '/bundle.js');
      });
    });

    it('can redirect to the latest versions', function () {
      return api.get('/modules/prote@latest', {redirect: false}).then(function (response) {
        var redirectLocation = response.headers.location;
        expect(redirectLocation).to.equal('/modules/' + encodeURIComponent('prote@' + proteLatest));
      });
    });

    it('can redirect to a tagged version', function () {
      return api.get('/modules/express@rc', {redirect: false}).then(function (response) {
        var redirectLocation = response.headers.location;
        expect(redirectLocation).to.equal('/modules/' + encodeURIComponent('express@' + expressRc));
      });
    });

    it('redirects to modules in alphabetical order', function () {
      return api.get('/modules/prote,express@rc', {redirect: false}).then(function (response) {
        var redirectLocation = response.headers.location;
        expect(redirectLocation).to.equal('/modules/' + encodeURIComponent('express@' + expressRc + ',prote@' + proteLatest));
      });
    });

    it('redirects to base modules with versions, plus deep paths', function () {
      return api.get('/modules/' + encodeURIComponent('browserify-server-test/lib/thing'), {redirect: false}).then(function (response) {
        var redirectLocation = response.headers.location;
        expect(redirectLocation).to.equal('/modules/' + encodeURIComponent('browserify-server-test/lib/thing,browserify-server-test@' + testVersion));
      });
    });

    it('redirects to modules in alphabetical order', function () {
      return api.get('/modules/prote@' + proteLatest + ',express@' + expressRc, {redirect: false}).then(function (response) {
        var redirectLocation = response.headers.location;
        expect(redirectLocation).to.equal('/modules/' + encodeURIComponent('express@' + expressRc + ',prote@' + proteLatest));
      });
    });
  });

  describe('building packages', function () {
    this.timeout(10000);

    describe('returning modules with versions', function () {
      it('browserifies modules', function () {
        return api.get('/modules/browserify-server-test').then(function (response) {
          var req = client.loadRequire(response.body);

          var browserifyServerTest = req('browserify-server-test');

          expect(browserifyServerTest()).to.equal('browserify-server-test');

          var dependencies = req('package.json').dependencies;
          expect(dependencies['browserify-server-test']).to.equal(testVersion);
        });
      });

      it('browserifies modules with peer dependencies', function () {
        return api.get('/modules/browserify-server-test,browserify-server-test-peer-dep').then(function (response) {
          var req = client.loadRequire(response.body);

          var browserifyServerTest = req('browserify-server-test');
          var browserifyServerTestPeerDep = req('browserify-server-test-peer-dep');

          expect(browserifyServerTest()).to.equal('browserify-server-test');
          expect(browserifyServerTestPeerDep()).to.equal('browserify-server-test-peer-dep');
          expect(browserifyServerTestPeerDep.peerDependency).to.equal(browserifyServerTest);

          var dependencies = req('package.json').dependencies;
          expect(dependencies['browserify-server-test']).to.equal(testVersion);
          expect(dependencies['browserify-server-test-peer-dep']).to.equal(testPeerDepVersion);
        });
      });

      it('fails when module not found', function () {
        return api.get('/modules/xxx-notfound-xxx', {exceptions: false}).then(function (response) {
          expect(response.statusCode).to.equal(404);
        });
      });

      it('fails when module version not found', function () {
        return api.get('/modules/browserify-server-test@0.9.0', {exceptions: false}).then(function (response) {
          expect(response.statusCode).to.equal(500);
          return fs.readdir(packagesDir).then(function (files) {
            expect(files).to.eql([]);
          });
        });
      });

      it('fails when module cannot be installed', function () {
        return api.get('/modules/browserify-server-test-broken', {exceptions: false}).then(function (response) {
          expect(response.statusCode).to.equal(500);
          return fs.readdir(packagesDir).then(function (files) {
            expect(files).to.eql([]);
          });
        });
      });
    });

    describe('caching', function () {
      beforeEach(function () {
        return api.get('/modules/browserify-server-test@' + testVersion);
      });

      it('responds quickly after module has already been built', function () {
        var startTime = Date.now();

        return api.get('/modules/browserify-server-test@' + testVersion).then(function () {
          expect(Date.now() - startTime).to.be.below(20);
        });
      });
    });

    context('when two requests are made concurrently', function () {
      it('returns both responses correctly', function () {
        return Promise.all([
          api.get('/modules/browserify-server-test@' + testVersion),
          api.get('/modules/browserify-server-test@' + testVersion)
        ]).then(function (responses) {
          expect(responses[0].body).to.equal(responses[1].body);
        });
      });

      it('returns both responses correctly, even with different parameters', function () {
        return Promise.all([
          api.get('/modules/browserify-server-test@' + testVersion + '?debug=true'),
          api.get('/modules/browserify-server-test@' + testVersion)
        ]).then(function (responses) {
          var req1 = client.loadRequire(responses[0].body);
          var req2 = client.loadRequire(responses[1].body);

          expect(req1('browserify-server-test')()).to.equal('browserify-server-test');
          expect(req2('browserify-server-test')()).to.equal('browserify-server-test');
        });
      });
    });

    describe('require', function () {
      it('browserifies modules with peer dependencies', function () {
        return api.get('/modules/browserify-server-test,browserify-server-test-peer-dep').then(function (response) {
          var req = client.loadRequire(response.body);

          var browserifyServerTest = req('browserify-server-test');
          var browserifyServerTestPeerDep = req('browserify-server-test-peer-dep');

          expect(browserifyServerTest()).to.equal('browserify-server-test');
          expect(browserifyServerTestPeerDep()).to.equal('browserify-server-test-peer-dep');
          expect(browserifyServerTestPeerDep.peerDependency).to.equal(browserifyServerTest);
        });
      });

      it('can require deep paths', function () {
        return api.get('/modules/' + encodeURIComponent('browserify-server-test/lib/thing')).then(function (response) {
          var req = client.loadRequire(response.body);

          var browserifyServerTestThing = req('browserify-server-test/lib/thing');

          expect(browserifyServerTestThing()).to.equal('browserify-server-test-thing');
        });
      });

      it('can require deep paths with versions', function () {
        return api.get('/modules/' + encodeURIComponent('browserify-server-test/lib/thing@' + testVersion)).then(function (response) {
          var req = client.loadRequire(response.body);

          var browserifyServerTestThing = req('browserify-server-test/lib/thing');

          expect(browserifyServerTestThing()).to.equal('browserify-server-test-thing');
        });
      });

      it('can require normal then deep paths', function () {
        return api.get('/modules/browserify-server-test').then(function (response) {
          var req = client.loadRequire(response.body);

          var browserifyServerTest = req('browserify-server-test');
          expect(browserifyServerTest()).to.equal('browserify-server-test');
        }).then(function () {
          return api.get('/modules/' + encodeURIComponent('browserify-server-test/lib/thing')).then(function (response) {
            var req = client.loadRequire(response.body);

            var browserifyServerTestThing = req('browserify-server-test/lib/thing');

            expect(browserifyServerTestThing()).to.equal('browserify-server-test-thing');
          });
        });
      });

      it('can require modules including their dependencies', function () {
        return api.get('/modules/browserify-server-test-dep').then(function (response) {
          var req = client.loadRequire(response.body);

          var browserifyServerTestDep = req('browserify-server-test-dep');

          expect(browserifyServerTestDep.dependency()).to.equal('browserify-server-test');
          expect(browserifyServerTestDep()).to.equal('browserify-server-test-dep');
        });
      });

      it('can require modules excluding their dependencies', function () {
        return api.get('/modules/browserify-server-test-dep,!browserify-server-test').then(function (response) {
          var req = client.loadRequire(response.body);

          expect(() => req('browserify-server-test-dep')).to.throw("Cannot find module 'browserify-server-test'");

          var browserifyServerTest = {};

          var externalModules = {
            'browserify-server-test': browserifyServerTest
          };

          var reqWithModules = client.loadRequire(response.body, externalModules);

          var browserifyServerTestDep = reqWithModules('browserify-server-test-dep');
          expect(browserifyServerTestDep.dependency).to.equal(browserifyServerTest);
          expect(browserifyServerTestDep()).to.equal('browserify-server-test-dep');
        });
      });
    });

    describe('removing node_modules to save space', function () {
      function packageDirectory() {
        return fs.readdir(packagesDir).then(function (packages) {
          expect(packages.length).to.equal(1);
          return packagesDir + '/' + packages[0] + '/node_modules';
        });
      }

      it('builds all versions, then removes node_modules', function () {
        return api.get('/modules/browserify-server-test@' + testVersion).then(function () {
          return packageDirectory();
        }).then(function (packageDir) {
          return retry(function () {
            return fs.exists(packageDir).then(function (nodeModulesExists) {
              expect(nodeModulesExists).to.be.false;
            });
          });
        }).then(function () {
          return Promise.all([
            api.get('/modules/browserify-server-test@' + testVersion),
            api.get('/modules/browserify-server-test@' + testVersion + '?debug=true')
          ]).then(function (responses) {
            var req1 = client.loadRequire(responses[0].body);
            var req2 = client.loadRequire(responses[1].body);

            expect(req1('browserify-server-test')()).to.equal('browserify-server-test');
            expect(req2('browserify-server-test')()).to.equal('browserify-server-test');
          });
        });
      });
    });
  });

  describe('source maps', function () {
    function positionOf(js, string) {
      var lines = js.split('\n');

      for(var n = 0; n < lines.length; n++) {
        var line = lines[n];
        var index = line.indexOf(string);

        if (index >= 0) {
          return {
            line: n + 1,
            column: index + 1
          }
        }
      }
    }

    it('can expose the original source from a minified file', function () {
      return api.get('/modules/browserify-server-test').then(function (response) {
        var js = response.body;
        var match = js.match(/^\/\/# sourceMappingURL=(.*)$/m);

        expect(match).to.exist;

        var mapUrl = match[1]

        return api.get(mapUrl).then(function (response) {
          var map = sourceMap.SourceMapConsumer(response.body);
          var position = positionOf(js, 'return"browserify-server-test"');
          expect(position).to.exist;

          expect(map.originalPositionFor(position)).to.eql({
            source: 'browserify-server-test',
            line: 2,
            column: 0,
            name: null
          });
        });
      });
    });

    it('can expose the original source from a non-minified file', function () {
      return api.get('/modules/browserify-server-test/bundle.js').then(function (response) {
        var js = response.body;
        var match = js.match(/^\/\/# sourceMappingURL=(.*)$/m);

        expect(match).to.exist;

        var mapUrl = match[1]

        return api.get(mapUrl).then(function (response) {
          var map = sourceMap.SourceMapConsumer(response.body);

          var position = positionOf(js, "return 'browserify-server-test'");
          expect(position).to.exist;

          expect(map.originalPositionFor(position)).to.eql({
            source: 'browserify-server-test',
            line: 2,
            column: 0,
            name: null
          });
        });
      });
    });
  });
});
