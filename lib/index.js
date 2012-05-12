/**
 * Module dependencies.
 */

var Base = require('./base')
  , Client = require('./client')
  , Dao = require('./dao');

/**
 * Mapper.
 */

var Mapper = function() {
  this.version = '0.2.0';
  return this;
};


Mapper.prototype.connect = function(connParams, options) {
  options = options || {};
  var client = new Client(connParams, options);
  client.connect();
  this.Base = new Base(client);
  this.client = client;
  this.options = options;
  return this;
};


Mapper.prototype.map = function(tableName, primaryKey) {
  primaryKey = primaryKey || "id";
  var dao = new Dao({client: this.client, tableName: tableName, primaryKey: primaryKey, strict: this.options.strict });
  return dao;
}

module.exports = new Mapper();
