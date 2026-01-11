const { sequelize, Account } = require('./models');

async function check() {
  try {
    const codes = ['1010', '1110', '2430'];
    const accounts = await Account.findAll({
      where: {
        account_code: codes
      }
    });
    console.log('Found accounts:', accounts.map(a => `${a.account_code}: ${a.name} (${a.type})`));
    
    // Also check all bank accounts
    const banks = await Account.findAll();
    console.log('All accounts types:', banks.map(a => `${a.account_code}: ${a.type}`).filter(s => s.toLowerCase().includes('bank')));
    
  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

check();
