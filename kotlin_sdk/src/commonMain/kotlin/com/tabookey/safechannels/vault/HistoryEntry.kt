package com.tabookey.safechannels.vault

import com.tabookey.safechannels.blockchain.BlockchainTransaction

class HistoryEntry(
        val scheduleTransaction: BlockchainTransaction,
        val executeTransaction: BlockchainTransaction
)