/**
 * Module dependencies.
 */

var mysql = require("mysql-libmysqlclient");
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash')._;
var async = require('async');
var QueryBuilder = require('./queryBuilder');
var __slice = [].slice;


/**
 * Client.
 */

function Client(config, options) {
  options = options || {};
  this.config = config;
  this.config.host = config.host || 'localhost';
  this.config.port = config.port || 3306;

  this.connected  = false;
  this.lastError = null;
  this.verbose = options.verbose || false;
  this.strict = Boolean(options.strict);
  return this;
}

Client.prototype.__proto__ = EventEmitter.prototype;


Client.prototype.connect = function() {
  var that = this;
  that.doConnect();

  this.on('query', function(query, values, callback) {

    if (!that.connected) that.doConnect();

    // values is optional.
    if (arguments.length === 2) {
      callback = values;
      values = null;
    }
    else if (values) {
      // arrays may contain arrays for IN operator
      if (typeof values[0] !== 'undefined') values = _.flatten(values);
      query = that.format(query, values);
    }

    if (that.verbose) console.log("SQL => "+query);

    that.client.query(query, function(err, result) {

      if (err)  {
        console.error("SQL =>", query);
        console.error(err);
        that.emit('error', err);
        return callback(err);
      }

      // libmysqlclient does not return the actual rows, fetch them
      if (result.fieldCount) {
        result.fetchAll(function(err, rows) {
          if (err) that.emit('error', err);

          //console.log("rows => ", rows);
          callback(err, rows);
        });
      }
      else {
        //console.log("result => ", result);
        callback(err, result);
      }
    });
  });
};


Client.prototype.format = function(sql, params) {
  var that = this;
  // clone it
  params = params.concat();

  sql = sql.replace(/\?/g, function() {
    if (params.length == 0) throw new Error('too few parameters given');
    var val = params.shift();
    return that.escape(val);
  });

  if (params.length) throw new Error('too many parameters given');
  return sql;
};


/**
 * Safely escapes params using C++ in the native client.
 */
Client.prototype.escape = function(val) {
  var client = this.client;

  if (val === undefined || val === null) return 'NULL';

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
};


Client.prototype.doConnect = function() {
  var config = this.config;
  this.client = mysql.createConnectionSync();
  this.client.initSync();
  if (config.charset) {
    this.client.setOptionSync(mysql.MYSQL_SET_CHARSET_NAME, config.charset);
  }
  this.client.realConnectSync(config.host, config.user, config.password, config.database, config.port);
  if (config.database) {
    this.client.query('USE '+config.database);
  }
  if (!this.client) throw new Error('Could not connect with this configuration.', config);
  return this.connected = true;
};


/**
 * Execute `sql` and return a column value.
 *
 * @example
 * mapper.client.executeScalar('select count(*) from posts where title like ?', ['%foo%'], cb);
 */
Client.prototype.scalar = function(sql, values, cb) {
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
};


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
};


/**
 * Executes `sql` and returns one or more rows.
 *
 * @example
 * mapper.client.query('select title, blurb from posts where title = ?', ['a title'], cb);
 */
Client.prototype.all = function(sql, values, cb) {
  if (arguments.length === 2) {
    cb = values;
    values = null;
  }
  this.emit('query', sql, values, cb);
};


/**
 * Executes `sql` and returns exactly one row.
 *
 * @example
 *
 */
Client.prototype.one = function(sql, values, cb) {
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
};


Client.prototype.execSync = function(sql, values) {
  this.connected || this.doConnect();
//  if (arguments.length === 2) {
//    var cb = values;
//    values = null;
//  }
//
//  // values is optional.
//  if (arguments.length === 2) {
//    ar callback = values;
//    values = null;
//  }
//  else
  if (values) {
    // arrays may contain arrays for IN operator
    if (typeof values[0] !== 'undefined') values = _.flatten(values);
    sql = this.format(sql, values);
  }

  try {
    if (this.verbose) console.log("SQL => "+sql);

    var result = this.client.querySync(sql);
    // libmysqlclient does not return the actual rows, fetch them
    if (result.fieldCount) {
      rows = result.fetchAllSync();
      return rows;
    }
    else {
      throw new Error("Invalid result (expected result.fieldCount).\nSQL: "+sql+"\nResult: "+JSON.stringify(result));
    }
  }
  catch (err) {
    console.error(err);
  }
};

Client.prototype._execSeriesParallel = function() {
  // remove callback, rest are queries
  var args = __slice.call(arguments, 0);
  var cb = args[args.length - 1];
  var i, arg, L;
  var method = args[0];

  // convert each query into an array for function.apply
  // ("select foo", "from bar where id = ?", [1])
  // becomes ["select foo", "from bar where id = ?", [1]]
  var queryArgs = [];
  var statement = [];
  for (i = 1, L = args.length - 1; i < L; i++) {
    arg = args[i];

    function isEndOfStatement() {
      // arguments for last statement
      if (Array.isArray(arg)) return true;

      // end of args
      if (i + 1 >= L) return true;

      // string ends with ';' and next arg is not an array
      if (arg[arg.length - 1] === ';') {
        var peek = args[i+1];
        if (!Array.isArray(peek)) return true;
      }

      return false;
    }

    if (isEndOfStatement()) {
      statement.push(arg);
      queryArgs.push(statement);
      statement = [];
    }
    else {
      statement.push(arg);
    }
  }

  var that = this;
  var results = [];

  async[method](queryArgs, function(statementArgs, cb) {
    var qb = new QueryBuilder();
    var sql = qb.sql.apply(qb, statementArgs).toSql();
    that.all(sql, function(err, rows) {
      if (err) return cb(err);
      results.push(rows);
      cb();
    });
  }, function(err) {
    cb(err, results);
  });
};


/**
 * Runs a series of SQL statements, returning the results[].
 *
 * MySQL client can only execute one query at a time.
 *
 * Example
 *  // each query is terminated by an array containing arguments
 *  Mapper.client.execSeries(
 *    "select * from id = ?;", [id],
 *    "select foo", "from bar", "where id = 3;"     // Statement without args MUST end with semicolon!
 *    function(err, results) {
 *    }
 *  );
 *
 */
Client.prototype.execSeries = function() {
  var args = __slice.call(arguments, 0);
  args.unshift("forEachSeries");
  this._execSeriesParallel.apply(this, args);
};


Client.prototype.execParallel = function() {
  var args = __slice.call(arguments, 0);
  args.unshift("forEach");
  this._execSeriesParallel.apply(this, args);
};

module.exports = Client;
