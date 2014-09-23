var async, cleanExit, closing, closing_stack;

async = require('async');

closing_stack = [];

closing = false;

cleanExit = function(killer) {
  var k;
  closing = true;
  k = setTimeout((function() {
    console.error('--- FORCING STOP');
    process.kill(process.pid);
  }), 5000);
  async.series(closing_stack, function(err, res) {
    console.log('--- successfully closed !');
    setTimeout(killer, 100);
  });
};

process.once('SIGUSR2', function() {
  console.log('--- closing server...');
  cleanExit(function() {
    process.kill(process.pid, 'SIGUSR2');
  });
});

process.on('uncaughtException', function(err) {
  if (closing) {
    console.error('--- uncaughtException WHILE CLOSING');
  } else {
    console.error('--- uncaughtException');
  }
  console.error(err.stack.toString());
  console.error('--- node exiting now...');
  if (closing) {
    process.exit(2);
  } else {
    cleanExit(function() {
      process.exit(1);
    });
  }
});

exports.push = function(name, f) {
  closing_stack.push(function(callback) {
    console.log('Closing `' + name + '`...');
    f(callback);
  });
};
