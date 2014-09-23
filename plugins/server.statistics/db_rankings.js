var check, db, shared, _ref;

_ref = shared = require('../shared'), check = _ref.check, db = _ref.db;

exports.getTotal = check('string', function(target, callback) {
  return db.redis.multi([['zcount', 'sr:' + target, '-inf', '+inf'], ['get', 'sr:' + target + ':t']]).exec(callback);
});

exports.getRanking = check('string', {
  start: ['int', 'none'],
  end: ['int', 'none']
}, function(target, data, callback) {
  var end, start;
  start = data.start, end = data.end;
  if (start == null) {
    start = 0;
  }
  if (end == null) {
    end = -1;
  }
  return db.redis.zrevrange('sr:' + target, start, end, "withscores", function(e, r) {
    var k, res;
    if (e) {
      return callback(e);
    }
    res = (function() {
      var _i, _ref1, _results;
      _results = [];
      for (k = _i = 0, _ref1 = r.length - 1; _i <= _ref1; k = _i += 2) {
        _results.push({
          name: r[k],
          score: parseInt(r[k + 1])
        });
      }
      return _results;
    })();
    return callback(null, res);
  });
});

exports.addScore = check('string', {
  id: 'string',
  val: ['number', 'none']
}, function(target, data, callback) {
  var val;
  val = data.val || 1;
  return db.redis.multi([['zincrby', 'sr:' + target, val, data.id], ['incrby', 'sr:' + target + ':t', val]]).exec(callback);
});

exports.setScore = check('string', {
  id: 'string',
  val: 'number'
}, function(target, data, callback) {
  return db.redis.multi([['zadd', 'sr:' + target, data.val, data.id], ['set', 'sr:' + target + ':t', data.val]]).exec(callback);
});

db.rankings = exports;
