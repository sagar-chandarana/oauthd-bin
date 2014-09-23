var check, crypto, db, db_login, db_register, hooks, restify, restifyOAuth2, shared, _config;

crypto = require('crypto');

restify = require('restify');

restifyOAuth2 = require('restify-oauth2-oauthd');

shared = require('../shared');

db = shared.db, check = shared.check;

_config = {
  expire: 3600 * 5
};

db_register = check({
  name: /^.{3,42}$/,
  pass: /^.{6,42}$/
}, function(data, callback) {
  return db.redis.get('adm:pass', function(e, r) {
    var dynsalt, pass;
    if (e || r) {
      return callback(new check.Error('Unable to register'));
    }
    dynsalt = Math.floor(Math.random() * 9999999);
    pass = db.generateHash(data.pass + dynsalt);
    return db.redis.mset('adm:salt', dynsalt, 'adm:pass', pass, 'adm:name', data.name, function(err, res) {
      if (err) {
        return callback(err);
      }
      return callback();
    });
  });
});

db_login = check({
  name: /^.{3,42}$/,
  pass: /^.{6,42}$/
}, function(data, callback) {
  return db.redis.mget(['adm:pass', 'adm:name', 'adm:salt'], function(err, replies) {
    var calcpass;
    if (err) {
      return callback(err);
    }
    if (!replies[1]) {
      return callback(null, false);
    }
    calcpass = db.generateHash(data.pass + replies[2]);
    if (replies[0] !== calcpass || replies[1] !== data.name) {
      return callback(new check.Error("Invalid email or password"));
    }
    return callback(null, replies[1]);
  });
});

hooks = {
  grantClientToken: function(clientId, clientSecret, cb) {
    var next;
    if (shared.db.redis.last_error) {
      return cb(new check.Error(shared.db.redis.last_error));
    }
    next = function() {
      var token;
      token = shared.db.generateUid();
      return (shared.db.redis.multi([['hmset', 'session:' + token, 'date', (new Date).getTime()], ['expire', 'session:' + token, _config.expire]])).exec(function(err, r) {
        if (err) {
          return cb(err);
        }
        return cb(null, token);
      });
    };
    return db_login({
      name: clientId,
      pass: clientSecret
    }, function(err, res) {
      if (err) {
        if (err.message === "Invalid email or password") {
          return cb(null, false);
        }
        if (err) {
          return cb(err);
        }
      }
      if (res) {
        return next();
      }
      return db_register({
        name: clientId,
        pass: clientSecret
      }, function(err, res) {
        if (err) {
          return cb(err);
        }
        return next();
      });
    });
  },
  authenticateToken: function(token, cb) {
    if (shared.db.redis.last_error) {
      return cb(null, false);
    }
    return shared.db.redis.hgetall('session:' + token, function(err, res) {
      if (err) {
        return cb(err);
      }
      if (!res) {
        return cb(null, false);
      }
      return cb(null, res);
    });
  }
};

exports.init = function() {
  return restifyOAuth2.cc(this.server, {
    hooks: hooks,
    tokenEndpoint: this.config.base + '/token',
    tokenExpirationTime: _config.expire
  });
};

exports.needed = function(req, res, next) {
  var cb, token, _ref;
  cb = function() {
    req.user = req.clientId;
    if (req.body == null) {
      req.body = {};
    }
    return next();
  };
  if (db.redis.last_error) {
    return cb();
  }
  if (req.clientId) {
    return cb();
  }
  token = (_ref = req.headers.cookie) != null ? _ref.match(/accessToken=%22(.*?)%22/) : void 0;
  token = token != null ? token[1] : void 0;
  if (!token) {
    return next(new restify.ResourceNotFoundError(req.url + ' does not exist'));
  }
  return db.redis.hget('session:' + token, 'date', function(err, res) {
    if (!res) {
      return next(new restify.ResourceNotFoundError(req.url + ' does not exist'));
    }
    req.clientId = 'admin';
    return cb();
  });
};

exports.optional = function(req, res, next) {
  var cb, token, _ref;
  cb = function() {
    req.user = req.clientId;
    if (req.body == null) {
      req.body = {};
    }
    return next();
  };
  if (db.redis.last_error) {
    return cb();
  }
  if (req.clientId) {
    return cb();
  }
  token = (_ref = req.headers.cookie) != null ? _ref.match(/accessToken=%22(.*?)%22/) : void 0;
  token = token != null ? token[1] : void 0;
  if (!token) {
    return cb();
  }
  return db.redis.hget('session:' + token, 'date', function(err, res) {
    if (!res) {
      return cb();
    }
    req.clientId = 'admin';
    return cb();
  });
};

exports.setup = function(callback) {
  var _this = this;
  this.server.post(this.config.base + '/signin', function(req, res, next) {
    res.setHeader('Content-Type', 'text/html');
    return hooks.grantClientToken(req.body.name, req.body.pass, function(e, token) {
      var expireDate;
      if (!e && !token) {
        e = new check.Error('Invalid email or password');
      }
      if (token) {
        expireDate = new Date((new Date - 0) + _config.expire * 1000);
        res.setHeader('Set-Cookie', 'accessToken=%22' + token + '%22; Path=' + _this.config.base + '/admin; Expires=' + expireDate.toUTCString());
        res.setHeader('Location', _this.config.host_url + _this.config.base + "/admin/key-manager");
      }
      if (e) {
        if (e.status === "fail") {
          if (e.body.name) {
            e = new check.Error("Invalid email format");
          }
          if (e.body.pass) {
            e = new check.Error("Invalid password format (must be 6 characters min)");
          }
        }
        res.setHeader('Location', _this.config.host_url + _this.config.base + "/admin#err=" + encodeURIComponent(e.message));
      }
      res.send(302);
      return next();
    });
  });
  return callback();
};

shared.auth = exports;
