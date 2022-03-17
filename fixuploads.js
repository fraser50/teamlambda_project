/*
Reads the groupID field for each upload and creates a record in groupImageMembership.
(This was used to assist in the change from a one-to-many to a many-to-many relationship between groups and upload)

NOTE: the following environment variables have to be set:

MYSQL_HOST
MYSQL_USER
MYSQL_PASS
MYSQL_DB

*/

const mysql = require("mysql");

var conn = mysql.createConnection({
    host: process.env['MYSQL_HOST'],
    user: process.env['MYSQL_USER'],
    password: process.env['MYSQL_PASS'],
    database: process.env['MYSQL_DB']
});

conn.query("SELECT * FROM upload", [], function(err, results) {
    results.forEach(function(r) {
        if (r.groupID == null) {
            console.log("Group is NULL for " + r.uploadID + " (" + r.caption + ")");
            return;
        }

        conn.query("INSERT INTO groupImageMembership (groupID,uploadID,dateAdded) VALUES (?,?,?)", [r.groupID, r.uploadID, r.datePosted], function(err, results) {
            console.log("Added " + r.uploadID + " (" + r.caption + ") to group " + r.groupID);
        });
    });
    conn.end();
});