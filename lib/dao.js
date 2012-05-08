/**
 * Module dependencies.
 */

var
  async = require("async"),
  _ = require('lodash');
  Relation = require("./relation"),
  RelationType = Relation.RelationType;


/**
 * Dao.
 */
function Dao(options) {
  this.client = options.client;
  this.tableName = options.tableName;
  this.primaryKey = options.primarykey || "id";


  // It's loaded SYNCHRONOUSLY to keep the code lean otherwise we need to
  // queue up commands or guard any functions. It only happens once so
  // sue the milliseconds out of me.
  this.schema = loadSchemaSync(this.client, this.tableName);
  this.schema.relations = {};
  this.schema.tableName = this.tableName;
  this.schema.primaryKey = this.primaryKey || "id";

  this.queryBuilderOptions = {
    schema: this.schema,
    verbose: true,
    strict: false
  };

  //this.client.on('error', function(err) { that.reset();});
  return this;
};


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


/**
 * Expose QueryBuilder methods which return a Relation object.
 *
 * Don't get cute like Rails and build these  dynamically. It's not much
 * boilerplate code and it's easier to follow.
 */

Dao.prototype.delete = function(clause) {
  return applyRelationMethod(this, null, "delete", arguments);
};

Dao.prototype.insert = function(clause) {
  return applyRelationMethod(this, null, "insert", arguments);
};

Dao.prototype.select = function(clause) {
  return applyRelationMethod(this, null, "select", arguments);
};

Dao.prototype.update = function(clause) {
  return applyRelationMethod(this, null, "update", arguments);
};

function applyRelationMethod(that, method, method2, args) {
  var relation = new Relation(that);
  if (method) relation[method]();
  return relation[method2].apply(relation, [].slice.call(args, 0));
}

Dao.prototype.load = function(clause) {
  return applyRelationMethod(this, "select", "load", arguments);
};

Dao.prototype.set = function(clause) {
  return applyRelationMethod(this, "update", "set", arguments);
};

Dao.prototype.where = function() {
  return applyRelationMethod(this, "select", "where", arguments);
};

Dao.prototype.id = function(val) {
  return applyRelationMethod(this, "select", "id", arguments);
};


/**
 * Direct fetch functions.
 */

Dao.prototype.all = function(cb) {
  if (arguments.length === 1)
    this.client.all("SELECT * FROM "+this.schema.escapedTableName, cb);
  else
    this.client.all.apply(this.client, [].slice.call(arguments, 0));
}

Dao.prototype.count = function(cb) {
  this.client.scalar("SELECT count(*) AS N FROM "+this.schema.escapedTableName, cb);
}

Dao.prototype.one = function(cb) {
  if (arguments.length === 1)
    this.client.one("SELECT * FROM "+this.schema.escapedTableName + " LIMIT 1;", cb);
  else
    this.client.one.apply(this.client, [].slice.call(arguments, 0));
}

Dao.prototype.truncate = function(cb) {
  this.client.exec("TRUNCATE "+this.schema.escapedTableName, cb);
}

/**
 * Private functions
 */

function addRelation(that, relation) {
  if (!that.schema.relations) that.schema.relations = {};
  that.schema.relations[relation.name] = relation;
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


module.exports = Dao;
