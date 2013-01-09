var assert = global.assert = require('chai').assert,
  config = require('../../config.json'),
  Mapper = require('../..');


var _client;
config.configureFn = function(client) {
  _client = client;
};

Mapper.connect(config);

describe('Connect', function() {
  it('should allow configuration lambda', function() {
    // ensure it was MySQL connect, don't know name of class
    assert.isTrue(typeof _client.connectErrno !== 'undefined');
  });
});



