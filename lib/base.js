/**
 * Module dependencies.
 */

var Statements = require("./statements");
var async = require("async");
var _ = require('lodash');

/**
 * Base.
 */

function Base(client) {
  this.client = client;
};


Base.prototype.extend = function(obj) {
  return _.extend(obj, this);
};


Base.prototype.truncate = function(opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  var truncateStatement = Statements.truncate(this, opts);
  this.client.emit('query', truncateStatement, callback);
};


Base.prototype.create = function(obj, callback) {
  var self = this;
  var createQuery = function() {
    var outValues = [];
    var insertStatement = Statements.insert(self, obj, outValues);
    self.client.emit('query', insertStatement, outValues, callback);
  };

  loadSchema(self, createQuery);
};

['find', 'findOne'].forEach(function(finder) {
  Base.prototype[finder] = function(selector, opts, callback) {
    var self = this;

    if (_.isFunction(opts)) {
      callback = opts;
      opts = {};
    }

    var findQuery = function() {
      if (finder === 'findOne') opts.limit = 1;

      var outValues = [];
      var selectStatement = Statements.select(self, selector, opts, outValues);
      self.client.emit('query', selectStatement, outValues, function(err, result) {
        var results = null;

        if (finder === 'find') {
          var empty = []
            , rowOrRows = typeof result === 'undefined' ? null : result;
        }

        if (finder === 'findOne') {
          var empty = null
            , rowOrRows = typeof result === 'undefined'  ? null : result[0];
        }

        if (err && err.message === 'column "invalid" does not exist') {
          callback(null, empty);
        } else {
          if (typeof opts.include === 'undefined') {
            if (_(selector).isArray())
              results = typeof result === 'undefined' ? empty : rowOrRows;
            else if (_(selector).isNumber() || _(selector).isString())
              results = typeof result[0] === 'undefined' ? null : result[0];
            else
              results = typeof result === 'undefined' ? empty : rowOrRows;

            callback(err, results);
          } else {
            results = typeof result === 'undefined' ? empty : rowOrRows;
            if (typeof results === 'undefined' || _.isEmpty(results)) {
              callback(null, results)
            } else {
              handleIncludes(self, results, selector, opts.include, callback);
            }
          }
        }
      });
    };

    loadSchema(self, findQuery, opts);
  };
});

Base.prototype.update = function(selector, obj, callback) {
  var self = this;

  var updateQuery = function() {
    var outValues = [];
    var updateStatement = Statements.update(self, selector, obj, outValues);
    self.client.emit('query', updateStatement, outValues, callback);
  };

  loadSchema(self, updateQuery);
};

Base.prototype.destroy = function(selector, callback) {
  var self = this;

  var destroyQuery = function() {
    if (_.isFunction(selector)) {
      callback = selector;
      selector = {};
    }

    var outValues = [];
    var destroyStatement = Statements.destroy(self, selector, outValues);
    self.client.emit('query', destroyStatement, outValues, callback);
  }

  loadSchema(self, destroyQuery);
};

var handleIncludes = function(self, models, selector, includes, callback) {
  var includedModels = _(includes).keys();

  var findIncludes = function(model, callback) {
    var finders = {};
    _(includedModels).each(function(includeFinder) {
      ['many', 'belongsTo', 'one'].forEach(function(relationship) {
        var includedModel = _(self[relationship]).select(function(m) {
          return _(_(m).keys()).include(includeFinder);
        })[0];

        if (_(includedModel).isUndefined())
          return;

        finders[includeFinder] = function(cb) {
          var where = _(includes[includeFinder].where).isUndefined() ?
            {} : includes[includeFinder].where;

          if (relationship === 'many') {
            var primaryKeySelector = {};
            if (includedModel.assoc) {
              var primaryKey = _(includedModel.assoc.foreignKeys).find(function (e) {
                return e.model.tableName === self.tableName}).key;
              primaryKeySelector[primaryKey] = model[self.primaryKey];
              var linkKey = _.find(includedModel.assoc.foreignKeys, function (elem) {
                return elem.model.tableName === includedModel[includeFinder].tableName}).key;
              includes[includeFinder].join = { model: includedModel.assoc, key: linkKey};
            } else {
              primaryKeySelector[includedModel.joinOn] = model[self.primaryKey];
            }
            var selector = _.extend(primaryKeySelector, where);

            includedModel[includeFinder].find(selector,
              includes[includeFinder],
            function(err, results) {
              cb(err, results);
            });
          } else if (relationship === 'one') {
            includedModel[includeFinder].find(model[includedModel.joinOn],
              includes[includeFinder],
            function(err, results) {
              cb(err, results);
            });
          } else if (relationship === 'belongsTo') {
            var primaryKeySelector = {};
            primaryKeySelector[includedModel[includeFinder].primaryKey] = model[includedModel.joinOn];
            var selector = _.extend(primaryKeySelector, where);

            includedModel[includeFinder].find(selector,
              includes[includeFinder],
            function(err, results) {
              cb(err, results);
            });
          }
        }
      });
    });

    async.parallel(finders, function(err, results) {
      var models = _.extend(model, results);
      callback(err, models);
    });
  };

  if (_.isArray(models)) {
    async.map(models, findIncludes, function(err, results) {
      var formattedResults = null;

      if (_(selector).isArray())
        formattedResults = _.isUndefined(results) ? [] : results;
      else if (_(selector).isNumber() || _(selector).isString())
        formattedResults = _.isUndefined(results) ? null : results[0];
      else
        formattedResults = _.isUndefined(results) ? [] : results;

      callback(err, formattedResults);
    });
  } else {
    findIncludes(models, function(err, results) {
      callback(err, results);
    });
  }
};

var loadSchema = function(model, query, opts) {
  if (typeof opts === 'undefined')
    opts = {};


  if (typeof model._fields === 'undefined') {
    var statement = Statements.information(model);
    model.client.emit('query', statement, function(err, result) {
      model._fields = result;
      model._columns = _(model._fields).pluck('column_name');
      if (typeof opts.join === 'undefined')
        return query();
      loadSchema(opts.join.model,query);
    });
  } else {
    query();
  }
};

module.exports = Base;
