#!/bin/bash -xe
#update yarn links it subfolders:
root=`cd dirname $0;pwd`

PKG=$root/sample/package.json

cd $root/solidity && yarn && ( yarn unlink || echo ) && yarn link

#remove current dependency on safechannels-contract... we add it as link in a minute..
perl -pi.tmp -e 's/.*safechannels-contracts.*//' $PKG

cd $root/sample && yarn link safechannels-contracts && yarn

mv $PKG.tmp $PKG

# cd $root
# node solidity/extract_abi.js

