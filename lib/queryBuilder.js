var _ = require('lodash'),
  utils = require('./utils'),
  slice = Array.prototype.slice;


function QueryBuilder(options) {
  options = options || {};
  if (options.schema) this.schema = options.schema;
  // safety checks do additional checks during development
  this.strict = options.strict || false;

  // assume it will be a select
  return this;
}


QueryBuilder.prototype.setSchema = function(schema) {
  // NOTE Use underscores to indicate these properties are
  //      internal since DAOs derive from QueryBuilder -> Dao -> UserDao
  this.schema = schema;
};


QueryBuilder.prototype.delete = function() {
  this.reset();
  this.type = QueryType.DELETE;
  this.buffer[Index.DELETE] = "DELETE ";
  this.buffer[Index.FROM] = "FROM "+this.schema.escapedTableName;
  this.buffer[Index.DELETE_END] = ";"
  return this;
};


QueryBuilder.prototype.select = function(clause) {
  this.reset();
  this.type = QueryType.SELECT;

  if (clause) {
    this.buffer[Index.SELECT] = "SELECT "+clause;
    this._changedBitmask |= (1 << this.SELECT);
  }
  else {
    this.buffer[Index.SELECT] = "SELECT *";
  }

  this.buffer[Index.FROM] = "FROM "+this.schema.escapedTableName;
  this.buffer[Index.SELECT_END] = ";"

  return this;
};



QueryBuilder.prototype.update = function() {
  this.reset();
  this.type = QueryType.UPDATE;

  this.buffer[Index.UPDATE] = "UPDATE "+this.schema.escapedTableName;
  this.buffer[Index.UPDATE_END] = ";"
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
}

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
      sql += field+" = "+escape(any[field]);
    }
  }

  this.buffer[Index.SET] = "SET "+sql;
  return this;
}


QueryBuilder.prototype.from = function(clause) {
  this.buffer[Index.FROM] = "FROM "+clause;
  return this;
};


/**
 * @example
 * q.where({foo: 'af'});
 * q.where('foo = ?', ['af']);
 * q.where('foo = a'); // unsafe
 */
QueryBuilder.prototype.where = function(any, locals) {
  var id, ids, locals, pred, that = this;

  if (_.isString(any)) {
    this.buffer[Index.WHERE] = "WHERE "+format(any, locals);
  } else {
    pred = _.chain(any)
            .map(function(value, key) {
              var keyop = extractKeyOperator(key)
                , key = keyop[0]
                , operator = keyop[1]
                , expression = buildExpression(key, operator, value);

              if (_.include(that.schema.columns, key)) {
                return expression;
              }
              else if (that.strict) {
                throw new Error("STRICT: Ivalid column "+key);
              }
            })
            .compact()
            .join(' AND ')
            .value();

    if (_.isEmpty(pred)) {
      throw new Error("Invalid fields or empty WHERE clause");
    }
    else {
      this.buffer[Index.WHERE] = "WHERE "+pred;
    }

  }

  this._changedBitmask |= (1 << Index.WHERE);
  return this;
}


/**
 * @example
 * insert({ field: 'value', foo: 'bar' });
 * insert('field, foo', [], []);
 *
 */
QueryBuilder.prototype.insert = function(any, values) {
  this.reset();
  var sql, that = this;

  if (Array.isArray(any)) {
    var i, len, fields = validFields(this, any[0]), obj, vals = "";

    for (i = 0, len = any.length; i < len; i++) {
      obj = any[i];
      if (i > 0)
        vals += ", ";
      vals += "("+escapeCsvObjectValues(obj, fields)+")";
    }
    sql = "("+fields.join(', ')+") VALUES " + vals;
  }

  else if (_.isObject(any)) {
    var fields = validFields(this, any)
      , vals = escapeCsvObjectValues(any, fields);
    sql = "(" + fields.join(', ') + ") VALUES (" + vals + ")";
  }

  else {
    sql = "("+any+") VALUES ("+escape(values)+")";
  }

  this.buffer = ["INSERT INTO "+this.schema.escapedTableName+sql+" ;"];
  return this;
};


QueryBuilder.prototype.offset = function(num) {
  this.buffer[Index.OFFSET] = "OFFSET "+num;
  return this;
}

QueryBuilder.prototype.limit = function(num) {
  this.buffer[Index.LIMIT] = "LIMIT "+num;
  return this;
}

QueryBuilder.prototype.order = function(clause) {
  this.buffer[Index.ORDER] = "ORDER BY "+clause;
  return this;
}

QueryBuilder.prototype.page = function(pageOffset, rowsPerPage) {
  this.buffer[Index.LIMIT] = "LIMIT "+(pageOffset * rowsPerPage)+", "+rowsPerPage;
  this.buffer[Index.OFFSET] = "";
  return this;
}


/**
 * Peeks at the SQL.
 *
 * `#toSql` resets the state.
 */
QueryBuilder.prototype.peekSql = function() {
  return this.buffer.join(" ");
}


QueryBuilder.prototype.toSql = function() {
  if (this.strict) {
    if (this.type === QueryType.UPDATE && !this.buffer[Index.WHERE])
      throw new Error("STRICT: WHERE clause missing for UPDATE operation");
    if (this.type === QueryType.DELETE && !this.buffer[Index.WHERE])
      throw new Error("STRICT: WHERE clause missing for DELETE operation");
  }

  var result = this.buffer.join(" ");

  // need to reset to default
  this.select();
  return result;
}


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

  return key + operator + value
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
};


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
};


function format(sql, params) {
  console.log("format sql", sql, "parsm", params);
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
};

function validFields(that, obj) {
  var key, keys = [];
  for (key in obj) {
    if (that.schema.columns.indexOf(key) > -1)
      keys.push(key)
    else if (that.strict)
      throw new Error("STRICT: Invalid column "+key);
  }
  return keys;
}


/**
 * Enumerations
 */

var Index = QueryBuilder.Index = {
  DELETE: 0,
  FROM: 1,
  WHERE: 2,
  DELETE_END: 3,

  SELECT: 0,
  //FROM: 1,
  //WHERE: 2,
  ORDER: 3,
  LIMIT: 4,
  OFFSET: 5,
  SELECT_END: 6,

  UPDATE: 0,
  SET: 1,
  //WHERE: 2,
  UPDATE_END: 3
};


var QueryType = QueryBuilder.QueryType = {
  SELECT: 0,
  DELETE: 1,
  UPDATE: 2,
  INSERT: 3
};


module.exports = QueryBuilder;
