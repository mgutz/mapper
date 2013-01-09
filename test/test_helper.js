var assert = global.assert = require('chai').assert,
  config = require('../config.json'),
  Mapper = require('..');

//Mapper.connect(config, {verbose: true, strict: true});
Mapper.connect(config);

module.exports = {
  assert: assert,
  Mapper: Mapper,
  QueryBuilder: require('../lib/queryBuilder')
};

