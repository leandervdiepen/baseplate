import { ManageUsers, type ListUsersQuery } from "#application";
import { MemoryUserAdmin } from "#infrastructure";
import { expect, test } from "vitest";

/** Remembers what it was asked for, which is where the page rules show up. */
class AskedUserAdmin extends MemoryUserAdmin {
  asked: ListUsersQuery | undefined;

  override async listUsers(query: ListUsersQuery) {
    this.asked = query;
    return super.listUsers(query);
  }
}

async function withOne(): Promise<{ users: MemoryUserAdmin; id: string }> {
  const users = new MemoryUserAdmin();
  const made = await users.createUser("ada@example.com", "correct-horse", true);
  return { users, id: made.id };
}

test("removing someone who is not there is an error, not a quiet success", async () => {
  const users = new MemoryUserAdmin();

  await expect(new ManageUsers({ users }).remove("11111111-1111-4111-8111-111111111111")).rejects.toMatchObject(
    { code: "users.not_found" },
  );
});

test("removing someone who is there takes their row and says nothing", async () => {
  const { users, id } = await withOne();

  await expect(new ManageUsers({ users }).remove(id)).resolves.toBeUndefined();
  expect(users.rows).toEqual([]);
});

test("a page nobody sized is fifty", async () => {
  const users = new AskedUserAdmin();

  await new ManageUsers({ users }).list();

  expect(users.asked).toEqual({ limit: 50, offset: 0 });
});

/** A stray `?limit=1000000` does not get to ask for every user there is. */
test("a page bigger than the cap is cut down to it", async () => {
  const users = new AskedUserAdmin();

  await new ManageUsers({ users }).list({ limit: 1_000_000, offset: 20 });

  expect(users.asked).toEqual({ limit: 200, offset: 20 });
});

test.for([
  ["not a number", Number.NaN],
  ["a fraction", 1.5],
  ["nothing at all", 0],
])("a limit that is %s falls back to the page size", async ([, limit]) => {
  const users = new AskedUserAdmin();

  await new ManageUsers({ users }).list({ limit: limit as number });

  expect(users.asked?.limit).toBe(50);
});

test("an offset that is not a whole number starts at the beginning", async () => {
  const users = new AskedUserAdmin();

  await new ManageUsers({ users }).list({ offset: Number.NaN });

  expect(users.asked?.offset).toBe(0);
});

test("a search is passed on, and an empty one is not a filter", async () => {
  const users = new AskedUserAdmin();
  const useCase = new ManageUsers({ users });

  await useCase.list({ search: "ada" });
  expect(users.asked?.search).toBe("ada");

  await useCase.list({ search: "" });
  expect(users.asked).not.toHaveProperty("search");
});

/** Someone the operator made by hand has nobody to click a confirmation mail. */
test("an account the operator makes can be signed in to straight away", async () => {
  const users = new MemoryUserAdmin();

  const made = await new ManageUsers({ users }).create("ada@example.com", "correct-horse");

  expect(made.emailConfirmedAt).toBeTypeOf("string");
});

test("an account can still be made unconfirmed when the operator asks for that", async () => {
  const users = new MemoryUserAdmin();

  const made = await new ManageUsers({ users }).create("ada@example.com", "correct-horse", false);

  expect(made.emailConfirmedAt).toBeUndefined();
});

test("a recovery link points at the site it was given", async () => {
  const { users, id } = await withOne();

  const { link } = await new ManageUsers({ users }).recoveryLink(id, "https://app.example.test");

  expect(link).toMatch(/^https:\/\/app\.example\.test\/reset-password\?token=/);
});
