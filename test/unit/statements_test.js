/**
 * Module dependencies.
 */

var helper = require('../test_helper.js');
var Statements = require('../../lib/statements');
var _ = require('lodash');

/**
 * Model stub.
 */

var model = {
  tableName:  'model_name',
  primaryKey: 'index',
  _fields: [
    { 'column_name': 'index' },
    { 'column_name': 'name' },
    { 'column_name': 'email' },
    { 'column_name': 'age' },
    { 'column_name': 'field' }
  ]
};

model._columns = _(model._fields).pluck('column_name');


/**
 * Statements test.
 */

module.exports = {

  // SELECT
  'select statement: single primary key': function() {
    assert.equal(
      Statements.select(model, '2345', {}, []),
      "SELECT * FROM `model_name` WHERE index = '2345';"
    );
  },
  'select statement: multiple primary keys': function() {
    assert.equal(
      Statements.select(model, ['1234', '5678'], {}, []),
      "SELECT * FROM `model_name` WHERE index IN (?,?);"
    );
  },
  'select statement: single field': function() {
    assert.equal(
      Statements.select(model, {
        'name': 'awesome sauce'
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE name = ?;"
    );
  },
  'select statement: multiple fields': function() {
    assert.equal(
      Statements.select(model, {
        'name': 'awesome sauce',
        'email': 'joepancakes@email.com'
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE name = ? " +
      "AND email = ?;"
    );
  },
  'select statement: only option': function() {
    assert.equal(
      Statements.select(model, {
        'name': 'awesome sauce',
        'email': 'joepancakes@email.com'
      }, {
        only: ['index', 'email']
      }, []),

      "SELECT index,email FROM `model_name` " +
      "WHERE name = ? " +
      "AND email = ?;"
    );
  },
  'select statement: limit': function() {
    assert.equal(
      Statements.select(model, {
        'name': 'awesome sauce',
        'email': 'joepancakes@email.com'
      }, {
        only: ['index', 'email'],
        limit: 25
      }, []),

      "SELECT index,email FROM `model_name` " +
      "WHERE name = ? " +
      "AND email = ? " +
      "LIMIT 25;"
    );
  },
  // 'select statement: offset': function() {
  //   assert.equal(
  //     Statements.select(model, {
  //       'name': 'awesome sauce',
  //       'email': 'joepancakes@email.com'
  //     }, {
  //       only: ['index', 'email'],
  //       offset: 5
  //     }, []),

  //     "SELECT index,email FROM `model_name` " +
  //     "WHERE name = ? " +
  //     "AND email = ? " +
  //     "LIMIT 5 OFFSET 5;"
  //   );
  // },
  'select statement: order asc': function() {
    assert.equal(
      Statements.select(model, {
        'name': 'awesome sauce',
        'email': 'joepancakes@email.com'
      }, {
        only: ['index', 'email'],
        limit: 50,
        order: ['field']
      }, []),

      "SELECT index,email FROM `model_name` " +
      "WHERE name = ? " +
      "AND email = ? " +
      "ORDER BY `field` ASC " +
      "LIMIT 50;"
    );
  },
  'select statement: order desc': function() {
    assert.equal(
      Statements.select(model, {
        'name': 'awesome sauce',
        'email': 'joepancakes@email.com'
      }, {
        only: ['index', 'email'],
        limit: 50,
        order: ['-field']
      }, []),

      "SELECT index,email FROM `model_name` " +
      "WHERE name = ? " +
      "AND email = ? " +
      "ORDER BY `field` DESC " +
      "LIMIT 50;"
    );
  },
  'select statement: order, offset & limit': function() {
    assert.equal(
      Statements.select(model, {
        'name': 'awesome sauce',
        'email': 'joepancakes@email.com'
      }, {
        only: ['index', 'email'],
        offset: 5,
        limit: 50,
        order: ['-field']
      }, []),

      "SELECT index,email FROM `model_name` " +
      "WHERE name = ? " +
      "AND email = ? " +
      "ORDER BY `field` DESC " +
      "LIMIT 50 " +
      "OFFSET 5;"
    );
  },
  'select statement: multiple order fields': function() {
    assert.equal(
      Statements.select(model, {
        'name': 'awesome sauce',
        'email': 'joepancakes@email.com'
      }, {
        only: ['index', 'email'],
        limit: 50,
        order: ['-field', 'another_field']
      }, []),

      "SELECT index,email FROM `model_name` " +
      "WHERE name = ? " +
      "AND email = ? " +
      "ORDER BY `field` DESC, `another_field` ASC " +
      "LIMIT 50;"
    );
  },
  'select statement: not equals (ne, not)': function() {
    assert.equal(
      Statements.select(model, {
        'name.ne': 'awesome sauce'
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE name <> ?;"
    );
    assert.equal(
      Statements.select(model, {
        'name.not': 'awesome sauce'
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE name <> ?;"
    );
  },
  'select statement: greater than (gt)': function() {
    assert.equal(
      Statements.select(model, {
        'age.gt': 21
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE age > ?;"
    );
  },
  'select statement: less than (lt)': function() {
    assert.equal(
      Statements.select(model, {
        'age.lt': 21
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE age < ?;"
    );
  },
  'select statement: greater than or equal (gte)': function() {
    assert.equal(
      Statements.select(model, {
        'age.gte': 21
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE age >= ?;"
    );
  },
  'select statement: less than or equal (lte)': function() {
    assert.equal(
      Statements.select(model, {
        'age.lte': 21
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE age <= ?;"
    );
  },
  'select statement: like (like)': function() {
    assert.equal(
      Statements.select(model, {
        'name.like': '%John%'
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE name LIKE ?;"
    );
  },
  'select statement: not like (nlike, not_like)': function() {
    assert.equal(
      Statements.select(model, {
        'name.nlike': '%John%'
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE name NOT LIKE ?;"
    );
    assert.equal(
      Statements.select(model, {
        'name.not_like': '%John%'
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE name NOT LIKE ?;"
    );
  },
  'select statement: in a list of values (in)': function() {
    assert.equal(
      Statements.select(model, {
        'field.in': ['some name']
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE field IN (?);"
    );

    assert.equal(
      Statements.select(model, {
        'field.in': ['some name', 34]
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE field IN (?,?);"
    );
  },
  'select statement: not in a list of values (nin, not_in)': function() {
    assert.equal(
      Statements.select(model, {
        'field.nin': ['some name']
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE field NOT IN (?);"
    );

    assert.equal(
      Statements.select(model, {
        'field.nin': ['some name', 34]
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE field NOT IN (?,?);"
    );

    assert.equal(
      Statements.select(model, {
        'field.not_in': ['some name', 34]
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE field NOT IN (?,?);"
    );
  },
  'select statement: ignores invalid fields': function() {
    assert.equal(
      Statements.select(model, {
        'field.in': ['some name', 34],
        'bad_field': 1234
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE field IN (?,?);"
    );
  },
  'select statement: returns empty with all invalid fields': function() {
    assert.equal(
      Statements.select(model, {
        'bad_field': 1234
      }, {}),

      "SELECT * FROM `model_name` WHERE INVALID;"
    );
  },
  'select statement: column alias': function() {
    assert.equal(
      Statements.select(model, '2345', {
        only: {'index':'a', 'email':'b'}
      }),

      "SELECT index AS `a`, email AS `b` FROM `model_name` " +
      "WHERE index = '2345';"
    )
  },
  'select statment: column alias ignores invalid fields': function() {
    assert.equal(
      Statements.select(model, '2345', {
        only: {'index':'a', 'email':'b', 'bad_field':'c', 'bad_field_2':'d'}
      }),

      "SELECT index AS `a`, email AS `b` FROM `model_name` " +
      "WHERE index = '2345';"
    )
  },
  'select statment: column alias all invalid fields returns all fields': function() {
    assert.equal(
      Statements.select(model, '2345', {
        only: {'bad_field':'c', 'bad_field_2':'d'}
      }),

      "SELECT * FROM `model_name` " +
      "WHERE index = '2345';"
    )
  },
  'select statement: column alias with order alias': function() {
    assert.equal(
      Statements.select(model, {
        'name': 'awesome sauce',
        'email': 'joepancakes@email.com'
      }, {
        only: {'index':'an index', 'email':'a email'},
        limit: 50,
        order: ['-an index', 'a email']
      }, []),

      "SELECT index AS `an index`, email AS `a email` FROM `model_name` " +
      "WHERE name = ? " +
      "AND email = ? " +
      "ORDER BY `an index` DESC, `a email` ASC " +
      "LIMIT 50;"
    );
  },
  'select statement: query using null': function() {
    assert.equal(
      Statements.select(model, {
        'name': null
      }, {}, []),

      "SELECT * FROM `model_name` " +
      "WHERE name IS NULL;"
    );
  },
  // 'select statement: text search query': function() {
  //   assert.equal(
  //     Statements.select(model, {
  //       'name.textsearch': 'test'
  //     }, {}, []),

  //     "SELECT * FROM `model_name` " +
  //     "WHERE to_tsvector('english', name) @@ to_tsquery('english', ?);"
  //   );
  // },

  // INSERT

  'insert statement: basic with all valid fields': function() {
    var obj = { index: '1234', name: 'Joseph' };

    assert.equal(
      Statements.insert(model, obj, []),
      "INSERT INTO `model_name`(index,name) " +
      "VALUES(?,?);"
    );
  },
  'insert statement: ignore invalid fields': function() {
    var obj = {
      bad_field: 'abcdef',
      email: 'bob@email.com',
      name: 'Bob',
      age: 8
    };

    assert.equal(
      Statements.insert(model, obj, []),
      "INSERT INTO `model_name`(email,name,age) " +
      "VALUES(?,?,?);"
    );
  },

  // UPDATE

  'update statement: basic with all valid fields': function() {
    var obj = { index: '1234', name: 'Joseph' };

    assert.equal(
      Statements.update(model, {
        'age.gt': 15
      }, obj, []),
      "UPDATE `model_name` " +
      "SET index= ?, name= ? " +
      "WHERE age > ?;"
    );
  },
  'update statement: ignore invalid fields': function() {
    var obj = {
      age: 8,
      bad_field: 'abcdef',
      name: 'Bob',
      email: 'bob@email.com'
    };

    assert.equal(
      Statements.update(model, {
        'name': 'Joe'
      }, obj, []),
      "UPDATE `model_name` " +
      "SET age= ?, name= ?, email= ? " +
      "WHERE name = ?;"
    );
  },

  // DELETE

  'delete statement: delete all rows': function() {
    assert.equal(
      Statements.destroy(model),

      "DELETE FROM `model_name`;"
    );
  },
  'delete statement: one field for selector': function() {
    assert.equal(
      Statements.destroy(model, {
        'name': 'awesome sauce'
      }, []),

      "DELETE FROM `model_name` " +
      "WHERE name = ?;"
    );
  },
  'delete statement: multiple fields for selector': function() {
    assert.equal(
      Statements.destroy(model, {
        'name': 'awesome sauce',
        'email': 'happyman@bluesky.com'
      }, []),

      "DELETE FROM `model_name` " +
      "WHERE name = ? " +
      "AND email = ?;"
    );
  },
  'delete statement: ignores invalid fields': function() {
    assert.equal(
      Statements.destroy(model, {
        'name': 'awesome sauce',
        'email': 'happyman@bluesky.com',
        'bad_field': 1000
      }, []),

      "DELETE FROM `model_name` " +
      "WHERE name = ? " +
      "AND email = ?;"
    );
  },

  // TRUNCATE

  'truncate statement: truncates all records': function() {
    assert.equal(
      Statements.truncate(model),
      "TRUNCATE `model_name`;"
    );
  },
}
