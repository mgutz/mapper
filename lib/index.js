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


Mapper.prototype.map = function(tableName, primaryKey) {
  primaryKey = primaryKey || "id";
  var dao = new Dao({client: this.client, tableName: tableName, primaryKey: primaryKey});
  return dao;
}

module.exports = new Mapper();
