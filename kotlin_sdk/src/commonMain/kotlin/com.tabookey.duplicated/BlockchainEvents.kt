package com.tabookey.duplicated

open class EventResponse

data class ConfigPendingEventResponse(
        val transactionHash: ByteArray,
        val sender: String,
        val senderPermsLevel: String,
        val booster: String,
        val boosterPermsLevel: String,
        val stateId: String,
        val actions: MutableList<String>,
        val actionsArguments: MutableList<ByteArray>
) : EventResponse()

data class ConfigCancelledEventResponse(
        val transactionHash: ByteArray,
        val sender: String
) : EventResponse()

data class ParticipantAddedEventResponse(
        val participant: ByteArray
) : EventResponse()

data class ParticipantRemovedEventResponse(
        val participant: ByteArray
) : EventResponse()

data class OwnerChangedEventResponse(
        val newOwner: String
) : EventResponse()

data class GatekeeperInitializedEventResponse(
        val vault: String,
        val participants: MutableList<ByteArray>
) : EventResponse()

data class LevelFrozenEventResponse(
        val frozenLevel: String,
        val frozenUntil: String,
        val sender: String
) : EventResponse()

class UnfreezeCompletedEventResponse : EventResponse()
data class WTFEventResponse(
        val encodedPacked: ByteArray
) : EventResponse()