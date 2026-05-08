const { initDatabase, getDb } = require('../config/database');
require('dotenv').config();

try {
  initDatabase();
  const db = getDb();
  const instances = db.prepare('SELECT * FROM instances').all();
  console.log('--- Current Instances ---');
  console.log(JSON.stringify(instances, null, 2));
} catch (err) {
  console.error('Error reading database:', err);
}
