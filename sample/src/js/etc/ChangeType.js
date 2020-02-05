export const ChangeType = {
  ADD_PARTICIPANT: 0,
  REMOVE_PARTICIPANT: 1,
  ADD_BYPASS_BY_TARGET: 2,
  ADD_BYPASS_BY_METHOD: 3,
  SET_ACCELERATED_CALLS: 4,
  UNFREEZE: 5,
  ADD_OPERATOR: 6,
  ADD_OPERATOR_NOW: 7
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
