var async = require("async")
  , config = require("../../.mapper.json")
  , Mapper = require("../..");

Mapper.connect(config);

var UserDao = Mapper.map("users");


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
            //if (iteration === 2)  console.log(result);
            insertId = result.insertId;
            cb(err);
          });
      } else {
        UserDao.select('userName', 'firstName', 'lastName').limit(25).all(cb);
          // .all(function(err, found) {
          //   if (iteration === 3)  console.log(found);
          //   cb(err);
          // });
      }
    },

    function(err) {
      if (err) console.error(err);
      cb(err);
    }
  );
}

testMapper(function(err) {
  process.exit();
});
