'use strict';
var Path, UAParser, Url, async, auth, check, clientCallback, config, db, exit, fixUrl, formatters, fs, oauth, plugins, restify, sdk_js, send, server, server_options;

fs = require('fs');

Path = require('path');

Url = require('url');

async = require('async');

restify = require('restify');

UAParser = require('ua-parser-js');

config = require('./config');

db = require('./db');

plugins = require('./plugins');

exit = require('./exit');

check = require('./check');

formatters = require('./formatters');

sdk_js = require('./sdk_js');

oauth = {
  oauth1: require('./oauth1'),
  oauth2: require('./oauth2')
};

auth = plugins.data.auth;
server_options = {
  name: 'OAuth Daemon',
  version: '1.0.0'
};

if (config.ssl) {
  server_options.key = fs.readFileSync(Path.resolve(config.rootdir, config.ssl.key));
  server_options.certificate = fs.readFileSync(Path.resolve(config.rootdir, config.ssl.certificate));
  console.log('SSL is enabled !');
}

server_options.formatters = formatters.formatters;

server = restify.createServer(server_options);

server.use(restify.authorizationParser());

server.use(restify.queryParser());

server.use(restify.bodyParser({
  mapParams: false
}));

server.use(function(req, res, next) {
  res.setHeader('Content-Type', 'application/json');
  return next();
});
restify.CORS.ALLOW_HEADERS.push('oauthio');
server.use(restify.CORS());
server.use(restify.fullResponse());

plugins.data.server = server;

plugins.runSync('init');

server.send = send = function(res, next) {
  return function(e, r) {
    if (e) {
      return next(e);
    }
    res.send((r != null ? r : check.nullv));
    return next();
  };
};

fixUrl = function(ref) {
  return ref.replace(/^([a-zA-Z\-_]+:\/)([^\/])/, '$1/$2');
};

server.get(config.base + '/download/latest/oauth.js', function(req, res, next) {
  return sdk_js.get(function(e, r) {
    if (e) {
      return next(e);
    }
    res.setHeader('Content-Type', 'application/javascript');
    res.send(r);
    return next();
  });
});

server.get(config.base + '/download/latest/oauth.min.js', function(req, res, next) {
  return sdk_js.getmin(function(e, r) {
    if (e) {
      return next(e);
    }
    res.setHeader('Content-Type', 'application/javascript');
    res.send(r);
    return next();
  });
});

server.post(config.base + '/refresh_token/:provider', function(req, res, next) {
  var e;
  e = new check.Error;
  e.check(req.body, {
    key: check.format.key,
    secret: check.format.key,
    token: 'string'
  });
  e.check(req.params, {
    provider: 'string'
  });
  if (e.failed()) {
    return next(e);
  }
  return db.apps.checkSecret(req.body.key, req.body.secret, function(e, r) {
    if (e) {
      return next(e);
    }
    if (!r) {
      return next(new check.Error("invalid credentials"));
    }
    return db.apps.getKeyset(req.body.key, req.params.provider, function(e, keyset) {
      if (e) {
        return next(e);
      }
      if (keyset.response_type !== "code") {
        return next(new check.Error("refresh token is a server-side feature only"));
      }
      return db.providers.getExtended(req.params.provider, function(e, provider) {
        var oa, _ref;
        if (e) {
          return next(e);
        }
        if (!((_ref = provider.oauth2) != null ? _ref.refresh : void 0)) {
          return next(new check.Error("refresh token not supported for " + req.params.provider));
        }
        oa = new oauth.oauth2;
        return oa.refresh(keyset, provider, req.body.token, send(res, next));
      });
    });
  });
});

