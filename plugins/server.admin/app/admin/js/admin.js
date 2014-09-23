window.hooks = {
  config: []
};

hooks.configRoutes = function($routeProvider, $locationProvider) {
  $routeProvider.when('/license', {
    templateUrl: '/admin/templates/license.html',
    controller: 'LicenseCtrl'
  });
  $routeProvider.when('/about', {
    templateUrl: '/admin/templates/about.html',
    controller: 'AboutCtrl'
  });
  $routeProvider.when('/contact-us', {
    templateUrl: '/admin/templates/contact-us.html',
    controller: 'ContactUsCtrl'
  });
  $routeProvider.when('/logout', {
    templateUrl: '/templates/signin.html',
    controller: 'LogoutCtrl'
  });
  $routeProvider.when('/key-manager', {
    templateUrl: '/admin/templates/key-manager.html',
    controller: 'ApiKeyManagerCtrl'
  });
  $routeProvider.when('/app-create', {
    templateUrl: '/admin/templates/app-create.html',
    controller: 'AppCtrl'
  });
  $routeProvider.when('/404', {
    templateUrl: '/admin/templates/404.html',
    controller: 'NotFoundCtrl'
  });
  return $routeProvider.otherwise({
    redirectTo: '/404'
  });
};
