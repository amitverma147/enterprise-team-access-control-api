/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Seeds the platform-wide (organizationId = null) "system" roles and the
 * full permission catalog. This runs once per environment (dev, staging,
 * prod) — organizations never need to redefine what "ADMIN" means, they just
 * assign the built-in role to a membership.
 *
 * Run with: npm run prisma:seed
 *
 * WHY IT MATTERS (Phase 4 & 5)
 * ----------------------------------------------------------------------------
 * A permission engine is only as good as its catalog. Keeping the catalog in
 * one seed file (rather than scattered magic strings) means every guard,
 * decorator, and role assignment references the same source of truth.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * The full permission catalog, grouped by resource.
 * Naming convention: "<resource>:<action>"
 */
const PERMISSIONS = [
  // Organization management
  { key: 'org:read', description: 'View organization details' },
  { key: 'org:update', description: 'Update organization settings' },
  { key: 'org:delete', description: 'Soft-delete the organization' },

  // Membership management
  { key: 'members:read', description: 'View organization members' },
  { key: 'members:invite', description: 'Invite new members' },
  {
    key: 'members:remove',
    description: 'Remove members from the organization',
  },
  { key: 'members:suspend', description: 'Suspend a member' },

  // Role management
  { key: 'roles:read', description: 'View roles and their permissions' },
  {
    key: 'roles:manage',
    description: 'Create, update, or delete custom roles',
  },
  { key: 'roles:assign', description: 'Assign roles to a member' },

  // Invitations
  { key: 'invitations:read', description: 'View pending invitations' },
  { key: 'invitations:revoke', description: 'Revoke a pending invitation' },

  // Sessions
  { key: 'sessions:read', description: "View a user's active sessions" },
  { key: 'sessions:revoke', description: "Revoke a user's session" },

  // Audit logs
  { key: 'audit:read', description: 'View audit log history' },

  // API keys
  { key: 'apikeys:read', description: 'View API keys' },
  { key: 'apikeys:manage', description: 'Create or revoke API keys' },
] as const;

/**
 * Built-in system roles and the permission keys each one grants.
 * `organizationId: null` marks these as global/system roles.
 */
const SYSTEM_ROLES: Record<string, readonly string[]> = {
  OWNER: PERMISSIONS.map((p) => p.key), // owners get every permission
  ADMIN: [
    'org:read',
    'org:update',
    'members:read',
    'members:invite',
    'members:remove',
    'members:suspend',
    'roles:read',
    'roles:manage',
    'roles:assign',
    'invitations:read',
    'invitations:revoke',
    'sessions:read',
    'sessions:revoke',
    'audit:read',
    'apikeys:read',
    'apikeys:manage',
  ],
  MEMBER: ['org:read', 'members:read', 'roles:read'],
};

async function main() {
  console.log('Seeding permission catalog...');
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  console.log('Seeding system roles...');
  for (const [roleName, permissionKeys] of Object.entries(SYSTEM_ROLES)) {
    // NOTE: Postgres treats each NULL as distinct in a unique index, so a
    // compound unique constraint on (organizationId, name) cannot prevent
    // duplicate system roles when organizationId is null. We look the role
    // up manually instead of relying on `upsert` here.
    let role = await prisma.role.findFirst({
      where: { organizationId: null, name: roleName },
    });
    if (!role) {
      role = await prisma.role.create({
        data: { name: roleName, isSystem: true, organizationId: null },
      });
    }

    const permissions = await prisma.permission.findMany({
      where: { key: { in: [...permissionKeys] } },
    });

    // Reset then re-attach so re-running the seed keeps roles in sync with
    // the SYSTEM_ROLES map above.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });

    console.log(`  - ${roleName}: ${permissions.length} permissions`);
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
