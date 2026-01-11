
const { sequelize } = require('./models');

async function checkColumns() {
  try {
    const [results] = await sequelize.query("PRAGMA table_info(PayrollRuns);");
    console.log('PayrollRuns columns:', results.map(c => c.name));
  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

checkColumns();
