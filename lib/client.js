/**
 * Module dependencies.
 */

var mysql = require('mysql-libmysqlclient');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash')._;
var async = require('async');
var QueryBuilder = require('./queryBuilder');
var __slice = [].slice;


/**
 * Client.
 *
 * @param {Object} config Database settings = {
 *  {String} database Database name.
 *  {String} user Database user.
 *  {String} password Database password.
 *  {String} [host] MySQL host. Defaults to 'localhost'.
 *  {Number} [port] MySQL port. Defaults to 3306.
 *
 *  {String} charset Character set option.
 *  {Boolean} [disableAutoReconnect] Whether to auto reconnect. ON by default.
 *  {Function} [configureFn] `function(client)` For setting additional MySQL options on connection.
 * }
 *
 * @param {Object} options Mapper options = {
 *  {Boolean} verbose Whether to log SQL statements and other information useful when debugging.
 *  {Boolean} strict Whether to warn when invalid table fields are used in objects.
 * }
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


/**
 * Connects to MySQL server.
 */
Client.prototype.connect = function() {
  if (this.connected) this.client.closeSync();

  var config = this.config;
  var client = mysql.createConnectionSync();
  this.client = client;
  client.initSync();

  if (config.configureFn) {
    config.configureFn(this.client);
  }
  else {
    if (config.charset) {
      client.setOptionSync(mysql.MYSQL_SET_CHARSET_NAME, config.charset);
    }
    if (!config.disableAutoReconnect) {
      client.setOptionSync(mysql.MYSQL_OPT_RECONNECT, 1);
    }
  }

  client.realConnectSync(config.host, config.user, config.password, config.database, config.port);
  if (config.database) {
    client.query('USE '+config.database);
  }

  if (!client) throw new Error('Could not connect with this configuration.', config);
  return this.connected = true;
};


/**
 * Executes a query.
 *
 * @param {String} query SQL statement with optional placeholders.
 * @param {String|Array} values The values for placeholders.
 * @param {Function} cb The callback result function.
 */
Client.prototype.all = Client.prototype.exec = function(query, values, cb) {
  var that = this;

  // values is optional.
  if (arguments.length === 2) {
    cb = values;
    values = null;
  }
  else if (values) {
    // arrays may contain arrays for IN operator
    if (typeof values[0] !== 'undefined') values = _.flatten(values);
    query = that.format(query, values);
  }

  if (that.verbose) console.log("SQL=> "+query);

  that.client.query(query, function(err, result) {

    if (err)  {
      console.error("SQL=>", query);
      console.error(err);
      that.emit('error', err);
      return cb(err);
    }

    // libmysqlclient does not return the actual rows, fetch them
    if (result.fieldCount) {
      result.fetchAll(function(err, rows) {
        if (err) that.emit('error', err);

        //console.log("rows => ", rows);
        cb(err, rows);
      });
    }
    else {
      //console.log("result => ", result);
      cb(err, result);
    }
  });
}


/**
 * Formats a SQL string containing placeholders.
 *
 * @param {String} sql The statement.
 * @param {Any} params The values for placeholders.
 */
Client.prototype.format = function(sql, params) {
  if (!params) return sql;

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

  this.exec(sql, values, function(err, rows) {
    if (err) return cb(err);

    var first = rows[0],
      scalar = first[Object.keys(first)[0]];
    cb(null, scalar);
  });
};


/**
 * Executes `sql` and returns exactly one row.
 *
 * @example
 *
 */
Client.prototype.one = function(sql, values, cb) {
  var that = this;

  if (arguments.length === 2) {
    cb = values;
    values = null;
  }

  this.exec(sql, values, function(err, rows) {
    if (err) return cb(err);

    if (rows.length > 1) {
      var message = 'Expected one result, got '+rows.length+': ' + that.format(sql, values);
      if (that.strict) return cb(message);
      if (that.verbose) console.log(message);
    }

    cb(null, rows[0]);
  });
};


/**
 * Executes a query synchronously.
 */
Client.prototype.execSync = function(sql, values) {
  if (values) {
    // arrays may contain arrays for IN operator
    if (typeof values[0] !== 'undefined') values = _.flatten(values);
    sql = this.format(sql, values);
  }

  try {
    if (this.verbose) console.log("SQL=> "+sql);

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
