# browserify server

Browserify on the fly!

    EH?!

Write a web page with this in it:

```html
<script src="http://localhost:4000/modules/qs"></script>
<script>
  var qs = require('qs');
  ...
</script>
```

How is this different to https://wzrd.in/?

* multiple modules (with inter-dependencies intact)
* supports `peerDependencies`
* supports using `require()` in your `<script>`
* supports deep paths, e.g. `require('module/lib/thing')`

Essentially just like doing `npm install` but from your browser.

## start

```sh
node server.js
```

# api

## unspecific versions

Listing modules redirects to the latest versions

    GET /modules/a,b,c
    => 302, Location: /modules/a@1.0.0,b@1.0.0,c@1.0.0

Likewise, if you specify a tag such as `beta` or `latest` you'll be redirected to the corresponding version

    GET /modules/a@beta,b,c
    => 302, Location: /modules/a@1.1.0-beta,b@1.0.0,c@1.0.0

## specific versions

### require

* sets a `require` global function (or not, see below)

```html
<script src="http://localhost:4000/modules/a@1.0.0,b@1.0.0,c@1.0.0"></script>
<script>
  var a = require('a');
  ...
</script>
```

If you want to get at the `require` function but without setting it globally, do this:

```js
function loadRequire(js) {
  return new Function('var require;\n' + js + '; return require;')();
}

$.get('http://localhost:4000/modules/a,b,c').then(function (js) {
  var require = loadRequire(js);
});
```

`loadRequire` can be found in [client.js](https://github.com/featurist/browserify-server/blob/master/client.js)

### with versions

    ?versions=true

* sets a `bundle` global variable (or not, see below)
* exposes the modules and their versions as resolved at the time

```html
<script src="http://localhost:4000/modules/a,b,c?versions=true"></script>
<script>
  var a = bundle.modules.a;
  var aVersion = bundle.versions.a; // "1.0.0"
  ...
</script>
```

If you want to get the bundle without setting a global `bundle` variable, do this:

```js
function loadModules(js) {
  var module = {exports: {}};
  new Function('module', 'exports', js)(module, module.exports);
  return module.exports;
}

$.get('http://localhost:4000/modules/a,b,c?versions=true').then(function (js) {
  var bundle = loadModules(js);
});
```

`loadModules` can be found in [client.js](https://github.com/featurist/browserify-server/blob/master/client.js)

### debug

    ?debug=true

* serves the same JS, but with source maps
