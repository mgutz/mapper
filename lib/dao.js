/**
 * Module dependencies.
 */

var QueryBuilder = require("./queryBuilder")
  , async = require("async")
  , _ = require('lodash');


function informationSql(tableName) {
  var stmt =  "SELECT column_name, is_nullable, data_type, " +
              "character_maximum_length, column_default " +
              "FROM information_schema.columns " +
              "WHERE table_name = '" + tableName + "';";

  return stmt;
};


var RelationType = {
  HAS_ONE: 0,
  HAS_MANY: 1,
  BELONGS_TO: 2,
  HAS_MANY_THROUGH: 3
};

/**
 * Dao.
 */
function Dao(options) {
  that = this;
  this.client = options.client;
  this.tableName = options.tableName;
  this.primaryKey = options.primarykey || "id";


  // Model must be loaded for QueryBuilder prototype inheritance to work.
  // It's loaded SYNCHRONOUSLY to keep the code lean otherwise we need to
  // queue up commands or guard any functions. It only happens once so
  // sue the milliseconds out of me!
  this._schema = loadSchemaSync(this.client, this.tableName);
  this._schema.relations = {};
  this._schema.tableName = this.tableName;
  this._schema.primaryKey = this.primaryKey || "id";

  //this.client.on('error', function(err) { that.reset();});



  return this;
};
Dao.prototype.__proto__ = QueryBuilder.prototype;


// should throw an exception if more than one is returned
Dao.prototype.one = function(cb) {
  if (!this.buffer) {
    this.select().limit(1);
  }

  query(this, "one", cb);
}


Dao.prototype.all = function(cb) {
  // returns all if no clauses were set
  if (!this.buffer) this.select();

  query(this, "all", cb);
}


/**
 * Executes a query without returning a result.
 *
 * Use `all` if you want the result.
 */
Dao.prototype.exec = function(cb) {
  // TODO optimize later, currently behaves just like all
  this.client.emit('query', this.toSql(), cb);
}


Dao.prototype.scalar = function(cb) {
  this.client.scalar(this.toSql(), cb);
}


/**
 * Creates a new row in the database.
 *
 * @example.
 * PostDao.create({title: "Some title."}, cb);
 */
Dao.prototype.create = function(obj, callback) {
  this.insert(obj);
  this.first(callback);
};


/**
 *
 * http://guides.rubyonrails.org/association_basics.html#the-has_many-association
 *
 * @examples
 * PostDao.hasMany("comments", Comment, "postId")
 */
Dao.prototype.hasMany = function(name, RelationDao, fieldName) {
  addRelation(this, {
      name: name,
      type: RelationType.HAS_MANY,
      RelationDao: RelationDao,
      fieldName: fieldName
  });
  return this;
};


/**
 *http://guides.rubyonrails.org/association_basics.html#the-has_many-through-association

 * @example
 * Post.hasManyThrough("tags", Tag, "tagId", PostTag, "postId");
 */
Dao.prototype.hasManyThrough = function(name, RelationDao, joinFieldName, ThroughDao, fieldName) {
  addRelation(this, {
    name: name,
    type: RelationType.HAS_MANY_THROUGH,
    RelationDao: RelationDao,
    joinFieldName: joinFieldName,
    ThroughDao: ThroughDao,
    fieldName: fieldName
  });
  return this;
}


/**
 * Defines a relationship where an entity has a single, related entity.
 *
 * http://guides.rubyonrails.org/association_basics.html#the-has_one-association
 *
 * @example
 * UserDao.hasOne("location", Location, "locationId")  // one location through self.locationId
 */
Dao.prototype.hasOne = function(name, RelationDao, fieldName) {
  addRelation(this, {
    name: name,
    type: RelationType.HAS_ONE,
    RelationDao: RelationDao,
    fieldName: fieldName
  });

  return this;
};


/**
 * Defines a relationship where a child collection belongs to
 * another.
 *
 *  http://guides.rubyonrails.org/association_basics.html#the-belongs_to-association
 *
 * @example
 * CommentDao.belongsTo("post", Post, "postId");
 */
Dao.prototype.belongsTo = function(name, RelationDao, fieldName) {
  addRelation(this, {
    name: name,
    type: RelationType.BELONGS_TO,
    RelationDao: RelationDao,
    fieldName: fieldName
  });

  return this;
};




/** Private functions
 */
function fetchPopulations(that, rows, cb) {
  if (!Array.isArray(rows)) rows = [rows];

  function populate(item, cb) {
    var relation = that._schema.relations[item.property];

    function fetch(err) {
      if (err) return cb(err);

      var dao = buildRelation(that, relation, rows);


        if (relation.name == 'post') {
          console.log("Comments", that._populations);
          console.log("Post", dao._populations);
          console.log(dao.peekSql());
          process.exit(0);
        }

      // get all the rows for all results
      dao.all(function(err, relationRows) {
        if (relation.name == 'post') {
          console.log("relationRows", relationRows);
          console.log(that._schema.relations);
          console.log(dao.peekSql());
          process.exit(0);
        }

        if (err) return cb(err);

        var id, filtered;
        _.each(rows, function(row) {
          id = row[that.primaryKey];
          filtered = _.filter(relationRows, function(rrow) {
            return rrow.__id === id;
          });
          if (filtered.length > 0) {
            if (relation.type == RelationType.HAS_ONE || relation.Type == RelationType.BELONGS_TO)
              row[relation.name] = filtered[0];
            else
              row[relation.name] = filtered;
          }
        });
        cb(null);
      });
    }

    // Allows customzed retrieval like retrieving a single page of comments
    // intead of all.
    if (item.lambda) {
      if (item.lambda.length === 1) {
        item.lambda(relation.RelationDao);
        fetch(null);
      }
      else {
        item.lambda(relation.RelationDao, fetch);
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



var schemaCache = {};
function loadSchemaSync(client, tableName) {
  if (schemaCache[tableName]) return schemaCache[tableName];

  var sql = "SELECT column_name, is_nullable, data_type, " +
            "character_maximum_length, column_default " +
            "FROM information_schema.columns " +
            "WHERE table_name = '" + tableName + "';";

  var result = client.execSync(sql);
  var schema =  {
    _fields: result,
    columns: _.pluck(result, 'column_name'),
    escapedTableName: "`"+tableName+"`"
  };

  return schemaCache[tableName] = schema;
};


/**
 * Executes a query against the database and if needed populates
 * any relations.
 */
var query = function(that, method, cb) {
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


module.exports = Dao;
