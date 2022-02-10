const express = require("express");
const path = require("path");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const fs = require("fs");

const multer = require("multer");
const upload = multer({dest: "uploads/"});

const util = require("./util.js");

var conn = mysql.createPool({
    connectionLimit : 10,
    host: process.env['MYSQL_HOST'],
    user: process.env['MYSQL_USER'],
    password: process.env['MYSQL_PASS'],
    database: process.env["MYSQL_DB"]
});

util.setConnection(conn);

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "FrontEndCode"));

app.get("/", util.authenticateUserOptional, function(req, res) {
    if (req.user) {
        res.render("index", {username: req.user.name});

    } else {
        res.render("index", {username: undefined});
    }
});

currentUsersNum = 0;

app.get("/login", function(req, res) {
    conn.query("SELECT COUNT(*) AS numberOfUsers FROM users", function(err, results){
        number = results[0].numberOfUsers;
        currentUsersNum = number;
        res.render("login", {alert: undefined, username: undefined, users: number});
    });
});

app.post("/login", function(req, res) {
    email = req.body.email;
    pass = req.body.pass;

    if (!(typeof email=='string' && typeof pass=='string')) {
        res.render("login", {alert: "Please only enter text!", username: undefined, users: currentUsersNum});
        return;
    }

    // All emails should be lowercase
    email = email.toLowerCase();
    conn.query('SELECT userID,email,pass,name FROM users WHERE email=?', [email], function (error, results, fields) {
        if (results.length == 0) {
            // If there are no results, then that user does not exist
            res.render("login", {alert: "User does not exist!", username: undefined, users: currentUsersNum});
            return;
        }

        user = results[0];
        userID = user.userID;
        dbpass = user.pass;
        username = user.name;

        // Compare password against hash
        bcrypt.compare(pass, dbpass, function(err, result) {
            if (result) {
                util.createSession(userID, req.ip, function(sessionString) {
                    res.cookie("session", sessionString);
                    return res.redirect("/");
                });

            } else {
                res.render("login", {alert: "Password was incorrect!", username: undefined, users: currentUsersNum});
            }
        });

    });
});

app.get("/logout", function(req, res) {
    username = undefined;

    cookies = util.parseCookies(req.headers.cookie);

    session = cookies.session;

    if (session == undefined) return res.redirect("/");

    conn.query("DELETE FROM sessions WHERE sessionString=?", [session], function (error, results, fields) {

    });

    res.clearCookie("session");
    return res.redirect("/");

});

app.get("/upload", util.authenticateUser, function(req, res) {
    conn.query("SELECT groupID,groupName FROM groups", [], function(err, results) {
        res.render("upload", {username: req.user.name, alert: undefined, groups: results});
    });
    
});

permittedExtensions = ["png", "jpg", "jpeg"];

app.post("/upload", util.authenticateUser, upload.single("imgfile"), function(req, res) {
    caption = req.body.caption;
    license = req.body.license;

    if (!(typeof caption=='string' && typeof req.body.selectedgroup=='string')) {
        res.render("upload", {alert: "Please only enter text!", username: req.user.name});
        return;
    }

    ext = undefined;
    permittedExtensions.forEach(function(item, i) {
        originalName = req.file.originalname.toLowerCase();
        if (originalName.endsWith("."+item)) {
            ext = item;
        }
    });

    if (ext == undefined) {
        console.log("Invalid file extension!");
        fs.unlinkSync(path.join(path.__dirname, "uploads/"+req.file.originalname));
        res.render("upload", {alert: "That upload has an invalid extension!", username: req.user.name});
        return;

    } else {
        fs.renameSync(path.join(__dirname, "uploads/"+req.file.filename), path.join(__dirname, "uploads/"+req.file.filename+"."+ext));
    }

    fName = req.file.filename+"."+ext;

    selectedgroup = req.body.selectedgroup == "none" ? null : parseInt(req.body.selectedgroup);

    conn.query("INSERT INTO upload (userID,licenseType,caption,fName,groupID) VALUES (?,?,?,?,?)", [req.user.userID, license, caption, fName, selectedgroup], function (err, results) {
        if(err) {
            res.render("upload", {alert: "There was a problem with your upload please try again", username: req.user.name});
            return;
        }

        // TODO: Separate page for each upload (scrapbook)
        return res.redirect("/image/"+results.insertId);
    });
});

