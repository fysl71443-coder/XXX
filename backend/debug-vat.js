const { sequelize, Account, JournalPosting, JournalEntry } = require('./models');
const { Op } = require('sequelize');

async function debugExpenses() {
  try {
    const accounts = await Account.findAll();
    const start = new Date('2025-10-01');
    const end = new Date('2025-12-31');

    const postings = await JournalPosting.findAll({
      include: [
        {
          model: JournalEntry,
          as: 'journal',
          where: {
            date: {
              [Op.gte]: start,
              [Op.lte]: end
            },
            status: 'posted'
          }
        },
        {
          model: Account,
          as: 'account'
        }
      ]
    });

    let deductible = 0;
    console.log('--- Deductible Expenses (Q4 2025) ---');
    
    for (const p of postings) {
      const a = p.account;
      if (!a) continue;
      
      const nameTxt = `${a.name||''} ${a.name_en||''}`.toLowerCase();
      let isDeductible = false;
      let val = 0;

      if (String(a.type) === 'expense') {
        const nonDeductible = /(رواتب|اجور|salary|wages|غرامات|fines|رسوم حكومية|government|ترفيه|entertainment|ضيافة|hospitality|سكن|lodging|مركبات.*شخصي|personal)/i.test(nameTxt);
        if (!nonDeductible) {
          val = parseFloat(p.debit || 0) - parseFloat(p.credit || 0);
          if (val > 0) {
            isDeductible = true;
            deductible += val;
          }
        }
      } else if (String(a.type) === 'asset') {
         const isFixedAsset = /(أصول ثابتة|fixed assets|معدات|equipment|أجهزة|devices|أثاث|furniture)/i.test(nameTxt);
         if (isFixedAsset) {
            val = parseFloat(p.debit || 0) - parseFloat(p.credit || 0);
            if (val > 0) {
              isDeductible = true;
              deductible += val;
            }
         }
      }

      if (isDeductible) {
        console.log(`Entry #${p.journal.entry_number} (${p.journal.date}): ${p.journal.description} | Account: ${a.name} | Amount: ${val}`);
      }
    }

    console.log('--- Total Deductible Expenses ---');
    console.log(deductible);
    console.log('--- Calculated Input VAT (15%) ---');
    console.log(deductible * 0.15);

  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

debugExpenses();
