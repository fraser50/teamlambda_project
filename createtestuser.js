/*
Creates a user with the email test@example.com and username: test, with the password ytrewq
NOTE: the following environment variables have to be set:

MYSQL_HOST
MYSQL_USER
MYSQL_PASS
MYSQL_DB

*/
const bcrypt = require("bcrypt");
const mysql = require("mysql");

EMAIL = 'test@example.com';
USER = 'test';
PASSWORD = 'ytrewq';

var conn = mysql.createConnection({
    host: process.env['MYSQL_HOST'],
    user: process.env['MYSQL_USER'],
    password: process.env['MYSQL_PASS'],
    database: process.env['MYSQL_DB']
});

hashedpass = bcrypt.hashSync(PASSWORD, 10);

conn.query("INSERT INTO users (email,name,pass) VALUES (?,?,?)", [EMAIL,USER,hashedpass], function (err, results) {
    if(err) throw err;
    console.log('done!');
});