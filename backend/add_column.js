const { sequelize } = require('./models');
const { DataTypes } = require('sequelize');

async function up() {
  const qi = sequelize.getQueryInterface();
  try {
    const tableDesc = await qi.describeTable('PayrollRuns');
    if (!tableDesc.payment_status) {
        await qi.addColumn('PayrollRuns', 'payment_status', { type: DataTypes.STRING, defaultValue: 'unpaid' });
        console.log('Added payment_status');
    } else {
        console.log('payment_status already exists');
    }
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
      await sequelize.close();
  }
}
up();
