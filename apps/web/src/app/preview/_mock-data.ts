import type { AdminUserListResponse, PublicUser } from "@lobby/shared";

function makeUser(args: {
  id: string;
  username: string;
  displayName: string;
  role?: PublicUser["role"];
  presence?: PublicUser["profile"]["presence"];
  isOnline?: boolean;
  lastSeenAt?: string | null;
  bio?: string | null;
}): PublicUser {
  const now = new Date().toISOString();

  return {
    id: args.id,
    username: args.username,
    email: `${args.username}@lobby.local`,
    role: args.role ?? "MEMBER",
    isOnline: args.isOnline ?? (args.presence ?? "ONLINE") !== "OFFLINE",
    lastSeenAt: args.lastSeenAt ?? null,
    createdAt: now,
    profile: {
      displayName: args.displayName,
      bio: args.bio ?? null,
      presence: args.presence ?? "ONLINE",
      avatarPreset: "NONE",
      avatar: {
        fileKey: null,
        originalName: null,
        mimeType: null,
        bytes: null,
        width: null,
        height: null,
        frameCount: null,
        animationDurationMs: null,
        isAnimated: false,
      },
      callRingtonePreset: "CLASSIC",
      callRingtoneMode: "BUILTIN",
      customRingtone: {
        fileKey: null,
        originalName: null,
        mimeType: null,
        bytes: null,
      },
      updatedAt: now,
    },
  };
}

export const previewViewer = makeUser({
  id: "cmqpreviewviewer0001abcde1234",
  username: "holty",
  displayName: "Artem Holty",
  role: "ADMIN",
  presence: "ONLINE",
  bio: "Designing calm, fast communication tools.",
});

export const previewContacts = [
  makeUser({
    id: "cmqpreviewuser0002abcde1234",
    username: "mira",
    displayName: "Mira Vale",
    presence: "ONLINE",
    bio: "Writes fast and sends sharper feedback.",
  }),
  makeUser({
    id: "cmqpreviewuser0003abcde1234",
    username: "leo",
    displayName: "Leo Hart",
    presence: "IDLE",
  }),
  makeUser({
    id: "cmqpreviewuser0004abcde1234",
    username: "nina",
    displayName: "Nina Ash",
    presence: "DND",
  }),
  makeUser({
    id: "cmqpreviewuser0005abcde1234",
    username: "omar",
    displayName: "Omar Reed",
    presence: "OFFLINE",
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  }),
];

export const previewMira = previewContacts[0]!;
export const previewLeo = previewContacts[1]!;
export const previewNina = previewContacts[2]!;
export const previewOmar = previewContacts[3]!;

export const previewAdminUsers: AdminUserListResponse = {
  total: 4,
  page: 1,
  pageSize: 20,
  items: [
    {
      user: previewViewer,
      activeSessionCount: 3,
      hubMembershipCount: 7,
      lastSeenAt: new Date().toISOString(),
      platformBlock: null,
    },
    {
      user: previewMira,
      activeSessionCount: 2,
      hubMembershipCount: 3,
      lastSeenAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      platformBlock: null,
    },
    {
      user: previewLeo,
      activeSessionCount: 1,
      hubMembershipCount: 5,
      lastSeenAt: new Date(Date.now() - 1000 * 60 * 21).toISOString(),
      platformBlock: null,
    },
    {
      user: previewOmar,
      activeSessionCount: 0,
      hubMembershipCount: 1,
      lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
      platformBlock: {
        id: "cmqpreviewblock0001abcde1234",
        reason: "Spam bursts across invite flows.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        blockedBy: previewViewer,
      },
    },
  ],
};

export const previewHub = {
  id: "cmqpreviewhub0001abcde1234",
  name: "North Studio",
  membershipRole: "OWNER",
  description:
    "Private product hub for message design, moderation and launch coordination.",
  lobbies: [
    {
      id: "l1",
      name: "arrival",
      type: "TEXT",
      isPrivate: false,
      description: "Announcements and brief updates.",
    },
    {
      id: "l2",
      name: "product-room",
      type: "TEXT",
      isPrivate: false,
      description: "Daily product conversation.",
    },
    {
      id: "l3",
      name: "voice-sprint",
      type: "VOICE",
      isPrivate: false,
      description: "Quick live syncs.",
    },
    {
      id: "l4",
      name: "briefs",
      type: "FORUM",
      isPrivate: true,
      description: "Long-form decision threads.",
    },
  ],
  members: [
    { id: "m1", user: previewViewer, role: "OWNER", canManage: false },
    { id: "m2", user: previewMira, role: "ADMIN", canManage: true },
    { id: "m3", user: previewLeo, role: "MEMBER", canManage: true },
    { id: "m4", user: previewNina, role: "MODERATOR", canManage: true },
  ],
  pendingInvites: [{ id: "i1", invitee: previewOmar }],
};
