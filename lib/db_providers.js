var Path, async, check, config, def, fs, providers;

fs = require("fs");

Path = require("path");

async = require("async");

config = require("./config");

check = require("./check");

def = {
  oauth2: {
    authorize: {
      query: {
        client_id: "{client_id}",
        response_type: "code",
        redirect_uri: "{{callback}}",
        scope: "{scope}",
        state: "{{state}}"
      }
    },
    access_token: {
      query: {
        client_id: "{client_id}",
        client_secret: "{client_secret}",
        redirect_uri: "{{callback}}",
        grant_type: "authorization_code",
        code: "{{code}}"
      }
    },
    request: {
      headers: {
        "Authorization": "Bearer {{token}}"
      }
    },
    refresh: {
      query: {
        client_id: "{client_id}",
        client_secret: "{client_secret}",
        grant_type: "refresh_token",
        refresh_token: "{{refresh_token}}"
      }
    },
    revoke: {}
  },
  oauth1: {
    request_token: {
      query: {
        oauth_callback: "{{callback}}"
      }
    },
    authorize: {},
    access_token: {
      query: {}
    },
    request: {}
  }
};

providers = {
  _list: {},
  _cached: false
};

exports.getList = function(callback) {
  var k, v;
  if (!providers._cached) {
    return fs.readdir(config.rootdir + '/providers', function(err, provider_names) {
      var cmds, provider, _fn, _i, _len;
      if (err) {
        return callback(err);
      }
      cmds = [];
      _fn = function(provider) {
        if (provider !== 'default') {
          return cmds.push(function(callback) {
            return exports.get(provider, function(err, data) {
              var _base;
              if (err) {
                console.error("Error in " + provider + ".json:", err, "skipping this provider");
                return callback(null);
              }
              if ((_base = providers._list)[provider] == null) {
                _base[provider] = {
                  cached: false,
                  name: data.name || provider
                };
              }
              return callback(null);
            });
          });
        }
      };
      for (_i = 0, _len = provider_names.length; _i < _len; _i++) {
        provider = provider_names[_i];
        _fn(provider);
      }
      return async.parallel(cmds, function(err, res) {
        var k, v;
        if (err) {
          return callback(err);
        }
        providers._cached = true;
        return callback(null, (function() {
          var _ref, _results;
          _ref = providers._list;
          _results = [];
          for (k in _ref) {
            v = _ref[k];
            _results.push({
              provider: k,
              name: v.name
            });
          }
          return _results;
        })());
      });
    });
  } else {
    return callback(null, (function() {
      var _ref, _results;
      _ref = providers._list;
      _results = [];
      for (k in _ref) {
        v = _ref[k];
        _results.push({
          provider: k,
          name: v.name
        });
      }
      return _results;
    })());
  }
};

exports.get = function(provider, callback) {
  var provider_name, providers_dir;
  provider_name = provider;
  providers_dir = config.rootdir + '/providers';
  provider = Path.resolve(providers_dir, provider + '/conf.json');
  if (Path.relative(providers_dir, provider).substr(0, 2) === "..") {
    return callback(new check.Error('Not authorized'));
  }
  return fs.readFile(provider, function(err, data) {
    var content;
    if ((err != null ? err.code : void 0) === 'ENOENT') {
      return callback(new check.Error('No such provider: ' + provider_name));
    }
    if (err) {
      return callback(err);
    }
    content = null;
    try {
      content = JSON.parse(data);
    } catch (_error) {
      err = _error;
      return callback(err);
    }
    content.provider = provider_name;
    return callback(null, content);
  });
};

exports.getSettings = function(provider, callback) {
  var provider_name, providers_dir;
  provider_name = provider;
  providers_dir = config.rootdir + '/providers';
  provider = Path.resolve(providers_dir, provider + '/settings.json');
  if (Path.relative(providers_dir, provider).substr(0, 2) === "..") {
    return callback(new check.Error('Not authorized'));
  }
  return fs.readFile(provider, function(err, data) {
    var content;
    if ((err != null ? err.code : void 0) === 'ENOENT') {
      return callback(new check.Error('No settings infos for ' + provider_name));
    }
    if (err) {
      return callback(err);
    }
    content = null;
    try {
      content = JSON.parse(data);
    } catch (_error) {
      err = _error;
      return callback(err);
    }
    content.provider = provider_name;
    return callback(null, content);
  });
};

