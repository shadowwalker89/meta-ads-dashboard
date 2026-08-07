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
  const createdPackages = [];
  for (const name of packageNames) {
    const pkg = await packages.create({
      name,
      description: `${name} plan`,
      metricThresholds: {},
    });
    createdPackages.push(pkg);
  }

  console.log("Seeding 1 super admin...");
  await users.create({
    role: "super_admin",
    fullName: "Super Admin",
    email: "superadmin@example.com",
  });

  console.log("Seeding 3 admins...");
  for (let i = 1; i <= 3; i++) {
    await users.create({
      role: "admin",
      fullName: `Admin ${i}`,
      email: `admin${i}@example.com`,
    });
  }

  console.log("Seeding 10 clients...");
  for (let i = 1; i <= 10; i++) {
    const pkg = createdPackages[(i - 1) % createdPackages.length];
    await clients.create({
      name: `Client ${i}`,
      businessType: "General",
      contactEmail: `client${i}@example.com`,
      packageId: pkg.id,
      isActive: true,
    });
  }

  console.log("Seed complete.");
  db.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