server.get(config.base + '/iframe', function(req, res, next) {
  var content, e, origin;
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('p3p', 'CP="IDC DSP COR ADM DEVi TAIi PSA PSD IVAi IVDi CONi HIS OUR IND CNT"');
  e = new check.Error;
  e.check(req.params, {
    d: 'string'
  });
  origin = check.escape(req.params.d);
  if (e.failed()) {
    return next(e);
  }
  content = '<!DOCTYPE html>\n';
  content += '<html><head><script>(function() {\n';
  content += 'function eraseCookie(name) {\n';
  content += '	var date = new Date();\n';
  content += '	date.setTime(date.getTime() - 86400000);\n';
  content += '	document.cookie = name+"=; expires="+date.toGMTString()+"; path=/";\n';
  content += '}\n';
  content += 'function readCookie(name) {\n';
  content += '	var nameEQ = name + "=";\n';
  content += '	var ca = document.cookie.split(";");\n';
  content += '	for(var i = 0; i < ca.length; i++) {\n';
  content += '		var c = ca[i];\n';
  content += '		while (c.charAt(0) === " ") c = c.substring(1,c.length);\n';
  content += '		if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length,c.length);\n';
  content += '	}\n';
  content += '	return null;\n';
  content += '}\n';
  content += 'var cookieCheckTimer = setInterval(function() {\n';
  content += '	var results = readCookie("oauthio_last");\n';
  content += '	if (!results) return;\n';
  content += '	var msg = decodeURIComponent(results.replace(/\\+/g, " "));\n';
  content += '	parent.postMessage(msg, "' + origin + '");\n';
  content += '	eraseCookie("oauthio_last");\n';
  content += '}, 1000);\n';
  content += '})();</script></head><body></body></html>';
  res.send(content);
  return next();
});

server.post(config.base + '/access_token', function(req, res, next) {
  var e;
  e = new check.Error;
  e.check(req.body, {
    code: check.format.key,
    key: check.format.key,
    secret: check.format.key
  });
  if (e.failed()) {
    return next(e);
  }
  return db.states.get(req.body.code, function(err, state) {
    if (err) {
      return next(err);
    }
    if (!state || state.step !== "1") {
      return next(new check.Error('code', 'invalid or expired'));
    }
    if (state.key !== req.body.key) {
      return next(new check.Error('code', 'invalid or expired'));
    }
    return db.apps.checkSecret(state.key, req.body.secret, function(e, r) {
      if (e) {
        return next(e);
      }
      if (!r) {
        return next(new check.Error("invalid credentials"));
      }
      db.states.del(req.body.code, (function() {}));
      r = JSON.parse(state.token);
      r.state = state.options.state;
      r.provider = state.provider;
      res.buildJsend = false;
      res.send(r);
      return next();
    });
  });
});

clientCallback = function(data, req, res, next) {
  return function(e, r) {
    var body, browser, chromeext, uaparser, view;
    body = formatters.build(e || r);
    if (data.state) {
      body.state = data.state;
    }
    if (data.provider) {
      body.provider = data.provider.toLowerCase();
    }
    view = '<!DOCTYPE html>\n';
    view += '<html><head><script>(function() {\n';
    view += '\t"use strict";\n';
    view += '\tvar msg=' + JSON.stringify(JSON.stringify(body)) + ';\n';
    if (data.redirect_uri) {
      if (data.redirect_uri.indexOf('#') > 0) {
        view += '\tdocument.location.href = "' + data.redirect_uri + '&oauthio=" + encodeURIComponent(msg);\n';
      } else {
        view += '\tdocument.location.href = "' + data.redirect_uri + '#oauthio=" + encodeURIComponent(msg);\n';
      }
    } else {
      uaparser = new UAParser();
      uaparser.setUA(req.headers['user-agent']);
      browser = uaparser.getBrowser();
      chromeext = data.origin.match(/chrome-extension:\/\/([^\/]+)/);
      if (browser.name.substr(0, 2) === 'IE') {
        res.setHeader('p3p', 'CP="IDC DSP COR ADM DEVi TAIi PSA PSD IVAi IVDi CONi HIS OUR IND CNT"');
        view += 'function createCookie(name, value) {\n';
        view += '	var date = new Date();\n';
        view += '	date.setTime(date.getTime() + 1200 * 1000);\n';
        view += '	var expires = "; expires="+date.toGMTString();\n';
        view += '	document.cookie = name+"="+value+expires+"; path=/";\n';
        view += '}\n';
        view += 'createCookie("oauthio_last",encodeURIComponent(msg));\n';
      } else if (chromeext) {
        view += '\tchrome.runtime.sendMessage("' + chromeext[1] + '", {data:msg});\n';
        view += '\twindow.close();\n';
      } else {
        view += 'var opener = window.opener || window.parent.window.opener;\n';
        view += 'if (opener)\n';
        view += '\topener.postMessage(msg, "' + data.origin + '");\n';
        view += '\twindow.close();\n';
      }
    }
    view += '})();</script></head><body></body></html>';
    res.send(view);
    return next();
  };
};

