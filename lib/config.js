var Path, Url, config;

Path = require('path');

Url = require('url');

config = require('../config');

if (config.host_url[config.host_url.length - 1] === '/') {
  config.host_url = config.host_url.substr(0, config.host_url.length - 1);
}

config.base = Path.normalize(config.base).replace(/\\/g, '/');

config.relbase = config.base;

if (config.base === '/') {
  config.base = '';
}

config.base_api = Path.normalize(config.base_api).replace(/\\/g, '/');

config.url = Url.parse(config.host_url);

module.exports = config;
