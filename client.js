module.exports.loadModules = function (js) {
  var module = {exports: {}};
  new Function('module', 'exports', js)(module, module.exports);
  return module.exports;
};

module.exports.loadRequire = function (js) {
  return new Function('var require;\n' + js + '; return require;')();
};
