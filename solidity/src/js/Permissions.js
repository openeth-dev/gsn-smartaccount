let permissions = {
    CanSpend: 1 << 0,
    CanUnfreeze: 1 << 1,
    CanChangeParticipants: 1 << 2,
    CanChangeOwner: 1 << 3,
    CanSignBoosts: 1 << 4,
    CanExecuteBoosts: 1 << 5,
    CanFreeze: 1 << 6,
    CanCancelConfigChanges: 1 << 7,
    CanCancelSpend: 1 << 8
};

Object.assign(permissions, {
    CanChangeConfig: permissions.CanUnfreeze | permissions.CanChangeParticipants | permissions.CanChangeOwner /* | canChangeDelays */,
    CanCancel: permissions.CanCancelSpend | permissions.CanCancelConfigChanges,

    OwnerPermissions: permissions.CanSpend | permissions.CanCancel | permissions.CanFreeze | permissions.CanChangeConfig | permissions.CanSignBoosts,
    AdminPermissions: permissions.CanChangeOwner | permissions.CanExecuteBoosts,
    WatchdogPermissions: permissions.CanCancel | permissions.CanFreeze,
});

module.exports = Object.freeze(permissions);