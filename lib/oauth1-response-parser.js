var OAuth1ResponseParser, OAuthResponseParser, check, querystring,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

querystring = require('querystring');

check = require('./check');

OAuthResponseParser = require('./oauth-response-parser');

OAuth1ResponseParser = (function(_super) {
  __extends(OAuth1ResponseParser, _super);

  function OAuth1ResponseParser(response, body, format, tokenType) {
    OAuth1ResponseParser.__super__.constructor.call(this, response, body, format, tokenType);
  }

  OAuth1ResponseParser.prototype.parse = function(callback) {
    var _this = this;
    return OAuth1ResponseParser.__super__.parse.call(this, function(e, r) {
      if (e) {
        return callback(e);
      }
      if (_this.body.error || _this.body.error_description) {
        return callback(_this._setError(_this.body.error_description || 'Error in response'));
      }
      if (!_this.body.oauth_token) {
        return callback(_this._setError('oauth_token not found'));
      }
      if (_this.body.oauth_token_secret == null) {
        return callback(_this._setError('oauth_token_secret not found'));
      }
      _this.oauth_token = _this.body.oauth_token;
      _this.oauth_token_secret = _this.body.oauth_token_secret;
      return callback(null, _this);
    });
  };

  return OAuth1ResponseParser;

})(OAuthResponseParser);

module.exports = OAuth1ResponseParser;
