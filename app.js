var express = require('express');
var bodyParser = require("body-parser");
var install = require('./install');
var bundle = require('./bundle');
var debug = require('debug')('browserify-server:app');
var createModules = require('./modules');
var qs = require('qs');
var cors = require('cors');

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());

function redirectToExactVersions(modules, req, res) {
  return modules.resolveVersions().then(function (modulesWithVersions) {
    var query = qs.stringify(req.query);
    var path = '/modules/' + modulesWithVersions.modules.join(',')
    var url = path + (query? '?' + query: '');
    res.redirect(url);
  });
}

function createBundle(modules, options, res) {
  var packagesDir = app.get('packages directory');

  return install(packagesDir, modules).then(function (dir) {
    return bundle(modules, dir, options);
  });
}

function respond(moduleNames, options, req, res) {
  var modules = createModules(moduleNames);

  if (modules.hasExactVersions()) {
    return createBundle(modules, options).then(function (filename) {
      res.set('Content-Type', 'text/javascript');
      res.sendFile(filename, {maxAge: '365d', root: process.cwd()});
    });
  } else {
    return redirectToExactVersions(modules, req, res);
  }
}

app.use('/modules', function (req, res) {
  new Promise(function (fulfil) {
    var moduleNames = req.path.substring(1).split(',');
    var debug = req.query.debug === 'true';
    var require = req.query.require === 'true';

    if (moduleNames.length > 0) {
      fulfil(respond(moduleNames, {debug: debug, require: require}, req, res));
    } else {
      res.status(400).send({message: 'expected modules to be an array'});
    }
  }).then(undefined, function (error) {
    if (error.statusCode == 404) {
      res.status(error.statusCode).send({message: 'module not found'});
    } else {
      debug('error', error.stack);
      res.status(500).send({message: error && error.message});
    }
  });
});

module.exports = app;

app.clearCache = function () {
  install.clearCache();
  bundle.clearCache();
};
