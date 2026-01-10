const { sequelize, Account } = require('./models')

async function run() {
  const t = await sequelize.transaction()
  try {
    console.log('Ensuring VAT accounts (2130, 2140)...')

    const vatParent = await Account.findOne({ where: { account_code: '2100' }, transaction: t })
    if (!vatParent) {
      throw new Error('VAT Parent 2100 not found! Please run fix_vat_structure.js first.')
    }

    // Ensure 2130 exists (Settlement)
    let acc2130 = await Account.findOne({ where: { account_code: '2130' }, transaction: t })
    if (!acc2130) {
      console.log('Creating 2130 VAT Settlement...')
      await Account.create({
        account_code: '2130',
        name: 'تسوية ضريبة القيمة المضافة',
        name_en: 'VAT Settlement',
        type: 'liability',
        parent_id: vatParent.id
      }, { transaction: t })
    } else {
      if (acc2130.parent_id !== vatParent.id) {
        await acc2130.update({ parent_id: vatParent.id }, { transaction: t })
        console.log('Updated 2130 parent')
      }
    }

    // Ensure 2140 exists (Non-recoverable VAT)
    let acc2140 = await Account.findOne({ where: { account_code: '2140' }, transaction: t })
    if (!acc2140) {
      console.log('Creating 2140 Non-recoverable VAT...')
      await Account.create({
        account_code: '2140',
        name: 'ضريبة القيمة المضافة غير القابلة للاسترداد',
        name_en: 'Non-recoverable VAT',
        type: 'expense', // User said "Loaded directly onto expense", so maybe 'expense' type is better?
        // However, if it's under 2100 (Liability), it should be Liability.
        // But usually non-recoverable VAT is an expense.
        // If I make it Liability, it balances the Liability side.
        // Let's stick to Liability (2xxx) as per code structure, but allow usage in expenses.
        type: 'liability', 
        parent_id: vatParent.id
      }, { transaction: t })
    } else {
       if (acc2140.parent_id !== vatParent.id) {
         await acc2140.update({ parent_id: vatParent.id }, { transaction: t })
         console.log('Updated 2140 parent')
       }
    }

    await t.commit()
    console.log('VAT accounts checked/created successfully.')
  } catch (e) {
    await t.rollback()
    console.error('Error:', e)
    process.exit(1)
  }
}

run()
