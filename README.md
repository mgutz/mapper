# Mapper

Mapper makes 80% of data access easy and provides unobtrusive access
to SQL for the 20% complicated, speed-critical tasks.

## Motivation

Wanted a lightweight data mapper that is fast and likes SQL.

## Install

To use mapper in your project

    # For Ubuntu
    sudo apt-get install libmysqlclient-dev

    npm install mapper

To run Backbone or AngularJS Example

    git clone git://github.com/mgutz/mapper.git
    cd mapper
    npm install -d
    make test                   # creates necessary database and config.json
    node example/app.js

then browse `http://localhost:3000`

## TODO

    Connection pooling - adding SOON

## Quickstart

Conect to Database

    var Mapper = require('mapper');
    var conn = { user: 'grace', password: 'secret', database: 'app_dev' };

    // set verbose flag to trace SQL
    // set strict to be warned of invalid columns in JSON objects
    Mapper.connect(conn, {verbose: true, strict: false});

Define Data Access Objects

    // Table name and optional primary key
    var Comment = Mapper.map("Comments")
      , Post = Mapper.map("Posts", "id");

Define Relationships

    Post.hasMany("comments", Comment, "postId");
    Comment.belongsTo("post", Post, "postId");

Create

    var insertId;

    // These are equivalent, where first is more SQL like
    Post.insert({ title: 'First Post' }).exec(function(err, result) {
        insertId = result.insertId;
    });
    Post.create({ title: 'First Post' }, function(err, result) { ... });

Retrieve

    // Select inserted post
    Post.where({ id: insertId }).one(function(err, post) {
        assert.equal(post.title, 'First Post,');
    });

    Post.findById(insertId, function(err, post) { ... });

Update

    // update inserted post
    Post
      .update()                         // optional since set() is used
      .set({ title: 'New Title' })
      .where({ id: insertId })
      .exec(function (err, result) {
        assert.equal(result.affectedRows, 1);
      });

    // if doc has id set, then save is simple. Note,
    // pluck only the columns you want updated
    Post.save(doc, function(err, result) { ... });

Delete

    // delete all posts with a specific title
    Post.delete().where({ title: 'New Title' }).exec(function(err, result) {
        assert.equal(result.affectedRows, 1);
    });

    Post.deleteById(insertId, function(err, result) {});


Gets the first page of posts and populate comments property with
the second page of comments for each post retrieved.

    Post
      .select('id', 'title', 'excerpt')
      .page(0, 25)
      .order('id DESC')
      .load('comments', function(c) {
        c.select('comment', 'createdAt')
         .order('id DESC')
         .page(1, 50);
      })
      .all(function(err, posts) {
        // boo-yah!
      });

OR, if you prefer SQL

    var sql = ("SELECT id, title, excerpt FROM `Posts` \
                ORDER BY id DESC LIMIT 0, 25";

    Post.all(sql, function(err, posts) {
      Post.load('comments', function(c) {
        c.sql("SELECT comment, createdAt FROM Comments ORDER BY id DESC LIMIT 1, 50");
      }).in(posts, function(err) {
        // boo-yah!
      });
    });


## SQL goodness

Executing multiple statements in a series

    Mapper.client.execSeries(
      "SELECT * FROM posts WHERE author = ?", [1],

      // SQL may be separated by `,`
      "SELECT * ",
      "FROM comments WHERE author = ?", [1],

      function(err, results) {
        // posts are in results[0][0..n]
        // comments are in results[1][0..n]
      }
    );


Executing multiple statements in parallel

    Mapper.client.execParallel(
      "SELECT * FROM posts WHERE author = ?", [1],
      "SELECT * FROM comments WHERE author = ?", [1],
      function(err, results) {
      }
    );

## Benchmarks

Time for 100,000 iterations alternating between insert and select. See `test/bench`
or run `make bench`.

    time node test/bench/testMysql.js (mysql 2.0.0-alpha3)

    real        1m27.239s
    user        0m58.506s
    sys         0m3.288s

    time node test/bench/testMapperDao.js

    real        0m30.701s
    user        0m11.346s
    sys         0m4.403s

    time node test/bench/testLibMysql.js

    real        0m26.044s
    user        0m8.207s
    sys         0m3.784s

    time node test/bench/testMongo.js (just for fun)

    real        0m41.771s
    user        0m30.830s
    sys         0m2.910s

The takeaway is `mysql-libmysqlclient` is a much faster driver than the
widely used `mysql` driver. Mapper, which is based on `mysql-libmysqlclient` adds
overhead yet outperforms the raw `mysql` driver.

Even more surprising is Mapper is faster than MongoDB using the official MongoDB
driver for node.js.

## Implementation Best Practice

A simple approach, without over-engineering your project, is to maintain
3 distinct layers in your code:

1. Data Access Objects (DAO) - Responsible for interacting with the database.
   There should be 1 DAO for each table used by project.
2. Models - A model uses one or more DAO adding business logic, validations as needed.
3. Resources or Services - This layer should only use models never DAO.

On a more complex project where a few tables might be better stored in Redis for
example, insert a Repository layer between DAO and models to insulate models
completely from low-level data access.
