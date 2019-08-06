#!/bin/bash -e

#PWD=`pwd`

./js_foundation/extract_abi.js

OUT=$PWD/js_foundation/src/js/generated

#folder to generate classes in
GEN=$PWD/java_foundation/src/main/java

for binfile in $OUT/*.bin; do

abifile=`echo $binfile|sed -e 's/[.]bin/.json/'`

echo -n "$binfile: "

../web3j_tabookey/build/tools/web3j-4.3.2-SNAPSHOT/bin/web3j solidity generate -b $binfile -a $abifile -p com.tabookey.foundation.generated -o $GEN

echo $PIPESTATUS|grep -q 0

done