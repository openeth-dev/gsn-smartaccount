#!/bin/bash -e
#run coverage files if changed.
#usage:
#	- circle-ci should restore from cache "coverage/covsig.txt"
#	- this script will recalculate file sig, and run its command-line if it changed.
#	- after successful test coverage run, save the file.
#	- circle-ci should cache the resulting covsig.txt file

report=coverage/report.txt
tests="test/test_gatekeeper.js  test/test_sponsor_gsn.js  test/test_vault_bootstrapping.js  test/test_vault_factory.js  test/test_whitelist_policy.js test/application_tests/test_app.js"
sigfile=coverage/covsig.txt

covfiles="$tests contracts/*.sol"
newsig=`md5sum $covfiles|md5sum`
oldsig=`cat $sigfile 2>/dev/null || echo`

if [ ! -r $report -o "$oldsig" != "$newsig" ]; then

	yarn run coverage 
	mkdir -p `dirname $sigfile`
	echo "$newsig" > $sigfile

else
	echo Last coverage report:
	cat $report
fi

