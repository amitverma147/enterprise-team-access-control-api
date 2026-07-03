import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Automated coverage for Phase 7 (Resource Authorization / defense-in-depth).
 * This exercises the full stack (real Postgres + Redis, per .env) rather
 * than mocking the permission engine, because the whole point of this phase
 * is to prove the *layers* actually compose correctly: JwtAuthGuard ->
 * PermissionsGuard -> service-level ownership rules.
 *
 * Requires `docker compose up -d` and a migrated + seeded database before
 * running (`npm run prisma:migrate && npm run prisma:seed`).
 */
describe('Tenant isolation & resource authorization (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  interface AuthResponseBody {
    accessToken: string;
  }
  interface OrganizationResponseBody {
    id: string;
  }
  interface MembershipResponseBody {
    id: string;
    roles: { roleId: string }[];
  }

  async function registerAndLogin(email: string) {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email,
      password: 'SuperSecret123!',
    });
    return (res.body as AuthResponseBody).accessToken;
  }

  it('blocks a non-member from reading another organization (403)', async () => {
    const ownerToken = await registerAndLogin(uniqueEmail('owner'));
    const outsiderToken = await registerAndLogin(uniqueEmail('outsider'));

    const orgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Isolated Co' });
    const organizationId = (orgRes.body as OrganizationResponseBody).id;

    await request(app.getHttpServer())
      .get(`/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('rejects requests with no access token at all (401)', async () => {
    const ownerToken = await registerAndLogin(uniqueEmail('owner'));
    const orgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'No Token Co' });
    const organizationId = (orgRes.body as OrganizationResponseBody).id;

    await request(app.getHttpServer())
      .get(`/organizations/${organizationId}`)
      .expect(401);
  });

  it('lets a MEMBER read but not manage roles, and blocks org deletion (403)', async () => {
    const ownerToken = await registerAndLogin(uniqueEmail('owner'));
    const memberEmail = uniqueEmail('member');
    const memberToken = await registerAndLogin(memberEmail);

    const orgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'RBAC Co' });
    const organizationId = (orgRes.body as OrganizationResponseBody).id;

    await request(app.getHttpServer())
      .post(`/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: memberEmail })
      .expect(201);

    // MEMBER role includes members:read
    await request(app.getHttpServer())
      .get(`/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    // MEMBER role does NOT include roles:manage
    await request(app.getHttpServer())
      .post(`/organizations/${organizationId}/roles`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Should Fail', permissionKeys: ['org:read'] })
      .expect(403);

    // MEMBER role does NOT include org:delete (OWNER-only)
    await request(app.getHttpServer())
      .delete(`/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('protects the organization owner from being suspended or removed', async () => {
    const ownerToken = await registerAndLogin(uniqueEmail('owner'));

    const orgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Protected Owner Co' });
    const organizationId = (orgRes.body as OrganizationResponseBody).id;

    const membersRes = await request(app.getHttpServer())
      .get(`/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const ownerMembershipId = (membersRes.body as MembershipResponseBody[])[0]
      .id;

    await request(app.getHttpServer())
      .patch(`/organizations/${organizationId}/members/${ownerMembershipId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'SUSPENDED' })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/organizations/${organizationId}/members/${ownerMembershipId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  });

  it("protects the organization owner's OWNER role from being unassigned", async () => {
    const ownerToken = await registerAndLogin(uniqueEmail('owner'));

    const orgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Protected Role Co' });
    const organizationId = (orgRes.body as OrganizationResponseBody).id;

    const membersRes = await request(app.getHttpServer())
      .get(`/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const ownerMembership = (membersRes.body as MembershipResponseBody[])[0];
    const ownerMembershipId = ownerMembership.id;
    const ownerRoleId = ownerMembership.roles[0].roleId;

    await request(app.getHttpServer())
      .delete(
        `/organizations/${organizationId}/members/${ownerMembershipId}/roles/${ownerRoleId}`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  });
});
