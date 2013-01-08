var _ = require('lodash');
var utils = require('./utils');
var __slice = [].slice;


function QueryBuilder(options) {
  options = options || {};
  if (options.schema) {
    this.schema = options.schema;
    this.escapedTableName = this.schema.escapedTableName;
  }
  else {
    this.escapedTableName = '';
  }
  this.strict = options.strict || false;
  return this;
}


QueryBuilder.prototype.delete = function() {
  this.reset();
  this.type = QueryType.DELETE;
  var buffer = this.buffer;
  buffer[FROM] = this.escapedTableName;
  return this;
};


/**
 * Select fields to be retrieved.
 *
 * @param {String} clause Optional comma-delimited list.
 *
 * @example
 * Post.select(['id', 'name', 'title']);
 * Post.select('id, name, title');
 * Post.select().where('name = ?', [1]);
 */
QueryBuilder.prototype.select = function(clause) {
  this.reset();
  var a= arguments, buffer = this.buffer, isArray = false;
  this.type = QueryType.SELECT;

  if (!clause) {
    buffer[SELECT] = "*";
  }
  else if (arguments.length > 1) {
    clause = __slice.call(arguments, 0);
    isArray = true;
  }
  else if (_.isString(clause)) {
    buffer[SELECT] = clause;
    this._changedBitmask |= (1 << this.SELECT);
  }
  else {
    isArray = true;
  }

  if (isArray) {
    var fields = validFieldsInArray(this, clause);
    if (fields.length === 0)
      buffer[SELECT] = "*";
    else
      buffer[SELECT] = this.csv(fields, ',');
  }

  this.buffer[FROM] = this.escapedTableName;

  return this;
};


/**
 * Starts an UPDATE statement.
 */
QueryBuilder.prototype.update = function(clause) {
  this.reset();
  this.type = QueryType.UPDATE;

  if (clause)
    this.buffer[UPDATE] = clause;
  else
    this.buffer[UPDATE] = this.escapedTableName;

  return this;
};


/**
 * @example
 *  var buf = builder.appendBuffer("WHERE", "other = ?", ['foo']);
 *  var buf = builder.getBuffer("WHERE");
 *  var buf = builder.setBuffer("WHERE", "WHERE fruit = ?", ['apple']");
 */
QueryBuilder.prototype.getBuffer = function(which) {
  return this.buffer[which];
};

QueryBuilder.prototype.isChangedBuffer = function(which) {
  return (this._changedBitmask & (1 << which)) !== 0;
};


QueryBuilder.prototype.setBuffer = function(which, str, locals) {
  this.buffer[which] = format(str, locals);
  return this;
};

QueryBuilder.prototype.appendBuffer = function(which, str, locals) {
  var clause = this.buffer[this[which]];
  clause += str;
  this.buffer[which] = format(clause, locals);
  return this;
};


QueryBuilder.prototype.reset = function() {
  delete this.buffer;
  this.buffer = [];
  this._changedBitmask = 0;
  return this;
};

QueryBuilder.prototype.id = function(val) {
  var expr;

  if (Array.isArray(val))
    expr = " IN (?)";
  else
    expr = " = ?";

  return this.where(this.schema.primaryKey + expr, [val]);
};

QueryBuilder.prototype.set = function(any, locals) {

  var sql = "";

  if (_.isString(any)) {
    sql = format(any, locals);
  }
  // must be object
  else {
    var i, field, len, value, fields = validFields(this, any);
    for (i = 0, len = fields.length; i < len; i++) {
      field = fields[i];
      if (i > 0) sql += ", "
      sql += escapedField(field) + " = " + escape(any[field]);
    }
  }

  this.buffer[SET] = sql;
  return this;
};


function escapedField(name) {
  return '`' + name + '`';
}


QueryBuilder.prototype.from = function(clause) {
  this.buffer[FROM] = clause;
  return this;
};


/**
 * @example
 * q.where({foo: 'af'});
 * q.where('foo = ?', ['af']);
 * q.where('foo = a'); // unsafe
 */
QueryBuilder.prototype.where = function(any, locals) {
  var pred, that = this;

  if (_.isString(any)) {
    this.buffer[WHERE] = format(any, locals);
  } else {
    pred = _(any)
            .map(function(value, key) {
              var keyop = extractKeyOperator(key);
              key = keyop[0];
              var operator = keyop[1];
              var expression = buildExpression(key, operator, value);

              if (_.include(that.schema.columns, key)) {
                return expression;
              }
              else if (that.strict) {
                throw new Error("STRICT: Invalid column "+key);
              }
            })
            .compact()
            .join(' AND ');

    if (_.isEmpty(pred)) {
      throw new Error("Invalid fields or empty WHERE clause");
    }
    else {
      this.buffer[WHERE] = pred;
    }

  }

  this._changedBitmask |= (1 << WHERE);
  return this;
};


