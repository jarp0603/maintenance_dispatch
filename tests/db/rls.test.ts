import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";

// These tests exercise the real local Supabase Postgres instance (via
// `supabase start`), simulating PostgREST's role-switching so RLS policies
// are evaluated exactly as they would be for a live request. Run with
// `npm run test:db` -- requires the local stack to be running.
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let pool: Pool;
let client: PoolClient;

beforeAll(() => {
  pool = new Pool({ connectionString: DATABASE_URL });
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  client = await pool.connect();
  await client.query("begin");
});

afterEach(async () => {
  await client.query("rollback");
  client.release();
});

async function asRole(role: "authenticated" | "service_role" | "anon", userId?: string) {
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify(userId ? { sub: userId, role } : { role }),
  ]);
  await client.query(`set local role ${role}`);
}

async function createUser(email: string): Promise<string> {
  const id = randomUUID();
  await client.query(
    `insert into auth.users
       (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), '{}', '{}')`,
    [id, email],
  );
  return id;
}

describe("profiles auto-provisioning", () => {
  it("creates a profile row automatically when an auth user is created", async () => {
    const id = await createUser("owner-a@example.com");
    const result = await client.query("select email from public.profiles where id = $1", [id]);
    expect(result.rows[0]?.email).toBe("owner-a@example.com");
  });
});

describe("row level security: ownership isolation", () => {
  it("lets an owner read their own property but not another owner's", async () => {
    const ownerA = await createUser("owner-a@example.com");
    const ownerB = await createUser("owner-b@example.com");

    await asRole("authenticated", ownerA);
    await client.query(
      `insert into public.properties (owner_id, name, address_line1) values ($1, 'Maple Apartments', '1 Maple St')`,
      [ownerA],
    );

    await asRole("authenticated", ownerB);
    const asB = await client.query("select * from public.properties");
    expect(asB.rows).toHaveLength(0);

    await asRole("authenticated", ownerA);
    const asA = await client.query("select * from public.properties");
    expect(asA.rows).toHaveLength(1);
  });

  it("rejects inserting a row owned by someone else", async () => {
    const ownerA = await createUser("owner-a@example.com");
    const ownerB = await createUser("owner-b@example.com");

    await asRole("authenticated", ownerB);
    await expect(
      client.query(
        `insert into public.properties (owner_id, name, address_line1) values ($1, 'Spoofed', '1 Fake St')`,
        [ownerA],
      ),
    ).rejects.toThrow();
  });

  it("blocks anon from reading any private table", async () => {
    const ownerA = await createUser("owner-a@example.com");
    await asRole("authenticated", ownerA);
    await client.query(
      `insert into public.properties (owner_id, name, address_line1) values ($1, 'Maple Apartments', '1 Maple St')`,
      [ownerA],
    );

    await asRole("anon");
    await expect(client.query("select * from public.properties")).rejects.toThrow();
  });

  it("denies the authenticated role any access to service-role-only tables", async () => {
    const ownerA = await createUser("owner-a@example.com");
    await asRole("authenticated", ownerA);

    await expect(client.query("select * from public.integration_credentials")).rejects.toThrow();
    await expect(client.query("select * from public.public_action_tokens")).rejects.toThrow();
    await expect(client.query("select * from public.webhook_events")).rejects.toThrow();
  });

  it("lets service_role read across all owners (bypasses RLS; only trusted server code may use it)", async () => {
    const ownerA = await createUser("owner-a@example.com");
    const ownerB = await createUser("owner-b@example.com");

    await asRole("authenticated", ownerA);
    await client.query(
      `insert into public.properties (owner_id, name, address_line1) values ($1, 'A Building', '1 A St')`,
      [ownerA],
    );
    await asRole("authenticated", ownerB);
    await client.query(
      `insert into public.properties (owner_id, name, address_line1) values ($1, 'B Building', '1 B St')`,
      [ownerB],
    );

    await asRole("service_role");
    const result = await client.query("select owner_id from public.properties");
    expect(result.rows).toHaveLength(2);
  });
});

describe("duplicate-protection constraints", () => {
  it("rejects a second email_imports row with the same owner + gmail_message_id", async () => {
    const ownerA = await createUser("owner-a@example.com");
    await asRole("service_role");
    const insert = () =>
      client.query(
        `insert into public.email_imports (owner_id, gmail_message_id) values ($1, 'gmail-msg-1')`,
        [ownerA],
      );
    await insert();
    await expect(insert()).rejects.toThrow();
  });

  it("rejects a second communications row with the same idempotency_key", async () => {
    const ownerA = await createUser("owner-a@example.com");
    await asRole("authenticated", ownerA);
    const workOrder = await client.query(
      `insert into public.work_orders (owner_id, issue_title) values ($1, 'Leaky faucet') returning id`,
      [ownerA],
    );
    const workOrderId: string = workOrder.rows[0].id;

    const insert = () =>
      client.query(
        `insert into public.communications (owner_id, work_order_id, type, recipient_email, subject, rendered_body, idempotency_key)
         values ($1, $2, 'initial_scheduling', 'tenant@example.com', 'Subject', 'Body', 'idem-key-1')`,
        [ownerA, workOrderId],
      );
    await insert();
    await expect(insert()).rejects.toThrow();
  });

  it("rejects a second rating for the same work order", async () => {
    const ownerA = await createUser("owner-a@example.com");
    await asRole("authenticated", ownerA);
    const workOrder = await client.query(
      `insert into public.work_orders (owner_id, issue_title) values ($1, 'Leaky faucet') returning id`,
      [ownerA],
    );
    const workOrderId: string = workOrder.rows[0].id;

    await asRole("service_role");
    const insert = () =>
      client.query(
        `insert into public.ratings (owner_id, work_order_id, rating) values ($1, $2, 5)`,
        [ownerA, workOrderId],
      );
    await insert();
    await expect(insert()).rejects.toThrow();
  });
});

describe("status and priority check constraints", () => {
  it("rejects an invalid status value", async () => {
    const ownerA = await createUser("owner-a@example.com");
    await asRole("authenticated", ownerA);
    await expect(
      client.query(
        `insert into public.work_orders (owner_id, issue_title, status) values ($1, 'Leaky faucet', 'not_a_real_status')`,
        [ownerA],
      ),
    ).rejects.toThrow();
  });

  it("rejects an invalid priority value", async () => {
    const ownerA = await createUser("owner-a@example.com");
    await asRole("authenticated", ownerA);
    await expect(
      client.query(
        `insert into public.work_orders (owner_id, issue_title, priority) values ($1, 'Leaky faucet', 'super-urgent')`,
        [ownerA],
      ),
    ).rejects.toThrow();
  });
});

describe("work order reference number generation", () => {
  it("auto-generates a unique WO-###### reference number", async () => {
    const ownerA = await createUser("owner-a@example.com");
    await asRole("authenticated", ownerA);
    const result = await client.query(
      `insert into public.work_orders (owner_id, issue_title) values ($1, 'Leaky faucet') returning reference_number`,
      [ownerA],
    );
    expect(result.rows[0].reference_number).toMatch(/^WO-\d{6}$/);
  });
});
