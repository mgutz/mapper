/**
 * Module dependencies.
 */

var _ = require('lodash')
  , utils = require('./utils');

/**
 * Statements.
 */

exports.select = function(model, selector, opts, outValues) {
  var fields = buildSelectFields(model, opts)
    , stmt = "SELECT " + fields + " FROM `" + model.tableName + "`"
    , join = buildJoinClause(model, opts)
    , where = buildWhereClause(model, selector, outValues)
    , order = buildOrderClause(opts)
    , limit = (typeof opts.limit === 'undefined') ? "" : " LIMIT " + opts.limit
    , offset = (typeof opts.offset === 'undefined') ? "" : " OFFSET " + opts.offset;

  return stmt + join + where + order + limit + offset + ';';
};


exports.insert = function(model, obj, outValues) {
  var stmt = "INSERT INTO `" + model.tableName + '`'
    , fields = buildInsertFields(model, obj, outValues);

  return stmt + fields + ';';
};


exports.update = function(model, selector, obj, outValues) {
  var stmt = "UPDATE `" + model.tableName + '`'
    , set = buildUpdateFields(model, obj, outValues)
    , where = buildWhereClause(model, selector, outValues);

  return stmt + set + where + ';';
};


exports.destroy = function(model, selector, outValues) {
  var stmt = "DELETE FROM `" + model.tableName + '`'
    , where = buildWhereClause(model, selector, outValues);

  return stmt + where + ";"
};


exports.truncate = function(model, opts) {
  var opts = opts === undefined ? {} : opts
    , stmt = "TRUNCATE `" + model.tableName + '`';

  return stmt + ";"
};


exports.information = function(model) {
  var stmt =  "SELECT column_name, is_nullable, data_type, " +
              "character_maximum_length, column_default " +
              "FROM information_schema.columns " +
              "WHERE table_name = '" + model.tableName + "';";

  return stmt;
};


var buildInsertFields = function(model, fields, outValues) {
  if (Array.isArray(fields)) {
    var keys =  utils.keysFromObject(fields)
      , vals =  buildMultiInsert(fields, keys, outValues);

    return "(" + keys + ") VALUES " + vals;
  } else {
    var fields = utils.validFields(model, fields)
      , keys = _.keys(fields).join(',')
      , vals = utils.toCsv(fields, undefined, outValues);

    return "(" + keys + ") VALUES(" + vals + ")";
  }
};


var buildJoinClause = function(model, opts) {
  if (typeof opts.join == 'undefined') {
    return "";
  }

  model._fields = model._fields.concat(opts.join.model._fields);
  return " INNER JOIN "  + opts.join.model.tableName + " ON `" +
          model.tableName + "`." + model.primaryKey + "=" +
          opts.join.model.tableName + "." + opts.join.key;
};


var buildLimitClause = function(opts) {
  return (typeof opts.limit === 'undefined')
    ? ""
    : " LIMIT " + opts.limit;
};


var buildOffsetClause = function(opts) {
  return (typeof opts.offset === 'undefined')
    ? ""
    : " OFFSET " + opts.offset;
};


var buildMultiInsert = function(fields, keys, outValues) {
  return _.chain(fields)
    .map(function(field) {
      var vals = _.map(keys, function(key) {
        outValues.push(field[key]);
        return "?";
      });
      return "(" + vals + ")";
    })
    .join(', ')
    .value();
};


var buildOperator = function(key, value, outValues) {
  var keySplit = key.split('.')
    , field = keySplit[0];

  switch(keySplit[1]) {
  case 'ne': case 'not':
    var operator = "<>";
    break;
  case 'gt':
    var operator = ">";
    break;
  case 'lt':
    var operator = "<";
    break;
  case 'gte':
    var operator = ">=";
    break;
  case 'lte':
    var operator = "<=";
    break;
  case 'like':
    var operator = "LIKE";
    break;
  case 'nlike': case 'not_like':
    var operator = "NOT LIKE";
    break;
  case 'in':
    var operator = "IN";
    break;
  case 'nin': case 'not_in':
    var operator = "NOT IN";
    break;
  // case 'textsearch':
  //   var operator = "@@";
        break;
  default:
    if (value === null) return field + ' IS NULL';
    var operator = "=";
  }

  outValues.push(value);
  outValues = _.flatten(outValues);

  // if (keySplit[1] == 'textsearch') {
  //   return 'to_tsvector(\'english\', ' + field + ') ' + operator +
  //          ' to_tsquery(\'english\', ' + utils.quote(outValues, operator) + ')';
  // } else {
  return field + ' ' + operator + ' ' + utils.quote(outValues, operator);
  // }
};


var buildOrderClause = function(opts) {
  if (typeof opts.order === 'undefined') {
    return "";
  } else {
    var orderFields = _.chain(opts.order)
      .map(function(orderField) {
        var direction  = orderField[0] === '-' ? 'DESC' : 'ASC';
        var orderField = orderField[0] === '-'
          ? '`'+orderField.substring(1, orderField.length)+'`'
          : '`'+orderField+'`';
        return orderField+' '+direction;
      })
      .join(', ')
      .value();

    return ' ORDER BY '+orderFields;
  }
};


var buildSelectFields = function(model, opts) {
  if (typeof opts.only === 'undefined') {
    if (typeof opts.join === 'undefined') {
      return "*";
    } else {
      return '`'+model.tableName+'`.*';
    }
  } else if (Array.isArray(opts.only)) {
    var validFields = _.select(opts.only, function(validField) {
      return _.include(model._columns, validField);
    });
    return _.isEmpty(validFields) ? "*" : validFields.join(',');
  } else {
    var aliasFields = [];
    _.map(opts.only, function(value, key) {
      if (_.include(model._columns, key))
        aliasFields.push(key+' AS `'+value+'`');
    });
    return _.isEmpty(aliasFields) ? "*" : aliasFields.join(', ');
  }
};


var buildUpdateFields = function(model, fields, outValues) {
  var fields = utils.validFields(model, fields)
    , pred = _.chain(fields)
             .map(function(value, key) {
               outValues.push(value);
               return key + '= ?';
              })
              .join(', ')
              .value();

  return utils.nil(pred) ? '' : ' SET '+pred;
};

var buildWhereClause = function(model, selector, outValues) {
  var id, ids, pred;

  if (utils.nil(selector)) {
    pred = '';
  } else if (Array.isArray(selector)) {
    ids = utils.toCsv(selector, undefined, outValues);
    pred = model.primaryKey + ' IN (' + ids + ')';
  } else if (_.isNumber(selector) || _.isString(selector)) {
    id = selector;
    pred = model.primaryKey + " = '" + id + "'";
  } else {
    pred =  _.chain(selector)
            .map(function(value, key) {
              if (utils.fieldIsValid(model, key))
                return buildOperator(key, value, outValues);
            })
            .compact()
            .join(' AND ')
            .value();
    pred += utils.nil(pred) ? 'INVALID' : '';
  }

  return utils.nil(pred) ? '' : ' WHERE ' + pred;
};
