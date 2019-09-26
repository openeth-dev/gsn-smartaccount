package com.tabookey.safechannels.vault

import com.soywiz.klock.DateTime
import com.tabookey.duplicated.ConfigPendingEventResponse
import com.tabookey.safechannels.blockchain.BlockchainTransaction

class PendingChange(
        val transaction: BlockchainTransaction,
        val event: ConfigPendingEventResponse,
        val dueTime: String
) {
    val isDue: Boolean
        get() = dueTime.toLong() > DateTime.now().unixMillisLong
}