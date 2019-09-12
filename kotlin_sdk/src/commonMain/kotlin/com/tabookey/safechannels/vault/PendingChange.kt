package com.tabookey.safechannels.vault

import com.tabookey.duplicated.ConfigPendingEventResponse
import com.tabookey.safechannels.blockchain.BlockchainTransaction

class PendingChange(
        val transaction: BlockchainTransaction,
        val event: ConfigPendingEventResponse,
        val dueTime: String
)