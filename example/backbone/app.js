var express = require("express");
var path = require("path");
var app = express();
var PORT = 3000;
var fs = require("fs");
var async = require("async");

var Mapper = require("../.."); // require("mapper") outside of this project

// Table is created in test/bootstrap/init
var Todo;

function configMapper(cb) {
  // Configuration is created by `make test`
  var configJson = path.join(__dirname, '../../.mapper.json');
  if (!fs.existsSync(configJson)) {
    return cb('Run `make test` to create config file and database.');
  }
  var config = require(configJson);
  Mapper.connect(config, {verbose: true});

  Todo = Mapper.map("todos");
  cb();
}

function configExpress(cb) {
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, "public")));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  cb();
}

function configRoutes(cb) {
  app.get('/', function(req, res){
    res.redirect('/todos.html');
  });

  app.get('/api/todos', function(req, res, next){
    Todo.all(function(err, todos) {
      if (err) return next(err);
      res.json(todos);
    });
  });

  app.get('/api/todos/:id', function(req, res, next){
    Todo.findById(req.params.id, function(err, todo) {
      if (err) return next(err);
      res.json(todo);
    });
  });

  app.put('/api/todos/:id', function(req, res, next){
    var todo = {
      id: req.params.id,
      text: req.body.text,
      done: req.body.done,
      order: req.body.order
    };

    Todo.save(todo, function(err) {
      if (err) return next(err);
      res.json(todo);
    });
  });

  app.post('/api/todos', function(req, res, next){
    var todo = {
      text: req.body.text,
      done: req.body.done,
      order: req.body.order
    };

    Todo.create(todo, function(err, row) {
      if (err) return next(err);
      todo.id = row.insertId; // NOTE: set inserted id for Backbonek
      res.json(todo);
    });
  });

  app.delete('/api/todos/:id', function(req, res, next) {
    Todo.deleteById(req.params.id, function(err) {
      if (err) return next(err);
      res.send('');
    });
  });

  cb();
}


async.series([configMapper, configExpress, configRoutes], function(err) {
  if (err) {
    console.error(err);
    process.exit();
  }
  app.listen(PORT);
  console.log("Express started. Browse http://127.0.0.1:" + PORT);
});


