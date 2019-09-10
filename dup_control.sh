#!/bin/bash -e

rootdir=`dirname ${BASH_SOURCE}`
cd "${rootdir}"

dir1="java_foundation/src/main/kotlin/com/tabookey/duplicated"
dir2="kotlin_sdk/src/commonMain/kotlin/com.tabookey.duplicated"
for file in "${dir1}"/*; do
    echo "Checking file $file..."
    [[ $(diff "${file}" "${dir2}/${file##*/}") ]] && echo "Alex, You should duplicate ${file} better" && exit 123
done
exit 0
