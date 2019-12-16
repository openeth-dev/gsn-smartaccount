export const ChangeType = {
  ADD_PARTICIPANT: 0,
  REMOVE_PARTICIPANT: 1,
  ADD_BYPASS_BY_TARGET: 2,
  ADD_BYPASS_BY_METHOD: 3,
  SET_ACCELERATED_CALLS: 4,
  SET_ADD_OPERATOR_NOW: 5,
  UNFREEZE: 6,
  ADD_OPERATOR: 7,
  ADD_OPERATOR_NOW: 8
}

export function changeTypeToString (val) {
  switch (parseInt(val)) {
    case ChangeType.ADD_PARTICIPANT:
      return 'add_participant'
    case ChangeType.REMOVE_PARTICIPANT:
      return 'remove_participant'
    case ChangeType.ADD_BYPASS_BY_TARGET:
      return 'add_bypass_by_target'
    case ChangeType.ADD_BYPASS_BY_METHOD:
      return 'add_bypass_by_method'
    case ChangeType.SET_ACCELERATED_CALLS:
      return 'set_accelerated_calls'
    case ChangeType.SET_ADD_OPERATOR_NOW:
      return 'set_add_operator_now'
    case ChangeType.UNFREEZE:
      return 'unfreeze'
    case ChangeType.ADD_OPERATOR:
      return 'add_operator'
    case ChangeType.ADD_OPERATOR_NOW:
      return 'add_operator_now'
    default:
      throw Error(`Unknown change type: ${val}`)
  }
}
