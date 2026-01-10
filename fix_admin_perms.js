const { sequelize, Role } = require('./models');
const fs = require('fs');

(async () => {
  try {
    await sequelize.authenticate();
    const [adminRole] = await Role.findOrCreate({ where: { name: 'Admin' }, defaults: { name: 'Admin', permissions: '{}' } });
    
    const allPerms = { view:true, create:true, edit:true, delete:true, billing:true, settings:true, 'payroll:write':true, 'users:write':true, 'employees:write':true };
    
    // Force update
    await adminRole.update({ permissions: JSON.stringify(allPerms) });
    
    const r = await Role.findOne({ where: { name: 'Admin' } });
    fs.writeFileSync('debug_output.txt', `Admin Perms: ${r.permissions}\n`);
    console.log('Done');
  } catch(e) {
    fs.writeFileSync('debug_output.txt', `Error: ${e.message}\n`);
    console.error(e);
  }
})();
