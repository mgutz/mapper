/**
 * Module dependencies.
 */

var utils = require('./utils');
var _ = require('lodash');

/**
 * Statements.
 */

exports.select = function(model, selector, opts, outValues) {
  var fields = buildSelectFields(model, opts)
    , stmt   = "SELECT " + fields + " FROM `" + model.tableName + "`"
    , join   = buildJoinClause(model, opts)
    , where  = buildWhereClause(model, selector, outValues)
    , limit  = buildLimitClause(opts)
    , offset = buildOffsetClause(opts)
    , order  = buildOrderClause(opts);

  return stmt + join + where + order + limit + offset + ';';
};

exports.insert = function(model, obj, outValues) {
  var stmt = "INSERT INTO `" + model.tableName + '`'
    , fields = buildInsertFields(model, obj, outValues);

  return stmt + fields + ';';
};

exports.update = function(model, selector, obj, outValues) {
  var stmt  = "UPDATE `" + model.tableName + '`'
    , set   = buildUpdateFields(model, obj, outValues)
    , where = buildWhereClause(model, selector, outValues);

  return stmt + set + where + ';';
};

exports.destroy = function(model, selector, outValues) {
  var stmt  = "DELETE FROM `" + model.tableName + '`'
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

    return "(" + keys + ") VALUES " + vals;// + ' RETURNING *';
  } else {
    var fields = utils.validFields(model, fields)
      , keys = _.keys(fields).join(',')
      , vals = utils.toCsv(fields, undefined, outValues);

    return "(" + keys + ") VALUES(" + vals + ")"// RETURNING *";
  }
};

var buildJoinClause = function(model, opts) {
  if (typeof opts.join == 'undefined') {
    return "";
  } else {
    model._fields = model._fields.concat(opts.join.model._fields);
    return " INNER JOIN "  + opts.join.model.tableName + " ON `" +
            model.tableName + "`." + model.primaryKey + "=" +
            opts.join.model.tableName + "." + opts.join.key;
  }
};

var buildLimitClause = function(opts) {
  if (typeof opts.limit === 'undefined') {
    return "";
  } else {
    return " LIMIT " + opts.limit;
  }
};

var buildOffsetClause = function(opts) {
  if(typeof opts.offset === 'undefined') {
    return "";
  } else {
    return " OFFSET " + opts.offset;
  }
};

var buildMultiInsert = function(fields, keys, outValues) {
  return _(fields).chain()
    .map(function(field) {
      var vals = _(keys).map(function(key) {
        outValues.push(field[key]);
        return "?";
      });
      return "(" + vals + ")";
    })
    .join(', ')
    .value();
};

var buildOperator = function(key, value, outValues) {
  var field = key.split('.')[0];

  switch(key.split('.')[1]) {
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
  // case 'ilike':
  //   var operator = "ILIKE";
  //   break;
  // case 'nilike': case 'not_ilike':
  //   var operator = "NOT ILIKE";
  //   break;
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
  if (key.split('.')[1] == 'textsearch') {
    return 'to_tsvector(\'english\', ' + field + ') ' + operator +
           ' to_tsquery(\'english\', ' + utils.quote(outValues, operator) + ')';
  } else {
    return field + ' ' + operator + ' ' + utils.quote(outValues, operator);
  }
};

var buildOrderClause = function(opts) {
  if (typeof opts.order === 'undefined') {
    return "";
  } else {
    var orderFields = _(opts.order).chain()
      .map(function(orderField) {
        var direction  = orderField[0] === '-' ? "DESC" : "ASC";
        var orderField = orderField[0] === '-' ?
          '`'+orderField.substring(1, orderField.length)+'`' :
          '`'+orderField+'`';
        return orderField + " " + direction;
      })
      .join(', ')
      .value();

    return " ORDER BY " + orderFields;
  }
};

var buildSelectFields = function(model, opts) {
  if (typeof opts.only === 'undefined') {
    if (typeof opts.join === 'undefined') {
      return "*";
    } else {
      return '`' + model.tableName + '`' + ".*";
    }
  } else if (Array.isArray(opts.only)) {
    var columns = _(model._fields).pluck('column_name');
    var valid_fields = _.select(opts.only, function(valid_field) {
      return _.include(columns, valid_field);
    });
    return _.isEmpty(valid_fields) ? "*" : valid_fields.join(',');
  } else {
    var columns = _.pluck(model._fields, 'column_name');
    var alias_fields = [];
    _.map(opts.only, function(value, key) {
      if (_.include(columns, key))
        alias_fields.push(key+' AS `'+value+'`');
    });
    return _.isEmpty(alias_fields) ? "*" : alias_fields.join(', ');
  }
};

var buildUpdateFields = function(model, fields, outValues) {
  var fields = utils.validFields(model, fields)
    , pred   =  _(fields).chain()
                .map(function(value, key) {
                  outValues.push(value);
                  return key + '= ?';
                })
                .join(', ')
                .value();

  return utils.nil(pred) ? '' : " SET " + pred;
};

var buildWhereClause = function(model, selector, outValues) {
  if (utils.nil(selector)) {
    var pred = '';
  } else if (Array.isArray(selector)) {
    var ids = utils.toCsv(selector, undefined, outValues);
    var pred = model.primaryKey + " IN (" + ids + ")";
  } else if (_.isNumber(selector) || _.isString(selector)) {
    var id = selector;
    var pred = model.primaryKey + " = '" + id + "'";
  } else {
    var pred =  _(selector).chain()
                .map(function(value, key) {
                  if (utils.fieldIsValid(model, key))
                    return buildOperator(key, value, outValues);
                })
                .compact()
                .join(' AND ')
                .value();
    pred += utils.nil(pred) ? 'INVALID' : '';
  }

  return utils.nil(pred) ? '' : " WHERE " + pred;
};
