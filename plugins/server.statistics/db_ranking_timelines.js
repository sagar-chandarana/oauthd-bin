var check, dateFormat, db, getWeek, shared, _ref;

_ref = shared = require('../shared'), check = _ref.check, db = _ref.db;

getWeek = function($y, $m, $d) {
  var a, b, c, d, e, f, g, n, s, w;
  if ($m <= 2) {
    a = $y - 1;
    b = (a / 4 | 0) - (a / 100 | 0) + (a / 400 | 0);
    c = ((a - 1) / 4 | 0) - ((a - 1) / 100 | 0) + ((a - 1) / 400 | 0);
    s = b - c;
    e = 0;
    f = $d - 1 + (31 * ($m - 1));
  } else {
    a = $y;
    b = (a / 4 | 0) - (a / 100 | 0) + (a / 400 | 0);
    c = ((a - 1) / 4 | 0) - ((a - 1) / 100 | 0) + ((a - 1) / 400 | 0);
    s = b - c;
    e = s + 1;
    f = $d + ((153 * ($m - 3) + 2) / 5) + 58 + s;
  }
  g = (a + b) % 7;
  d = (f + g - e) % 7;
  n = (f + 3 - d) | 0;
  if (n < 0) {
    w = 53 - ((g - s) / 5 | 0);
  } else if (n > 364 + s) {
    w = 1;
  } else {
    w = (n / 7 | 0) + 1;
  }
  return w;
};

dateFormat = function(date, format) {
  format = format.replace("DD", (date.getUTCDate() < 10 ? '0' : '') + date.getUTCDate());
  format = format.replace("MM", (date.getUTCMonth() < 9 ? '0' : '') + (date.getUTCMonth() + 1));
  format = format.replace("HH", (date.getUTCHours() < 10 ? '0' : '') + date.getUTCHours());
  format = format.replace("YYYY", date.getUTCFullYear());
  return format;
};

exports.getTotal = check('string', {
  unit: ['string', 'none'],
  timestamp: ['int', 'none']
}, function(target, data, callback) {
  var date, day, month, year;
  if (data.unit) {
    if (data.timestamp) {
      date = new Date(data.timestamp * 1000);
    } else {
      date = new Date();
    }
    year = date.getFullYear();
    month = date.getMonth() + 1;
    day = date.getDate();
    if (data.unit === 'm') {
      target += ':m:' + year + '-' + month;
    } else if (data.unit === 'w') {
      target += ':w:' + year + '-' + getWeek(year, month, day);
    } else if (data.unit === 'd') {
      target += ':d:' + year + '-' + month + '-' + day;
    }
  }
  return db.rankings.getTotal(target, callback);
});

exports.getRanking = check('string', {
  unit: ['string', 'none'],
  timestamp: ['int', 'none'],
  start: ['int', 'none'],
  end: ['int', 'none']
}, function(target, data, callback) {
  var date, day, month, year;
  if (data.unit) {
    if (data.timestamp) {
      date = new Date(data.timestamp * 1000);
    } else {
      date = new Date();
    }
    year = date.getFullYear();
    month = date.getMonth() + 1;
    day = date.getDate();
    if (data.unit === 'm') {
      target += ':m:' + year + '-' + month;
    } else if (data.unit === 'w') {
      target += ':w:' + year + '-' + getWeek(year, month, day);
    } else if (data.unit === 'd') {
      target += ':d:' + year + '-' + month + '-' + day;
    }
  }
  return db.rankings.getRanking(target, data, callback);
});

exports.addScore = check('string', {
  id: 'string',
  val: ['number', 'none'],
  timestamp: ['int', 'none']
}, function(target, data, callback) {
  var date, day, month, val, week, year;
  if (data.timestamp) {
    date = new Date(data.timestamp * 1000);
  } else {
    date = new Date();
  }
  year = date.getFullYear();
  month = date.getMonth() + 1;
  day = date.getDate();
  week = year + '-' + getWeek(year, month, day);
  month = year + "-" + month;
  day = month + "-" + day;
  val = data.val || 1;
  return db.redis.multi([['incrby', 'sr:' + target + ':m:' + month + ':t', val], ['zincrby', 'sr:' + target + ':m:' + month, val, data.id], ['incrby', 'sr:' + target + ':w:' + week + ':t', val], ['zincrby', 'sr:' + target + ':w:' + week, val, data.id], ['incrby', 'sr:' + target + ':d:' + day + ':t', val], ['zincrby', 'sr:' + target + ':d:' + day, val, data.id], ['incrby', 'sr:' + target + ':t', val], ['zincrby', 'sr:' + target, val, data.id]]).exec(callback);
});

db.ranking_timelines = exports;
