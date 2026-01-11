const { User, Role } = require('./backend/models');

async function check() {
  try {
    const users = await User.findAll({ include: [{ model: Role, as: 'role' }] });
    console.log('--- Users ---');
    users.forEach(u => {
      console.log(`ID: ${u.id}, Email: ${u.email}, Role: ${u.role?.name}, Permissions: ${u.role?.permissions}`);
    });

    const roles = await Role.findAll();
    console.log('\n--- Roles ---');
    roles.forEach(r => {
      console.log(`ID: ${r.id}, Name: ${r.name}, Permissions: ${r.permissions}`);
    });

  } catch (e) {
    console.error(e);
  }
}

check();
