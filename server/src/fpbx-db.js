const { Pool } = require('pg');

const fpbxPool = new Pool({
  host: '3.11.129.110',
  port: 5432,
  database: 'fusionpbx',
  user: 'fusionpbx',
  password: 'WgofzUTLbtyKhBxLOLepJ1mXj8o',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

module.exports = fpbxPool;
