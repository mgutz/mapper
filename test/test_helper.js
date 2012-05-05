var assert = global.assert = require('chai').assert,
  config = require('../.mapper.json'),
  Mapper = require('..');

Mapper.connect(config);

module.exports = {
  assert: assert,
  Mapper: Mapper,
  QueryBuilder: require('../lib/queryBuilder')
};

