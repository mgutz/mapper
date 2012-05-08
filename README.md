# Mapper

Mapper makes 80% of data access easy and provides unobtrusive access
to SQL for the 20% complicated, speed-critical tasks. It does
not try to replace SQL.


## Motivation

Current node.js ORMs try to add business logic with statics,
virtual attributes, validations, pseudo-class inheritance. They're BLOATED.
Why have validations in the ORM when you could do validations in a separate
module and share that between client and server? Simpler is better as
development move towards single page apps, data services and shared code.

Speed!


NOTE:

Work in progress. Moving away from FastLegS syntax to a cleaner, fluent
and consistent API.


## Quickstart

    var Mapper = require('mapper');
    var conn = { user: 'dont' , password: 'blink' , database: 'now' };
    Mapper.connect(conn);

    // Define a DAO with DB table name and optional primary key.
    var Comment = Mapper.map("Comments")
      , Post = Mapper.map("Posts", "id");

    Post.hasMany("comments", Comment, "postId");
    Comment.belongsTo("post", Post, "postId");

    // Get the first page of posts and populate comments property
    // with the second page of comments.
    Post
      .select('id', 'title', 'excerpt')
      .page(0, 25)
      .order('id DESC')
      .load('comments', function(c) {
        c.select('comment', 'createdAt')
         .orderBy('id DESC')
         .page(1, 50);
      })
      .all(function(err, posts) {
        // boo-yah!
      });

    // Populate existing rowset
    Post.load('comments').in(posts, cb);


## Installation

    npm install mapper


## Benchmarks

Time for 100,000 iterations alternating between insert and select. See `test/bench` or run `make bench`.

mapper

    real    0m24.197s   user    0m11.146s   sys     0m3.630s

mysql-libmysqlclient

    real    0m18.165s   user    0m6.613s    sys     0m3.396s

node-mysql

    real    0m34.283s   user    0m19.964s   sys     0m2.541s


## FAQ

Q. How to view the SQL being sent to the server?

A. Pass in `verbose` option when connecting.

    Mapper.connect(conn, {verbose: true});

Q. How to do prepared statements?

A. Unfortunately, this has not been implemented in the driver. For now,
   use pseudo-bindings with `'?'` placeholders to bind locals.

    Mapper.client.find('select title from posts where blurb like ?', ['%foo%'], cb);


Q. What about validations?

A. They belong in your models, preferrably in a shared Javascript file that
   can be used on the client side.

Q. What about migrations?

A. See [mygrate],  an external utility I use for SQL migrations which is not
   tied to any ORM.


## Best Practices

A simple approach, without over-engineering, is to maintain 3 distinct layers in your code:

1. Data Access Objects (DAO) - 1 to 1 mapping to database tables.
2. Models - Aggregate one or more DAO and add business logic.
3. Resources or services - Use models never DAO.


##Contributors

* Mario Gutierrez (mgutz)

