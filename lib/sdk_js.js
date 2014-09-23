var config, fs, sdk_js_str, sdk_js_str_min;

fs = require('fs');

config = require('./config');

sdk_js_str = null;

sdk_js_str_min = null;

exports.get = function(callback) {
  if (sdk_js_str) {
    return callback(null, sdk_js_str);
  }
  return fs.readFile(config.rootdir + '/app/js/oauth.js', 'utf8', function(err, data) {
    sdk_js_str = data.replace(/\{\{auth_url\}\}/g, config.host_url + config.base);
    sdk_js_str = sdk_js_str.replace(/\{\{api_url\}\}/g, config.base_api);
    return callback(null, sdk_js_str);
  });
};

exports.getmin = function(callback) {
  if (sdk_js_str_min) {
    return callback(null, sdk_js_str_min);
  }
  return fs.readFile(config.rootdir + '/app/js/oauth.min.js', 'utf8', function(err, data) {
    sdk_js_str_min = data.replace(/\{\{auth_url\}\}/g, config.host_url + config.base);
    sdk_js_str_min = sdk_js_str_min.replace(/\{\{api_url\}\}/g, config.base_api);
    return callback(null, sdk_js_str_min);
  });
};
