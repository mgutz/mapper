# Mapper

Fast MySQL ORM on top of the awesome `mysql-libmysqlclient` driver.

The goal is to have a speedy ORM for node like that used by StackOverflow, [dapper-dot-net](http://code.google.com/p/dapper-dot-net/) .
My internal benchmarks show Mapper is faster than JAVA ORMs like JDBI (dropwizard) and faster than other SQL-based ORMs
for node. No bloat.

Based off original code by [didit-tech](https://github.com/didit-tech/FastLegS).


## Quickstart

    var Mapper = require('mapper');
    var conn = { user: 'dont' , password: 'blink' , database: 'now' };
    Mapper.connect(conn);

    // table name only
    var PostDao = Mapper.Base.extend({
      tableName: 'posts'
    });

    PostDao.create({ title: 'Some Title 1', body: 'Some body 1' }, function(err, results) {
      PostDao.find({ 'title.like': '%title%' }, { only: ['id', 'body'] }, function(err, post) {
        // Hooray!
      });
    });


    See [Getting Things Done]() for more examples.


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


Q. How do I execute SQL?

A. `Mapper.client#execScalar`, `Mapper.client#exec`, `Mapper.client#find`, `Mapper.client#findOne`

    Mapper.client.execScalar('select count(*) from posts', function(err, count) {
        // count is an integer
    });


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
