const { sequelize, Role } = require('./models');

(async () => {
  try {
    await sequelize.authenticate();
    const adminPerms = {
      view: true,
      create: true,
      edit: true,
      delete: true,
      billing: true,
      settings: true,
      'settings:read': true,
      'settings:write': true,
      'settings:backup': true,
      'settings:restore': true,
      'roles:read': true,
      'roles:write': true,
      'users:write': true,
      'payroll:write': true,
      'employees:write': true,
      'expenses:edit': true,
      'expenses:delete': true,
      'expenses:reverse': true
    };

    const [admin] = await Role.findOrCreate({ where: { name: 'Admin' } });
    await admin.update({ permissions: JSON.stringify(adminPerms) });
    console.log('Admin permissions updated:', JSON.stringify(adminPerms, null, 2));

    // Also update Manager if it exists, similar to Admin
    const managerPerms = { ...adminPerms }; // Manager has full access too for now
    const [manager] = await Role.findOrCreate({ where: { name: 'Manager' } });
    await manager.update({ permissions: JSON.stringify(managerPerms) });
    console.log('Manager permissions updated');

    // Update Accountant to have settings:read for branding?
    // Actually, let's give basic read permissions to everyone for branding if possible, 
    // but here we are just updating roles.
    // Let's ensure Viewer/Sales/Accountant have settings:read? 
    // No, settings:read allows reading ALL settings (including smtp, security, etc which might be sensitive).
    // So non-admins should NOT have settings:read.
    // This implies that settings_branding should NOT be behind settings:read if normal users need it.
    
  } catch (e) {
    console.error(e);
  }
})();
