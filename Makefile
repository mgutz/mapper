SHELL := /bin/bash

test: setup test-mapper

setup:
	@[ -e ".mapper.json" ] || node test/bootstrap/init.js

test-unit:
	@mocha -u exports -R spec test/unit/statements_test.js

test-integration:
	@mocha -u exports -R spec test/integration/*test.js

test-mapper:
	@mocha -R spec test/unit/queryBuilderTest.js
	@mocha -R spec test/integration/clientTest.js
	@mocha -R spec test/integration/integrationTest.js


bench: setup
	time node test/bench/testMysql.js
	time node test/bench/testMapperDao.js
	time node test/bench/testLibMysql.js

bench-mongo:
	time node test/bench/testMongo.js
