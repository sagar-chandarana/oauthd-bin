var buildReply, check, config, formatters, restify;

restify = require('restify');

check = require('./check');

config = require('./config');

buildReply = function(body, res) {
  var result;
  if (body === check.nullv) {
    body = null;
  }
  if (body instanceof Error) {
    if (config.debug) {
      if (body.body == null) {
        body.body = {};
      }
      if (body.stack) {
        body.body.stack = body.stack.split("\n");
      }
    } else if (!body.statusCode && !(body instanceof check.Error)) {
      body = new restify.InternalError("Internal error");
    }
    res.statusCode = body.statusCode || 500;
    res.statusCodeInternal = body.statusCode != null;
    res.message = body.message;
    res.statusStr = body.status || 'error';
    if (body.body) {
      body = body.body;
    }
    if (body.code && (body.message != null)) {
      delete body.message;
    }
  } else {
    res.statusStr = 'success';
    if (Buffer.isBuffer(body)) {
      body = body.toString('base64');
    }
  }
  if (res.buildJsend || res.buildJsend !== false && !(res.statusStr === 'error' && (body != null ? body.error : void 0) && (body != null ? body.error_description : void 0)) && !(res.statusStr === 'success' && (body != null ? body.access_token : void 0) && (body != null ? body.token_type : void 0))) {
    result = {
      status: res.statusStr
    };
    if (res.statusStr === 'error') {
      if (res.statusCodeInternal) {
        result.code = res.statusCode;
      }
      result.message = res.message;
      if (typeof body === 'object' && Object.keys(body).length) {
        result.data = body;
      }
    } else {
      if (body == null) {
        body = null;
      }
      result.data = body;
    }
    body = result;
  }
  return body;
};

formatters = {
  'application/json; q=0.9': function(req, res, body) {
    var data;
    data = JSON.stringify(buildReply(body, res));
    res.setHeader('Content-Type', "application/json; charset=utf-8");
    res.setHeader('Content-Length', Buffer.byteLength(data));
    return data;
  },
  'application/javascript; q=0.1': function(req, res, body) {
    if (body instanceof Error && !config.debug) {
      return "";
    }
    body = body.toString();
    res.setHeader('Content-Type', "application/javascript; charset=utf-8");
    res.setHeader('Content-Length', Buffer.byteLength(body));
    return body;
  },
  'text/html; q=0.1': function(req, res, body) {
    var k, msg, v, _ref, _ref1;
    if (body instanceof Error) {
      if (body instanceof check.Error || body instanceof restify.RestError) {
        msg = body.message;
        if (typeof body.body === 'object' && Object.keys(body.body).length) {
          msg += "<br/>";
          _ref = body.body;
          for (k in _ref) {
            v = _ref[k];
            msg += '<span style="color:red">' + k.toString() + "</span>: " + v.toString() + "<br/>";
          }
        } else if (typeof body.body === 'string' && body.body !== "") {
          msg += '<br/><span style="color:red">' + body.body + '</span>';
        }
        if (config.debug && body.stack) {
          if ((_ref1 = body.we_cause) != null ? _ref1.stack : void 0) {
            msg += "<br/>" + body.we_cause.stack.split("<br/>");
          } else {
            msg += "<br/>" + body.stack.split("<br/>");
          }
        }
        body = msg;
      } else {
        body = "Internal error";
      }
    }
    body = body.toString();
    res.setHeader('Content-Type', "text/html; charset=utf-8");
    res.setHeader('Content-Length', Buffer.byteLength(body));
    return body;
  }
};

module.exports = {
  formatters: formatters,
  build: function(e, r) {
    return buildReply(e || r, {
      buildJsend: true
    });
  }
};
