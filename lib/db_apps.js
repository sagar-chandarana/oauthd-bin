var Url, async, check, config, db, plugins;

Url = require('url');

async = require('async');

db = require('./db');

config = require('./config');

check = require('./check');

plugins = require('./plugins');

exports.create = check({
  name: /^.{3,50}$/,
  domains: ['none', 'array']
}, function(data, callback) {
  var domain, err, key, secret, _i, _len, _ref;
  err = new check.Error;
  err.check('name', data.name, 'string');
  err.check('secret', data.secret, 'string');
  if (data.domains) {
    _ref = data.domains;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      domain = _ref[_i];
      err.check('domains', domain, 'string');
    }
  }
  if (err.failed()) {
    return callback(err);
  }
  key = data.name;
  secret = data.secret;
  return db.redis.incr('a:i', function(err, idapp) {
    var cmds, prefix, _j, _len1, _ref1;
    if (err) {
      return callback(err);
    }
    prefix = 'a:' + idapp + ':';
    cmds = [['mset', prefix + 'name', data.name, prefix + 'key', key, prefix + 'secret', secret], ['hset', 'a:keys', key, idapp]];
    if (data.domains) {
      _ref1 = data.domains;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        domain = _ref1[_j];
        cmds.push(['sadd', prefix + 'domains', domain]);
      }
    }
    return db.redis.multi(cmds).exec(function(err, res) {
      if (err) {
        return callback(err);
      }
      return callback(null, {
        id: idapp,
        name: data.name,
        key: key
      });
    });
  });
});

exports.getById = check('int', function(idapp, callback) {
  var prefix;
  prefix = 'a:' + idapp + ':';
  return db.redis.mget([prefix + 'name', prefix + 'key', prefix + 'secret'], function(err, replies) {
    if (err) {
      return callback(err);
    }
    return callback(null, {
      id: idapp,
      name: replies[0],
      key: replies[1],
      secret: replies[2]
    });
  });
});

exports.get = check(check.format.key, function(key, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    var prefix;
    if (err) {
      return callback(err);
    }
    if (!idapp) {
      return callback(new check.Error('Unknown key'));
    }
    prefix = 'a:' + idapp + ':';
    return db.redis.mget([prefix + 'name', prefix + 'key', prefix + 'secret'], function(err, replies) {
      if (err) {
        return callback(err);
      }
      return callback(null, {
        id: idapp,
        name: replies[0],
        key: replies[1],
        secret: replies[2]
      });
    });
  });
});

exports.update = check(check.format.key, {
  name: ['none', /^.{3,15}$/],
  domains: ['none', 'array']
}, function(key, data, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    if (err) {
      return callback(err);
    }
    if (!idapp) {
      return callback(new check.Error('Unknown key'));
    }
    return async.parallel([
      function(callback) {
        var upinfos;
        upinfos = [];
        if (data.name) {
          upinfos.push('a:' + idapp + ':name');
          upinfos.push(data.name);
        }
        if (!upinfos.length) {
          return callback();
        }
        return db.redis.mset(upinfos, function() {
          if (err) {
            return callback(err);
          }
          return callback();
        });
      }, function(callback) {
        if (!data.domains) {
          return callback();
        }
        return exports.updateDomains(key, data.domains, function(err, res) {
          if (err) {
            return callback(err);
          }
          return callback();
        });
      }
    ], function(err, res) {
      if (err) {
        return callback(err);
      }
      return callback();
    });
  });
});

exports.resetKey = check(check.format.key, function(key, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    var newkey, newsecret;
    if (err) {
      return callback(err);
    }
    if (!idapp) {
      return callback(new check.Error('Unknown key'));
    }
    newkey = db.generateUid();
    newsecret = db.generateUid();
    return db.redis.multi([['mset', 'a:' + idapp + ':key', newkey, 'a:' + idapp + ':secret', newsecret], ['hdel', 'a:keys', key], ['hset', 'a:keys', newkey, idapp]]).exec(function(err, r) {
      if (err) {
        return callback(err);
      }
      return callback(null, {
        key: newkey,
        secret: newsecret
      });
    });
  });
});

exports.remove = check(check.format.key, function(key, callback) {
  return exports.getKeysets(key, function(err, providers) {
    var provider, _i, _len;
    if (err) {
      return callback(err);
    }
    for (_i = 0, _len = providers.length; _i < _len; _i++) {
      provider = providers[_i];
      plugins.data.emit('app.remkeyset', {
        provider: provider,
        app: key
      });
    }
    return db.redis.hget('a:keys', key, function(err, idapp) {
      if (err) {
        return callback(err);
      }
      if (!idapp) {
        return callback(new check.Error('Unknown key'));
      }
      return db.redis.multi([['hdel', 'a:keys', key], ['keys', 'a:' + idapp + ':*']]).exec(function(err, replies) {
        if (err) {
          return callback(err);
        }
        return db.redis.del(replies[1], function(err, removed) {
          if (err) {
            return callback(err);
          }
          return callback();
        });
      });
    });
  });
});

exports.getDomains = check(check.format.key, function(key, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    if (err) {
      return callback(err);
    }
    if (!idapp) {
      return callback(new check.Error('Unknown key'));
    }
    return db.redis.smembers('a:' + idapp + ':domains', callback);
  });
});

exports.updateDomains = check(check.format.key, 'array', function(key, domains, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    var cmds, domain, _i, _len;
    if (err) {
      return callback(err);
    }
    if (!idapp) {
      return callback(new check.Error('Unknown key'));
    }
    cmds = [['del', 'a:' + idapp + ':domains']];
    for (_i = 0, _len = domains.length; _i < _len; _i++) {
      domain = domains[_i];
      cmds.push(['sadd', 'a:' + idapp + ':domains', domain]);
    }
    return db.redis.multi(cmds).exec(function(err, res) {
      if (err) {
        return callback(err);
      }
      return callback();
    });
  });
});

