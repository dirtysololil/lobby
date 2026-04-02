import { parseSeedEnv } from "@lobby/config";
import { PrismaClient, PresenceStatus, UserRole } from "@prisma/client";
import * as argon2 from "argon2";
import { hashOpaqueToken } from "../apps/api/src/common/utils/opaque-token.util";

async function hashPassword(password: string, env: ReturnType<typeof parseSeedEnv>): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: env.ARGON2_MEMORY_COST,
    timeCost: env.ARGON2_TIME_COST,
    parallelism: env.ARGON2_PARALLELISM,
  });
}

async function main(): Promise<void> {
  const env = parseSeedEnv(process.env);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

  try {
    const ownerPasswordHash = await hashPassword(env.SEED_OWNER_PASSWORD, env);
    const adminPasswordHash = await hashPassword(env.SEED_ADMIN_PASSWORD, env);

    const owner = await prisma.user.upsert({
      where: {
        email: env.SEED_OWNER_EMAIL,
      },
      create: {
        email: env.SEED_OWNER_EMAIL,
        username: env.SEED_OWNER_USERNAME,
        passwordHash: ownerPasswordHash,
        role: UserRole.OWNER,
        profile: {
          create: {
            displayName: env.SEED_OWNER_DISPLAY_NAME,
            presence: PresenceStatus.OFFLINE,
          },
        },
      },
      update: {
        username: env.SEED_OWNER_USERNAME,
        passwordHash: ownerPasswordHash,
        role: UserRole.OWNER,
        profile: {
          upsert: {
            create: {
              displayName: env.SEED_OWNER_DISPLAY_NAME,
              presence: PresenceStatus.OFFLINE,
            },
            update: {
              displayName: env.SEED_OWNER_DISPLAY_NAME,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    const admin = await prisma.user.upsert({
      where: {
        email: env.SEED_ADMIN_EMAIL,
      },
      create: {
        email: env.SEED_ADMIN_EMAIL,
        username: env.SEED_ADMIN_USERNAME,
        passwordHash: adminPasswordHash,
        role: UserRole.ADMIN,
        profile: {
          create: {
            displayName: env.SEED_ADMIN_DISPLAY_NAME,
            presence: PresenceStatus.OFFLINE,
          },
        },
      },
      update: {
        username: env.SEED_ADMIN_USERNAME,
        passwordHash: adminPasswordHash,
        role: UserRole.ADMIN,
        profile: {
          upsert: {
            create: {
              displayName: env.SEED_ADMIN_DISPLAY_NAME,
              presence: PresenceStatus.OFFLINE,
            },
            update: {
              displayName: env.SEED_ADMIN_DISPLAY_NAME,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    const invites = [
      {
        rawCode: env.SEED_OWNER_INVITE_KEY,
        label: "Seed owner invite",
        role: UserRole.OWNER,
        maxUses: 1,
        createdByUserId: owner.id,
      },
      {
        rawCode: env.SEED_ADMIN_INVITE_KEY,
        label: "Seed admin invite",
        role: UserRole.ADMIN,
        maxUses: 2,
        createdByUserId: owner.id,
      },
      {
        rawCode: env.SEED_MEMBER_INVITE_KEY,
        label: "Seed member invite",
        role: UserRole.MEMBER,
        maxUses: 10,
        createdByUserId: admin.id,
      },
    ];

    for (const invite of invites) {
      await prisma.inviteKey.upsert({
        where: {
          codeHash: hashOpaqueToken(invite.rawCode, env.SESSION_SECRET, "invite"),
        },
        create: {
          codeHash: hashOpaqueToken(invite.rawCode, env.SESSION_SECRET, "invite"),
          label: invite.label,
          role: invite.role,
          maxUses: invite.maxUses,
          createdByUserId: invite.createdByUserId,
        },
        update: {
          label: invite.label,
          role: invite.role,
          maxUses: invite.maxUses,
          createdByUserId: invite.createdByUserId,
          revokedAt: null,
        },
      });
    }

    console.log("Seed complete");
    console.log(`owner_email=${env.SEED_OWNER_EMAIL}`);
    console.log(`admin_email=${env.SEED_ADMIN_EMAIL}`);
    console.log(`owner_invite=${env.SEED_OWNER_INVITE_KEY}`);
    console.log(`admin_invite=${env.SEED_ADMIN_INVITE_KEY}`);
    console.log(`member_invite=${env.SEED_MEMBER_INVITE_KEY}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
