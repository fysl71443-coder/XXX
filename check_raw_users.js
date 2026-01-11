const { sequelize } = require('./backend/models');

async function checkUserRoles() {
  try {
    await sequelize.authenticate();
    const [results] = await sequelize.query("SELECT id, email, role_id FROM Users");
    console.log('--- Users Table Raw Data ---');
    console.table(results);
    
    const [roles] = await sequelize.query("SELECT id, name FROM Roles");
    console.log('--- Roles Table Raw Data ---');
    console.table(roles);

  } catch (e) {
    console.error(e);
  }
}

checkUserRoles();
