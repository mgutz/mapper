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


## Quickstart


Conect to Database

    var Mapper = require('mapper');
    var conn = { user: 'dont' , password: 'blink' , database: 'now' };
    Mapper.connect(conn);

Define Data Access Objects

    // table name and optional primary key
    var Comment = Mapper.map("Comments")
      , Post = Mapper.map("Posts", "id");

Define Relationships

    Post.hasMany("comments", Comment, "postId");
    Comment.belongsTo("post", Post, "postId");

Use it. Get the first page of posts and populate comments property with
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

    Post
      .sql("SELECT id, title, excerpt FROM `Posts` ORDER BY id DESC LIMIT 0, 25")
      .all(function(err, posts) {
        Post.load('comments').in(posts, function(err) {
          // boo-yah!
        });
      });

Find post 14

    Post.id(14).one(function(err, post) {  });

Find last 10 posts

    Post.select().order('id desc').limit(10).all(function(err, posts) { });

Find Authors

    Post.where('author IN (?)', ['foo', 'bar']).all(function(err, posts) { });
    Post.where({'author IN': ['foo', 'bar']}).all(function(err, posts) { });

Update a Post

    Post.set({author: 'bah'}).where({author: 'foo'}).exec(function(err, result) { });


## Installation

    npm install mapper


## Benchmarks

Time for 100,000 iterations alternating between insert and select. See `test/bench` or run `make bench`.

mysql-libmysqlclient

    real	0m29.871s
    user	0m9.702s
    sys	        0m3.907s

mapper

    real	0m35.187s
    user	0m12.919s
    sys	        0m3.889s

node-mysql

    real	1m5.828s
    user	0m35.650s
    sys	        0m3.072s


## FAQ

Q. How to view the SQL being sent to the server?

A. Pass in `verbose` option when connecting.

    Mapper.connect(conn, {verbose: true});


Q. How to do prepared statements?

A. Unfortunately, this has not been implemented in the driver. For now,
   use pseudo-bindings with `'?'` placeholders to bind locals.

    Post.where('blurb like ?', ['%foo%'], cb);


Q. What about validations?

A. I put validations in a separate module to be shared with client code.


Q. What about migrations?

A. See [mygrate](https://github.com/mgutz/mygrate), an external migration
utility for MySQL and PostgreSQL ot tied to an ORM.



## Best Practices

A simple approach, without over-engineering your project, is to maintain
3 distinct layers in your code:

1. Data Access Objects (DAO) - 1 to 1 mapping to database tables (Mapper).
2. Models - Aggregate one or more DAO and add business logic, validations.
3. Resources or Services - This layer should only user models never DAO.

On larger, more complex projects, a Repository later between 1 and 2 is
recommended to insulate models completely from low-level data access.


##Contributors

* Mario Gutierrez (mgutz)

