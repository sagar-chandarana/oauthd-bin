var OAuthBase, db, dbstates;

dbstates = require('./db_states');

db = require('./db');

OAuthBase = (function() {
  function OAuthBase(oauthv) {
    this._params = {};
    this._oauthv = oauthv;
    this._short_formats = {
      json: 'application/json',
      url: 'application/x-www-form-urlencoded'
    };
  }

  OAuthBase.prototype._setParams = function(parameters) {
    var k, v;
    for (k in parameters) {
      v = parameters[k];
      this._params[k] = v;
    }
  };

  OAuthBase.prototype._replaceParam = function(param, hard_params, keyset) {
    var _this = this;
    param = param.replace(/\{\{(.*?)\}\}/g, function(match, val) {
      if (val === "nonce") {
        return db.generateUid();
      }
      return hard_params[val] || "";
    });
    return param.replace(/\{(.*?)\}/g, function(match, val) {
      if (!_this._params[val] || !keyset[val]) {
        return "";
      }
      if (Array.isArray(keyset[val])) {
        return keyset[val].join(_this._params[val].separator || ",");
      }
      return keyset[val];
    });
  };

  OAuthBase.prototype._createState = function(provider, opts, callback) {
    var newStateData;
    newStateData = {
      key: opts.key,
      provider: provider.provider,
      redirect_uri: opts.redirect_uri,
      oauthv: this._oauthv,
      origin: opts.origin,
      options: opts.options,
      expire: 1200
    };
    return dbstates.add(newStateData, callback);
  };

  return OAuthBase;

})();

module.exports = OAuthBase;
