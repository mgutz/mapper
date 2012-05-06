var _ = require('lodash')
  , utils = require('./utils')
  , slice = Array.prototype.slice;



function format(sql, params) {
  // need clone for shifting
  params = params ? params.concat() : [];

  sql = sql.replace(/\?/g, function() {
    if (params.length == 0) {
      throw new Error('too few parameters given');
    }
    var val = params.shift();
    return escape(val);
  });

  if (params.length) {
    throw Error('too many parameters given');
  }

  return sql;
};


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




function QueryBuilder(options) {
  options = options || {};
  if (options.schema) this._schema = options.schema;
  // safety checks do additional checks during development
  this._strict = options.strict || false;
  return this;
}


QueryBuilder.prototype.setSchema = function(schema) {
  // NOTE Use underscores to indicate these properties are
  //      internal since DAOs derive from QueryBuilder -> Dao -> UserDao
  this._schema = schema;
}


QueryBuilder.prototype.delete = function() {
  this.reset();
  this.buffer = [];
  this.DELETE = 0;
  this.FROM = 1;
  this.WHERE = 2;
  this.END = 3;
  this.buffer[this.END] = ";"

  this.buffer[this.DELETE] = "DELETE ";
  this.buffer[this.FROM] = "FROM "+this._schema.escapedTableName;
  return this;
}


QueryBuilder.prototype.select = function(clause) {
  this.reset();
  this.buffer = [];
  this.SELECT = 0;
  this.FROM = 1;
  this.WHERE = 2;
  this.ORDER_BY = 3;
  this.LIMIT = 4;
  this.OFFSET = 5;
  this.END = 6;
  this.buffer[this.END] = ";"

  if (clause) {
    this.buffer[this.SELECT] = "SELECT "+clause;
    this._changedBitmask |= (1 << this.SELECT);
  }
  else {
    this.buffer[this.SELECT] = "SELECT *";
  }

  this.buffer[this.FROM] = "FROM "+this._schema.escapedTableName;
  return this;
};



QueryBuilder.prototype.update = function() {
  this.reset();
  this.buffer = [];
  this.UPDATE = 0;
  this.SET = 1;
  this.WHERE = 2;
  this.END = 3;
  this.buffer[this.END] = ";"

  this.buffer[this.UPDATE] = "UPDATE "+this._schema.escapedTableName;
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
  this.UPDATE = null;
  this.SET = null;
  this.SELECT = null;
  this.FROM = null;
  this.WHERE = null;
  this.ORDER_BY = null;
  this.LIMIT = null;
  this.OFFSET = null;
  this.END = null;
  delete this.buffer;
  this.buffer = null;
  this._changedBitmask = 0;
  return this;
}


QueryBuilder.prototype.set = function(any, locals) {
  if (!this.buffer) this.update();

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

  this.buffer[this.SET] = "SET "+sql;
  return this;
}


QueryBuilder.prototype.from = function(clause) {
  if (!this.buffer) this.select();

  this.buffer[this.FROM] = "FROM "+clause;
  return this;
};


QueryBuilder.prototype.truncate = function(clause) {
  this.buffer = ["TRUNCATE "+this._schema.escapedTableName+" ;"];
  return this;
};


/**
 * @example
 * q.where({foo: 'af'});
 * q.where('foo = ?', ['af']);
 * q.where('foo = a'); // unsafe
 */
QueryBuilder.prototype.where = function(any, locals) {
  if (!this.buffer) this.select();

  var id, ids, locals, pred, that = this;

  if (_.isString(any)) {
    this.buffer[this.WHERE] = "WHERE "+format(any, locals);
  } else {
    var outValues = [];
    pred = _.chain(any)
            .map(function(value, key) {
              var keyop = extractKeyOperator(key)
                , key = keyop[0]
                , operator = keyop[1]
                , expression = buildExpression(key, operator, value);

              if (_.include(that._schema.columns, key)) {
                return expression;
              }
              else if (that._strict) {
                throw new Error("STRICT: Ivalid column "+key);
              }
            })
            .compact()
            .join(' AND ')
            .value();

    if (_.isEmpty(pred)) {
      if (this._strict)
        throw new Error("STRICT: Invalid fields or empty where clause");
      else
        // Caller probably meant to find something. On empty force no results.
        this.buffer[this.WHERE] = "WHERE 1=0";
    }
    else {
      this.buffer[this.WHERE] = "WHERE "+pred;
    }

  }

  this._changedBitmask |= (1 << this.WHERE);
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
  var outValues = [], sql, that = this;

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

  this.buffer = ["INSERT INTO "+this._schema.escapedTableName+sql+" ;"];
  return this;
};


QueryBuilder.prototype.offset = function(num) {
  if (!this.buffer) this.select();

  this.buffer[this.OFFSET] = "OFFSET "+num;
  return this;
}

QueryBuilder.prototype.limit = function(num) {
  if (!this.buffer) this.select();

  this.buffer[this.LIMIT] = "LIMIT "+num;
  return this;
}

QueryBuilder.prototype.orderBy = function(clause) {
  if (!this.buffer) this.select();

  this.buffer[this.ORDER_BY] = "ORDER BY "+clause;
  return this;
}

QueryBuilder.prototype.page = function(pageOffset, rowsPerPage) {
  if (!this.buffer) this.select();

  this.buffer[this.LIMIT] = "LIMIT "+(pageOffset * rowsPerPage)+", "+rowsPerPage;
  this.buffer[this.OFFSET] = "";
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
  if (this._strict) {
    if (this.UPDATE === 0 && !this.buffer[this.WHERE])
      throw new Error("STRICT: WHERE clause missing for UPDATE operation");
    if (this.DELETE === 0 && !this.buffer[this.WHERE])
      throw new Error("STRICT: WHERE clause missing for DELETE operation");
  }

  var result = this.buffer.join(" ");

  // need to reset for object to be reusable
  this.reset();
  return result;
}


/** Private Methods
 */
function validFields(that, obj) {
  var key, keys = [];
  for (key in obj) {
    if (that._schema.columns.indexOf(key) > -1)
      keys.push(key)
    else if (that._strict)
      throw new Error("STRICT: Invalid column "+key);
  }
  return keys;
}


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


module.exports = QueryBuilder;

