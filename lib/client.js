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

    // values is optional.
    if (arguments.length === 2) {
      callback = values;
      values = null;
    } else if (values) {
      // arrays may contain arrays for IN operator
      if (typeof values[0] !== 'undefined') values = _.flatten(values);
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

      // libmysqlclient does not return the actual rows, fetch them
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


/**
 * Safely escapes params using C++ in the native client.
 */
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


/**
 * Disconnects the client from the database.
 */
Client.prototype.disconnect = function() {
  this.client.closeSync();
}


Client.prototype.doConnect = function() {
  var config = this.connParams;
  this.client = mysql.createConnectionSync(config.host, config.user, config.password, config.database);
  return this.connected = true;
}


/**
 * Execute `sql` and return a column value.
 *
 * @example
 * mapper.client.executeScalar('select count(*) from posts where title like ?', ['%foo%'], cb);
 */
Client.prototype.execScalar = function(sql, values, cb) {
  if (arguments.length === 2) {
    cb = values;
    values = null;
  }

  this.emit('query', sql, values, function(err, rows) {
    if (err) return cb(err);

    var first = rows[0],
      scalar = first[Object.keys(first)[0]];
    cb(null, scalar);
  });
}


/**
 * Executes `sql` without returning a value.
 *
 * This actually returns a result but does not do any extra processing
 * on it. TODO, there should be a way to optimize this.
 *
 * @example
 * mapper.client.exec("CREATE TABLE foo");
 */
Client.prototype.exec = function(sql, values, cb) {
  if (arguments.length === 2) {
    cb = values;
    values = null;
  }
  this.emit('query', sql, values, cb);
}


/**
 * Executes `sql` and returns one or more rows.
 *
 * @example
 * mapper.client.query('select title, blurb from posts where title = ?', ['a title'], cb);
 */
Client.prototype.find = function(sql, values, cb) {
  if (arguments.length === 2) {
    cb = values;
    values = null;
  }
  this.emit('query', sql, values, cb);
}


/**
 * Executes `sql` and returns exactly one row.
 *
 * @example
 *
 */
Client.prototype.findOne = function(sql, values, cb) {
  if (arguments.length === 2) {
    cb = values;
    values = null;
  }

  // TODO should force to one by adding LIMIT 1 or maybe there is
  // a mysql feature like @maxrows
  this.emit('query', sql, values, function(err, rows) {
    if (err) return cb(err);
    cb(null, rows[0]);
  });
}


module.exports = Client;
