const { sequelize, Role } = require('./models');
(async () => {
  try {
    await sequelize.authenticate();
    const r = await Role.findOne({ where: { name: 'Admin' } });
    console.log('Admin perms:', r ? r.permissions : 'Role not found');
  } catch(e) { console.error(e); }
})();
