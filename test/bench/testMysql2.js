var mysql = require('mysql');
var config = {
  "user":"root",
  "password":"root",
  "database":"mapper_test",
  "host":"localhost",
  "debug": true
};

var connection = mysql.createConnection(config);
connection.query("select userName, firstName, lastName from users", function(err, rows, fields) {
  console.error(err.stack);
  console.error(err);
  console.log(rows);
});
