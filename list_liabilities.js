const { Account } = require('./backend/models');

async function listLiabilities() {
  try {
    const liabilities = await Account.findAll({
      where: { type: 'liability' },
      attributes: ['id', 'account_code', 'name', 'name_en']
    });
    console.log(JSON.stringify(liabilities, null, 2));
  } catch (error) {
    console.error(error);
  }
}

listLiabilities();
