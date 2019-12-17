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
  const string = Object.keys(ChangeType)
    .sort((a, b) => ChangeType[a] - (ChangeType[b]))
    .map(it => it.toLowerCase())[val]
  if (!string) {
    throw Error(`Unknown change type: ${val}`)
  }
  return string
}
