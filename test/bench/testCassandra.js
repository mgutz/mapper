var async = require("async")
  , config = require("../../.mapper.json");


function testLibMysql(cb) {
  var Connection = require('cassandra-client').Connection,
    connection = new Connection({
        host: '127.0.0.1',
        port: 9160,
        keyspace: "gf_test01",
        use_bigints: true
    });

    connection.connect(function(err) {
      if (err) return cb(err);

      console.log(connection);

      var iteration = 0;
      async.whilst(
        function() { return iteration < 100000; },

        function (cb) {
          iteration++;
          if (iteration % 2 === 0) {
            connection.execute("insert into users(id, userName, firstName, lastName) values("+iteration+", 'libmysql', 'is', 'fast')", [], function(err, result) {
              //if (iteration === 2) console.log(result);
              cb(err);
            });
          } else {
            connection.execute("select userName, firstName, lastName from users limit 50", [], function(err, rows) {
              if (iteration === 3) console.log(rows);
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
}


testLibMysql(function(err) {
  process.exit();
});
