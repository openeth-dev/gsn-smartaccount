let permissions = {
    CanSpend: 1 << 0,
    CanUnfreeze: 1 << 1,
    CanChangeParticipants: 1 << 2,
    CanChangeBypass: 1 << 3,
    CanSignBoosts: 1 << 4,
    CanExecuteBoosts: 1 << 5,
    CanFreeze: 1 << 6,
    CanCancelConfigChanges: 1 << 7,
    CanCancelSpend: 1 << 8,
    CanApprove: 1 << 9,
    CanAddOperator: 1 << 10,
    canExecuteBypassCall: 1 << 11,
    canCancelBypassCall: 1 << 12,
    CanSetAcceleratedCalls: 1 << 13,
    CanSetAddOperatorNow: 1 << 14,
    CanAddOperatorNow: 1 << 15,
};

Object.assign(permissions, {
    CanChangeConfig: permissions.CanUnfreeze | permissions.CanChangeParticipants | permissions.CanAddOperator | permissions.CanAddOperatorNow |
        permissions.CanChangeBypass | permissions.CanSetAcceleratedCalls | permissions.CanSetAddOperatorNow/* | permissions.CanChangeOwner*/ /* | canChangeDelays */,
    CanCancel: permissions.CanCancelSpend | permissions.CanCancelConfigChanges,

    OwnerPermissions: permissions.CanSpend | permissions.CanCancel | permissions.CanFreeze | permissions.CanChangeConfig
        | permissions.CanSignBoosts | permissions.CanAddOperator | permissions.CanChangeBypass,
    AdminPermissions: /*permissions.CanChangeOwner |*/ permissions.CanExecuteBoosts | permissions.CanAddOperator,
    WatchdogPermissions: permissions.CanCancel | permissions.CanFreeze | permissions.CanApprove,
});

module.exports = Object.freeze(permissions);