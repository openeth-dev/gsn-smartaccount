package com.tabookey.duplicated

abstract class EventResponse(val transactionHash: String)

open class ConfigPendingEventResponse(
        transactionHash: String,
        val configChangeHash: ByteArray,
        val sender: String,
        val senderPermsLevel: String,
        val booster: String,
        val boosterPermsLevel: String,
        val stateId: String,
        val actions: List<String>,
        val actionsArguments: List<ByteArray>
) : EventResponse(transactionHash)

open class ConfigCancelledEventResponse(
        transactionHash: String,
        val configChangeHash: ByteArray,
        val sender: String
) : EventResponse(transactionHash)

open class ConfigAppliedEventResponse(
        transactionHash: String,
        val configChangeHash: ByteArray,
        val sender: String
) : EventResponse(transactionHash)

open class ParticipantAddedEventResponse(
        transactionHash: String,
        val participant: ByteArray
) : EventResponse(transactionHash)

open class ParticipantRemovedEventResponse(
        transactionHash: String,
        val participant: ByteArray
) : EventResponse(transactionHash)

open class OwnerChangedEventResponse(
        transactionHash: String,
        val newOwner: String
) : EventResponse(transactionHash)

open class GatekeeperInitializedEventResponse(
        transactionHash: String,
        val vault: String,
        val participants: List<ByteArray>
) : EventResponse(transactionHash)

open class LevelFrozenEventResponse(
        transactionHash: String,
        val frozenLevel: String,
        val frozenUntil: String,
        val sender: String
) : EventResponse(transactionHash)

open class UnfreezeCompletedEventResponse(transactionHash: String) : EventResponse(transactionHash)
open class VaultCreatedEventResponse(
        transactionHash: String,
        val gatekeeper: EthereumAddress,
        val vault: EthereumAddress
) : EventResponse(transactionHash)

open class WTFEventResponse(
        transactionHash: String,
        val encodedPacked: ByteArray
) : EventResponse(transactionHash)