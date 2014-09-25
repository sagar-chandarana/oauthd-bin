var apiRequest;

apiRequest = function($http, $rootScope) {
  return function(url, success, error, opts) {
    var req, _ref;
    if (opts == null) {
      opts = {};
    }
    opts.url = oauthdconfig.base_api + "/" + url;
    if (opts.data) {
      opts.data = JSON.stringify(opts.data);
      if (opts.method == null) {
        opts.method = "POST";
      }
    }
    opts.method = ((_ref = opts.method) != null ? _ref.toUpperCase() : void 0) || "GET";
    if (opts.headers == null) {
      opts.headers = {};
    }
    if ($rootScope.accessToken) {
      //opts.headers.Authorization = "Bearer " + $rootScope.accessToken ;
    }
    if (opts.method === "POST" || opts.method === "PUT") {
      opts.headers['Content-Type'] = 'application/json';
    }
    req = $http(opts);
    if (success) {
      req.success(success);
    } else {
      req.error(function(data) {
      	console.log(data)
      });
    }
    if (error) {
      req.error(error);
    } else {
      req.error(function(e) {
      	console.error(e)
      });
    }
  };
};

hooks.config.push(function() {
  app.factory('AdmService', function($http, $rootScope) {
    var api;
    api = apiRequest($http, $rootScope);
    return {
      me: function(success, error) {
        return api('me', success, error);
      }
    };
  });
  app.factory('ProviderService', function($http, $rootScope) {
    var api;
    api = apiRequest($http, $rootScope);
    return {
      list: function(success, error) {
        return api('providers', success, error);
      },
      get: function(name, success, error) {
        return api('providers/' + name + '?extend=true', success, error);
      },
      auth: function(appKey, provider, success) {
        OAuth.initialize(appKey);
        return OAuth.popup(provider, success);
      }
    };
  });
  app.factory('AppService', function($http, $rootScope) {
    var api;
    var uuid = function (){
      return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    }
    api = apiRequest($http, $rootScope);
    return {
      get: function(key, success, error) {
        return api('apps/' + key, success, error);
      },
      add: function(app, success, error) {
        return api('apps', success, error, {
          data: {
            name: app.name,
            domains: app.domains,
            secret: uuid()
          }
        });
      },
      edit: function(key, app, success, error) {
        return api('apps/' + key, success, error, {
          data: {
            name: app.name,
            domains: app.domains
          }
        });
      },
      remove: function(key, success, error) {
        return api('apps/' + key, success, error, {
          method: 'delete'
        });
      }
    };
  });
  return app.factory('KeysetService', function($rootScope, $http) {
    var api;
    api = apiRequest($http, $rootScope);
    return {
      get: function(app, provider, success, error) {
        return api('apps/' + app + '/keysets/' + provider, success, error);
      },
      add: function(app, provider, keys, response_type, success, error) {
        return api('apps/' + app + '/keysets/' + provider, success, error, {
          data: {
            parameters: keys,
            response_type: response_type
          }
        });
      },
      remove: function(app, provider, success, error) {
        return api('apps/' + app + '/keysets/' + provider, success, error, {
          method: 'delete'
        });
      }
    };
  });
});
