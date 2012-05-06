# Mapper

Fast MySQL ORM on top of the awesome `mysql-libmysqlclient` driver.

The goal is to have a speedy ORM for node like that used by StackOverflow, [dapper-dot-net](http://code.google.com/p/dapper-dot-net/) .
My internal benchmarks show Mapper is faster than JAVA ORMs like JDBI (dropwizard) and faster than other SQL-based ORMs
for node.

Why another ORM. Current node.js ORMs try to add business logic with statics,
virtual attributes, validations, etc. They're bloated. And with so much
packed into those ORMs, it is difficult to share code like validations between client
and server.

work-in-progress! Moving away from FastLegS syntax to a cleaner, fluent
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
      .select('id, title, excerpt')
      .page(0, 25)
      .orderBy('createdAt DESC')
      .populate('comments', function(c) {
        c.select('comment', 'createdAt')
         .orderBy('createdAt DESC')
         .page(1, 50);
      })
      .one(function(err, row) {
        assert.equal(row.comments.length, 2);
        done();
      });




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


### Original FastLegS

Many thanks to the original project

* Thad Clay (thadclay)
* Jim Drannbauer (excellentdrums)
* Rob Malko (malkomalko)
