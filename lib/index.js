/**
 * Module dependencies.
 */
"use strict";

var Client = require('./client');
var Dao = require('./dao');

/**
 * Mapper.
 */

var Mapper = function() {
  this.version = '0.2.0';
  return this;
};


Mapper.prototype.connect = function(config, options) {
  options = options || {};
  var client = new Client(config, options);
  client.connect();
  this.client = client;
  this.options = options;
  return this;
};


Mapper.prototype.map = function(tableName, primaryKey) {
  primaryKey = primaryKey || "id";
  return new Dao({client: this.client, tableName: tableName, primaryKey: primaryKey, strict: this.options.strict });
};


module.exports = new Mapper();
