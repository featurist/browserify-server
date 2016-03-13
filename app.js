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

function redirectToExactVersions(modules, filename, req, res) {
  return modules.resolveVersions().then(function (modulesWithVersions) {
    var query = qs.stringify(req.query);
    var path = baseUrlForModules(modulesWithVersions);

    if (filename) {
      path += '/' + filename;
    }

    var url = path + (query? '?' + query: '');
    res.redirect(url);
  });
}

function createBundle(modules, options) {
  var packagesDir = app.get('packages directory');

  return install(packagesDir, modules).then(function (dir) {
    return bundle(modules, dir, options);
  });
}

function baseUrlForModules(modules) {
  return '/modules/' + encodeURIComponent(modules.modules.join(','));
}

function respondWithBundle(moduleNames, filename, req, res) {
  var modules = createModules(moduleNames);
  var bundleFilename = filename || 'bundle.min.js';

  if (modules.hasExactVersions() && modules.hasCorrectOrder(moduleNames)) {
    return createBundle(modules, {basePath: baseUrlForModules(modules)}).then(function (dir) {
      res.set('Content-Type', 'text/javascript');
      res.sendFile(dir + '/' + bundleFilename, {maxAge: '365d', root: process.cwd()});
    });
  } else {
    return redirectToExactVersions(modules, filename, req, res);
  }
}

app.get('/modules/:moduleNames', handleModules);
app.get('/modules/:moduleNames/:filename', handleModules);

function handleModules(req, res) {
  new Promise(function (fulfil) {
    var filename = req.params.filename;
    var moduleNames = req.params.moduleNames.split(',').filter(function (x) { return x; });

    if (moduleNames.length > 0) {
      fulfil(respondWithBundle(moduleNames, filename, req, res));
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
}

module.exports = app;

app.clearCache = function () {
  install.clearCache();
  bundle.clearCache();
};
