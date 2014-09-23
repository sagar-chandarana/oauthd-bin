var async;

async = require('async');

exports.setup = function(callback) {
  var sendStats,
    _this = this;
  this.db.timelines = require('./db_timelines');
  this.on('connect.callback', function(data) {
    _this.db.timelines.addUse({
      target: 'co:a:' + data.key + ':' + data.status
    }, (function() {}));
    _this.db.timelines.addUse({
      target: 'co:p:' + data.provider + ':' + data.status
    }, (function() {}));
    return _this.db.timelines.addUse({
      target: 'co:a:' + data.key + ':p:' + data.provider + ':' + data.status
    }, (function() {}));
  });
  this.on('connect.auth', function(data) {
    _this.db.timelines.addUse({
      target: 'co:p:' + data.provider
    }, (function() {}));
    _this.db.timelines.addUse({
      target: 'co:a:' + data.key + ':p:' + data.provider
    }, (function() {}));
    return _this.db.timelines.addUse({
      target: 'co:a:' + data.key
    }, (function() {}));
  });
  sendStats = this.check({
    target: 'string',
    unit: ['string', 'none'],
    start: 'int',
    end: ['int', 'none']
  }, function(data, callback) {
    var err, now;
    now = Math.floor((new Date).getTime() / 1000);
    if (data.unit == null) {
      data.unit = 'd';
    }
    if (data.end == null) {
      data.end = now;
    }
    err = new _this.check.Error;
    if (data.unit !== 'm' && data.unit !== 'd' && data.unit !== 'h') {
      err.error('unit', 'invalid unit type');
    }
    if (data.end > now + 12 * 31 * 24 * 3600 * 24) {
      err.error('end', 'invalid format');
    }
    if (err.failed()) {
      return callback(err);
    }
    if (data.unit === 'm' && data.end - data.start > 50 * 31 * 24 * 3600 || data.unit === 'd' && data.end - data.start > 50 * 24 * 3600 || data.unit === 'h' && data.end - data.start > 50 * 3600) {
      return callback(new _this.check.Error('Too large date range'));
    }
    return async.parallel([
      function(cb) {
        return _this.db.timelines.getTimeline(data.target, data, cb);
      }, function(cb) {
        return _this.db.timelines.getTimeline(data.target + ':success', data, cb);
      }, function(cb) {
        return _this.db.timelines.getTimeline(data.target + ':error', data, cb);
      }
    ], function(e, r) {
      var k, res, v, _ref;
      if (e) {
        return callback(e);
      }
      res = {
        labels: Object.keys(r[0]),
        ask: [],
        success: [],
        fail: []
      };
      _ref = r[0];
      for (k in _ref) {
        v = _ref[k];
        res.ask.push(v);
        res.success.push(r[1][k]);
        res.fail.push(r[2][k]);
      }
      return callback(null, res);
    });
  });
  this.server.get(this.config.base_api + '/apps/:key/stats', this.auth.needed, function(req, res, next) {
    req.params.target = 'co:a:' + req.params.key;
    return sendStats(req.params, _this.server.send(res, next));
  });
  this.server.get(this.config.base_api + '/apps/:key/keysets/:provider/stats', this.auth.needed, function(req, res, next) {
    req.params.target = 'co:a:' + req.params.key + ':p:' + req.params.provider;
    return sendStats(req.params, _this.server.send(res, next));
  });
  this.server.get(this.config.base_api + '/providers/:provider/stats', this.auth.needed, function(req, res, next) {
    req.params.target = 'co:p:' + req.params.provider;
    return sendStats(req.params, _this.server.send(res, next));
  });
  return callback();
};