server.get(config.base + '/', function(req, res, next) {
  var getState;
  if (Object.keys(req.params).length === 0) {
    res.setHeader('Location', config.base + '/admin');
    res.send(302);
    return next();
  }
  res.setHeader('Content-Type', 'text/html');
  getState = function(callback) {
    var oad_uid, stateid, stateref, _ref, _ref1;
    if (req.params.state) {
      return callback(null, req.params.state);
    }
    if (req.headers.referer) {
      stateref = req.headers.referer.match(/state=([^&$]+)/);
      stateid = stateref != null ? stateref[1] : void 0;
      if (stateid) {
        return callback(null, stateid);
      }
    }
    oad_uid = (_ref = req.headers.cookie) != null ? (_ref1 = _ref.match(/oad_uid=%22(.*?)%22/)) != null ? _ref1[1] : void 0 : void 0;
    if (oad_uid) {
      return db.redis.get('cli:state:' + oad_uid, callback);
    }
  };
  return getState(function(err, stateid) {
    if (err) {
      return next(err);
    }
    if (!stateid) {
      return next(new check.Error('state', 'must be present'));
    }
    return db.states.get(stateid, function(err, state) {
      var callback, oa;
      if (err) {
        return next(err);
      }
      if (!state) {
        return next(new check.Error('state', 'invalid or expired'));
      }
      callback = clientCallback({
        state: state.options.state,
        provider: state.provider,
        redirect_uri: state.redirect_uri,
        origin: state.origin
      }, req, res, next);
      if (state.step !== "0") {
        return callback(new check.Error('state', 'code already sent, please use /access_token'));
      }
      oa = new oauth[state.oauthv];
      return oa.access_token(state, req, function(e, r) {
        var d, oad_uid, status, _ref, _ref1;
        status = e ? 'error' : 'success';
        plugins.data.emit('connect.callback', {
          key: state.key,
          provider: state.provider,
          status: status
        });
        if (!e) {
          if (state.options.response_type !== 'token') {
            db.states.set(stateid, {
              token: JSON.stringify(r),
              step: 1
            }, (function() {}));
          }
          if (state.options.response_type === 'code') {
            r = {};
          }
          if (state.options.response_type !== 'token') {
            r.code = stateid;
          }
          if (state.options.response_type === 'token') {
            db.states.del(stateid, (function() {}));
          }
          oad_uid = (_ref = req.headers.cookie) != null ? (_ref1 = _ref.match(/oad_uid=%22(.*?)%22/)) != null ? _ref1[1] : void 0 : void 0;
          if (!oad_uid) {
            oad_uid = db.generateUid();
            d = new Date((new Date).getTime() + 30 * 24 * 3600 * 1000);
            res.setHeader('Set-Cookie', 'oad_uid=%22' + oad_uid + '%22; Path=/; Expires=' + d.toGMTString());
          }
        }
        return callback(e, r);
      });
    });
  });
});

