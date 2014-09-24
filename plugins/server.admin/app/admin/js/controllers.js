hooks.config.push(function() {
  app.controller('LogoutCtrl', function($location, $rootScope) {
    return document.location.reload();
  });
  app.controller('ProviderCtrl', function($filter, $scope, $rootScope, ProviderService, $timeout) {
    return ProviderService.list(function(json) {
      var provider, _i, _len, _ref;
      $scope.providers = (function() {
        var _i, _len, _ref, _results;
        _ref = json.data;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          provider = _ref[_i];
          _results.push(provider.provider);
        }
        return _results;
      })();
      if (!$rootScope.providers_name) {
        $rootScope.providers_name = {};
      }
      _ref = json.data;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        provider = _ref[_i];
        $rootScope.providers_name[provider.provider] = provider.name;
      }
      $scope.providers_name = $rootScope.providers_name;
      $scope.filtered = $filter('filter')($scope.providers, $scope.query);
      $scope.pagination = {
        nbPerPage: 15,
        nbPages: Math.ceil($scope.providers.length / 15),
        current: 1,
        max: 5
      };
      return $scope.queryChange = function(query) {
        return $timeout((function() {
          $scope.filtered = $filter('filter')($scope.providers, query);
          $scope.pagination.nbPages = Math.ceil($scope.filtered.length / $scope.pagination.nbPerPage);
          return $scope.pagination.current = 1;
        }), 0);
      };
    });
  });
  app.controller('ApiKeyManagerCtrl', function($scope, $timeout, $rootScope, $location, UserService, $http, MenuService, KeysetService, ProviderService) {
    MenuService.changed();
    if (!UserService.isLogin()) {
      $location.path('/');
    }
    if (!$rootScope.providers_name) {
      $rootScope.providers_name = {};
    }
    $scope.providers_name = $rootScope.providers_name;
    $scope.keySaved = false;
    $scope.authUrl = oauthdconfig.host_url + oauthdconfig.base;
    $scope.authDomain = oauthdconfig.host_url;
    $scope.oauthdconfig = oauthdconfig;
    $scope.createKeyProvider = 'facebook';
    $scope.createKeyTemplate = "/templates/partials/create-key.html";
    $scope.createAppTemplate = "/templates/partials/create-app.html";
    $scope.providersTemplate = "/templates/partials/providers.html";
    $scope.createKeyLastStepTemplate = "/templates/partials/create-key-laststep.html";
    $scope.cancelCreateKey = function() {
      var app, _ref;
      if ($scope.createKeyStep <= 2) {
        if ($scope.isDropped && $scope.createKeyExists) {
          app = $rootScope.apps.find((function(n) {
            return n.key === $scope.createKeyAppKey;
          }));
          if ((app != null ? (_ref = app.keysets) != null ? _ref.length : void 0 : void 0) > 0) {
            app.keysets.removeAt(app.keysets.length - 1);
          }
        }
        return $scope.$broadcast('btHide');
      } else {
        return $scope.createKeyStep--;
      }
    };
    $scope.scopeSelect = {
      escapeMarkup: function(m) {
        return m;
      }
    };
    $scope.startDrag = function(a, b, c, d) {
      return $('.col-lg-4 .dashboard-sidenav li').css('z-index', 10000);
    };
    $scope.stopDrag = function(a) {
      return $('.col-lg-4 .dashboard-sidenav li').css('z-index', 0);
    };
    $scope.modifyType = function(a) {
      return $scope.createKeyType = a;
    };
    $scope.createKeySubmit = function() {
      var conf, data, field, key, provider, response_type, _ref;
      provider = $scope.createKeyProvider;
      $rootScope.error = {
        state: false,
        message: '',
        type: ''
      };
      if ($scope.createKeyStep === 3) {
        key = $scope.createKeyAppKey;
        conf = $scope.createKeyConf;
        response_type = $scope.createKeyType;
        data = {};
        for (field in conf) {
          if (!conf[field].value && (field !== 'scope' && field !== 'permissions' && field !== 'perms')) {
            $rootScope.error.state = true;
            $rootScope.error.type = "CREATE_KEY";
            $rootScope.error.message = "" + field + " must be set";
            break;
          }
          data[field] = conf[field].value;
        }
        if (!$rootScope.error.state) {
          KeysetService.add(key, provider, data, response_type, (function(keysetEntry) {
            var app;
            app = $rootScope.apps.find(function(n) {
              return n.key === $scope.createKeyAppKey;
            });
            if (!app.keys) {
              app.keys = {};
            }
            if (!app.response_type) {
              app.response_type = {};
            }
            app.showKeys = true;
            app.response_type[provider] = response_type;
            app.keys[provider] = data;
            if (!$scope.apikeyUpdate) {
              app.keysets.add(provider);
              app.keysets.sort();
            }
            return $scope.$broadcast('btHide');
          }), function(error) {
            return console.log("error", error);
          });
        }
      } else {
        $scope.createKeyStep++;
      }
      if (((_ref = app.keysField) != null ? _ref[provider] : void 0) == null) {
        return ProviderService.get(provider, (function(conf) {
          var k, oauth, v, _ref1;
          if (app.keysField == null) {
            app.keysField = {};
          }
          oauth = "oauth1";
          if (Object.has(conf.data, "oauth2")) {
            oauth = "oauth2";
          }
          app.keysField[provider] = conf.data[oauth].parameters || {};
          _ref1 = conf.data.parameters;
          for (k in _ref1) {
            v = _ref1[k];
            app.keysField[provider][k] = v;
          }
        }), function(error) {
          return console.log("error", error);
        });
      }
    };
    $scope.$watch("createKeyStep", function(newVal, oldVal) {
      if (newVal === 2 || newVal === 1) {
        $scope.createKeyButton = "Next";
        $scope.createKeyCancel = "Cancel";
        $scope.createKeyBtnClass = "btn btn-success";
      }
      if (newVal === 3) {
        $scope.createKeyButton = "Finish";
        $scope.createKeyCancel = "Back";
        $scope.createKeyBtnClass = "btn btn-primary";
        $http({
          method: "GET",
          url: $scope.oauthdconfig.base_api + '/providers/' + $scope.createKeyProvider + '/keys.png'
        }).success(function() {
          return $scope.createKeyKeysImg = true;
        }).error(function() {
          return $scope.createKeyKeysImg = false;
        });
        $scope.apikeyUpdate = false;
        return KeysetService.get($scope.createKeyAppKey, $scope.createKeyProvider, (function(json) {
          var field, _i, _len, _ref;
          if (json.data != null) {
            $scope.apikeyUpdate = true;
            for (field in json.data.parameters) {
              $scope.createKeyConf[field].value = json.data.parameters[field];
            }
            return $scope.createKeyType = json.data.response_type;
          } else {
            _ref = $scope.createKeyConf;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              field = _ref[_i];
              field.value = "";
            }
            return $scope.createKeyType = "token";
          }
        }), function(error) {});
      }
    });
    $scope.updateAppKey = function(key) {
      return $scope.createKeyAppKey = key;
    };
    return $scope.keyFormOpen = function(droppable, helper) {
      var key, name,
        _this = this;
      if (Object.isString(droppable)) {
        name = droppable;
        key = $rootScope.apps[0].key;
        $scope.isDropped = false;
      } else {
        name = $('.provider-text', helper.draggable).attr('data-provider');
        $scope.isDropped = true;
        key = $(droppable.target).find('.app-public-key').text().trim();
      }
      return ProviderService.get(name, (function(data) {
        var a, k, oauth, v, _ref, _ref1, _results;
        $scope.$broadcast('btShow');
        $scope.createKeyProvider = name;
        $scope.createKeyAppKey = key;
        $scope.createKeyHref = data.data.href;
        a = $rootScope.apps.find(function(n) {
          return n.key === $scope.createKeyAppKey;
        });
        $scope.createKeyAppName = a.name;
        $scope.createKeyStep = 2;
        if (Object.has(data.data, "oauth2")) {
          $scope.oauthType = "OAuth 2";
          $scope.createKeyConf = data.data.oauth2.parameters || {};
          oauth = "oauth2";
        } else {
          $scope.oauthType = "OAuth 1.0a";
          $scope.createKeyConf = data.data.oauth1.parameters || {};
          oauth = "oauth1";
        }
        _ref = data.data.parameters;
        for (k in _ref) {
          v = _ref[k];
          $scope.createKeyConf[k] = v;
        }
        $http({
          method: "GET",
          url: $scope.oauthdconfig.base_api + '/providers/' + $scope.createKeyProvider + '/config.png'
        }).success(function() {
          return $scope.createKeyConfigImg = true;
        }).error(function() {
          return $scope.createKeyConfigImg = false;
        });
        if (a.keysField == null) {
          a.keysField = {};
        }
        a.keysField[$scope.createKeyProvider] = data.data[oauth].parameters || {};
        _ref1 = data.data.parameters;
        _results = [];
        for (k in _ref1) {
          v = _ref1[k];
          _results.push(a.keysField[$scope.createKeyProvider][k] = v);
        }
        return _results;
      }), function(error) {});
    };
  });
  app.controller('AppCtrl', function($scope, $rootScope, $location, AdmService, UserService, $timeout, AppService, ProviderService, KeysetService) {
    var serializeObject, setKeysField;
    if (!UserService.isLogin()) {
      $location.path('/');
    }
    $scope.loaderApps = true;
    serializeObject = function(form) {
      var a, o;
      o = {};
      a = form.serializeArray();
      $.each(a, function() {
        var pname;
        pname = this.name.replace(/\[\]/, '');
        if (o[pname] != null) {
          if (!o[this.name].push) {
            o[pname] = [o[pname]];
          }
          return o[pname].push(this.value || '');
        } else {
          return o[pname] = this.value || '';
        }
      });
      return o;
    };
    AdmService.me((function(me) {
      var i, n, _results;
      $rootScope.apps = me.data.apps;
      n = $rootScope.apps.length;
      $rootScope.noApp = false;
      if (n === 0) {
        if ($location.path() === '/key-manager') {
          $location.path("/app-create");
        } else {
          $rootScope.noApp = true;
        }
      }
      $scope.counter = 0;
      _results = [];
      for (i in $rootScope.apps) {
        _results.push((function(i, n) {
          var _this = this;
          return AppService.get($rootScope.apps[i], (function(app) {
            $scope.counter++;
            delete app.data.secret;
            $rootScope.apps[i] = app.data;
            $rootScope.apps[i].keysets.sort();
            $rootScope.apps[i].keys = {};
            $rootScope.apps[i].response_type = {};
            $rootScope.apps[i].showKeys = false;
            return $timeout((function() {
              if ($scope.counter === n) {
                return $scope.loaderApps = false;
              }
            }), 0);
          }), function(error) {
            return console.log("error", error);
          });
        })(i, n));
      }
      return _results;
    }), function(error) {
      return console.log("error", error);
    });
    $scope.editMode = false;
    $scope.appCreateTemplate = "/templates/partials/create-app.html";
    $scope.createAppForm = {
      name: "",
      input: "",
      domains: ["localhost"]
    };
    $scope.displaySecret = function(app, disp) {
      if (!disp) {
        return (app.secret = void 0);
      }
      return AppService.get(app.key, function(r) {
        var _ref;
        return app.secret = (_ref = r.data) != null ? _ref.secret : void 0;
      });
    };
    $scope.tryAuth = function(provider, key) {
      return ProviderService.auth(key, provider, function(err, res) {
        return $scope.$apply(function() {
          var app;
          app = $rootScope.apps.find(function(n) {
            return n.key === key;
          });
          if (app.showKeys !== provider) {
            $scope.keyClick(provider, app);
          }
          if (app.auth == null) {
            app.auth = {};
          }
          return app.auth[provider] = {
            error: err,
            result: res
          };
        });
      });
    };
    $scope.addDomain = function() {
      if ($scope.createAppForm.input !== "" && $scope.createAppForm.domains.indexOf($scope.createAppForm.input) === -1) {
        $scope.createAppForm.domains.push($scope.createAppForm.input);
        return $scope.createAppForm.input = "";
      }
    };
    $scope.removeDomain = function(name) {
      return $scope.createAppForm.domains.remove(name);
    };
    $scope.createAppSubmit = function() {
      var nb_domain;
      $scope.addDomain();
      $rootScope.error = {
        state: false,
        type: "",
        message: ""
      };
      nb_domain = $scope.createAppForm.domains.length;
      if (nb_domain === 0) {
        $rootScope.error.state = true;
        $rootScope.error.type = "CREATE_APP";
        $rootScope.error.message = "You must specify a name and at least one domain for your application";
        return;
      }
      return AppService.add($scope.createAppForm, (function() {
        return $location.path("/key-manager");
      }), function(error) {
        $rootScope.error.state = true;
        $rootScope.error.type = "CREATE_APP";
        return $rootScope.error.message = "You must specify a name and at least one domain for your application";
      });
    };
    setKeysField = function(app, provider) {
      var _ref;
      if (((_ref = app.keysField) != null ? _ref[provider] : void 0) == null) {
        return ProviderService.get(provider, function(conf) {
          var k, oauth, v, _ref1, _results;
          if (app.keysField == null) {
            app.keysField = {};
          }
          oauth = "oauth1";
          if (Object.has(conf.data, "oauth2")) {
            oauth = "oauth2";
          }
          app.keysField[provider] = conf.data[oauth].parameters || {};
          _ref1 = conf.data.parameters;
          _results = [];
          for (k in _ref1) {
            v = _ref1[k];
            _results.push(app.keysField[provider][k] = v);
          }
          return _results;
        });
      }
    };
    $scope.keyClick = function(provider, app) {
      if (app.showKeys !== provider) {
        if (!app.keys[provider]) {
          return KeysetService.get(app.key, provider, function(data) {
            setKeysField(app, provider);
            app.keys[provider] = data.data.parameters;
            app.response_type[provider] = data.data.response_type;
            return app.showKeys = provider;
          });
        } else {
          return app.showKeys = provider;
        }
      } else {
        return app.showKeys = false;
      }
    };
    $scope.editApp = function(key) {
      var app, clone;
      app = $rootScope.apps.find(function(n) {
        return n['key'] === key;
      });
      clone = Object.clone(app);
      $scope.editMode = clone.key;
      return $scope.createAppForm = {
        name: clone.name,
        input: "",
        domains: Array.create(clone.domains)
      };
    };
    $scope.editAppCancel = function() {
      return $scope.editMode = false;
    };
    $scope.editAppSubmit = function(key) {
      var nb_domain;
      nb_domain = $scope.createAppForm.domains.length;
      $scope.addDomain();
      if (nb_domain === 0) {
        $rootScope.error.state = true;
        $rootScope.error.type = "CREATE_APP";
        $rootScope.error.message = "You must specify a name and at least one domain for your application";
        return;
      }
      return AppService.edit(key, $scope.createAppForm, (function() {
        var app;
        app = $rootScope.apps.find(function(n) {
          return n['key'] === key;
        });
        app.domains = Array.create($scope.createAppForm.domains);
        app.name = $scope.createAppForm.name;
        return $scope.editMode = false;
      }), function(error) {
        $rootScope.error.state = true;
        $rootScope.error.type = "CREATE_APP";
        return $rootScope.error.message = "You must specify a name and at least one domain for your application";
      });
    };
    $scope.removeApp = function(key) {
      if (confirm('Are you sure you want to remove this application? All API Keys stored will be lost forever!')) {
        return AppService.remove(key, (function() {
          $rootScope.apps.remove(function(n) {
            return n['key'] === key;
          });
          if ($rootScope.apps.isEmpty()) {
            return $location.path("/app-create");
          }
        }), function(error) {});
      }
    };
    $scope.keySaved = false;
    $scope.editKeyset = function(app, provider) {
      var i, keys, response_type, select, selector;
      $rootScope.error = {
        state: false,
        message: '',
        type: ''
      };
      keys = serializeObject($('#appkey-' + app.key + '-' + provider));
      response_type = keys.response_type;
      delete keys.response_type;
      selector = $('#appkey-' + app.key + '-' + provider + ' select[ui-select2=scopeSelect]');
      select = false;
      if (selector.length > 0) {
        select = selector.val();
        keys[selector.attr('name')] = select;
      }
      for (i in keys) {
        if (!keys[i] && (i !== 'scope' && i !== 'permissions' && i !== 'perms')) {
          $rootScope.error.state = true;
          $rootScope.error.type = "CREATE_KEY";
          $rootScope.error.message = "" + i + " must be set";
          break;
        }
      }
      if (!$rootScope.error.state) {
        return KeysetService.add(app.key, provider, keys, response_type, function(data) {
          $scope.keySaved = true;
          app.editProvider = {};
          return $timeout((function() {
            return $scope.keySaved = false;
          }), 1000);
        });
      }
    };
    return $scope.removeKeyset = function(app, provider) {
      if (confirm("Are you sure you want to delete this API Key ? If this Key is running in production, it could break your app.")) {
        return KeysetService.remove(app.key, provider, (function(data) {
          app.keysets.remove(provider);
          return delete app.keys[provider];
        }), function(error) {
          return console.log("error");
        });
      }
    };
  });
  app.controller('LicenseCtrl', function(UserService, MenuService) {
    return MenuService.changed();
  });
  app.controller('AboutCtrl', function(UserService, MenuService) {
    return MenuService.changed();
  });
  return app.controller('NotFoundCtrl', function($scope, $routeParams, UserService, MenuService) {
    MenuService.changed();
    return $scope.errorGif = 'img/404/' + (Math.floor(Math.random() * 2) + 1) + '.gif';
  });
});
