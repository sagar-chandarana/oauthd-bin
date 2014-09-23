var app, config, global_err, _i, _len, _ref;

global_err = /[\\#&]err=([^&]*)/.exec(document.location.hash);

if (global_err) {
  document.location.hash = document.location.hash.replace(/&?err=[^&]*/, '');
  global_err = decodeURIComponent(global_err[1].replace(/\+/g, " "));
}

app = angular.module('oauth', ['ui.bootstrap', 'ngDragDrop', 'ui.select2', 'ngCookies']);

app.config([
  '$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    var originalWhen;
    originalWhen = $routeProvider.when;
    $routeProvider.when = function() {
      var _ref;
      arguments[0] = oauthdconfig.base + '/admin' + arguments[0];
      if ((_ref = arguments[1]) != null ? _ref.templateUrl : void 0) {
        arguments[1].templateUrl = oauthdconfig.base + arguments[1].templateUrl;
      }
      return originalWhen.apply($routeProvider, arguments);
    };
    $routeProvider.when('', {
      templateUrl: '/templates/signin.html',
      controller: 'SigninCtrl'
    });
    $routeProvider.when('/error', {
      templateUrl: '/templates/globalError.html',
      controller: 'ErrorCtrl'
    });
    $routeProvider.otherwise({
      redirectTo: '/admin'
    });
    if (typeof hooks !== "undefined" && hooks !== null ? hooks.configRoutes : void 0) {
      hooks.configRoutes($routeProvider, $locationProvider);
    }
    return $locationProvider.html5Mode(true);
  }
]).config([
  '$httpProvider', function($httpProvider) {
    var interceptor;
    interceptor = [
      '$rootScope', '$location', '$cookieStore', '$q', function($rootScope, $location, $cookieStore, $q) {
        var error, success;
        success = function(response) {
          $rootScope.error = {
            state: false,
            message: '',
            type: ''
          };
          return response;
        };
        error = function(response) {
          var deferred;
          $rootScope.error = {
            state: false,
            message: '',
            type: ''
          };
          if (response.status === 401) {
            if ($cookieStore.get('accessToken')) {
              delete $rootScope.accessToken;
              $cookieStore.remove('accessToken');
            }
            if ($location.path() === "/") {
              $rootScope.error.state = true;
              $rootScope.error.message = "Invalid passphrase";
            }
            $rootScope.authRequired = $location.path();
            $location.path('/');
            deferred = $q.defer();
            return deferred.promise;
          }
          return $q.reject(response);
        };
        return function(promise) {
          return promise.then(success, error);
        };
      }
    ];
    return $httpProvider.responseInterceptors.push(interceptor);
  }
]).run(function($rootScope, $location) {
  var locationpath;
  $rootScope.baseurl = oauthdconfig.base;
  $rootScope.adminurl = oauthdconfig.base + '/admin';
  locationpath = $location.path;
  return $location.path = function() {
    var path;
    if (arguments.length === 0) {
      path = locationpath.call($location);
      if (path.substr(0, $rootScope.adminurl.length) === $rootScope.adminurl.length) {
        path = path.substr($rootScope.adminurl.length);
      }
      return path;
    } else {
      if (arguments[0] === '/') {
        arguments[0] = '';
      }
      return locationpath.call($location, $rootScope.adminurl + arguments[0]);
    }
  };
});

if (typeof hooks !== "undefined" && hooks !== null ? hooks.config : void 0) {
  _ref = hooks.config;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    config = _ref[_i];
    config();
  }
}

app.factory('UserService', function($http, $rootScope, $cookieStore) {
  $rootScope.accessToken = $cookieStore.get('accessToken');
  return $rootScope.UserService = {
    isLogin: function() {
      return $cookieStore.get('accessToken') != null;
    }
  };
});

app.factory('MenuService', function($rootScope, $location) {
  $rootScope.selectedMenu = $location.path();
  return {
    changed: function() {
      return $rootScope.selectedMenu = $location.path();
    }
  };
});

app.controller('SigninCtrl', function($scope, $rootScope, $location, UserService, MenuService) {
  if ($rootScope.global_err) {
    document.location.reload();
  }
  MenuService.changed();
  if (global_err) {
    $scope.info = {
      status: 'error',
      message: global_err
    };
  }
  if (UserService.isLogin()) {
    if (typeof hooks !== "undefined" && hooks !== null ? hooks.configRoutes : void 0) {
      return $location.path('/key-manager');
    } else {
      document.location.reload();
    }
  }
  $scope.user = {};
  return $scope.userForm = {
    template: "/templates/userForm.html"
  };
});

app.controller('ErrorCtrl', function($scope, $rootScope) {
  if (!global_err) {
    return $location.path('/');
  }
  $rootScope.global_err = global_err;
  return $scope.info = {
    status: 'error',
    message: global_err
  };
});