app.get("/register", function(req, res) {
    conn.query("SELECT COUNT(*) AS numberOfUsers FROM users", function(err, results){
        number = results[0].numberOfUsers;
    res.render("register", {alert: undefined, username: undefined, users: number});
    });
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
        util.createSession(userID, req.ip, function(sessionString) {
            res.cookie("session", sessionString);
            return res.redirect("/");
        });
    });
});

app.get("/creategroup", util.authenticateUser, function(req, res) {
    res.render("creategroup", {alert: undefined, username: req.user.name});

});

app.post("/creategroup", util.authenticateUser, function(req, res) {
    groupname = req.body.groupname;
    groupdesc = req.body.groupdesc;

    if (!(typeof groupname=='string' || groupdesc=='string')) {
        res.render("creategroup", {alert: "Please only enter text!", username: user.name});
        return;
    }

    conn.query("INSERT INTO groups (groupName,groupDesc,private) VALUES (?,?,?)", [groupname, groupdesc, 'N'], function(err, results) {
        if (err) {
            res.render("creategroups", {alert: "A group with that name already exists!", username: req.user.name});
            return;
        }

        // TODO: Redirect to group overview (when added)
        return res.redirect("/");
    });
});

app.get("/groups", util.authenticateUser, function(req, res) {
    conn.query("SELECT * FROM groups", function(err, results, fields) {
        res.render("groups", {username: req.user.name, groups: results});
    });
    
});

app.get("/image/:uploadID", util.authenticateUserOptional, function(req, res) {
    uploadID = req.params.uploadID;

    // TODO: Additional features when user logged in (republish, add to one of my groups, etc)
    username = undefined;
    if (req.user) {
        username = req.user.name;
    }

    conn.query("SELECT upload.*,users.name FROM upload INNER JOIN users ON upload.userID=users.userID WHERE uploadID=?", [uploadID,], function(err, results) {
        if (results.length == 1) {
            r = results[0];
            uname = r.name;
            caption = r.caption;

            // Fetch comments from database
            conn.query("SELECT commentID,commentContent AS content,datePosted,users.name FROM uploadComments INNER JOIN users ON users.userID=uploadComments.userID WHERE uploadID=?",
            [uploadID,], function(err, results) {
                res.render("image", {username: username, comments: results, poster: uname, caption: caption, license: "Test", fName: r.fName, uploadID: uploadID});
            });

        } else {
            // TODO: Give an actual error page to the user
            return res.status(404).send("<html><body><p>That content does not appear to exist!</p></body></html>");
        }
    });
});

app.post("/image/:uploadID/comment", util.authenticateUser, function(req, res) {
    uploadID = req.params.uploadID;

    if (typeof req.body.comment != "string") {
        return res.redirect("/image/"+uploadID);
    }

    conn.query("INSERT INTO uploadComments (userID,uploadID,datePosted,commentContent) VALUES (?,?,?,?)", [req.user.userID,uploadID, new Date(), req.body.comment], function(err, results) {
        return res.redirect("/image/"+uploadID);
    });

});

app.get("/group/:groupID", util.authenticateUser, function(req, res) {
    conn.query("SELECT * FROM upload WHERE groupID=?", [req.params.groupID],function(err, results, fields) {
    res.render("group", {username: req.user.name, group: results});
    });
});

// TODO: Use a static directory for things like stylesheets, images, etc
app.get("/style.css", function(req, res) {
    res.sendFile(path.join(__dirname, "FrontEndCode/style.css"));
});

app.get("/placeholder.png", function(req, res) {
    res.sendFile(path.join(__dirname, "FrontEndCode/placeholder.png"));
});

app.use("/uploads", express.static("uploads", {dotfiles: 'ignore'}));
app.use("/static", express.static("static", {dotfiles: 'ignore'}));

app.get("/support", util.authenticateUserOptional, function(req, res) {
    if (req.user) {
        res.render("support", {username: req.user.name});
        
    } else {
        res.render("support", {username: undefined});
    }
});

app.listen(8080);
