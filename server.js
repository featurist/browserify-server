var app = require('./app');

app.set('packages directory', 'packages');

var port = process.env.PORT || 4000;

app.listen(port, function () {
  console.log('http://localhost:' + port + '/');
});
