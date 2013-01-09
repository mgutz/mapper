var async = require("async")
  , config = require("../../config.json")
  , Mapper = require("../..")
  , verbose = false
  ;

Mapper.connect(config);

var UserDao = Mapper.map("Users");


function testMapper(cb) {
  var iteration = 0;
  var insertId;
  async.whilst(
    function() { return iteration < 100000; },

    function (cb) {
      iteration++;
      if (iteration % 2 === 0) {
        UserDao
          .insert({userName: "mapper", firstName: "is", lastName: "fast"})
          .exec(function(err, result) {
            if (verbose && iteration === 2)  console.log(result);
            insertId = result.insertId;
            cb(err);
          });
      } else {
        UserDao
          .select('userName', 'firstName', 'lastName')
          .limit(50)
          .all(function(err, found) {
            if (verbose && iteration === 3)  console.log(found);
            cb(err);
          });
      }
    },

    cb
  );
}

testMapper(function(err) {
  if (err) console.error(err);
  process.exit();
});
