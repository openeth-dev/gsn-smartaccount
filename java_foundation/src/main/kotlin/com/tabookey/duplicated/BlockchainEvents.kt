package com.tabookey.duplicated

data class ConfigPendingEventResponse(
        val transactionHash: ByteArray,
        val sender: String,
        val senderPermsLevel: String,
        val booster: String,
        val boosterPermsLevel: String,
        val stateId: String,
        val actions: MutableList<String>,
        val actionsArguments: MutableList<ByteArray>
)

data class ConfigCancelledEventResponse(
        val transactionHash: ByteArray,
        val sender: String
)

data class ParticipantAddedEventResponse(
        val participant: ByteArray
)

data class ParticipantRemovedEventResponse(
        val participant: ByteArray
)

data class OwnerChangedEventResponse(
        val newOwner: String
)

data class GatekeeperInitializedEventResponse(
        val vault: String,
        val participants: MutableList<ByteArray>
)

data class LevelFrozenEventResponse(
        val frozenLevel: String,
        val frozenUntil: String,
        val sender: String
)

class UnfreezeCompletedEventResponse
data class WTFEventResponse(
        val encodedPacked: ByteArray
)