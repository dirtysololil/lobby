export function buildUserProfileHref(username: string) {
  return `/app/people/${encodeURIComponent(username)}`;
}
