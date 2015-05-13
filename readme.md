# browserify server

browserifies JS on the fly. Like https://wzrd.in/ but handles multiple modules much better, including support for sharing modules, peerDependencies etc.

## start

    node server.js

# api

## unspecific versions

    GET /modules/a,b,c
    => 302, /modules/a@1.0.0,b@1.0.0,c@1.0.0

## specific versions

    GET /modules/a@1.0.0,b@1.0.0,c@1.0.0
    => 200 + js

    function loadJs(js) {
      var module = { exports: {} };
      new Function('module', 'exports', js)(module, module.exports);
      return module.exports;
    }

    var modules = loadJs(js);
    =>  {
      modules: {
        a: [object Object],
        b: [object Object],
        c: [object Object]
      },
      versions: {
        a: '1.0.0',
        b: '1.0.0',
        c: '1.0.0'
      }
    }

* `?require=true` - define `window.require` so you can `require('a')`.
* `?debug=true` - include source maps.
