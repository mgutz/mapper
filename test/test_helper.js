var assert = global.assert = require('chai').assert,
  config = require('../.mapper.json'),
  Mapper = require('..');

Mapper.connect(config, {verbose: true});

module.exports = {
  assert: assert,
  Mapper: Mapper,
  QueryBuilder: require('../lib/queryBuilder')
};