server.get(config.base + '/auth/:provider', function(req, res, next) {
  var callback, domain, e, key, oauthv, options, origin, ref, urlinfos;
  res.setHeader('Content-Type', 'text/html');
  domain = null;
  origin = null;
  ref = fixUrl(req.headers['referer'] || req.headers['origin'] || req.params.d || req.params.redirect_uri || "");
  urlinfos = Url.parse(ref);
  if (!urlinfos.hostname) {
    return next(new restify.InvalidHeaderError('Missing origin or referer.'));
  }
  origin = urlinfos.protocol + '//' + urlinfos.host;
  options = {};
  if (req.params.opts) {
    try {
      options = JSON.parse(req.params.opts);
      if (typeof options !== 'object') {
        return cb(new check.Error('Options must be an object'));
      }
    } catch (_error) {
      e = _error;
      return cb(new check.Error('Error in request parameters'));
    }
  }
  callback = clientCallback({
    state: options.state,
    provider: req.params.provider,
    origin: origin,
    redirect_uri: req.params.redirect_uri
  }, req, res, next);
  key = req.params.k;
  if (!key) {
    return callback(new restify.MissingParameterError('Missing OAuthd public key.'));
  }
  oauthv = req.params.oauthv && {
    "2": "oauth2",
    "1": "oauth1"
  }[req.params.oauthv];
  return async.waterfall([
    function(cb) {
      return db.apps.checkDomain(key, ref, cb);
    }, function(valid, cb) {
      if (!valid) {
        return cb(new check.Error('Origin "' + ref + '" does not match any registered domain/url on ' + config.url.host));
      }
      if (req.params.redirect_uri) {
        return db.apps.checkDomain(key, req.params.redirect_uri, cb);
      } else {
        return cb(null, true);
      }
    }, function(valid, cb) {
      if (!valid) {
        return cb(new check.Error('Redirect "' + req.params.redirect_uri + '" does not match any registered domain on ' + config.url.host));
      }
      return db.providers.getExtended(req.params.provider, cb);
    }, function(provider, cb) {
      plugins.data.emit('connect.auth', {
        key: key,
        provider: provider.provider
      });
      if (oauthv && !provider[oauthv]) {
        return cb(new check.Error("oauthv", "Unsupported oauth version: " + oauthv));
      }
      if (provider.oauth2) {
        if (oauthv == null) {
          oauthv = 'oauth2';
        }
      }
      if (provider.oauth1) {
        if (oauthv == null) {
          oauthv = 'oauth1';
        }
      }
      return db.apps.getKeyset(key, req.params.provider, function(e, r) {
        return cb(e, r, provider);
      });
    }, function(keyset, provider, cb) {
      var oa, opts, parameters, response_type;
      if (!keyset) {
        return cb(new check.Error('This app is not configured for ' + provider.provider));
      }
      parameters = keyset.parameters, response_type = keyset.response_type;
      plugins.data.emit('connect.auth', {
        key: key,
        provider: provider.provider,
        parameters: parameters
      });
      options.response_type = response_type;
      opts = {
        oauthv: oauthv,
        key: key,
        origin: origin,
        redirect_uri: req.params.redirect_uri,
        options: options
      };
      oa = new oauth[oauthv];
      return oa.authorize(provider, parameters, opts, cb);
    }, function(authorize, cb) {
      var oad_uid, _ref, _ref1;
      oad_uid = (_ref = req.headers.cookie) != null ? (_ref1 = _ref.match(/oad_uid=%22(.*?)%22/)) != null ? _ref1[1] : void 0 : void 0;
      if (!oad_uid) {
        return cb(null, authorize.url);
      }
      return db.redis.set('cli:state:' + oad_uid, authorize.state, function(err) {
        if (err) {
          return cb(err);
        }
        db.redis.expire('cli:state:' + oad_uid, 1200);
        return cb(null, authorize.url);
      });
    }
  ], function(err, url) {
    if (err) {
      return callback(err);
    }
    res.setHeader('Location', url);
    res.send(302);
    return next();
  });
});

server.post(config.base_api + '/apps', function(req, res, next) {
  return db.apps.create(req.body, function(e, r) {
  	if (e) {
      return next(e);
    }
    plugins.data.emit('app.create', req, r);
    res.send({
      name: r.name,
      key: r.key,
      domains: r.domains
    });
    return next();
  });
});

server.get(config.base_api + '/apps/:key', function(req, res, next) {
  return async.parallel([
    function(cb) {
      return db.apps.get(req.params.key, cb);
    }, function(cb) {
      return db.apps.getDomains(req.params.key, cb);
    }, function(cb) {
      return db.apps.getKeysets(req.params.key, cb);
    }
  ], function(e, r) {
    if (e) {
      return next(e);
    }
    res.send({
      name: r[0].name,
      key: r[0].key,
      secret: r[0].secret,
      domains: r[1],
      keysets: r[2]
    });
    return next();
  });
});

