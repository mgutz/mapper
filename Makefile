SHELL := /bin/bash

test: setup test-unit test-integration

setup:
	@[ -e ".mapper.json" ] || node test/bootstrap/init.js

test-unit:
	@mocha -u exports -R spec test/unit/statements_test.js

test-integration:
	@mocha -u exports -R spec test/integration/*test.js

test-refactor: setup
	@mocha -R spec test/unit/queryBuilderTest.js
	@mocha -R spec test/integration/clientTest.js
	@mocha -R spec test/integration/integrationTest.js

bench: setup
	time node test/bench/testMapper.js
	time node test/bench/testMysql.js
	time node test/bench/testLibMysql.js
