var OAuthResponseParser, check, querystring, zlib;

querystring = require('querystring');

check = require('./check');

zlib = require('zlib');

OAuthResponseParser = (function() {
  function OAuthResponseParser(response, body, format, tokenType) {
    this._response = response;
    this._undecodedBody = body;
    this._format = format || response.headers['content-type'];
    this._format = this._format.match(/^([^;]+)/)[0];
    this._errorPrefix = 'Error during the \'' + tokenType + '\' step';
  }

  OAuthResponseParser.prototype.decode = function(callback) {
    if (this._response.headers['content-encoding'] === 'gzip') {
      return zlib.gunzip(this._undecodedBody, callback);
    } else {
      return callback(null, this._undecodedBody);
    }
  };

  OAuthResponseParser.prototype.parse = function(callback) {
    var _this = this;
    return this.decode(function(e, r) {
      var parseFunc;
      if (e) {
        return callback(e);
      }
      _this._unparsedBody = r.toString();
      if (_this._response.statusCode !== 200 && !_this._unparsedBody) {
        return callback(_this._setError('HTTP status code: ' + _this._response.statusCode));
      }
      if (!_this._unparsedBody) {
        return callback(_this._setError('Empty response'));
      }
      parseFunc = _this._parse[_this._format];
      if (parseFunc) {
        _this._parseBody(parseFunc);
      } else {
        _this._parseUnknownBody();
      }
      if (_this.error) {
        return callback(_this.error);
      }
      if (_this._response.statusCode !== 200) {
        return callback(_this._setError('HTTP status code: ' + _this._response.statusCode));
      }
      return callback(null, _this);
    });
  };

  OAuthResponseParser.prototype._parse = {
    'application/json': function(d) {
      return JSON.parse(d);
    },
    'application/x-www-form-urlencoded': function(d) {
      return querystring.parse(d);
    }
  };

  OAuthResponseParser.prototype._parseUnknownBody = function() {
    var format, parseFunc, _ref;
    _ref = this._parse;
    for (format in _ref) {
      parseFunc = _ref[format];
      delete this.error;
      this._parseBody(parseFunc);
      if (!this.error) {
        break;
      }
    }
    if (this.error) {
      this.error.message += ' from format ' + this._format;
    }
  };

  OAuthResponseParser.prototype._parseBody = function(parseFunc) {
    var ex;
    try {
      this.body = parseFunc(this._unparsedBody);
    } catch (_error) {
      ex = _error;
      return this._setError('Unable to parse response');
    }
    if (this.body == null) {
      this._setError('Empty response');
    }
  };

  OAuthResponseParser.prototype._setError = function(message) {
    this.error = new check.Error(this._errorPrefix + ' (' + message + ')');
    if (typeof this.body === 'object' && Object.keys(this.body).length) {
      this.error.body = this.body;
    } else if (this._unparsedBody) {
      this.error.body = this._unparsedBody;
    }
    return this.error;
  };

  return OAuthResponseParser;

})();

module.exports = OAuthResponseParser;
