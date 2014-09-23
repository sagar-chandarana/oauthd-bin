hooks.config.push(function() {
  app.filter('toUpper', function() {
    return function(input, scope) {
      if (input) {
        return input.toUpperCase();
      }
    };
  });
  app.filter('trunc', function() {
    return function(input, chars) {
      if (isNaN(chars)) {
        return input;
      }
      if (chars <= 0) {
        return '';
      }
      if (input && input.length >= chars) {
        return input.substring(0, chars).trim() + '...';
      }
      return input;
    };
  });
  app.filter('capitalize', function() {
    return function(input, scope) {
      var arr, i, str, _i, _len;
      if (!input) {
        return input;
      }
      str = '';
      arr = input.split('_');
      for (_i = 0, _len = arr.length; _i < _len; _i++) {
        i = arr[_i];
        str += i.substring(0, 1).toUpperCase() + i.substring(1) + ' ';
      }
      return str.substring(0, str.length - 1);
    };
  });
  return app.filter('startFrom', function() {
    return function(input, start) {
      if (!input) {
        return [];
      }
      start = +start;
      return input.slice(start);
    };
  });
});
