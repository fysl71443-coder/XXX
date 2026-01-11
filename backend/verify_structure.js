const { Account } = require('./models')

async function run() {
  const accounts = await Account.findAll({ 
    where: { account_code: ['2000', '2100', '2110', '2120', '2130', '2400', '2430', '2431'] },
    order: [['account_code', 'ASC']]
  })
  
  console.log('--- Account Verification ---')
  for (const acc of accounts) {
    const parent = acc.parent_id ? await Account.findByPk(acc.parent_id) : null
    console.log(`${acc.account_code} ${acc.name} (Parent: ${parent ? parent.account_code : 'None'})`)
  }
}

run()
