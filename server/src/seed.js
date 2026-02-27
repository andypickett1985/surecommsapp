const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  try {
    // Create default tenant
    const tenantResult = await db.query(
      "INSERT INTO tenants (name, domain) VALUES ('SureCloudComms', 'surecloudcomms.com') ON CONFLICT DO NOTHING RETURNING id"
    );
    let tenantId;
    if (tenantResult.rows.length > 0) {
      tenantId = tenantResult.rows[0].id;
    } else {
      const existing = await db.query("SELECT id FROM tenants WHERE name = 'SureCloudComms'");
      tenantId = existing.rows[0].id;
    }

    // Create superadmin
    const hash = await bcrypt.hash('Admin123!', 12);
    await db.query(
      `INSERT INTO admins (tenant_id, email, password_hash, name, role)
       VALUES ($1, 'admin@surecloudcomms.com', $2, 'System Admin', 'superadmin')
       ON CONFLICT (email) DO NOTHING`,
      [tenantId, hash]
    );

    console.log('Seed complete!');
    console.log('Admin login: admin@surecloudcomms.com / Admin123!');
    console.log('Tenant ID:', tenantId);
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
