const { sequelize, User, Role } = require('./models');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
  try {
    const email = 'admin@example.com';
    const password = 'Admin123!';
    const hash = await bcrypt.hash(password, 10);

    const adminRole = await Role.findOne({ where: { name: 'Admin' } });
    const roleId = adminRole ? adminRole.id : null;

    const user = await User.findOne({ where: { email } });

    if (user) {
      console.log(`User ${email} found. Updating password...`);
      await user.update({
        password_hash: hash,
        status: 'active',
        failed_attempts: 0,
        locked_until: null,
        role_id: roleId || user.role_id
      });
      console.log('Password updated successfully.');
    } else {
      console.log(`User ${email} not found. Creating...`);
      await User.create({
        name: 'Admin',
        email: email,
        password_hash: hash,
        role_id: roleId,
        status: 'active'
      });
      console.log('User created successfully.');
    }
  } catch (error) {
    console.error('Error resetting admin:', error);
  } finally {
    await sequelize.close();
  }
}

resetAdmin();