/**
 * @example
 * insert({ field: 'value', foo: 'bar' });
 * insert('field, foo', [], []);
 *
 */
QueryBuilder.prototype.insert = function(any, values) {
  this.reset();
  var sql, fields, vals;

  if (Array.isArray(any)) {
    fields = validFields(this, any[0]);
    vals = "";
    var i, len, obj;

    for (i = 0, len = any.length; i < len; i++) {
      obj = any[i];
      if (i > 0)
        vals += ", ";
      vals += "("+escapeCsvObjectValues(obj, fields)+")";
    }
    sql = "(" + this.csv(fields, ', ') + ") VALUES " + vals;
  }

  else if (_.isObject(any)) {
    fields = validFields(this, any);
    vals = escapeCsvObjectValues(any, fields);
    sql = "(" + this.csv(fields, ', ') + ") VALUES (" + vals + ")";
  }

  else {
    sql = "("+any+") VALUES ("+escape(values)+")";
  }

  this.type = QueryType.INSERT;
  this.buffer = [this.escapedTableName+sql];
  return this;
};


QueryBuilder.prototype.offset = function(num) {
  this.buffer[OFFSET] = num;
  return this;
};

QueryBuilder.prototype.limit = function(num) {
  this.buffer[LIMIT] = num;
  return this;
} ;

QueryBuilder.prototype.order = function(clause) {
  this.buffer[ORDER] = clause;
  return this;
};

QueryBuilder.prototype.page = function(pageOffset, rowsPerPage) {
  this.buffer[LIMIT] = (pageOffset * rowsPerPage)+", "+rowsPerPage;
  this.buffer[OFFSET] = null;
  return this;
};


/**
 * Peeks at the SQL.
 *
 * `#toSql` resets the state.
 */
QueryBuilder.prototype.peekSql = function(modify) {
  var buffer, type = this.type;
  if (modify)
    buffer = this.buffer;
  else
    buffer = this.buffer.concat();


  if (type === QueryType.SQL) return buffer.toString();

  switch (type) {
    case QueryType.DELETE:
      buffer[DELETE] = "DELETE ";
      break;
    case QueryType.SELECT:
      buffer[SELECT] = "SELECT " + buffer[SELECT];
      break;
    case QueryType.UPDATE:
      buffer[UPDATE] = "UPDATE " + buffer[UPDATE];
      break;
    case QueryType.INSERT:
      buffer[INSERT] = "INSERT INTO " + buffer[INSERT];
      break;
  }

  var bufferFROM = buffer[FROM];
  if (bufferFROM) buffer[FROM] = "FROM "+bufferFROM;

  var bufferWHERE = buffer[WHERE];
  if (bufferWHERE) buffer[WHERE] = "WHERE "+bufferWHERE;

  var bufferORDER = buffer[ORDER];
  if (bufferORDER) buffer[ORDER] = "ORDER BY "+bufferORDER;

  var bufferLIMIT = buffer[LIMIT];
  if (bufferLIMIT) buffer[LIMIT] = "LIMIT "+bufferLIMIT;

  var bufferOFFSET = buffer[OFFSET];
  if (bufferOFFSET) buffer[OFFSET] = "OFFSET "+bufferOFFSET;

  var bufferSET = buffer[SET];
  if (bufferSET) buffer[SET] = "SET "+bufferSET;

  //buffer[SQL_END] = ";";

  return buffer.join(" ") + ";";
};

QueryBuilder.prototype.sql = function(sql) {
  this.type = QueryType.SQL;
  var args = __slice.call(arguments, 0);
  var len = args.length;

  if (len === 1) {
    this.buffer = args[0];
  }
  else {
    if (_.isArray(args[len -1])) {
      this.buffer = format(args.slice(0, len - 1).join(' '), args[len -1]);
    }
    else
      this.buffer = args.join(' ');
  }

  return this;
};


QueryBuilder.prototype.toSql = function() {
  var buffer = this.buffer,
    type = this.type;

  if (this.strict) {
    if (type === QueryType.UPDATE && !buffer[WHERE])
      throw new Error("STRICT: WHERE clause missing for UPDATE operation");
    if (type === QueryType.DELETE && !buffer[WHERE])
      throw new Error("STRICT: WHERE clause missing for DELETE operation");
  }

  var result = this.peekSql(true);
  // need to reset to default
  this.select();
  return result;
};


