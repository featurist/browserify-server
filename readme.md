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

How is this different to https://wzrd.in/ and [browserify-cdn](https://github.com/jfhbrook/browserify-cdn)?

* multiple modules (with inter-dependencies intact)
* supports `peerDependencies`
* supports using `require()` in your `<script>`
* supports deep paths, e.g. `require('module/lib/thing')`
* includes the versions of each module, as they were resolved

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
* includes a module called `module-versions` containing the versions of each module

```html
<script src="http://localhost:4000/modules/a@1.0.0,b@1.0.0,c@1.0.0"></script>
<script>
  var a = require('a');
  var versionOfA = require('module-versions').a; // "1.0.0"
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

### debug

    ?debug=true

* serves the same JS, but with source maps
