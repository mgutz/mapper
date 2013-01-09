var async = require("async")
  , config = require("../../config.json");


function testMysql(cb) {
  var mysql = require('mysql')
    //, client = mysql.createClient(config);
    , client = mysql.createConnection(config);


  var iteration = 0;
  async.whilst(
    function() { return iteration < 100000; },

    function (cb) {
      iteration++;
      if (iteration % 2 === 0) {
        client.query("insert into Users(userName, firstName, lastName) values('mysql', 'is', 'slow');", function(err, result) {
          //if (iteration === 2) console.log(result);
          cb(err);
        });
      } else {
        client.query("select userName, firstName, lastName from Users limit 50;", function(err, rows, fields) {
          //if (iteration === 3) console.log(rows);
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

