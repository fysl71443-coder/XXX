const { sequelize, User, Role } = require('./models');
const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const PORT = 4000; // Assuming backend runs on 4000

function generateToken(user) {
  const roleName = user.role ? user.role.name : 'Viewer';
  return jwt.sign({ id: user.id, email: user.email, role: roleName }, JWT_SECRET, { expiresIn: '1h' });
}

function makeRequest(path, method, token, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', (e) => reject(e));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  try {
    console.log('--- 1. Fixing Roles in Database ---');
    await sequelize.authenticate();
    
    // Get Roles
    const adminRole = await Role.findOne({ where: { name: 'Admin' } });
    const accRole = await Role.findOne({ where: { name: 'Accountant' } });
    const mgrRole = await Role.findOne({ where: { name: 'Manager' } });
    
    if (!adminRole || !accRole || !mgrRole) {
      console.error('Roles missing! Run server to init roles.');
      return;
    }

    // Fix Users
    const adminUser = await User.findOne({ where: { email: 'fysl71443@gmail.com' } });
    if (adminUser) await adminUser.update({ role_id: adminRole.id });
    
    const admin2 = await User.findOne({ where: { email: 'admin@example.com' } });
    if (admin2) await admin2.update({ role_id: adminRole.id });

    const accUser = await User.findOne({ where: { email: 'acc1@example.com' } });
    if (accUser) await accUser.update({ role_id: accRole.id });

    // Create a temporary Manager user if not exists
    const [mgrUser] = await User.findOrCreate({
      where: { email: 'manager_test@example.com' },
      defaults: {
        name: 'Test Manager',
        email: 'manager_test@example.com',
        password_hash: 'hash',
        role_id: mgrRole.id
      }
    });
    if (mgrUser.role_id !== mgrRole.id) await mgrUser.update({ role_id: mgrRole.id });

    console.log('Roles updated.');

    console.log('\n--- 2. Testing Permissions ---');

    // Reload users with roles
    const uAdmin = await User.findByPk(adminUser.id, { include: [{ model: Role, as: 'role' }] });
    const uAcc = await User.findByPk(accUser.id, { include: [{ model: Role, as: 'role' }] });
    const uMgr = await User.findByPk(mgrUser.id, { include: [{ model: Role, as: 'role' }] });

    // Generate Tokens
    const tAdmin = generateToken(uAdmin);
    const tAcc = generateToken(uAcc);
    const tMgr = generateToken(uMgr);

    console.log('Tokens generated.');

    // Test 1: Admin accessing Payroll (Should Succeed)
    console.log('\n[Test 1] Admin accessing /api/payroll/run (Expected: 200 or 400)');
    const r1 = await makeRequest('/api/payroll/run', 'POST', tAdmin, { period: '2025-01' });
    console.log(`Status: ${r1.statusCode}`);
    console.log(`Response: ${r1.body.substring(0, 100)}...`);
    if (r1.statusCode === 403) console.error('FAIL: Admin was Forbidden!');
    else console.log('PASS: Admin allowed.');

    // Test 2: Accountant accessing Payroll (Expected: 403)
    console.log('\n[Test 2] Accountant accessing /api/payroll/run (Expected: 403)');
    const r2 = await makeRequest('/api/payroll/run', 'POST', tAcc, { period: '2025-01' });
    console.log(`Status: ${r2.statusCode}`);
    console.log(`Response: ${r2.body.substring(0, 200)}...`);
    if (r2.statusCode === 403) console.log('PASS: Accountant Forbidden correctly.');
    else console.error('FAIL: Accountant was allowed!');

    // Test 3: Manager accessing Payroll (Expected: 200 or 400)
    console.log('\n[Test 3] Manager accessing /api/payroll/run (Expected: 200 or 400)');
    const r3 = await makeRequest('/api/payroll/run', 'POST', tMgr, { period: '2025-01' });
    console.log(`Status: ${r3.statusCode}`);
    console.log(`Response: ${r3.body.substring(0, 100)}...`);
    if (r3.statusCode === 403) console.error('FAIL: Manager was Forbidden!');
    else console.log('PASS: Manager allowed.');

    // Test 4: Check /api/auth/me for Admin
    console.log('\n[Test 4] Admin checking /api/auth/me');
    const r4 = await makeRequest('/api/auth/me', 'GET', tAdmin);
    console.log(`Status: ${r4.statusCode}`);
    console.log(`Response: ${r4.body}`);

  } catch (e) {
    console.error('Test Failed with Error:', e);
  }
}

runTest();
