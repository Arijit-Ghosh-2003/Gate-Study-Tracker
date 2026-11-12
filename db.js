const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: '+00:00',
  dateStrings: true,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Ensure every new TiDB session evaluates NOW(), CURDATE(), and TIMESTAMP columns in IST
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00';");
});

module.exports = pool;