var async, check, config, db;

async = require('async');

db = require('./db');

config = require('./config');

check = require('./check');

exports.add = check({
  key: check.format.key,
  provider: check.format.provider,
  token: ['none', 'string'],
  expire: ['none', 'number'],
  oauthv: 'string',
  origin: ['none', 'string'],
  redirect_uri: ['none', 'string'],
  options: ['none', 'object']
}, function(data, callback) {
  var dbdata, id;
  id = db.generateUid();
  dbdata = {
    key: data.key,
    provider: data.provider
  };
  if (data.token) {
    dbdata.token = data.token;
  }
  if (data.expire) {
    dbdata.expire = (new Date()).getTime() + data.expire;
  }
  if (data.redirect_uri) {
    dbdata.redirect_uri = data.redirect_uri;
  }
  if (data.oauthv) {
    dbdata.oauthv = data.oauthv;
  }
  if (data.origin) {
    dbdata.origin = data.origin;
  }
  if (data.options) {
    dbdata.options = JSON.stringify(data.options);
  }
  dbdata.step = 0;
  return db.redis.hmset('st:' + id, dbdata, function(err, res) {
    if (err) {
      return callback(err);
    }
    if (data.expire != null) {
      db.redis.expire('st:' + id, data.expire);
    }
    dbdata.id = id;
    return callback(null, dbdata);
  });
});

exports.get = check(check.format.key, function(id, callback) {
  return db.redis.hgetall('st:' + id, function(err, res) {
    if (err) {
      return callback(err);
    }
    if (!res) {
      return callback();
    }
    if (res != null ? res.expire : void 0) {
      res.expire = parseInt(res.expire);
    }
    res.id = id;
    if (res.options) {
      res.options = JSON.parse(res.options);
    }
    return callback(null, res);
  });
});

exports.set = check(check.format.key, {
  token: ['none', 'string'],
  expire: ['none', 'number'],
  origin: ['none', 'string'],
  redirect_uri: ['none', 'string'],
  step: ['none', 'number']
}, function(id, data, callback) {
  return db.redis.hmset('st:' + id, data, callback);
});

exports.del = check(check.format.key, function(id, callback) {
  return db.redis.del('st:' + id, callback);
});

exports.setToken = check(check.format.key, 'string', function(id, token, callback) {
  return db.redis.hset('st:' + id, 'token', token, callback);
});
