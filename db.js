const mysql = require('mysql2');

// Create connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      
    password: '1234',      
    database: 'MovieCommunityDB',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Promisify for Node.js async/await
const promisePool = pool.promise();

console.log("Database Pool Created...");

module.exports = promisePool;