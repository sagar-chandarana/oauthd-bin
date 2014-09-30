var OAuth2, OAuth2ResponseParser, OAuthBase, async, check, config, dbapps, dbproviders, dbstates, querystring, request,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

querystring = require('querystring');

async = require('async');

request = require('request');

check = require('./check');

dbstates = require('./db_states');

dbproviders = require('./db_providers');

dbapps = require('./db_apps');

config = require('./config');

OAuth2ResponseParser = require('./oauth2-response-parser');

OAuthBase = require('./oauth-base');

OAuth2 = (function(_super) {
  __extends(OAuth2, _super);

  function OAuth2() {
    OAuth2.__super__.constructor.call(this, 'oauth2');
  }
  
  OAuth2.prototype.parser =  OAuth2ResponseParser;

  OAuth2.prototype.authorize = function(provider, parameters, opts, callback) {
    var _this = this;
    this._setParams(provider.parameters);
    this._setParams(provider.oauth2.parameters);
    return this._createState(provider, opts, function(err, state) {
      var authorize, name, param, query, url, value, _ref, _ref1;
      if (err) {
        return callback(err);
      }
      authorize = provider.oauth2.authorize;
      query = {};
      if (typeof ((_ref = opts.options) != null ? _ref.authorize : void 0) === 'object') {
        query = opts.options.authorize;
      }
      _ref1 = authorize.query;
      for (name in _ref1) {
        value = _ref1[name];
        param = _this._replaceParam(value, {
          state: state.id,
          callback: config.host_url + config.relbase
        }, parameters);
        if (param) {
          query[name] = param;
        }
      }
      url = _this._replaceParam(authorize.url, {}, parameters);
      url += "?" + querystring.stringify(query);
      return callback(null, {
        url: url,
        state: state.id
      });
    });
  };

  OAuth2.prototype.access_token = function(state, req, callback) {
    var err,
      _this = this;
    if (req.params.error || req.params.error_description) {
      err = new check.Error;
      if (req.params.error_description) {
        err.error(req.params.error_description);
      } else {
        err.error(OAuth2ResponseParser.errors_desc.authorize[req.params.error] || 'Error while authorizing');
      }
      if (req.params.error) {
        err.body.error = req.params.error;
      }
      if (req.params.error_uri) {
        err.body.error_uri = req.params.error_uri;
      }
      return callback(err);
    }
    if (!req.params.code) {
      return callback(new check.Error('code', 'unable to find authorize code'));
    }
    return async.parallel([
      function(callback) {
        return dbproviders.getExtended(state.provider, callback);
      }, function(callback) {
        return dbapps.getKeyset(state.key, state.provider, callback);
      }
    ], function(err, res) {
      var access_token, headers, name, options, param, parameters, provider, query, response_type, value, _ref, _ref1, _ref2, _ref3;
      if (err) {
        return callback(err);
      }
      provider = res[0], (_ref = res[1], parameters = _ref.parameters, response_type = _ref.response_type);
      _this._setParams(provider.parameters);
      _this._setParams(provider.oauth2.parameters);
      access_token = provider.oauth2.access_token;
      query = {};
      _ref1 = access_token.query;
      for (name in _ref1) {
        value = _ref1[name];
        param = _this._replaceParam(value, {
          code: req.params.code,
          state: state.id,
          callback: config.host_url + config.relbase
        }, parameters);
        if (param) {
          query[name] = param;
        }
      }
      headers = {};
      if (access_token.format) {
        headers["Accept"] = _this._short_formats[access_token.format] || access_token.format;
      }
      _ref2 = access_token.headers;
      for (name in _ref2) {
        value = _ref2[name];
        param = _this._replaceParam(value, {}, parameters);
        if (param) {
          headers[name] = param;
        }
      }
      options = {
        url: _this._replaceParam(access_token.url, {}, parameters),
        method: ((_ref3 = access_token.method) != null ? _ref3.toUpperCase() : void 0) || "POST",
        followAllRedirects: true,
        encoding: null
      };
      if (Object.keys(headers).length) {
        options.headers = headers;
      }
      if (options.method === "GET") {
        options.qs = query;
      } else {
        options.form = query;
      }
      return request(options, function(e, r, body) {
        var responseParser;
        if (e) {
          return callback(e);
        }
        responseParser = new OAuth2ResponseParser(r, body, headers["Accept"], 'access_token');
        return responseParser.parse(function(err, response) {
          var expire, extra, k, now, requestclone, result, v, _i, _j, _len, _len1, _ref4, _ref5, _ref6, _ref7;
          if (err) {
            return callback(err);
          }
          expire = response.body.expire;
          if (expire == null) {
            expire = response.body.expires;
          }
          if (expire == null) {
            expire = response.body.expires_in;
          }
          if (expire == null) {
            expire = response.body.expires_at;
          }
          if (expire) {
            expire = parseInt(expire);
            now = (new Date).getTime();
            if (expire > now) {
              expire -= now;
            }
          }
          requestclone = {};
          _ref4 = provider.oauth2.request;
          for (k in _ref4) {
            v = _ref4[k];
            requestclone[k] = v;
          }
          _ref5 = this._params;
          for (k in _ref5) {
            v = _ref5[k];
            if (v.scope === 'public') {
              if (requestclone.parameters == null) {
                requestclone.parameters = {};
              }
              requestclone.parameters[k] = parameters[k];
            }
          }
          result = {
            access_token: response.access_token,
            token_type: response.body.token_type,
            expires_in: expire,
            base: provider.baseurl,
            request: requestclone
          };
          if (response.body.refresh_token && response_type === "code") {
            result.refresh_token = response.body.refresh_token;
          }
          _ref6 = access_token.extra || [];
          for (_i = 0, _len = _ref6.length; _i < _len; _i++) {
            extra = _ref6[_i];
            if (response.body[extra]) {
              result[extra] = response.body[extra];
            }
          }
          _ref7 = provider.oauth2.authorize.extra || [];
          for (_j = 0, _len1 = _ref7.length; _j < _len1; _j++) {
            extra = _ref7[_j];
            if (req.params[extra]) {
              result[extra] = req.params[extra];
            }
          }
          return callback(null, result);
        });
      });
    });
  };

  OAuth2.prototype.refresh = function(keyset, provider, token, callback) {
    var headers, name, options, param, parameters, query, refresh, value, _ref, _ref1, _ref2,
      _this = this;
    parameters = keyset.parameters;
    this._setParams(provider.parameters);
    this._setParams(provider.oauth2.parameters);
    refresh = provider.oauth2.refresh;
    query = {};
    _ref = refresh.query;
    for (name in _ref) {
      value = _ref[name];
      param = this._replaceParam(value, {
        refresh_token: token
      }, parameters);
      if (param) {
        query[name] = param;
      }
    }
    headers = {};
    if (refresh.format) {
      headers["Accept"] = this._short_formats[refresh.format] || refresh.format;
    }
    _ref1 = refresh.headers;
    for (name in _ref1) {
      value = _ref1[name];
      param = this._replaceParam(value, {
        refresh_token: token
      }, parameters);
      if (param) {
        headers[name] = param;
      }
    }
    options = {
      url: this._replaceParam(refresh.url, {}, parameters),
      method: ((_ref2 = refresh.method) != null ? _ref2.toUpperCase() : void 0) || "POST",
      followAllRedirects: true
    };
    if (Object.keys(headers).length) {
      options.headers = headers;
    }
    if (options.method === "GET") {
      options.qs = query;
    } else {
      options.form = query;
    }
    return request(options, function(e, r, body) {
      var responseParser;
      if (e) {
        return callback(e);
      }
      responseParser = new OAuth2ResponseParser(r, body, headers["Accept"], 'refresh token');
      return responseParser.parse(function(err, response) {
        var expire, now, result;
        if (err) {
          return callback(err);
        }
        expire = response.body.expire;
        if (expire == null) {
          expire = response.body.expires;
        }
        if (expire == null) {
          expire = response.body.expires_in;
        }
        if (expire == null) {
          expire = response.body.expires_at;
        }
        if (expire) {
          expire = parseInt(expire);
          now = (new Date).getTime();
          if (expire > now) {
            expire -= now;
          }
        }
        result = {
          access_token: response.access_token,
          token_type: response.body.token_type,
          expires_in: expire
        };
        if (response.body.refresh_token && keyset.response_type === "code") {
          result.refresh_token = response.body.refresh_token;
        }
        return callback(null, result);
      });
    });
  };

  OAuth2.prototype.request = function(provider, parameters, req, callback) {
    var name, oauthrequest, options, param, value, _ref, _ref1, _ref2;
    this._setParams(provider.parameters);
    this._setParams(provider.oauth2.parameters);
    if (!parameters.oauthio.token) {
      if (parameters.oauthio.access_token) {
        parameters.oauthio.token = parameters.oauthio.access_token;
      } else {
        return callback(new check.Error("You must provide a 'token' in 'oauthio' http header"));
      }
    }
    oauthrequest = provider.oauth2.request;
    options = {
      method: req.method,
      followAllRedirects: true,
      encoding: null
    };
    options.url = decodeURIComponent(req.params[1]);
    if (!options.url.match(/^[a-z]{2,16}:\/\//)) {
      if (options.url[0] !== '/') {
        options.url = '/' + options.url;
      }
      options.url = oauthrequest.url + options.url;
    }
    options.url = this._replaceParam(options.url, parameters.oauthio, parameters);
    options.qs = {};
    _ref = req.query;
    for (name in _ref) {
      value = _ref[name];
      options.qs[name] = value;
    }
    _ref1 = oauthrequest.query;
    for (name in _ref1) {
      value = _ref1[name];
      param = this._replaceParam(value, parameters.oauthio, parameters);
      if (param) {
        options.qs[name] = param;
      }
    }
    options.headers = {
      accept: req.headers.accept,
      'accept-encoding': req.headers['accept-encoding'],
      'accept-language': req.headers['accept-language'],
      'content-type': req.headers['content-type'],
      'User-Agent': 'OAuth.io'
    };
    _ref2 = oauthrequest.headers;
    for (name in _ref2) {
      value = _ref2[name];
      param = this._replaceParam(value, parameters.oauthio, parameters);
      if (param) {
        options.headers[name] = param;
      }
    }
    if (req.method === "PATCH" || req.method === "POST" || req.method === "PUT") {
      options.body = req._body || req.body;
      if (typeof options.body === 'object') {
        delete options.body;
      }
    }
    return callback(null, request(options));
  };

  return OAuth2;

})(OAuthBase);

module.exports = OAuth2;
