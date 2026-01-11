const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { sequelize, User, Role, Employee } = require('./models');
const payrollRouter = require('./routes/payroll');
const { requireAuth } = require('./middleware/auth');

const app = express();
app.use(express.json());
app.use('/payroll', requireAuth, payrollRouter);

async function run() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    // Find or create an admin user
    let adminRole = await Role.findOne({ where: { name: 'Admin' } });
    if (!adminRole) {
      adminRole = await Role.create({ name: 'Admin', permissions: '{}' });
    }

    let user = await User.findOne({ where: { email: 'admin@example.com' } });
    if (!user) {
      user = await User.create({
        name: 'Admin',
        email: 'admin@example.com',
        password_hash: 'hash',
        role_id: adminRole.id,
        is_super_admin: true
      });
    }

    // Ensure at least one employee exists
    let emp = await Employee.findOne();
    if (!emp) {
        emp = await Employee.create({
            first_name: 'Test',
            last_name: 'Employee',
            employee_number: 'EMP001',
            basic_salary: 5000,
            status: 'active'
        });
    }

    // Sign token
    const token = jwt.sign({
      id: user.id,
      email: user.email,
      role: 'Admin',
      isSuperAdmin: true,
      permissions: ['*']
    }, 'dev_jwt_secret');

    console.log('Testing create payroll run...');
    const period = '2025-07';
    
    // First, try to cleanup if exists
    try {
        const { PayrollRun } = require('./models');
        await PayrollRun.destroy({ where: { period } });
    } catch {}

    const res = await request(app)
      .post('/payroll/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ period });

    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.body, null, 2));

  } catch (e) {
    console.error(e);
  }
}

run();
