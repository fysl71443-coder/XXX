const { sequelize, Account } = require('./models')

async function run() {
  const t = await sequelize.transaction()
  try {
    console.log('Ensuring payroll accounts exist...')

    // Ensure 2400 exists (Parent)
    let acc2400 = await Account.findOne({ where: { account_code: '2400' }, transaction: t })
    if (!acc2400) {
      console.log('Creating 2400 Accounts Payable...')
      const liabilities = await Account.findOne({ where: { account_code: '0002' }, transaction: t })
      acc2400 = await Account.create({
        account_code: '2400',
        name: 'الذمم الدائنة',
        name_en: 'Accounts Payable',
        type: 'liability',
        parent_id: liabilities?.id || null
      }, { transaction: t })
    }

    // Ensure 2430 Accrued Payroll
    let acc2430 = await Account.findOne({ where: { account_code: '2430' }, transaction: t })
    if (!acc2430) {
      console.log('Creating 2430 Accrued Payroll...')
      await Account.create({
        account_code: '2430',
        name: 'رواتب مستحقة',
        name_en: 'Accrued Payroll',
        type: 'liability',
        parent_id: acc2400.id
      }, { transaction: t })
    } else {
       // Ensure parent is 2400
       if (acc2430.parent_id !== acc2400.id) {
         await acc2430.update({ parent_id: acc2400.id }, { transaction: t })
         console.log('Updated 2430 parent to 2400')
       }
    }

    // Ensure 2431 GOSI Payable
    let acc2431 = await Account.findOne({ where: { account_code: '2431' }, transaction: t })
    if (!acc2431) {
      console.log('Creating 2431 GOSI Payable...')
      await Account.create({
        account_code: '2431',
        name: 'مستحقات التأمينات الاجتماعية',
        name_en: 'GOSI Payable',
        type: 'liability',
        parent_id: acc2400.id
      }, { transaction: t })
    } else {
       if (acc2431.parent_id !== acc2400.id) {
         await acc2431.update({ parent_id: acc2400.id }, { transaction: t })
         console.log('Updated 2431 parent to 2400')
       }
    }

    await t.commit()
    console.log('Payroll accounts checked/created successfully.')
  } catch (e) {
    await t.rollback()
    console.error('Error:', e)
    process.exit(1)
  }
}

run()
