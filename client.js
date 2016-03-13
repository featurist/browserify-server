module.exports.loadRequire = function (js) {
  return new Function('var require;\n' + js + ';\nreturn require;')();
};
