/** TODO: this should be organized differently. ? Can we avoid hard-coding this to the JS code ? **/

const canSpend = 1 << 0;
const canUnfreeze = 1 << 3;
const canChangeParticipants = 1 << 4;
const canChangeOwner = 1 << 10;
const canSignBoosts = 1 << 8;
const canExecuteBoosts = 1 << 9;
const canFreeze = 1 << 2;
const canCancelConfigChanges = 1 << 5;
const canCancelSpend = 1 << 1;


const canChangeConfig = canUnfreeze | canChangeParticipants | canChangeOwner /* | canChangeDelays */;
const canCancel = canCancelSpend | canCancelConfigChanges;

const ownerPermissions = canSpend | canCancel | canFreeze | canChangeConfig | canSignBoosts;
const adminPermissions = canChangeOwner | canExecuteBoosts;
const watchdogPermissions = canCancel | canFreeze;

class PermissionsModel {

    static getAdminPermissions() {
        return adminPermissions;
    }

    static getOwnerPermissions() {
        return ownerPermissions;
    }

    static getWatchdogPermissions() {
        return watchdogPermissions;
    }
}

module.exports = PermissionsModel;