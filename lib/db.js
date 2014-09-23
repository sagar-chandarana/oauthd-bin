var config, crypto, exit, redis;

crypto = require('crypto');

redis = require('redis');

config = require('./config');

exit = require('./exit');

exports.redis = redis.createClient(config.redis.port, config.redis.host, config.redis.options);

if (config.redis.password) {
  exports.redis.auth(config.redis.password);
}

if (config.redis.database) {
  exports.redis.select(config.redis.database);
}

exports.redis.on('error', function(err) {
  exports.redis.last_error = 'Error while connecting to redis DB (' + err.message + ')';
  return console.error(exports.redis.last_error);
});

exit.push('Redis db', function(callback) {
  var e;
  try {
    if (exports.redis) {
      exports.redis.quit();
    }
  } catch (_error) {
    e = _error;
    return callback(e);
  }
  return callback();
});

exports.generateUid = function(data) {
  var shasum, uid;
  if (data == null) {
    data = '';
  }
  shasum = crypto.createHash('sha1');
  shasum.update(config.publicsalt);
  shasum.update(data + (new Date).getTime() + ':' + Math.floor(Math.random() * 9999999));
  uid = shasum.digest('base64');
  return uid.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=+$/, '');
};

exports.generateHash = function(data) {
  var shasum;
  shasum = crypto.createHash('sha1');
  shasum.update(config.staticsalt + data);
  return shasum.digest('base64');
};
