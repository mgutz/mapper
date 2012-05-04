# Mapper

Fast MySQL ORM on top of the awesome `mysql-libmysqlclient` driver.

The goal is to have a blazing fast ORM like [dapper-dot-net](http://code.google.com/p/dapper-dot-net/)
for node. Mapper is faster than JAVA ORMs like JDBI (dropwizard). Much faster than any SQL-based ORM
for node. No bloat.

Based off original code by [didit-tech](https://github.com/didit-tech/FastLegS).


## Installation

    npm install mapper


## Benchmarks

Time for 100,000 iterations alternating between insert and select. See `test/bench` or run `make bench`.

mapper

    real    0m24.197s   user    0m11.146s   sys     0m3.630s

node-mysqllibclient

    real    0m18.165s   user    0m6.613s    sys     0m3.396s

node-mysql

    real    0m34.283s   user    0m19.964s   sys     0m2.541s


## Best Practices

A simple practice without over-engineering is to main 3 distinct layers in your code:

1) Data Access Objects (DAO) - 1 to 1 mapping to database tables.
2) Models - Aggregate one or more DAO and add business logic.
3) Resources or services - Use models never DAO.


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


##Contributors

* Mario Gutierrez (mgutz)


### Original FastLegS

Many thanks to the original project

* Thad Clay (thadclay)
* Jim Drannbauer (excellentdrums)
* Rob Malko (malkomalko)
