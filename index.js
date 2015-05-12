var debug = require('debug');
debug.enable('*');

var install = require('./install');
var bundle = require('./bundle');

install(['plastiq', 'plastiq-router']).then(function (package) {
  return bundle(package.modules, package.dir, {standalone: 'blah'});
}).then(function () {
  console.log('done');
}, function (error) {
  console.log(error.stack);
});
