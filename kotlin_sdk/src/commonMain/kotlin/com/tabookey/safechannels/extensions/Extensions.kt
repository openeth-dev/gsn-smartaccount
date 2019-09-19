package com.tabookey.safechannels.extensions

import kotlin.experimental.and

private val HEX_CHARS = "0123456789ABCDEF"

fun String.hexStringToByteArray(): ByteArray {

    val result = ByteArray(length / 2)

    for (i in 0 until length step 2) {
        val firstIndex = HEX_CHARS.indexOf(this[i]);
        val secondIndex = HEX_CHARS.indexOf(this[i + 1]);

        val octet = firstIndex.shl(4).or(secondIndex)
        result.set(i.shr(1), octet.toByte())
    }

    return result
}

/**
 * TODO: replace once 'toCharArray' is moved from experimental with:
 * private val hexArray = "0123456789ABCDEF".toCharArray()
 */
private val hexArray = CharArray(16) {
    return@CharArray if (it < 10) {
        (48 + it).toChar()
    } else {
        // it = 10; A=65;
        (55 + it).toChar()
    }
}

fun ByteArray.toHexString(): String {
    val hexChars = CharArray(this.size * 2)
    for (j in this.indices) {
        val v = (this[j] and 0xFF.toByte()).toInt()
        hexChars[j * 2] = hexArray[v ushr 4]
        hexChars[j * 2 + 1] = hexArray[v and 0x0F]
    }
    return String(hexChars)
}