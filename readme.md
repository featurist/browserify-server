# browserify server

[http://require.plastiq.org/](http://require.plastiq.org/)

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

See this lovely minified JS: [http://require.plastiq.org/modules/plastiq](http://require.plastiq.org/modules/plastiq)

How is this different to https://wzrd.in/ and [browserify-cdn](https://github.com/jfhbrook/browserify-cdn)?

* multiple modules (with inter-dependencies intact)
* supports `peerDependencies`
* supports using `require()` in your `<script>`
* supports deep paths, e.g. `require('module/lib/thing')`
* includes the `package.json` containing the versions of the modules in the bundle
* minifies JS by default
* includes source maps
* supports excluding modules from the bundle

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

**NOTE** resolving versions can take a little extra time, a few hundred milliseconds, depending on [registry.npmjs.org](https://registry.npmjs.org). It's advisable to specify exact versions to get almost instant responses (after initial build).

## specific versions

**NOTE** it can take a few seconds to build the bundle for the first time, following that responses are almost instantaneous.

* sets a `require` global function (or not, see below)
* includes `package.json` containing the versions of each module

```html
<script src="http://localhost:4000/modules/a@1.0.0,b@1.0.0,c@1.0.0"></script>
<script>
  var a = require('a');
  var versionOfA = require('package.json').dependencies.a; // "1.0.0"
  ...
</script>
```

## require

If you want to get at the `require` function but without setting it globally, do this:

```js
function loadRequire(js) {
  return new Function('var require;\n' + js + ';\nreturn require;')();
}

$.get('http://localhost:4000/modules/a,b,c').then(function (js) {
  var require = loadRequire(js);
});
```

`loadRequire` can be found in [client.js](https://github.com/featurist/browserify-server/blob/master/client.js)

## excluding and referring to external modules

You can exclude modules by placing a `!` before the name, so to bundle `a` and `b`, but exclude the dependency `c`:

    GET /modules/a,b,!c

The module `c` can then be referenced from an existing `require` possibly from another bundle. For example, to get a `require` function that refers to extenal modules:

```js
module.exports.loadRequire = function (js, modules) {
  return new Function('require', js + ';\nreturn require;')(createRequire(modules));
};

function createRequire(modules) {
  return function(name) {
    if (modules.hasOwnProperty(name)) {
      return modules[name];
    } else {
      throw new Error("Cannot find module '" + name + "'");
    }
  };
}
```

You can use it like this:

```js
$.get('http://localhost:4000/modules/a,b,!c').then(function (js) {
  var require = loadRequire(js, {
    c: {
      name: "this is the module 'c'"
    }
  });

  var a = require('a');
  var b = require('b');
});
```

Or you could layer two script tags, one that bundles `c` and defines `require`, the second that bundles `a` and `b` that uses the first `require` for the module `c`.

```html
<script src="http://localhost:4000/modules/c"></script>
<script src="http://localhost:4000/modules/a,b,!c"></script>
```

## specific files

* minified js: `/modules/a@1.0.0` or `/modules/a@1.0.0/bundle.min.js`
* minified source map: `/modules/a@1.0.0/bundle.min.js.map`
* unminified js: `/modules/a@1.0.0/bundle.js`
* unminified source map: `/modules/a@1.0.0/bundle.js.map`
* package.json: `/modules/a@1.0.0/package.json`
