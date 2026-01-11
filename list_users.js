const { sequelize, User, Role } = require('./backend/models');

async function listUsers() {
  try {
    await sequelize.authenticate();
    const users = await User.findAll({ 
      include: [{ model: Role, as: 'role' }],
      attributes: ['id', 'email', 'password_hash']
    });
    
    console.log('--- Users ---');
    users.forEach(u => {
      console.log(`Email: ${u.email}, Role: ${u.role?.name}, ID: ${u.id}`);
    });

    const roles = await Role.findAll();
    console.log('\n--- Roles & Permissions ---');
    roles.forEach(r => {
      console.log(`Role: ${r.name}`);
      console.log(`Permissions: ${r.permissions}`);
    });

  } catch (e) {
    console.error(e);
  }
}

listUsers();
