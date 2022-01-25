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

//TODO: Separate this into a seperate utilities file (util.js)

// Generate a session for a given user, and provides the session ID to the given callback
function createSession(userID, ip, callback) {
    currentTime = new Date();
    sessionString = crypto.randomBytes(32).toString("hex");

    conn.query("INSERT INTO sessions (sessionString,userID,creationDate,creationIP) VALUES (?,?,?,?)",
    [sessionString, userID, currentTime, ip], function (error, results, fields) {
        if (error) throw error;

        callback(sessionString);
    });
}

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

function getUserFromCookies(rawCookies, callback) {
    cookies = parseCookies(rawCookies);

    var session = cookies.session;
    
    if (session == undefined || typeof session != "string") {
        callback(null);
        return;
    }

    conn.query("SELECT users.userID,email,name,admin,avatar,approved FROM users INNER JOIN sessions ON users.userID=sessions.userID AND sessions.sessionString=?", [session], function(error, results, fields) {
        if (results.length == 1) {
            callback(results[0]);

        } else {
            callback(null);
        }
        
    });
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "FrontEndCode"));

app.get("/", function(req, res) {
    getUserFromCookies(req.headers.cookie, function(user) {
        if (user) {
            res.render("index", {username: user.name});

        } else {
            res.render("index", {username: undefined});
        }
    });
});

app.get("/login", function(req, res) {
    res.render("login", {alert: undefined, username: undefined});
});

app.post("/login", function(req, res) {
    email = req.body.email;
    pass = req.body.pass;

    if (!(typeof email=='string' && typeof pass=='string')) {
        res.render("login", {alert: "Please only enter text!", username: undefined});
        return;
    }

    // All emails should be lowercase
    email = email.toLowerCase();
    conn.query('SELECT userID,email,pass,name FROM users WHERE email=?', [email], function (error, results, fields) {
        if (results.length == 0) {
            // If there are no results, then that user does not exist
            res.render("login", {alert: "User does not exist!", username: undefined});
            return;
        }

        user = results[0];
        userID = user.userID;
        dbpass = user.pass;
        username = user.name;

        // Compare password against hash
        bcrypt.compare(pass, dbpass, function(err, result) {
            if (result) {
                createSession(userID, req.ip, function(sessionString) {
                    res.cookie("session", sessionString);
                    return res.redirect("/");
                });

            } else {
                res.render("login", {alert: "Password was incorrect!", username: undefined});
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
    getUserFromCookies(req.headers.cookie, function(user) {
        if (user) {
            res.render("upload", {username: user.name});

        } else {
            return res.redirect("/login");
        }
    });
    
});

app.post("/upload", function(req, res) {
    caption = req.body.caption;
    license = req.body.license;

    if (!(typeof caption=='string' )) {
        res.render("upload", {alert: "Please only enter text!", username: user.name});
        return;
    }


       // Attempt to insert the new user into the users table
    conn.query("INSERT INTO upload (licenseType,caption) VALUES (?,?)", [license,caption], function (err, results) {
        if(err) {
            // If there is an error, this most likely means a user with the same name/email address is already registered
            res.render("upload", {alert: "There was a problem with your upload please try again", username: user.name});
            return;
        }

        // Create a session for the user and redirect them to the home page
        createSession(userID, req.ip, function(sessionString) {
            res.cookie("session", sessionString);
            return res.redirect("/");
        });
    });
});

app.get("/register", function(req, res) {
    res.render("register", {alert: undefined, username: undefined});
});

app.post("/register", function(req, res) {
    email = req.body.email;
    pass1 = req.body.pass1;
    pass2 = req.body.pass2;
    username = req.body.username;

    if (!(typeof email=='string' && typeof pass1=='string' && typeof pass2=='string' && typeof username=='string')) {
        res.render("register", {alert: "Please only enter text!", username: undefined});
        return;
    }

    // The password and confirm password fields should be the same
    if (pass1 != pass2) {
        res.render("register", {alert: "Passwords provided do not match!", username: undefined});
        return;
    }

    // We only want Heriot-Watt students to be able to register for now
    if (!email.endsWith("@hw.ac.uk")) {
        res.render("register", {alert: "Sorry, you are unable to sign up with that email!", undefined});
        return;
    }

    //TODO: Only allow email to consist of alphanumeric characters

    hashedpass = bcrypt.hashSync(pass1, 10);

    // Attempt to insert the new user into the users table
    conn.query("INSERT INTO users (email,name,pass) VALUES (?,?,?)", [email,username,hashedpass], function (err, results) {
        if(err) {
            // If there is an error, this most likely means a user with the same name/email address is already registered
            res.render("register", {alert: "Email/username is already registered!", username: undefined});
            return;
        }

        // Get the user ID (Primary Key) of the newly inserted user
        userID = results.insertId;

        // Create a session for the user and redirect them to the home page
        createSession(userID, req.ip, function(sessionString) {
            res.cookie("session", sessionString);
            return res.redirect("/");
        });
    });
});

app.get("/creategroup", function(req, res) {
    getUserFromCookies(req.headers.cookie, function(user) {
        if (user) {
            res.render("creategroup", {alert: undefined, username: user.name});

        } else {
            return res.redirect("/login");
        }
    });
});

app.post("/creategroup", function(req, res) {
    getUserFromCookies(req.headers.cookie, function(user) {
        if (user) {
            groupname = req.body.groupname;
            groupdesc = req.body.groupdesc;

            if (!(typeof groupname=='string' || groupdesc=='string')) {
                res.render("creategroup", {alert: "Please only enter text!", username: user.name});
                return;
            }

            conn.query("INSERT INTO groups (groupName,groupDesc,private) VALUES (?,?,?)", [groupname, groupdesc, 'N'], function(err, results) {
                if (err) {
                    res.render("creategroups", {alert: "A group with that name already exists!", username: user.name});
                    return;
                }

                // TODO: Redirect to group overview (when added)
                return res.redirect("/");
            });

        } else {
            return res.redirect("/login");
        }
    });
});

app.get("/groups", function(req, res) {
    getUserFromCookies(req.headers.cookie, function(user) {
        if (user) {
            conn.query("SELECT * FROM groups", function(err, results, fields) {
                res.render("groups", {username: user.name, groups: results});
            });

        } else {
            // TODO: Decide if users should be able to view group list when logged out
            return res.redirect("/login");
        }
    });
});

// TODO: Use a static directory for things like stylesheets, images, etc
app.get("/style.css", function(req, res) {
    res.sendFile(path.join(__dirname, "FrontEndCode/style.css"));
});

app.get("/placeholder.png", function(req, res) {
    res.sendFile(path.join(__dirname, "FrontEndCode/placeholder.png"));
});

app.listen(8080);