let friendlyNames = {};
export function setFriendlyNames(names) { friendlyNames = names; }
export function getFriendlyNames() { return friendlyNames; }
export function getFriendlyName(key) { return friendlyNames[key] || key; }
