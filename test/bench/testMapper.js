var async = require("async")
  , config = require("../../.mapper.json")
  , Mapper = require("../..");

Mapper.connect(config);

var UserDao = Mapper.Base.extend({
  tableName: "users"
});


function testMapper(cb) {
  var iteration = 0;
  async.whilst(
    function() { return iteration < 100000; },

    function (cb) {
      iteration++;
      if (iteration % 2 === 0) {
        UserDao.create({userName: "mapper", firstName: "is", lastName: "fast"}, function(err, result) {
          //if (iteration === 2)  console.log(result);
          cb(err);
        });
      } else {
        UserDao.find({}, {limit: 10}, function(err, found) {
          //if (iteration === 3)  console.log(found);
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

testMapper(function(err) {
  process.exit();
});
