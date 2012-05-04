/**
 * Module dependencies.
 */

var mysql = require("mysql-libmysqlclient");
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash')._;

/**
 * Client.
 */

function Client(connParams, options) {
  options = options || {};
  this.connParams = connParams;
  this.connected  = false;
  this.lastError = null;
  this.verbose = options.verbose || false;
  return this;
};

Client.prototype.__proto__ = EventEmitter.prototype;


Client.prototype.connect = function() {
  var self = this;

  this.on('query', function(query, values, callback) {
    if (typeof values[0] !== 'undefined') values = _.flatten(values);

    // values is optional.
    if (arguments.length === 2) {
      callback = values;
      values = null;
    } else {
      query = this.format(query, values);
    }

    this.connected || this.doConnect();
    if (this.verbose) console.log("SQL => "+query);

    this.client.query(query, function(err, result) {

      if (err)  {
        console.error(err);
        console.error("SQL =>", query);
        return callback(err);
      }

      // libmysqlclient returns a count not the actual rows, fetch them
      // (too bad it's not like a cursor)
      if (result.fieldCount) {
        result.fetchAll(function(err, rows) {
          //console.log("rows => ", rows);
          callback(err, rows);
        });
      } else {
        //console.log("result => ", result);
        callback(err, result);
      }
    });
  });
}


Client.prototype.format = function(sql, params) {
  var self = this;
  // clone it
  params = params.concat();

  sql = sql.replace(/\?/g, function() {
    if (params.length == 0) {
      throw new Error('too few parameters given');
    }
    var val = params.shift();
    return self.escape(val);
  });

  if (params.length) {
    throw new Error('too many parameters given');
  }

  return sql;
};


Client.prototype.escape = function(val) {
  var client = this.client,
    escape = this.escape;

  if (val === undefined || val === null) {
    return 'NULL';
  }

  switch (typeof val) {
    case 'boolean': return (val) ? 'true' : 'false';
    case 'number': return val+'';
  }

  if (Array.isArray(val)) {
    var sanitized = val.map(function(v) { return client.escapeSync(v); } );
    return "'" + sanitized.join("','") + "'";
  }

  if (typeof val === 'object') {
    val = (typeof val.toISOString === 'function')
      ? val.toISOString()
      : val.toString();
  }

  val = client.escapeSync(val);
  return "'"+val+"'";
};


Client.prototype.disconnect = function() {
  this.client.closeSync();
}


Client.prototype.doConnect = function() {
  var config = this.connParams;
  this.client = mysql.createConnectionSync(config.host, config.user, config.password, config.database);
  return this.connected = true;
}

module.exports = Client;
