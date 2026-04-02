export function buildUserPairKey(
  firstUserId: string,
  secondUserId: string,
): string {
  return [firstUserId, secondUserId].sort().join(':');
}
