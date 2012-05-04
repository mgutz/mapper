/**
 * Module dependencies.
 */

var Base   = require('./base');
var Client = require('./client');

/**
 * Mapper.
 */

var Mapper = function() {
  this.version = '0.1.5';
  return this;
};


Mapper.prototype.connect = function(connParams, options) {
  var client = new Client(connParams, options);
  client.connect();
  this.Base = new Base(client);
  this.client = client;
  return this;
};

module.exports = new Mapper();
