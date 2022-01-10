const express = require("express");
const path = require("path");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

var conn = mysql.createPool({
    connectionLimit : 10,
    host: process.env['MYSQL_HOST'],
    user: process.env['MYSQL_USER'],
    password: process.env['MYSQL_PASS'],
    database: process.env["MYSQL_DB"]
});

function parseCookies(cookies) {
    cookieDict = {};
    if (cookies == undefined) return cookieDict;
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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "FrontEndCode"));
app.set('view options', {delimiter: '?'});

app.get("/", function(req, res) {
    username = undefined;

    cookies = parseCookies(req.headers.cookie);

    session = cookies.session;
    
    if (session == undefined) {
        res.render("index", {username: username});
        return;
    }

    if (typeof session == 'string') {
        conn.query("SELECT name FROM users INNER JOIN sessions ON users.userID=sessions.userID AND sessions.sessionString=?", [session], function(error, results, fields) {
            if (results.length == 1) {
                username = results[0].name;

                res.render("index", {username: username});

            } else {
                res.render("index", {username: undefined});
            }
            
        });
    }
});

app.get("/login", function(req, res) {
    res.render("login", {alert: undefined});
});

app.post("/login", function(req, res) {
    email = req.body.email;
    pass = req.body.pass;

    if (!(typeof email=='string' && typeof pass=='string')) {
        res.render("login", {alert: "Please only enter text!"});
        return;
    }

    // All emails should be lowercase
    email = email.toLowerCase();
    conn.query('SELECT userID,email,pass,name FROM users WHERE email=?', [email], function (error, results, fields) {
        if (results.length == 0) {
            // If there are no results, then that user does not exist
            res.render("login", {alert: "User does not exist!"});
            return;
        }

        user = results[0];
        userID = user.userID;
        dbpass = user.pass;
        username = user.name;

        // Compare password against hash
        bcrypt.compare(pass, dbpass, function(err, result) {
            if (result) {

                // Produce a session
                currentTime = new Date();
                sessionString = crypto.randomBytes(32).toString("hex");

                conn.query("INSERT INTO sessions (sessionString,userID,creationDate,creationIP) VALUES (?,?,?,?)",
                [sessionString, userID, currentTime, req.ip], function (error, results, fields) {
                    if (error) throw error;
                    res.cookie("session", sessionString);
                    return res.redirect("/");

                });

            } else {
                res.render("login", {alert: "Password was incorrect!"});
            }
        });

    });
});

app.get("/logout", function(req, res) {
    username = undefined;

    cookies = parseCookies(req.headers.cookie);

    session = cookies.session;

    if (session == undefined) return res.redirect("/");

    conn.query("DELETE FROM sessions WHERE sessionString=?", [session], function (error, results, fields) {

    });

    res.clearCookie("session");
    return res.redirect("/");

});

app.get("/upload", function(req, res) {
    res.render("upload", {username: undefined});
});

// TODO: Use a static directory for things like stylesheets, images, etc
app.get("/style.css", function(req, res) {
    res.sendFile(path.join(__dirname, "FrontEndCode/style.css"));
});

app.get("/placeholder.png", function(req, res) {
    res.sendFile(path.join(__dirname, "FrontEndCode/placeholder.png"));
});

app.listen(8080);