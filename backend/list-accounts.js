const { sequelize, Account } = require('./models');

async function listAccounts() {
  try {
    const accounts = await Account.findAll();
    accounts.forEach(a => {
      console.log(`${a.id} | ${a.account_code} | ${a.name} | ${a.name_en} | ${a.type}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

listAccounts();
