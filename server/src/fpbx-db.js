const { Pool } = require('pg');

const fpbxPool = new Pool({
  host: process.env.FPBX_DB_HOST || 'localhost',
  port: parseInt(process.env.FPBX_DB_PORT || '5432'),
  database: process.env.FPBX_DB_NAME || 'fusionpbx',
  user: process.env.FPBX_DB_USER || 'fusionpbx',
  password: process.env.FPBX_DB_PASS || '',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

module.exports = fpbxPool;
