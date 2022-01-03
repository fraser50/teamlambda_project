const express = require("express");
const path = require("path");
const mysql = require("mysql");
const bcrypt = require("bcrypt");

var conn = mysql.createConnection({
    host: process.env['MYSQL_HOST'],
    user: process.env['MYSQL_USER'],
    password: process.env['MYSQL_PASS'],
    database: process.env["MYSQL_DB"]
});

conn.connect(function (err) {
    if (!err) return;
    console.log("Failed to connect to DB!");
    process.exit(1);
});

function parseCookies(cookies) {
    cookieDict = {};
    cookies.split("; ").forEach(function (c, i) {
        cookieData = c.split("=");
        cookieName = cookieData[0];
        cookieContents = cookieData[1];

        cookieDict[cookieName] = cookieContents;
    });

    return cookieDict;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get("/", function(req, res) {
    res.sendFile(path.join(__dirname, "FrontEndCode/index.html"));
});

app.get("/login", function(req, res) {
    res.sendFile(path.join(__dirname, "FrontEndCode/login.html"));
});

app.post("/login", function(req, res) {
    email = req.body.email;
    pass = req.body.pass;

    if (!(typeof email=='string' && typeof pass=='string')) {
        return res.send("Error: username or password was empty");
    }

    // All emails should be lowercase
    email = email.toLowerCase();
    conn.query('SELECT userID,email,pass,name FROM users WHERE email=?', [email], function (error, results, fields) {
        if (results.length == 0) {
            // If there are no results, then that user does not exist
            return res.send("Error: user does not exist!");
        }

        user = results[0];
        userID = user.userID;
        dbpass = user.pass;
        username = user.name;

        // Compare password against hash
        bcrypt.compare(pass, dbpass, function(err, result) {
            if (result) {
                //TODO: redirect to home page, create session and set cookie
                return res.send("Login successful!");
            } else {
                return res.send("Authentication failure!");
            }
        });

    });
});

// TODO: Use a static directory for things like stylesheets, images, etc
app.get("/style.css", function(req, res) {
    res.sendFile(path.join(__dirname, "FrontEndCode/style.css"));
});

app.listen(8080);