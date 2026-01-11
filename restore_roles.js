const { sequelize, User, Role } = require('./backend/models');

async function restoreRoles() {
  try {
    await sequelize.authenticate();
    
    const adminRole = await Role.findOne({ where: { name: 'Admin' } });
    const accRole = await Role.findOne({ where: { name: 'Accountant' } });
    const mgrRole = await Role.findOne({ where: { name: 'Manager' } });
    const viewerRole = await Role.findOne({ where: { name: 'Viewer' } });

    const map = {
      'fysl71443@gmail.com': adminRole,
      'admin@example.com': adminRole,
      'admin2@example.com': adminRole,
      'acc1@example.com': accRole,
      'manager_test@example.com': mgrRole,
      'new@example.com': viewerRole
    };

    for (const [email, role] of Object.entries(map)) {
      if (!role) continue;
      const u = await User.findOne({ where: { email } });
      if (u) {
        await u.update({ role_id: role.id });
        console.log(`Restored ${email} -> ${role.name}`);
      }
    }

  } catch (e) {
    console.error(e);
  }
}

restoreRoles();
