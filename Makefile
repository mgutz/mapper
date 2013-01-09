SHELL := /bin/bash

test: setup test-mapper

setup:
	@[ -e "config.json" ] || node test/bootstrap/init.js

test-unit:
	@mocha -u exports -R spec test/unit/statements_test.js

test-integration:
	@mocha -u exports -R spec test/integration/*test.js

test-mapper:
	# TODO queryBuilder works and is used by other tests, but the
	# tests need to be updated to escape field names in expected strings
	# @mocha --bail -R spec test/unit/queryBuilderTest.js
	@mocha --bail -R spec test/integration/clientTest.js
	@mocha --bail -R spec test/integration/integrationTest.js


bench: setup
	time node test/bench/testMysql.js
	time node test/bench/testMapperDao.js
	time node test/bench/testLibMysql.js

bench-mongo:
	time node test/bench/testMongo.js


remove-config:
	rm -f config.json

force-test: remove-config test
