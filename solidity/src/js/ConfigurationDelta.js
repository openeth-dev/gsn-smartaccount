class ConfigurationDelta {
  constructor (participantsToAdd, participantsToRemove, newOwner, unfreeze) {
    this.participantsToAdd = participantsToAdd
    this.participantsToRemove = participantsToRemove
    this.newOwner = newOwner
    this.unfreeze = unfreeze
  }
}

module.exports = ConfigurationDelta
