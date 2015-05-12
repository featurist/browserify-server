module.exports = function promisify(fn) {
  return new Promise(function (fulfil, reject) {
    fn(function (err, res) {
      if (err) {
        reject(err);
      } else {
        fulfil(res);
      }
    });
  });
}
