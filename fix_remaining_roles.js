const { sequelize, User, Role } = require('./backend/models');

async function fixAllRoles() {
  try {
    await sequelize.authenticate();
    
    const adminRole = await Role.findOne({ where: { name: 'Admin' } });
    const viewerRole = await Role.findOne({ where: { name: 'Viewer' } });

    if (!adminRole || !viewerRole) {
      console.error('Roles not found');
      return;
    }

    // Fix admin2 -> Admin
    const admin2 = await User.findOne({ where: { email: 'admin2@example.com' } });
    if (admin2) {
      await admin2.update({ role_id: adminRole.id });
      console.log('Fixed admin2@example.com -> Admin');
    }

    // Fix others -> Viewer
    const others = await User.findAll({ where: { role_id: null } });
    for (const u of others) {
      await u.update({ role_id: viewerRole.id });
      console.log(`Fixed ${u.email} -> Viewer`);
    }

  } catch (e) {
    console.error(e);
  }
}

fixAllRoles();
