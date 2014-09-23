var async, config, shared;

async = require('async');

config = require('./config');

shared = require('../plugins/shared');

shared.exit = require('./exit');

shared.check = require('./check');

shared.db = require('./db');

shared.db.apps = require('./db_apps');

shared.db.providers = require('./db_providers');

shared.db.states = require('./db_states');

shared.config = config;

shared.plugins = exports;

exports.plugin = {};

exports.data = shared;

exports.load = function(plugin_name) {
  var plugin;
  plugin = require('../plugins/' + plugin_name + '/' + plugin_name.replace(/\./g, '_'));
  exports.plugin[plugin_name] = plugin;
};

exports.init = function() {
  var plugin, _i, _len, _ref;
  _ref = config.plugins;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    plugin = _ref[_i];
    exports.load(plugin);
  }
};

exports.run = function(name, args, callback) {
  var calls, k, plugin, _ref;
  if (typeof args === 'function') {
    callback = args;
    args = [];
  }
  args.push(null);
  calls = [];
  _ref = exports.plugin;
  for (k in _ref) {
    plugin = _ref[k];
    if (typeof plugin[name] === 'function') {
      (function(plugin) {
        return calls.push(function(cb) {
          args[args.length - 1] = cb;
          return plugin[name].apply(shared, args);
        });
      })(plugin);
    }
  }
  async.series(calls, function() {
    args.pop();
    callback.apply(null, arguments);
  });
};

exports.runSync = function(name, args) {
  var k, plugin, _ref;
  _ref = exports.plugin;
  for (k in _ref) {
    plugin = _ref[k];
    if (typeof plugin[name] === 'function') {
      plugin[name].apply(shared, args);
    }
  }
};
