async function test() {
  try {
    // Bootstrap Admin
    console.log('Bootstrapping admin...');
    await fetch('http://localhost:4000/api/debug/bootstrap-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'admin', name: 'Admin' })
    });

    // Login as admin
    console.log('Logging in...');
    const loginRes = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin'
      })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
        console.error('Login Failed:', loginData);
        return;
    }
    const token = loginData.token;
    
    // Get Payroll Runs
    const runsRes = await fetch('http://localhost:4000/api/payroll/runs', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const runsData = await runsRes.json();
    
    console.log('Payroll Runs:', JSON.stringify(runsData, null, 2));
    
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
