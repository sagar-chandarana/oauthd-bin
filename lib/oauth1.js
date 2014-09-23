var OAuth1, OAuth1ResponseParser, OAuthBase, async, check, config, crypto, db, dbapps, dbproviders, dbstates, querystring, request,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

querystring = require('querystring');

crypto = require('crypto');

async = require('async');

request = require('request');

check = require('./check');

db = require('./db');

dbstates = require('./db_states');

dbproviders = require('./db_providers');

dbapps = require('./db_apps');

config = require('./config');

OAuth1ResponseParser = require('./oauth1-response-parser');

OAuthBase = require('./oauth-base');

OAuth1 = (function(_super) {
  __extends(OAuth1, _super);

  function OAuth1() {
    OAuth1.__super__.constructor.call(this, 'oauth1');
  }

  OAuth1.prototype.authorize = function(provider, parameters, opts, callback) {
    var _this = this;
    this._setParams(provider.parameters);
    this._setParams(provider.oauth1.parameters);
    return this._createState(provider, opts, function(err, state) {
      if (err) {
        return callback(err);
      }
      return _this._getRequestToken(state, provider, parameters, opts, callback);
    });
  };

  OAuth1.prototype._getRequestToken = function(state, provider, parameters, opts, callback) {
    var headers, name, options, param, query, request_token, value, _ref, _ref1, _ref2, _ref3,
      _this = this;
    request_token = provider.oauth1.request_token;
    query = {};
    if (typeof ((_ref = opts.options) != null ? _ref.request_token : void 0) === 'object') {
      query = opts.options.request_token;
    }
    _ref1 = request_token.query;
    for (name in _ref1) {
      value = _ref1[name];
      param = this._replaceParam(value, {
        state: state.id,
        callback: config.host_url + config.relbase
      }, parameters);
      if (param) {
        query[name] = param;
      }
    }
    headers = {};
    if (request_token.format) {
      headers["Accept"] = this._short_formats[request_token.format] || request_token.format;
    }
    _ref2 = request_token.headers;
    for (name in _ref2) {
      value = _ref2[name];
      param = this._replaceParam(value, {}, parameters);
      if (param) {
        headers[name] = param;
      }
    }
    options = {
      url: request_token.url,
      method: ((_ref3 = request_token.method) != null ? _ref3.toUpperCase() : void 0) || "POST",
      encoding: null,
      oauth: {
        callback: query.oauth_callback,
        consumer_key: parameters.client_id,
        consumer_secret: parameters.client_secret
      }
    };
    delete query.oauth_callback;
    if (Object.keys(headers).length) {
      options.headers = headers;
    }
    if (options.method === 'POST') {
      options.form = query;
    } else {
      options.qs = query;
    }
    return request(options, function(err, response, body) {
      if (err) {
        return callback(err);
      }
      return _this._parseGetRequestTokenResponse(response, body, provider, parameters, opts, headers, state, callback);
    });
  };

  OAuth1.prototype._parseGetRequestTokenResponse = function(response, body, provider, parameters, opts, headers, state, callback) {
    var responseParser,
      _this = this;
    responseParser = new OAuth1ResponseParser(response, body, headers["Accept"], 'request_token');
    return responseParser.parse(function(err, response) {
      if (err) {
        return callback(err);
      }
      return dbstates.setToken(state.id, response.oauth_token_secret, function(err, returnCode) {
        if (err) {
          return callback(err);
        }
        return callback(null, _this._generateRequestTokenAuthorizeUrl(state, provider, parameters, opts, response));
      });
    });
  };

  OAuth1.prototype._generateRequestTokenAuthorizeUrl = function(state, provider, parameters, opts, response) {
    var authorize, name, param, query, url, value, _ref, _ref1;
    authorize = provider.oauth1.authorize;
    query = {};
    if (typeof ((_ref = opts.options) != null ? _ref.authorize : void 0) === 'object') {
      query = opts.options.authorize;
    }
    _ref1 = authorize.query;
    for (name in _ref1) {
      value = _ref1[name];
      param = this._replaceParam(value, {
        state: state.id,
        callback: config.host_url + config.relbase
      }, parameters);
      if (param) {
        query[name] = param;
      }
    }
    query.oauth_token = response.oauth_token;
    url = this._replaceParam(authorize.url, {}, parameters);
    url += "?" + querystring.stringify(query);
    return {
      url: url,
      state: state.id
    };
  };

  OAuth1.prototype.access_token = function(state, req, callback) {
    var err, _base,
      _this = this;
    if (!req.params.oauth_token && !req.params.error) {
      if ((_base = req.params).error_description == null) {
        _base.error_description = 'Authorization refused';
      }
    }
    if (req.params.error || req.params.error_description) {
      err = new check.Error;
      err.error(req.params.error_description || 'Error while authorizing');
      if (req.params.error) {
        err.body.error = req.params.error;
      }
      if (req.params.error_uri) {
        err.body.error_uri = req.params.error_uri;
      }
      return callback(err);
    }
    return async.parallel([
      function(callback) {
        return dbproviders.getExtended(state.provider, callback);
      }, function(callback) {
        return dbapps.getKeyset(state.key, state.provider, callback);
      }
    ], function(err, res) {
      var access_token, extra, hard_params, headers, name, options, param, parameters, provider, query, response_type, value, _i, _len, _ref, _ref1, _ref2, _ref3, _ref4;
      if (err) {
        return callback(err);
      }
      provider = res[0], (_ref = res[1], parameters = _ref.parameters, response_type = _ref.response_type);
      err = new check.Error;
      if (provider.oauth1.authorize.ignore_verifier === true) {
        err.check(req.params, {
          oauth_token: 'string'
        });
      } else {
        err.check(req.params, {
          oauth_token: 'string',
          oauth_verifier: 'string'
        });
      }
      if (err.failed()) {
        return callback(err);
      }
      _this._setParams(provider.parameters);
      _this._setParams(provider.oauth1.parameters);
      access_token = provider.oauth1.access_token;
      query = {};
      hard_params = {
        state: state.id,
        callback: config.host_url + config.relbase
      };
      _ref1 = provider.oauth1.authorize.extra || [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        extra = _ref1[_i];
        if (req.params[extra]) {
          hard_params[extra] = req.params[extra];
        }
      }
      _ref2 = access_token.query;
      for (name in _ref2) {
        value = _ref2[name];
        param = _this._replaceParam(value, hard_params, parameters);
        if (param) {
          query[name] = param;
        }
      }
      headers = {};
      if (access_token.format) {
        headers["Accept"] = _this._short_formats[access_token.format] || access_token.format;
      }
      _ref3 = access_token.headers;
      for (name in _ref3) {
        value = _ref3[name];
        param = _this._replaceParam(value, {}, parameters);
        if (param) {
          headers[name] = param;
        }
      }
      options = {
        url: _this._replaceParam(access_token.url, hard_params, parameters),
        method: ((_ref4 = access_token.method) != null ? _ref4.toUpperCase() : void 0) || "POST",
        encoding: null,
        oauth: {
          callback: query.oauth_callback,
          consumer_key: parameters.client_id,
          consumer_secret: parameters.client_secret,
          token: req.params.oauth_token,
          token_secret: state.token
        }
      };
      if (provider.oauth1.authorize.ignore_verifier !== true) {
        options.oauth.verifier = req.params.oauth_verifier;
      } else {
        options.oauth.verifier = "";
      }
      delete query.oauth_callback;
      if (Object.keys(headers).length) {
        options.headers = headers;
      }
      if (options.method === 'POST') {
        options.form = query;
      } else {
        options.qs = query;
      }
      return request(options, function(e, r, body) {
        var responseParser;
        if (e) {
          return callback(e);
        }
        responseParser = new OAuth1ResponseParser(r, body, headers["Accept"], 'access_token');
        return responseParser.parse(function(err, response) {
          var expire, k, now, requestclone, result, v, _j, _k, _len1, _len2, _ref5, _ref6, _ref7, _ref8;
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
          _ref5 = provider.oauth1.request;
          for (k in _ref5) {
            v = _ref5[k];
            requestclone[k] = v;
          }
          _ref6 = _this._params;
          for (k in _ref6) {
            v = _ref6[k];
            if (v.scope === 'public') {
              if (requestclone.parameters == null) {
                requestclone.parameters = {};
              }
              requestclone.parameters[k] = parameters[k];
            }
          }
          result = {
            oauth_token: response.oauth_token,
            oauth_token_secret: response.oauth_token_secret,
            expires_in: expire,
            request: requestclone
          };
          _ref7 = access_token.extra || [];
          for (_j = 0, _len1 = _ref7.length; _j < _len1; _j++) {
            extra = _ref7[_j];
            if (response.body[extra]) {
              result[extra] = response.body[extra];
            }
          }
          _ref8 = provider.oauth1.authorize.extra || [];
          for (_k = 0, _len2 = _ref8.length; _k < _len2; _k++) {
            extra = _ref8[_k];
            if (req.params[extra]) {
              result[extra] = req.params[extra];
            }
          }
          return callback(null, result);
        });
      });
    });
  };

  OAuth1.prototype.request = function(provider, parameters, req, callback) {
    var name, oauthrequest, options, param, value, _ref, _ref1, _ref2;
    this._setParams(provider.parameters);
    this._setParams(provider.oauth1.parameters);
    if (!parameters.oauthio.oauth_token || !parameters.oauthio.oauth_token_secret) {
      return callback(new check.Error("You must provide 'oauth_token' and 'oauth_token_secret' in 'oauthio' http header"));
    }
    oauthrequest = provider.oauth1.request;
    options = {
      method: req.method,
      followAllRedirects: true
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
    options.oauth = {
      consumer_key: parameters.client_id,
      consumer_secret: parameters.client_secret,
      token: parameters.oauthio.oauth_token,
      token_secret: parameters.oauthio.oauth_token_secret
    };
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

  return OAuth1;

})(OAuthBase);

module.exports = OAuth1;
