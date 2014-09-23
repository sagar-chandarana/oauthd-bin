var check, dateFormat, db, shared, _ref;

_ref = shared = require('../shared'), check = _ref.check, db = _ref.db;

dateFormat = function(date, format) {
  format = format.replace("DD", (date.getUTCDate() < 10 ? '0' : '') + date.getUTCDate());
  format = format.replace("MM", (date.getUTCMonth() < 9 ? '0' : '') + (date.getUTCMonth() + 1));
  format = format.replace("HH", (date.getUTCHours() < 10 ? '0' : '') + date.getUTCHours());
  format = format.replace("YYYY", date.getUTCFullYear());
  return format;
};

exports.getTotal = check('string', function(target, callback) {
  return db.redis.get('st:' + target + ':t', function(err, total) {
    if (err) {
      return callback(err);
    }
    return callback(null, total);
  });
});

exports.getTimeline = check('string', {
  unit: 'string',
  start: 'int',
  end: 'int'
}, function(target, data, callback) {
  var date, dateEnd, day, hours, keys, month, unit, year;
  unit = data.unit || 'm';
  keys = {};
  date = new Date(data.start * 1000);
  dateEnd = new Date(data.end * 1000);
  if (unit === 'm') {
    while (true) {
      year = date.getFullYear();
      month = date.getMonth();
      keys['st:' + target + ':m:' + year + '-' + (month + 1)] = dateFormat(date, 'YYYY-MM');
      date = new Date(year, month + 1, 2);
      if (!(date <= dateEnd || date.getMonth() === dateEnd.getMonth())) {
        break;
      }
    }
  } else if (unit === 'd') {
    while (true) {
      year = date.getFullYear();
      month = date.getMonth();
      day = date.getDate();
      keys['st:' + target + ':d:' + year + '-' + (month + 1) + '-' + day] = dateFormat(date, 'YYYY-MM-DD');
      date = new Date(year, month, day + 1, 12);
      if (!(date <= dateEnd || date.getDate() === dateEnd.getDate())) {
        break;
      }
    }
  } else if (unit = 'h') {
    while (true) {
      year = date.getFullYear();
      month = date.getMonth();
      day = date.getDate();
      hours = date.getHours();
      keys['st:' + target + ':h:' + year + '-' + (month + 1) + '-' + day + '-' + hours] = dateFormat(date, 'YYYY-MM-DD HH:00');
      date = new Date(year, month, day, hours + 1);
      if (!(date <= dateEnd)) {
        break;
      }
    }
  }
  return db.redis.mget(Object.keys(keys), function(err, res) {
    var k, result, v, val;
    if (err) {
      return callback(err);
    }
    result = {};
    for (k in keys) {
      v = keys[k];
      val = res.shift();
      if (val) {
        result[v] = parseInt(val);
      } else {
        result[v] = 0;
      }
    }
    return callback(null, result);
  });
});

exports.addUse = check({
  target: 'string',
  uses: ['number', 'none']
}, function(data, callback) {
  var date, day, hours, month, rediscmds, target, uses;
  date = new Date;
  month = date.getFullYear() + "-" + (date.getMonth() + 1);
  day = month + "-" + date.getDate();
  hours = day + "-" + date.getHours();
  uses = data.uses || 1;
  target = data.target;
  rediscmds = [['incrby', 'st:' + target + ':m:' + month, uses], ['incrby', 'st:' + target + ':d:' + day, uses], ['incrby', 'st:' + target + ':h:' + hours, uses], ['incrby', 'st:' + target + ':t', uses]];
  return (db.redis.multi(rediscmds)).exec(callback);
});

db.timelines = exports;
