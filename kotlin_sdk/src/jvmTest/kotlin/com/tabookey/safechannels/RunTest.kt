package com.tabookey.safechannels


/**
 * Taken from:
 * https://github.com/SeekDaSky/Sok/blob/master/common/sok-common/src/Sok/Internal/RunTest.kt
 * (MIT license)
 */

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.runBlocking

/*actual*/ fun runTest(block: suspend (scope : CoroutineScope) -> Unit) = runBlocking { block(this) }