'use strict';
var Url, db, db_getApps, fs, restify, shared;

restify = require('restify');

fs = require('fs');

Url = require('url');

db = (shared = require('../shared')).db;

db_getApps = function(callback) {
  return db.redis.smembers('adm:apps', function(err, apps) {
    var app, keys;
    if (err) {
      return callback(err);
    }
    if (!apps.length) {
      return callback(null, []);
    }
    keys = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = apps.length; _i < _len; _i++) {
        app = apps[_i];
        _results.push('a:' + app + ':key');
      }
      return _results;
    })();
    return db.redis.mget(keys, function(err, appkeys) {
      if (err) {
        return callback(err);
      }
      return callback(null, appkeys);
    });
  });
};

shared.on('app.create', function(req, app) {
  return db.redis.sadd('adm:apps', app.id);
});

shared.on('app.remove', function(req, app) {
  return db.redis.srem('adm:apps', app.id);
});

exports.setup = function(callback) {
  var rmBasePath, sendIndex,
    _this = this;
  rmBasePath = function(req, res, next) {
    if (req.path().substr(0, _this.config.base.length) === _this.config.base) {
      req._path = req._path.substr(_this.config.base.length);
    }
    return next();
  };
  sendIndex = function(req, res, next) {
    return fs.readFile(__dirname + '/app/index.html', 'utf8', function(err, data) {
      res.setHeader('Content-Type', 'text/html');
      data = data.toString().replace(/\{\{if admin\}\}([\s\S]*?)\{\{endif\}\}\n?/gm, req.user ? '$1' : '');
      data = data.replace(/\{\{jsconfig\}\}/g, "var oauthdconfig={host_url:\"" + _this.config.host_url + "\",base:\"" + _this.config.base + "\",base_api:\"" + _this.config.base_api + "\"};");
      data = data.replace(/\{\{baseurl\}\}/g, "" + _this.config.base);
      res.end(data);
      return next();
    });
  };
  this.server.get(this.config.base + '/admin', this.auth.optional, (function(req, res, next) {
    if (db.redis.last_error) {
      res.setHeader('Location', _this.config.host_url + _this.config.base + "/admin/error#err=" + encodeURIComponent(db.redis.last_error));
      res.send(302);
      next(false);
    }
    return next();
  }), sendIndex);
  this.server.get(new RegExp('^' + this.config.base + '\/(lib|css|js|img|templates)\/.*'), rmBasePath, restify.serveStatic({
    directory: __dirname + '/app',
    maxAge: 1
  }));
  this.server.get(new RegExp('^' + this.config.base + '\/admin\/(lib|css|js|img|templates)\/*'), rmBasePath, this.auth.needed, restify.serveStatic({
    directory: __dirname + '/app',
    maxAge: 1
  }));
  this.server.get(this.config.base_api + '/me', function(req, res, next) {
    return db_getApps(function(e, appkeys) {
      if (e) {
        return next(e);
      }
      res.send({
        apps: appkeys
      });
      return next();
    });
  });
  this.server.get(new RegExp('^' + this.config.base + '\/admin\/(.*)'), this.auth.optional, (function(req, res, next) {
    if (req.params[0] === "logout") {
      res.setHeader('Set-Cookie', 'accessToken=; Path=' + _this.config.base + '/admin; Expires=' + (new Date(0)).toUTCString());
      delete req.user;
    }
    if (!req.user && req.params[0] !== "error") {
      res.setHeader('Location', _this.config.host_url + _this.config.base + "/admin");
      res.send(302);
      next(false);
    }
    return next();
  }), sendIndex);
  return callback();
};
