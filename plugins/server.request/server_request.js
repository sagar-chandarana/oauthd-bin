var Url, async, oauth, qs, restify;

async = require('async');

qs = require('querystring');

Url = require('url');

restify = require('restify');

zlib = require('zlib');

accessObjByString = function(o, s) {
	s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
	s = s.replace(/^\./, '');           // strip a leading dot
	var a = s.split('.');
	while (a.length) {
		var n = a.shift();
		if (n in o) {
		    o = o[n];
		} else {
		    return;
		}
	}
	return o;
}

oauth = {
  oauth1: require('../../lib/oauth1'),
  oauth2: require('../../lib/oauth2')
};

exports.setup = function(callback) {
  var doRequest, fixUrl,
    _this = this;
  fixUrl = function(ref) {
    return ref.replace(/^([a-zA-Z\-_]+:\/)([^\/])/, '$1/$2');
  };
  doRequest = function(req, res, next, isMe) {
    var cb, oauthio, origin, ref, urlinfos;
    cb = _this.server.send(res, next);
    oauthio = req.headers.oauthio;
    if (!oauthio) {
      return cb(new _this.check.Error("You must provide a valid 'oauthio' http header"));
    }
    oauthio = qs.parse(oauthio);
    if (!oauthio.k) {
      return cb(new _this.check.Error("oauthio_key", "You must provide a 'k' (key) in 'oauthio' header"));
    }
    origin = null;
    ref = fixUrl(req.headers['referer'] || req.headers['origin'] || "http://localhost");
    urlinfos = Url.parse(ref);
    if (!urlinfos.hostname) {
      ref = origin = "http://localhost";
    } else {
      origin = urlinfos.protocol + '//' + urlinfos.host;
    }
    return async.parallel([
      function(callback) {
        return _this.db.providers.getExtended(req.params[0], callback);
      }, function(callback) {
        return _this.db.apps.getKeyset(oauthio.k, req.params[0], callback);
      }, function(callback) {
        return _this.db.apps.checkDomain(oauthio.k, ref, callback);
      }
    ], function(err, results) {
      var domaincheck, oa, oauthv, parameters, provider, _ref;
      if (err) {
        return cb(err);
      }
      provider = results[0], (_ref = results[1], parameters = _ref.parameters), domaincheck = results[2];
      if (!domaincheck) {
        return cb(new _this.check.Error('Origin "' + ref + '" does not match any registered domain/url on ' + _this.config.url.host));
      }
      oauthv = oauthio.oauthv && {
        "2": "oauth2",
        "1": "oauth1"
      }[oauthio.oauthv];
      if (oauthv && !provider[oauthv]) {
        return cb(new _this.check.Error("oauthio_oauthv", "Unsupported oauth version: " + oauthv));
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
      if(isMe) {
      	req.params[1] = provider[oauthv].me.url;
      }
      console.log('params', req.params);
      oa = new oauth[oauthv];
      parameters.oauthio = oauthio;
      return oa.request(provider, parameters, req, function(err, api_request) {
        if (err) {
          return cb(err);
        }
        api_request.pipefilter = function(response, dest) {
          dest.setHeader('Access-Control-Allow-Origin', origin);
          return dest.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
        };
        var body='';
        api_request.on('data', function(chunk) {
           body += chunk;
        });
        if(!isMe) {
        	api_request.pipe(res);	
        }
        return api_request.once('end', function() {
          if(isMe) {
		      var providerMe = JSON.parse(body);
		      var me = {};
		      //streamlining 'me' object
		      for(var prop in provider[oauthv].me.format) {
		      	me[prop] = accessObjByString(providerMe, provider[oauthv].me.format[prop]);
		      }
		      me.raw = providerMe;
		      res.send(me);
          }
          return next(false);
        });
      });
    });
  };
  this.server.opts(new RegExp('^' + this.config.base + '/request/([a-zA-Z0-9_\\.~-]+)/(.*)$'), function(req, res, next) {
    var origin, ref, urlinfos;
    origin = null;
    ref = fixUrl(req.headers['referer'] || req.headers['origin'] || "http://localhost");
    urlinfos = Url.parse(ref);
    if (!urlinfos.hostname) {
      return next(new restify.InvalidHeaderError('Missing origin or referer.'));
    }
    origin = urlinfos.protocol + '//' + urlinfos.host;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    if (req.headers['access-control-request-headers']) {
      res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers']);
    }
    res.cache({
      maxAge: 120
    });
    res.send(200);
    return next(false);
  });
  this.server.get(new RegExp('^' + this.config.base + '/request/([a-zA-Z0-9_\\.~-]+)/(.*)$'), doRequest);
  this.server.post(new RegExp('^' + this.config.base + '/request/([a-zA-Z0-9_\\.~-]+)/(.*)$'), doRequest);
  this.server.put(new RegExp('^' + this.config.base + '/request/([a-zA-Z0-9_\\.~-]+)/(.*)$'), doRequest);
  this.server.patch(new RegExp('^' + this.config.base + '/request/([a-zA-Z0-9_\\.~-]+)/(.*)$'), doRequest);
  this.server.del(new RegExp('^' + this.config.base + '/request/([a-zA-Z0-9_\\.~-]+)/(.*)$'), doRequest);
  this.server.get(this.config.base + '/auth/:0/me', function() {
  	doRequest(arguments[0], arguments[1], arguments[2], true);
  });
  return callback();
};
