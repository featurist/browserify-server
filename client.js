module.exports.loadRequire = function (js, modules) {
  if (modules) {
    return new Function('require', js + ';\nreturn require;')(createRequire(modules));
  } else {
    return new Function('var require;\n' + js + ';\nreturn require;')();
  }
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
