var express = require('express');
var bodyParser = require("body-parser");
var install = require('./install');
var bundle = require('./bundle');
var debug = require('debug');
var createModules = require('./modules');
var qs = require('qs');
var cors = require('cors');

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());

app.get('/modules/:modules', function (req, res) {
  try {
    var moduleNames = req.params.modules.split(',');
    var debug = req.query.debug === 'true';
    var require = req.query.require === 'true';

    if (moduleNames.length > 0) {
      var modules = createModules(moduleNames);

      if (modules.hasExactVersions()) {
        install(modules).then(function (dir) {
          return bundle(modules, dir, {debug: debug, require: require}).then(function (filename) {
            res.set('Content-Type', 'text/javascript');
            res.sendFile(filename, {maxAge: '365d', root: process.cwd()});
          });
        }).then(undefined, function (error) {
          console.log(error);
          res.status(500).send({message: error && error.message});
        });
      } else {
        modules.resolveVersions().then(function (modulesWithVersions) {
          var query = qs.stringify(req.query);
          var path = '/modules/' + modulesWithVersions.modules.join(',')
          var url = path + (query? '?' + query: '');
          res.redirect(url);
        }).then(undefined, function (error) {
          console.log(error);
          res.status(500).send({message: error && error.message});
        });
      }
    } else {
      res.status(400).send({message: 'expected modules to be an array'});
    }
  } catch (error) {
    res.status(500).send({message: error && error.message});
  }
});

module.exports = app;
