var Path, async, config, plugins, server, startTime;

startTime = new Date;

Path = require('path');

config = require("./config");

async = require("async");

config.rootdir = Path.normalize(__dirname + '/..');

exports.plugins = plugins = require("./plugins");

plugins.init();

exports.server = server = require('./server');

async.series([plugins.data.db.providers.getList, server.listen], function(err) {
  if (err) {
    console.error('Error while initialisation', err.message);
    return plugins.data.emit('server', err);
  } else {
    return console.log('Server is ready (load time: ' + Math.round(((new Date) - startTime) / 10) / 100 + 's)');
  }
});
