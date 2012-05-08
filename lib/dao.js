/**
 * Module dependencies.
 */

var
  async = require("async"),
  _ = require('lodash');
  Relation = require("./relation"),
  RelationType = Relation.RelationType;


/**
 * Data Access Object (DAO).
 *
 * A DAO maps to a database table and should only contain data access methods.
 */
function Dao(options) {
  var primaryKey;

  this.client = options.client;
  this.tableName = options.tableName;
  this.primaryKey = options.primarykey || "id";
  this.strict = Boolean(options.strict);


  // It's loaded SYNCHRONOUSLY to keep the code lean otherwise we need to
  // queue up commands or guard any functions. It only happens once so
  // sue the milliseconds out of me.
  var schema = loadSchemaSync(this.client, this.tableName);
  this.schema = schema;
  this.escapedTableName = schema.escapedTableName;

  schema.relations = {};
  schema.tableName = this.tableName;
  if (!schema.primaryKey) {
    schema.primaryKey = options.primaryKey || "id";
  }

  this.queryBuilderOptions = {
    schema: this.schema,
    verbose: true,
    strict: false
  };

  return this;
};



/**
 * Defines a 1-many relationship.
 *
 * See [rails has_many](http://guides.rubyonrails.org/association_basics.html#the-has_many-association)
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
 * Defines a 1-many relationship through a join table.
 *
 * See [rails has_many_through](http://guides.rubyonrails.org/association_basics.html#the-has_many-through-association)
 *
 * @example
 * Post.hasManyThrough("tags", TagDao, "tagId", PostTagDao, "postId");
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
 * See [rails has_one](http://guides.rubyonrails.org/association_basics.html#the-has_one-association)
 *
 * @example
 * UserDao.hasOne("location", LocationDao, "locationId")  // one location through self.locationId
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
 * See [rails belongs_to](http://guides.rubyonrails.org/association_basics.html#the-belongs_to-association)
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

/**
 * Creates a delete Relation.
 *
 * @see Relation
 */
Dao.prototype.delete = function(clause) {
  return applyRelationMethod(this, null, "delete", arguments);
};

/**
 * Creates an insert Relation.
 *
 * @see Relation
 */
Dao.prototype.insert = function(clause) {
  return applyRelationMethod(this, null, "insert", arguments);
};

/**
 * Creates a select Relation.
 *
 * @see Relation
 */
Dao.prototype.select = function(clause) {
  return applyRelationMethod(this, null, "select", arguments);
};

/**
 * Creates an update Relation.
 *
 * @see Relation
 */
Dao.prototype.update = function(clause) {
  return applyRelationMethod(this, null, "update", arguments);
};

/**
 * Loads a relation when a Relation is executed.
 */
Dao.prototype.load = function(clause) {
  return applyRelationMethod(this, "select", "load", arguments);
};

/**
 * Creates an update Relation then calls `Relation#set`.
 *
 * @see Relation
 */
Dao.prototype.set = function(clause) {
  return applyRelationMethod(this, "update", "set", arguments);
};

/**
 * Creates a select Relation then calls `Relation#where`.
 *
 * @see Relation
 */
Dao.prototype.where = function() {
  return applyRelationMethod(this, "select", "where", arguments);
};


/**
 * Sugar functions.
 */

/**
 * Sets the WHERE of a select Relation.
 *
 * @see Relation
 */
Dao.prototype.id = function(val) {
  return applyRelationMethod(this, "select", "id", arguments);
};

/**
 * Creates a new row in the database.
 *
 * @example.
 * PostDao.create({title: "Some title."}, cb);
 */
Dao.prototype.create = function(obj, callback) {
  this.insert(obj).exec(callback);
};

/**
 * Finds a row by id.
 */
Dao.prototype.byId = function(id, callback) {
  this.id(id).exec(callback);
};


/**
 * Direct fetch functions.
 */

/**
 * Executes a query if provided, else fetches all rows.
 *
 * @example
 * dao.all('SELECT * FROM daos WHERE id = ?', [1], cb);
 * dao.all('SELECT * FROM daos', cb);
 * dao.all(cb);
 */
Dao.prototype.all = function(cb) {
  if (arguments.length === 1)
    this.client.all("SELECT * FROM "+this.escapedTableName, cb);
  else
    this.client.all.apply(this.client, [].slice.call(arguments, 0));
}

Dao.prototype.count = function(cb) {
  this.client.scalar("SELECT count(*) AS N FROM "+this.escapedTableName, cb);
}

Dao.prototype.one = function(cb) {
  if (arguments.length === 1)
    this.client.one("SELECT * FROM "+this.escapedTableName + " LIMIT 1;", cb);
  else
    this.client.one.apply(this.client, [].slice.call(arguments, 0));
}

Dao.prototype.truncate = function(cb) {
  this.client.exec("TRUNCATE "+this.escapedTableName, cb);
}

/**
 * Private functions
 */

function addRelation(that, relation) {
  var schema = that.schema;
  if (!schema.relations) schema.relations = {};
  schema.relations[relation.name] = relation;
}

var schemaCache = {};
function loadSchemaSync(client, tableName) {
  if (schemaCache[tableName]) return schemaCache[tableName];
  var sql, rows, schema, primaryKey, row;

  sql = "SELECT column_name, is_nullable, data_type, " +
        "character_maximum_length, column_default, column_key " +
        "FROM information_schema.columns " +
        "WHERE table_schema = '"+client.config.database+"' AND table_name = '" + tableName + "';";

  rows = client.execSync(sql);
  var row = _.find(rows, function(row) {
    return row.column_key === 'PRI';
  });
  primaryKey = row.column_name;
  if (client.strict && !primaryKey) {
    console.error("STRICT WARNING: Primary Key not defined in database for `"+tableName+"`.");
  }

  var schema =  {
    relations: {},
    _fields: rows,
    columns: _.pluck(rows, 'column_name'),
    tableName: tableName,
    primaryKey: primaryKey,
    escapedTableName: "`"+tableName+"`"
  };
  return schemaCache[tableName] = schema;
};


function applyRelationMethod(that, method, method2, args) {
  var relation = new Relation(that);
  if (method) relation[method]();
  return relation[method2].apply(relation, [].slice.call(args, 0));
}

module.exports = Dao;