exports.getExtended = function(name, callback) {
  var provider;
  provider = providers._list[name];
  if (provider != null ? provider.cache : void 0) {
    return callback(null, provider.data);
  }
  return exports.get(name, function(err, res) {
    var base_url, endpoint, endpoint_name, fillRequired, found_state, k, oauthv, params, v, _base, _i, _j, _len, _len1, _ref, _ref1, _ref10, _ref11, _ref12, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    if (err) {
      return callback(err);
    }
    provider = (_base = providers._list)[name] != null ? (_base = providers._list)[name] : _base[name] = {
      cache: false
    };
    base_url = "";
    if (res.url) {
      base_url = res.url.match(/^.{2,5}:\/\/[^/]+/)[0] || "";
    }
    _ref = ['oauth1', 'oauth2'];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      oauthv = _ref[_i];
      if (res[oauthv] != null) {
        found_state = false;
        _ref1 = ['request_token', 'authorize', 'access_token', 'request', 'refresh', 'revoke'];
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          endpoint_name = _ref1[_j];
          if (oauthv === 'oauth2' && endpoint_name === 'request_token') {
            continue;
          }
          endpoint = res[oauthv][endpoint_name];
          if (endpoint_name === 'request' && !endpoint) {
            endpoint = res[oauthv][endpoint_name] = {};
          }
          if (!endpoint) {
            res[oauthv][endpoint_name] = {};
            continue;
          }
          if (typeof endpoint === 'string') {
            endpoint = res[oauthv][endpoint_name] = {
              url: endpoint
            };
          }
          if (res.url && ((_ref2 = endpoint.url) != null ? _ref2[0] : void 0) === '/') {
            endpoint.url = res.url + endpoint.url;
          }
          if (endpoint_name === 'request') {
            if (!endpoint.url) {
              endpoint.url = base_url;
            }
            fillRequired = function(str) {
              var hardparamRegexp, matches, _results;
              hardparamRegexp = /\{\{(.+?)\}\}/g;
              _results = [];
              while (matches = hardparamRegexp.exec(str)) {
                if (matches[1] !== 'token') {
                  if (endpoint.required == null) {
                    endpoint.required = [];
                  }
                  _results.push(endpoint.required.push(matches[1]));
                } else {
                  _results.push(void 0);
                }
              }
              return _results;
            };
            fillRequired(endpoint.url);
            if (endpoint.query) {
              _ref3 = endpoint.query;
              for (k in _ref3) {
                v = _ref3[k];
                fillRequired(v);
              }
            }
            if (endpoint.headers) {
              _ref4 = endpoint.headers;
              for (k in _ref4) {
                v = _ref4[k];
                fillRequired(v);
              }
            }
          }
          if (!endpoint.query && endpoint_name === 'authorize' && endpoint.ignore_verifier) {
            endpoint.query = {
              oauth_callback: '{{callback}}'
            };
          }
          if (!endpoint.query && def[oauthv][endpoint_name].query) {
            endpoint.query = {};
            _ref5 = def[oauthv][endpoint_name].query;
            for (k in _ref5) {
              v = _ref5[k];
              endpoint.query[k] = v;
            }
          }
          if (!endpoint.query && def[oauthv][endpoint_name].headers) {
            endpoint.headers = endpoint.headers? endpoint.headers : {};
            _ref6 = def[oauthv][endpoint_name].headers;
            for (k in _ref6) {
              v = _ref6[k];
              endpoint.headers[k] = endpoint.headers[k]? endpoint.headers[k] : v;
            }
          }
          _ref7 = endpoint.query;
          for (k in _ref7) {
            v = _ref7[k];
            if (v.indexOf('{{state}}') !== -1) {
              found_state = true;
            }
            if (v.indexOf('{scope}') !== -1 && !((_ref8 = res[oauthv].parameters) != null ? _ref8.scope : void 0) && !((_ref9 = res.parameters) != null ? _ref9.scope : void 0)) {
              delete endpoint.query[k];
            }
          }
          if (!found_state) {
            _ref10 = endpoint.query;
            for (k in _ref10) {
              v = _ref10[k];
              endpoint.query[k] = v.replace(/\{\{callback\}\}/g, '{{callback}}?state={{state}}');
            }
          }
        }
        params = res[oauthv].parameters;
        if (params) {
          for (k in params) {
            v = params[k];
            if (typeof v === 'string') {
              params[k] = {
                type: v
              };
            }
            if (!params[k].type) {
              params[k].type = 'string';
            }
            if (params[k].values && !params[k].cardinality) {
              params[k].cardinality = '*';
            }
            if (params[k].values && !params[k].separator) {
              params[k].separator = ' ';
            }
          }
        }
      }
    }
    if (!((_ref11 = res.oauth1) != null ? _ref11.parameters : void 0) && !((_ref12 = res.oauth2) != null ? _ref12.parameters : void 0) && !res.parameters) {
      res.parameters = {
        client_id: 'string',
        client_secret: 'string'
      };
    }
    params = res.parameters;
    if (params) {
      for (k in params) {
        v = params[k];
        if (typeof v === 'string') {
          params[k] = {
            type: v
          };
        }
        if (!params[k].type) {
          params[k].type = 'string';
        }
        if (params[k].values && !params[k].cardinality) {
          params[k].cardinality = '*';
        }
        if (params[k].values && !params[k].separator) {
          params[k].separator = ' ';
        }
      }
    }
    provider.data = res;
    provider.cache = true;
    return callback(null, res);
  });
};
