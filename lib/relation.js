var _ = require('lodash'),
  async = require('async'),
  QueryBuilder = require('./queryBuilder'),
  Index = QueryBuilder.Index,
  util = require("util");


function Relation(dao)  {
  this.dao = dao;
  this.client = dao.client;

  // Relation is a QueryBuilder
  QueryBuilder.call(this, dao.queryBuilderOptions);
}
util.inherits(Relation, QueryBuilder);


/**
 * Populates a relation.
 */
Relation.prototype.load = function(property, lambda) {
  if (!this._populations) this._populations = [];
  this._populations.push({property: property, lambda: lambda});
  return this;
};


// should throw an exception if more than one is returned
Relation.prototype.one = function(cb) {
  if (!this.buffer) {
    this.select().limit(1);
  }

  query(this, "one", cb);
}

// used when loading relations with existing rowset
Relation.prototype.in = function(rows, cb) {
  fetchPopulations(this, rows, function(err) {
    cb(err, rows);
  });
}


Relation.prototype.all = function(cb) {
  // returns all if no clauses were set
  if (!this.buffer) this.select();

  query(this, "all", cb);
}




/**
 * Executes a query without returning a result.
 *
 * Use `all` if you want the result.
 */
Relation.prototype.exec = function(cb) {
  // TODO optimize later, currently behaves just like all
  this.client.emit('query', this.toSql(), cb);
}


Relation.prototype.scalar = function(cb) {
  this.client.scalar(this.toSql(), cb);
}


function buildRelation(that, relationItem, rows, relation) {
  var RelationDao = relationItem.RelationDao,
    relation = relation || RelationDao.select(),
    fieldName = relationItem.fieldName,
    relationTableName = relation.dao.schema.escapedTableName,
    thatTableName = that.dao.schema.escapedTableName,
    relationStar = relationTableName+".*",
    ids,
    whereClause = "";

  // Caller may have set SELECT or WHERE clause
  if (relation.isChangedBuffer(Index.SELECT))
    relationStar = relation.getBuffer(Index.SELECT).replace("SELECT ", "");
  if (relation.isChangedBuffer(Index.WHERE))
    whereClause = relation.getBuffer(Index.WHERE).replace("WHERE", " AND");

  switch (relationItem.type) {

    case RelationType.BELONGS_TO:
      var thatIdField = thatTableName+"."+that.dao.primaryKey;
      var relationIdField = relationTableName+"."+relation.dao.primaryKey;
      // SELECT Comment.id AS __id, Post.*
      // FROM Post
      // INNER JOIN Comment
      //   ON Post.id = Comment.postId
      // WHERE Post.id IN ($comment.postId)
      ids = _.pluck(rows, fieldName);
      console.log("BELONGS_TO", ids);
      return relation
        .select(thatIdField+" AS __id, "+relationStar)
        .from(relationTableName+
          " INNER JOIN "+thatTableName+
          "  ON "+relationIdField+" = "+thatTableName+"."+fieldName
         )
        .where(relationIdField+" IN (?)"+whereClause, [ids]);

    case RelationType.HAS_ONE:
      // SELECT postId AS __id, Detail.*
      // FROM Detail
      // WHERE postId = Post.id
      ids = _.pluck(rows, that.dao.primaryKey);
      return relation
        .select(fieldName+" AS __id, "+relationStar)
        .where(fieldName+" IN (?)"+whereClause, [ids]);

    case RelationType.HAS_MANY:
      // SELECT postId AS __id, Comments.*
      // FROM Comments
      // WHERE postId = $id;
      ids = _.pluck(rows, that.dao.primaryKey);
      return relation
        .select(fieldName+ " AS __id, "+relationStar)
        .where(fieldName+" IN (?)"+whereClause, [ids]);

    case RelationType.HAS_MANY_THROUGH:
      var throughRelation = relationItem.ThroughDao.select(),
        throughTableName = throughRelation.dao.schema.escapedTableName,
        relationIdField = relationTableName+"."+throughRelation.dao.primaryKey,
        throughJoin = throughTableName+"."+relationItem.joinFieldName,
        throughField = throughTableName+"."+fieldName;

      // SELECT PostsTags.postId AS __id, Tags.*
      // FROM Tags
      // INNER JOIN PostsTags on Tags.id = PostTags.tagId
      // WHERE PostsTags.postId IN ($ids);
      ids = _.pluck(rows, that.dao.primaryKey);
      return relation
        .select(throughField+" AS __id, "+relationStar)
        .from(relationTableName+
          " INNER JOIN "+throughTableName+" ON "+relationIdField+" = "+throughJoin
        )
        .where(throughField+" IN (?)"+whereClause, [ids]);

    default: throw new Error("Unknown relation type.");
  }
}

/** Private functions
 */
function fetchPopulations(that, rows, cb) {
  if (!Array.isArray(rows)) rows = [rows];

  function populate(item, cb) {
    var relationItem = that.schema.relations[item.property];

    function fetch(err, inRelation) {
      if (err) return cb(err);

      // `inRelation` is set above if a callback was provided for `populate`
      var relation = buildRelation(that, relationItem, rows, inRelation);

      // get all the rows for all results
      relation.all(function(err, relationRows) {
        if (err) return cb(err);

        var id, filtered;
        _.each(rows, function(row) {
          id = row[that.dao.primaryKey];
          filtered = _.filter(relationRows, function(rrow) {
            return rrow.__id === id;
          });
          if (filtered.length > 0) {
            if (relationItem.type === RelationType.HAS_ONE || relationItem.type === RelationType.BELONGS_TO)
              row[relationItem.name] = filtered[0];
            else
              row[relationItem.name] = filtered;
          }
        });
        cb(null);
      });
    }

    // Allows customzed retrieval like retrieving a single page of comments
    // intead of all.
    if (item.lambda) {
      if (item.lambda.length === 1) {
        var rel = relationItem.RelationDao.select();
        // create a new Relation object for this Dao
        item.lambda(rel);
        fetch(null, rel);
      }
      else {
        item.lambda(relationItem.RelationDao.select(), function(err) {
          fetch(err, relation);
        });
      }
    }
    else {
      fetch(null);
    }
  }

  async.forEach(that._populations, populate, function(err) {
    cb(err, rows);
  });
}

/**
 * Executes a query against the database and if needed populates
 * any relations.
 */
function query(that, method, cb) {
  if (that._populations) {
    that.client[method](that.toSql(), function(err, rows) {
        if (err) return cb(err);
        fetchPopulations(that, rows, function(err, rows) {
          if (method === "all")
            cb(err, rows);
          else
            cb(err, rows[0]);
        });
    });
  }
  else {
    that.client[method](that.toSql(), cb);
  }
};

/**
 * Enumerated types.
 */

var RelationType = Relation.RelationType = {
  HAS_ONE: 0,
  HAS_MANY: 1,
  BELONGS_TO: 2,
  HAS_MANY_THROUGH: 3
};

module.exports = Relation;