QueryBuilder.prototype.csv = function(fields, separator) {
  var schema = this.schema;
  return _(fields)
    .map(function(name) {
      return schema.escapedColumns[name];
    })
    .join(separator);
};


/**
 * Private Methods
 */

function extractKeyOperator(key) {
  var key, operator = false, space = key.indexOf(" ");

  if (space > 0) {
    operator = key.slice(space) + " ";
    key = key.slice(0, space);
  }

  return [key, operator];
}

/**
 * Builds an expression from a key and value.
 *
 * Keys may take form of identifier and operator: { "name <": "foo", "age not in: "asdfadsf" }
 */
function buildExpression(key, operator, value) {
  if (Array.isArray(value)) {
    value = "("+escape(value)+")";
    if (!operator) operator = " IN ";
  }
  else {
    if (value === undefined || value === null) {
      operator = " IS ";
      value = "NULL";
    }
    else {
      value = escape(value);
    }
    if (!operator) operator = " = ";
  }

  return escapedField(key) + operator + value
}


function escape(val) {
  if (val === undefined || val === null) {
    return 'NULL';
  }

  switch (typeof val) {
    case 'boolean': return (val) ? 'true' : 'false';
    case 'number': return val+'';
  }

  if (Array.isArray(val)) {
    var sanitized = val.map(function( v ) { return escape(v); } );
    //return "'" + sanitized.join("','") + "'";
    return sanitized.join(",");
  }

  if (typeof val === 'object') {
    val = (typeof val.toISOString === 'function')
      ? val.toISOString()
      : val.toString();
  }

  val = val.replace(/[\0\n\r\b\t\\\'\"\x1a]/g, function(s) {
    switch(s) {
      case "\0": return "\\0";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\b": return "\\b";
      case "\t": return "\\t";
      case "\x1a": return "\\Z";
      default: return "\\"+s;
    }
  });
  return "'"+val+"'";
}


function escapeCsvObjectValues(obj, keys) {
  if (!keys) keys = Object.keys(obj);

  var i, item, len, result = "";
  for (i = 0, len = keys.length; i < len; i++) {
    item = obj[keys[i]];
    if (i > 0)
      result += ", ";
    result += escape(item);
  }
  return result;
}


function format(sql, params) {
  // need clone for shifting
  params = params ? params.concat() : [];

  sql = sql.replace(/\?/g, function() {
    if (params.length == 0) {
      throw new Error('ZERO parameters given');
    }
    var val = params.shift();
    return escape(val);
  });

  if (params.length) {
    throw Error('too many parameters given');
  }

  return sql;
}


function validFields(that, obj) {
  var columns = that.schema.columns, key, keys = [], strict = that.strict;
  for (key in obj) {
    if (obj.hasOwnProperty(key) && columns.indexOf(key) > -1)
      keys.push(key);
    else if (strict)
      throw new Error("STRICT: Invalid column "+key);
  }
  return keys;
}


function validFieldsInArray(that, arr) {
  var i, len = arr.length, field, fields = [], columns = that.schema.columns;
  for (i = 0; i < len; i++) {
    field = arr[i];
    if (columns.indexOf(field) > -1)
      fields.push(field);
  }
  return fields;
}


/**
 * Enumerations
 */

var
  UPDATE = 0,
  SET = 1,
  FROM = 2,
  WHERE = 3,

  DELETE = 0,
  //FROM = 2,
  //WHERE = 3,

  SELECT = 0,
  //FROM = 2,
  //WHERE = 3,
  ORDER = 4,
  LIMIT = 5,
  OFFSET = 6,

  INSERT = 0,

  SQL_END = 7;

var Index = QueryBuilder.Index = {
  DELETE: DELETE,
  FROM: FROM,
  WHERE: WHERE,

  SELECT: SELECT,
  //FROM: 1,
  //WHERE: 2,
  ORDER: ORDER,
  LIMIT: LIMIT,
  OFFSET: OFFSET,

  UPDATE: UPDATE,
  SET: SET,
  //WHERE: ,
};


var QueryType = QueryBuilder.QueryType = {
  SELECT: 0,
  DELETE: 1,
  UPDATE: 2,
  INSERT: 3,
  SQL: 4
};


module.exports = QueryBuilder;