server.post(config.base_api + '/apps/:key', function(req, res, next) {
  return db.apps.update(req.params.key, req.body, send(res, next));
});

server.del(config.base_api + '/apps/:key', function(req, res, next) {
  return db.apps.get(req.params.key, function(e, app) {
    if (e) {
      return next(e);
    }
    return db.apps.remove(req.params.key, function(e, r) {
      if (e) {
        return next(e);
      }
      plugins.data.emit('app.remove', req, app);
      res.send(check.nullv);
      return next();
    });
  });
});

server.get(config.base_api + '/apps/:key/domains', function(req, res, next) {
  return db.apps.getDomains(req.params.key, send(res, next));
});

server.post(config.base_api + '/apps/:key/domains', function(req, res, next) {
  return db.apps.updateDomains(req.params.key, req.body.domains, send(res, next));
});

server.post(config.base_api + '/apps/:key/domains/:domain', function(req, res, next) {
  return db.apps.addDomain(req.params.key, req.params.domain, send(res, next));
});

server.del(config.base_api + '/apps/:key/domains/:domain', function(req, res, next) {
  return db.apps.remDomain(req.params.key, req.params.domain, send(res, next));
});

server.get(config.base_api + '/apps/:key/keysets', function(req, res, next) {
  return db.apps.getKeysets(req.params.key, send(res, next));
});

server.get(config.base_api + '/apps/:key/keysets/:provider', function(req, res, next) {
  return db.apps.getKeyset(req.params.key, req.params.provider, send(res, next));
});

server.post(config.base_api + '/apps/:key/keysets/:provider', function(req, res, next) {
  return db.apps.addKeyset(req.params.key, req.params.provider, req.body, send(res, next));
});

server.del(config.base_api + '/apps/:key/keysets/:provider', function(req, res, next) {
  return db.apps.remKeyset(req.params.key, req.params.provider, send(res, next));
});

server.get(config.base_api + '/providers', function(req, res, next) {
  return db.providers.getList(send(res, next));
});

server.get(config.base_api + '/providers/:provider', function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.query.extend) {
    return db.providers.getExtended(req.params.provider, send(res, next));
  } else {
    return db.providers.get(req.params.provider, send(res, next));
  }
});

server.get(config.base_api + '/providers/:provider/settings', function(req, res, next) {
  return db.providers.getSettings(req.params.provider, send(res, next));
});

server.get(config.base_api + '/providers/:provider/logo', (function(req, res, next) {
  return fs.exists(Path.normalize(config.rootdir + '/providers/' + req.params.provider + '/logo.png'), function(exists) {
    if (!exists) {
      req.params.provider = 'default';
    }
    req.url = '/' + req.params.provider + '/logo.png';
    req._url = Url.parse(req.url);
    req.path();
    req._path = req._url._path;
    return next();
  });
}), restify.serveStatic({
  directory: config.rootdir + '/providers',
  maxAge: 120
}));

server.get(config.base_api + '/providers/:provider/:file', (function(req, res, next) {
  req.url = '/' + req.params.provider + '/' + req.params.file;
  req._url = Url.parse(req.url);
  req._path = req._url._path;
  return next();
}), restify.serveStatic({
  directory: config.rootdir + '/providers',
  maxAge: config.cacheTime
}));

exports.listen = function(callback) {
  return plugins.run('setup', function() {
    var listen_args;
    listen_args = [config.port];
    if (config.bind) {
      listen_args.push(config.bind);
    }
    listen_args.push(function(err) {
      if (err) {
        return callback(err);
      }
      console.log('%s listening at %s for %s', server.name, server.url, config.host_url);
      plugins.data.emit('server', null);
      return callback(null, server);
    });
    server.on('error', function(err) {
      return callback(err);
    });
    return server.listen.apply(server, listen_args);
  });
};
