var async = require("async");
var mongodb = require("mongodb");
var Db = mongodb.Db;
var Connection = mongodb.Connection;
var Server = mongodb.Server;


function testLibMysql(cb) {
  var db = new Db('test', new Server('localhost',  27017));
  db.open(function(err) {
    if (err) return cb(err);
    db.collection('users', function(err, collection) {

      var iteration = 0;
      async.whilst(
        function() { return iteration < 100000; },

        function (cb) {
          iteration++;
          if (iteration % 2 === 0) {
            collection.insert({
              id: iteration,
              userName: 'mongo',
              firstName: 'is',
              lastName: 'fast'
            }, function(err, result) {
              //if (iteration === 2) console.log(result);
              cb(err);
            })
          } else {
            var cursor = collection.find({}, ['userName', 'firstName', 'lastName']);
            cursor.limit(50);
            cursor.toArray(function(err, result) {
              //if (iteration === 3) console.log(result);
              cb(err);
            });
          }
        },

        function(err) {
          if (err) console.error(err);
          cb(err);
        }
      );
    });
  });
}


testLibMysql(function(err) {
  process.exit();
});
