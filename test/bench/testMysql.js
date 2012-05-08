var async = require("async")
  , config = require("../../.mapper.json");


function testMysql(cb) {
  var mysql = require('mysql')
    , client = mysql.createClient(config);

  var iteration = 0;
  async.whilst(
    function() { return iteration < 500000; },

    function (cb) {
      iteration++;
      if (iteration % 2 === 0) {
        client.query("insert into users(userName, firstName, lastName) values('mysql', 'is', 'slow')", function(err, result) {
          //if (iteration === 2) console.log(result);
          cb(err);
        });
      } else {
        client.query("select * from users limit 10;", function(err, result) {
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
}


testMysql(function(err) {
  process.exit();
});

