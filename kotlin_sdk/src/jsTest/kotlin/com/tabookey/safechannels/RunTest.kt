package com.tabookey.safechannels

/**
 * Taken from:
 * https://github.com/SeekDaSky/Sok/blob/master/js/sok-js/src/Sok/Internal/RunTest.kt
 * (MIT license)
 */

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.promise

/*actual*/ fun runTest(block: suspend (scope : CoroutineScope) -> Unit): dynamic = GlobalScope.promise { block(this) }