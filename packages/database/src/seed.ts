import { openDatabase } from "./client.js";
import { runMigrations } from "./migrations/migrate.js";
import {
  SqliteUserRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
} from "./repositories/index.js";

async function seed() {
  const db = openDatabase();
  runMigrations(db);

  const users = new SqliteUserRepository(db);
  const clients = new SqliteClientRepository(db);
  const packages = new SqlitePackageRepository(db);

  console.log("Seeding 3 packages...");
  const packageNames = ["Bronze", "Silver", "Gold"];
  const existingPackages = await packages.listAll();
  const packagesByName = new Map(existingPackages.map((p) => [p.name, p]));
  const createdPackages = [];
  for (const name of packageNames) {
    const existing = packagesByName.get(name);
    if (existing) {
      createdPackages.push(existing);
      continue;
    }
    const pkg = await packages.create({
      name,
      description: `${name} plan`,
      metricThresholds: {},
    });
    createdPackages.push(pkg);
  }

  console.log("Seeding 1 super admin...");
  if (!(await users.findByEmail("superadmin@example.com"))) {
    await users.create({
      role: "super_admin",
      fullName: "Super Admin",
      email: "superadmin@example.com",
      clientId: null,
    });
  }

  console.log("Seeding 3 admins...");
  for (let i = 1; i <= 3; i++) {
    const email = `admin${i}@example.com`;
    if (!(await users.findByEmail(email))) {
      await users.create({
        role: "admin",
        fullName: `Admin ${i}`,
        email,
        clientId: null,
      });
    }
  }

  console.log("Seeding 10 clients...");
  const existingClients = (await clients.list({ limit: 100 })).items;
  const clientsByName = new Map(existingClients.map((c) => [c.name, c]));
  const createdClients = [];
  for (let i = 1; i <= 10; i++) {
    const name = `Client ${i}`;
    const existing = clientsByName.get(name);
    if (existing) {
      createdClients.push(existing);
      continue;
    }
    const pkg = createdPackages[(i - 1) % createdPackages.length];
    const client = await clients.create({
      name,
      businessType: "General",
      contactEmail: `client${i}@example.com`,
      packageId: pkg.id,
      isActive: true,
    });
    createdClients.push(client);
  }

  console.log("Seeding 1 client-role user...");
  if (!(await users.findByEmail("client1user@example.com"))) {
    await users.create({
      role: "client",
      fullName: "Client 1 User",
      email: "client1user@example.com",
      clientId: createdClients[0].id,
    });
  }

  console.log("Seed complete.");
  db.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
