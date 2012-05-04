/**
 * Module dependencies.
 */

var helper = require("../test_helper"),
  assert = helper.assert,
  mapper = helper.Mapper,
  X = new Date;


exports['should get a scalar value'] = function(done) {
  mapper.client.execScalar('select count(*) from information_schema.columns', function(err, count) {
    assert.ifError(err);
    assert.ok(parseInt(count) >= 0);
    done();
  });
};

exports['should get a scalar value parameterized'] = function(done) {
  mapper.client.execScalar('select count(*) from information_schema.columns where table_name =  ?', ['posts'], function(err, count) {
    assert.ifError(err);
    assert.ok(parseInt(count) >= 0);
    done();
  });
}

exports['should execute without result'] = function(done) {
  var unique = X++;

  mapper.client.exec('create table T'+unique+'(id int)', function(err) {
    assert.ifError(err);

    mapper.client.execScalar('select count(*) from T'+unique, function(err, count) {
      assert.equal(count, 0);
      done();
    });
  });
};

exports['should find rows'] = function(done) {
  mapper.client.find('select * from information_schema.columns', function(err, rows) {
    assert.ok(rows.length > 0);
    done();
  });
};

exports['should find single row'] = function(done) {
  mapper.client.findOne('select * from information_schema.columns limit ?', [1], function(err, rows) {
    assert.ok(rows.TABLE_NAME.length > 0);
    done();
  });
};