exports.addDomain = check(check.format.key, 'string', function(key, domain, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    if (err) {
      return callback(err);
    }
    if (!idapp) {
      return callback(new check.Error('Unknown key'));
    }
    return db.redis.sadd('a:' + idapp + ':domains', domain, function(err, res) {
      if (err) {
        return callback(err);
      }
      if (!res) {
        return callback(new check.Error('domain', domain + ' is already valid'));
      }
      return callback();
    });
  });
});

exports.remDomain = check(check.format.key, 'string', function(key, domain, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    if (err) {
      return callback(err);
    }
    if (!idapp) {
      return callback(new check.Error('Unknown key'));
    }
    return db.redis.srem('a:' + idapp + ':domains', domain, function(err, res) {
      if (err) {
        return callback(err);
      }
      if (!res) {
        return callback(new check.Error('domain', domain + ' is already non-valid'));
      }
      return callback();
    });
  });
});

exports.getKeyset = check(check.format.key, 'string', function(key, provider, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    if (err) {
      return callback(err);
    }
    if (!idapp) {
      return callback(new check.Error('Unknown key'));
    }
    return db.redis.mget('a:' + idapp + ':k:' + provider, 'a:' + idapp + ':ktype:' + provider, function(err, res) {
      var e;
      if (err) {
        return callback(err);
      }
      if (!res[0]) {
        return callback();
      }
      try {
        res[0] = JSON.parse(res[0]);
      } catch (_error) {
        e = _error;
        return callback(e);
      }
      return callback(null, {
        parameters: res[0],
        response_type: res[1] || 'token'
      });
    });
  });
});

exports.addKeyset = check(check.format.key, 'string', {
  parameters: 'object',
  response_type: 'string'
}, function(key, provider, data, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    if (err) {
      return callback(err);
    }
    if (!idapp) {
      return callback(new check.Error('Unknown key'));
    }
    return db.redis.mset('a:' + idapp + ':k:' + provider, JSON.stringify(data.parameters), 'a:' + idapp + ':ktype:' + provider, data.response_type, function(err, res) {
      if (err) {
        return callback(err);
      }
      plugins.data.emit('app.addkeyset', {
        provider: provider,
        app: key,
        id: idapp
      });
      return callback();
    });
  });
});

exports.remKeyset = check(check.format.key, 'string', function(key, provider, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    if (err) {
      return callback(err);
    }
    if (!idapp) {
      return callback(new check.Error('Unknown key'));
    }
    return db.redis.del('a:' + idapp + ':k:' + provider, 'a:' + idapp + ':ktype:' + provider, function(err, res) {
      if (err) {
        return callback(err);
      }
      if (!res) {
        return callback(new check.Error('provider', 'You have no keyset for ' + provider));
      }
      plugins.data.emit('app.remkeyset', {
        provider: provider,
        app: key
      });
      return callback();
    });
  });
});

exports.getKeysets = check(check.format.key, function(key, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    var prefix;
    if (err) {
      return callback(err);
    }
    if (!idapp) {
      return callback(new check.Error('Unknown key'));
    }
    prefix = 'a:' + idapp + ':k:';
    return db.redis.keys(prefix + '*', function(err, replies) {
      var reply;
      if (err) {
        return callback(err);
      }
      return callback(null, (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = replies.length; _i < _len; _i++) {
          reply = replies[_i];
          _results.push(reply.substr(prefix.length));
        }
        return _results;
      })());
    });
  });
});

exports.checkDomain = check(check.format.key, 'string', function(key, domain_str, callback) {
  return exports.getDomains(key, function(err, domains) {
    var domain, vdomain, vdomain_str, _i, _len;
    if (err) {
      return callback(err);
    }
    domain = Url.parse(domain_str);
    if (!domain.protocol) {
      domain_str = 'http://' + domain_str;
      domain = Url.parse(domain_str);
    }
    if (domain.host === config.url.host) {
      return callback(null, true);
    }
    for (_i = 0, _len = domains.length; _i < _len; _i++) {
      vdomain_str = domains[_i];
      vdomain_str = vdomain_str.replace('*', '.');
      if (!vdomain_str.match(/^.{1,}:\/\//)) {
        vdomain_str = '.://' + vdomain_str;
      }
      vdomain = Url.parse(vdomain_str);
      if (vdomain.protocol !== '.:' && vdomain.protocol !== domain.protocol) {
        continue;
      }
      if (vdomain.port && vdomain.port !== domain.port) {
        continue;
      }
      if (vdomain.pathname && vdomain.pathname !== '/' && vdomain.pathname !== domain.pathname) {
        continue;
      }
      if (vdomain.hostname === domain.hostname || vdomain.hostname.substr(0, 2) === '..' && domain.hostname.substr(domain.hostname.length - vdomain.hostname.length + 1) === vdomain.hostname.substr(1)) {
        return callback(null, true);
      }
    }
    return callback(null, false);
  });
});

exports.checkSecret = check(check.format.key, check.format.key, function(key, secret, callback) {
  return db.redis.hget('a:keys', key, function(err, idapp) {
    if (err) {
      return callback(err);
    }
    return db.redis.get('a:' + idapp + ':secret', function(err, sec) {
      if (err) {
        return callback(err);
      }
      return callback(null, sec === secret);
    });
  });
});
