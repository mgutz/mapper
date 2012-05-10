# Mapper

Mapper makes 80% of data access easy and provides unobtrusive access
to SQL for the 20% complicated, speed-critical tasks.


## Motivation

Current node.js ORMs try to add business logic with statics,
virtual attributes, validations, pseudo-class inheritance. They're BLOATED.
Why have validations in the ORM when you could do validations in a separate
module and share that between client and server? Simpler is better as
development move towards single page apps, data services and shared code.

Speed!


## Install

    npm install mapper


## Quickstart

Conect to Database

    var Mapper = require('mapper');
    var conn = { user: 'dont', password: 'blink', database: 'now' };
    Mapper.connect(conn);

Define Data Access Objects

    // table name and optional primary key
    var Comment = Mapper.map("Comments")
      , Post = Mapper.map("Posts", "id");

Define Relationships

    Post.hasMany("comments", Comment, "postId");
    Comment.belongsTo("post", Post, "postId");

CRUD

    var insertId;

    Post.insert({ title: 'First Post' }).exec(function(err, result) {
        insertId = result.insertId;
    });

    Post.where({ id: insertId }).one(function(err, post) {
        assert.equal(post.title, 'First Post,');
    });

    Post.set({ title: 'New Title'}).exec(function(err, result) {
        assert.equal(result.affectedRows, 1);
    });

    Post.delete({ title: 'New Title'}).exec(function(err, result) {
        assert.equal(result.affectedRows, 1);
    });


Gets the first page of posts and populate comments property with
the second page of comments.

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
      Post.load('comments').in(posts, function(err) {
        // boo-yah!
      });
    });


## Benchmarks

Time for 100,000 iterations alternating between insert and select. See `test/bench` or run `make bench`.

    mysql-libmysqlclient    0m29.871s
    mapper                  0m35.187s
    node-mysql              1m5.828s

The take away is `mysql-libmysqlclient` is a much faster driver than the
widely used `mysql` driver. Mapper adds a little overhead but is still
faster than raw `mysql` driver. These numbers fluctuate. NOTE: most runs
show `mapper` performing around 30% better than `mysql`.


## Implementation Best Practice

A simple approach, without over-engineering your project, is to maintain
3 distinct layers in your code:

1. Data Access Objects (DAO) - Responsible for interacting with the database.
   There should be 1 DAO for each table used by project.
2. Models - Contains domain objects. A model usually aggregates one or more DAO
   adding business logic, validations as needed.
3. Resources or Services - This layer should only user models never DAO.

On larger, more complex projects, a Repository later between 1 and 2 is
recommended to insulate models completely from low-level data access.
