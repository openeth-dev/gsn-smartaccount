#!/bin/bash -e

rootdir=`dirname ${BASH_SOURCE}`
cd "${rootdir}"

dir1="java_foundation/src/main/kotlin/com/tabookey/duplicated"
dir2="kotlin_sdk/src/commonMain/kotlin/com.tabookey.duplicated"
[[ $(diff -qr "${dir1}" "${dir2}" 2>&1) ]] && echo "Alex, You should duplicate better" && diff -qr "${dir1}" "${dir2}" && exit 123
exit 0
