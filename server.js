require("dotenv").config();
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
    database: process.env["MYSQL_DB"],
    multipleStatements: true
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
        var number = results[0].numberOfUsers;
        var currentUsersNum = number;
        res.render("login", {alert: undefined, username: undefined, users: number});
    });
});

app.post("/login", function(req, res) {
    var email = req.body.email;
    var pass = req.body.pass;

    if (!(typeof email=='string' && typeof pass=='string')) {
        res.render("login", {alert: "Please only enter text!", username: undefined, users: currentUsersNum});
        return;
    }

    // All emails should be lowercase
    var email = email.toLowerCase();

    conn.query('SELECT userID,email,pass,name FROM users WHERE email=?', [email], function (error, results, fields) {
        if (results.length == 0) {
            // If there are no results, then that user does not exist
            res.render("login", {alert: "User does not exist!", username: undefined, users: currentUsersNum});
            return;
        }

        var user = results[0];
        var userID = user.userID;
        var dbpass = user.pass;
        var username = user.name;

        // Compare password against hash
        bcrypt.compare(pass, dbpass, function(err, result) {
            if (result) {
                util.createSession(userID, req.ip, function(sessionString) {
                    // Cookie will expire in 30 days
                    res.cookie("session", sessionString, {maxAge: new Date(1000 * 60 * 60 * 24 * 30)});
                    return res.redirect("/");
                });

            } else {
                res.render("login", {alert: "Password was incorrect!", username: undefined, users: currentUsersNum});
            }
        });

    });
});

app.get("/logout", function(req, res) {
    var username = undefined;

    var cookies = util.parseCookies(req.headers.cookie);

    var session = cookies.session;

    if (session == undefined) return res.redirect("/");

    conn.query("DELETE FROM sessions WHERE sessionString=?", [session], function (error, results, fields) {

    });

    res.clearCookie("session");
    return res.redirect("/");

});

app.get("/upload", util.authenticateUser, function(req, res) {
    conn.query("SELECT groups.groupID AS groupID,groupName,groupRank FROM groups INNER JOIN groupMembership ON userID=? AND groupMembership.groupID=groups.groupID", [req.user.userID], function(err, results) {
        if (err) throw err;
        var groups = util.filter(results, function(v) {
            // TODO: Check for other group ranks (might want to move this into util)
            return v.groupRank == 'o';
        });

        res.render("upload", {username: req.user.name, alert: undefined, groups: groups});
    });

});

permittedExtensions = ["png", "jpg", "jpeg"];

app.post("/upload", util.authenticateUser, upload.single("imgfile"), function(req, res) {
    var caption = req.body.caption;
    var license = req.body.license;

    if (!(typeof caption=='string' && typeof req.body.selectedgroup=='string')) {
        res.render("upload", {alert: "Please only enter text!", username: req.user.name});
        return;
    }

    if (req.file == undefined) {
        conn.query("SELECT groupID,groupName FROM groups", [], function(err, results) {
            res.render("upload", {username: req.user.name, alert: "No file has been selected!", groups: results});
        });
        return;
    }

    var ext = undefined;
    permittedExtensions.forEach(function(item, i) {
        originalName = req.file.originalname.toLowerCase();
        if (originalName.endsWith("."+item)) {
            ext = item;
        }
    });

    if (ext == undefined) {
        console.log("Invalid file extension!");
        fs.unlinkSync(path.join(path.__dirname, "uploads/"+req.file.originalname));

        conn.query("SELECT groupID,groupName FROM groups", [], function(err, results) {
            res.render("upload", {username: req.user.name, alert: "That upload has an invalid extension!", groups: results});
        });

        return;

    } else {
        fs.renameSync(path.join(__dirname, "uploads/"+req.file.filename), path.join(__dirname, "uploads/"+req.file.filename+"."+ext));
    }

    var fName = req.file.filename+"."+ext;

    var selectedgroup = req.body.selectedgroup == "none" ? null : parseInt(req.body.selectedgroup);

    conn.query("INSERT INTO upload (userID,licenseType,caption,fName,datePosted) VALUES (?,?,?,?,?)", [req.user.userID, license, caption, fName, new Date()], function (err, results) {
        if(err) {
            conn.query("SELECT groupID,groupName FROM groups", [], function(err, results) {
                res.render("upload", {username: req.user.name, alert: "There was a problem with your upload please try again", groups: results});
            });

            return;
        }

        conn.query("INSERT INTO groupImageMembership (groupID,uploadID,dateAdded) VALUES (?,?,?)", [selectedgroup, results.insertId, new Date()], function(err, results2) {
            return res.redirect("/image/"+results.insertId);
        });

    });
});

app.get("/register", function(req, res) {
    conn.query("SELECT COUNT(*) AS numberOfUsers FROM users", function(err, results){
        var number = results[0].numberOfUsers;
        res.render("register", {alert: undefined, username: undefined, users: number});
    });
});

app.post("/register", function(req, res) {
    var email = req.body.email;
    var pass1 = req.body.pass1;
    var pass2 = req.body.pass2;
    var username = req.body.username;

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

    var hashedpass = bcrypt.hashSync(pass1, 10);

    // Attempt to insert the new user into the users table
    conn.query("INSERT INTO users (email,name,pass) VALUES (?,?,?)", [email,username,hashedpass], function (err, results) {
        if(err) {
            // If there is an error, this most likely means a user with the same name/email address is already registered
            res.render("register", {alert: "Email/username is already registered!", username: undefined});
            return;
        }

        // Get the user ID (Primary Key) of the newly inserted user
        var userID = results.insertId;

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
    var groupname = req.body.groupname;
    var groupdesc = req.body.groupdesc;

    if (!(typeof groupname=='string' || groupdesc=='string')) {
        res.render("creategroup", {alert: "Please only enter text!", username: user.name});
        return;
    }

    conn.query("INSERT INTO groups (groupName,groupDesc,private) VALUES (?,?,?)", [groupname, groupdesc, 'N'], function(err, results) {
        if (err) {
            res.render("creategroups", {alert: "A group with that name already exists!", username: req.user.name});
            return;
        }

        var groupID = results.insertId;

        conn.query("INSERT INTO groupMembership (userID, groupID, groupRank, dateJoined, favourite) VALUES (?, ?, ?, ?, ?)",
        // The following options exist for groupRank: owner: o, admin: a, moderator: m, normal: n, guest: g
        [req.user.userID, groupID, "o", new Date(), "n"], function(err, results) {
        });

        return res.redirect("/group/"+results.insertId);
    });
});

app.get("/groups", util.authenticateUser, function(req, res) {
    conn.query("SELECT groups.*, (SELECT favourite FROM groupMembership WHERE userID=? AND groupMembership.groupID=groups.groupID) AS favourite FROM groups",
    [req.user.userID], function(err, results) {
        res.render("groups", {username: req.user.name, groups: results});
    });

});

app.get("/image/:uploadID", util.authenticateUserOptional, function(req, res) {
    var uploadID = req.params.uploadID;

    // TODO: Additional features when user logged in (republish, add to one of my groups, etc)
    var username = undefined;
    if (req.user) {
        username = req.user.name;
    }

    conn.query("SELECT upload.*,users.name FROM upload INNER JOIN users ON upload.userID=users.userID WHERE uploadID=?", [uploadID,], function(err, results) {
        if (results.length == 1) {
            var r = results[0];
            var uname = r.name;
            var caption = r.caption;

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
    var uploadID = req.params.uploadID;

    if (typeof req.body.comment != "string") {
        return res.redirect("/image/"+uploadID);
    }

    conn.query("INSERT INTO uploadComments (userID,uploadID,datePosted,commentContent) VALUES (?,?,?,?)", [req.user.userID,uploadID, new Date(), req.body.comment], function(err, results1) {
        return res.redirect("/image/"+uploadID);
    });

});

app.get("/group/:groupID", util.authenticateUser, function(req, res) {
    conn.query("SELECT favourite,groupRank FROM groupMembership WHERE userID=? AND groupID=?", [req.user.userID, req.params.groupID], function (err, results1) {
        var fav = 'n';
        var rank = null;

        if (results1.length == 1) {
            fav = results1[0].favourite;
            rank = results1[0].groupRank;
        }

        conn.query("SELECT upload.* FROM upload INNER JOIN groupImageMembership ON groupImageMembership.uploadID=upload.uploadID AND groupImageMembership.groupID=?", [req.params.groupID],function(err, results, fields) {
            res.render("group", {username: req.user.name, group: results, gid: req.params.groupID, fav: fav == 'y' ? "Unfavourite" : "Favourite", favstar: fav == 'y' ? "star_on.png" : "star_off.png", rank: rank});
        });
    });

});

app.post("/group/:groupID/fav", util.authenticateUser, function (req, res) {
    conn.query("SELECT favourite FROM groupMembership WHERE userID=? AND groupID=?", [req.user.userID, req.params.groupID], function (err, results) {
        var fav = 'y';
        var groupID = req.params.groupID;

        if (results.length == 1) {
            fav = results[0].favourite == 'y' ? 'n' : 'y';
        }

        if (results.length == 0) {
            conn.query("INSERT INTO groupMembership (userID, groupID, groupRank, dateJoined, favourite) VALUES (?, ?, ?, ?, ?)",
            [req.user.userID, groupID, "g", new Date(), fav], function(err, results) {

                return res.redirect("/group/"+req.params.groupID);

        });

        } else {
            conn.query("UPDATE groupMembership SET favourite=? WHERE userID=? AND groupID=?", [fav, req.user.userID, req.params.groupID], function (err, results) {
                return res.redirect("/group/"+req.params.groupID);
            });
        }
    });
});

app.get("/report/:commentID", util.authenticateUser, function (req, res) {
    conn.query("SELECT uploadComments.*,users.name FROM uploadComments INNER JOIN users ON uploadComments.userID=users.userID WHERE commentID=?", [req.params.commentID], function (err, results) {
        if (results.length != 1) {
            return res.send("<html><body><h1>You can't report a non-existant comment!</h1></body></html>");
        }

        res.render("report", {username: req.user.name, commentID: req.params.commentID, c: results[0]});
    });
});

app.post("/report/:commentID", util.authenticateUser, function (req, res) {
    // TODO: Save report into the database
    commID = req.params.commentID;
    user = req.user.userID;
    reason = req.body.simplereason;
    adInfo = req.body.extra;
    dateRep = new Date();
    resolution = "unresolved";

    conn.query("SELECT uploadComments.*,users.name FROM uploadComments INNER JOIN users ON uploadComments.userID=users.userID WHERE commentID=?", [req.params.commentID], function (err, results) {
        if (results.length != 1) {
            return res.send("<html><body><h1>You can't report a non-existant comment!</h1></body></html>");
        }

        conn.query("INSERT INTO report (commentID,reporterID,reason,adInfo,dateReported,resolutionStatus) VALUES (?,?,?,?,?,?)", [commID,user,reason,adInfo,dateRep,resolution], function (err, results) {
            if(err) {
                // If there is an error, this most likely means a user has not filled in all marked fields
                res.render("report", {alert: "Please fill out all marked fields", username: req.user.name});
                return;
            }

            return res.redirect("/");
        });
    });
});

app.get("/group/:groupID/settings", util.authenticateUser, function(req, res) {
    conn.query("SELECT groupRank FROM groupMembership WHERE groupID=? AND userID=?", [req.params.groupID, req.user.userID], function(err, results_user) {
        if (results_user.length != 1) {
            return res.redirect("/");
        }

        if (!util.canAccessGroupSettings(results_user[0].groupRank)) {
            return res.redirect("/");
        }
    

        conn.query("SELECT groups.* FROM groups INNER JOIN groupMembership ON groups.groupID=groupMembership.groupID AND groupMembership.userID=? WHERE groups.groupID=?", [req.user.userID, req.params.groupID], function(err, results) {
            if (results.length != 1) {
                return res.redirect("/groups");
            }

            conn.query("SELECT users.name,users.userID,groupRank FROM users INNER JOIN groupMembership ON users.userID=groupMembership.userID AND groupMembership.groupRank!='g' AND groupMembership.groupID=?", [req.params.groupID], function(err, results2) {
                results2.forEach(function (v) {
                    v.mappedRank = util.rankMappings[v.groupRank];
                });

                res.render("groupsettings.ejs", {username: req.user.name, group: results[0], users: results2});
            });
        });
    });
});

app.post("/group/:groupID/settings", util.authenticateUser, function(req, res) {
    conn.query("SELECT * FROM groupMembership WHERE groupID=? AND userID=?", [req.params.groupID, req.user.userID], function(err, results) {
        var rank = results[0].groupRank;

        if (results.length != 1) {
            return res.redirect("/");
        }

        if (!util.canAccessGroupSettings(rank)) {
            return res.redirect("/");
        }

        if (req.body.remove) {
            conn.query("UPDATE groupMembership SET groupRank='g' WHERE userID=? AND groupID=?", [req.body.affecteduser, req.params.groupID], function(err, results) {
                return res.redirect("/group/" + req.params.groupID + "/settings");
            });

        } else if (req.body.promote) {
            var chosenRank = req.body.rank;

            if (chosenRank != "a" && chosenRank != "m" && chosenRank != "n") {
                return res.redirect("/group/"+req.params.groupID+"/settings");
            }

            conn.query("UPDATE groupMembership SET groupRank=? WHERE userID=? AND groupID=?", [chosenRank, req.body.affecteduser, req.params.groupID], function(err, results) {
                return res.redirect("/group/"+req.params.groupID + "/settings");
            });

        } else if (req.body.invite) {
            conn.query("SELECT userID FROM users WHERE name=?", [req.body.invname], function(err, results) {
                if (results.length != 1) {
                    return res.redirect("/group/"+req.params.groupID+"/settings");
                }

                var uID = results[0].userID;
                var gID = req.params.groupID;
                // I read the MySQL doc for insert (specifically the bit about the IGNORE modifier)
                // https://dev.mysql.com/doc/refman/8.0/en/insert.html
                conn.query("INSERT IGNORE INTO groupMembership (userID,groupID,groupRank,dateJoined,favourite) VALUES (?,?,'n',?,?); UPDATE groupMembership SET groupRank=? WHERE userID=? AND groupID=?", [uID, gID, new Date(), "n", "n", uID, gID], function(err, results) {
                    return res.redirect("/group/"+req.params.groupID+"/settings");
                });
            });

        } else {
            return res.send("<html><body><h1>Unsupported option</h1></body></html>");
        }
    });
});

app.get("/admin", util.authenticateUser, function(req, res) {
    // SELECT COUNT(upload.*),SELECT COUNT(users.*),SELECT COUNT(groups.*),SELECT COUNT(uploadComments.*) FROM upload,users,groups,uploadComments
    conn.query("SELECT COUNT(*) AS C FROM upload; SELECT COUNT(*) AS C FROM users; SELECT COUNT(*) AS C FROM groups; SELECT COUNT(*) AS C FROM uploadComments;", [], function(err, results) {
        res.render("admin.ejs", {username: req.user.name, basicstats: results});
    });
});

app.get("/admin/reports", util.authenticateUser, function(req, res) {
    conn.query("SELECT report.*,users.name,commentContent,(SELECT name FROM users INNER JOIN uploadComments ON uploadComments.userID=users.userID AND uploadComments.commentID=report.commentID) AS rid FROM report INNER JOIN uploadComments ON uploadComments.commentID=report.commentID INNER JOIN users ON users.userID=report.reporterID WHERE resolutionStatus='unresolved'",
    [req.user.userID], function(err, results) {
        res.render("adminreports", {username: req.user.name, reports: results});
    });
    
});

app.post("/admin/reports/respond/:reportID", util.authenticateUser, function(req, res) {
    // TODO: different handling in the event of a report being accepted (delete/hide comment and ban/warn commenting user)
    conn.query("UPDATE report SET resolutionStatus=? WHERE reportID=?", [req.body.reject ? "rejected" : "accepted", req.params.reportID], function(err, results) {
        if (err) throw err;
        return res.redirect("/admin/reports");
    });

});

app.get("/admin/users", util.authenticateUser, function(req, res) {
    conn.query("SELECT * FROM users", [req.user.userID], function(err, results){
        res.render("userlist.ejs", {username: req.user.name, users: results});
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

app.get("/tc", util.authenticateUserOptional, function (req, res) {
    if (req.user) {
        res.render("tc", {username: req.user.name});
        
    } else {
        res.render("tc", {username: undefined});
    }
});

app.listen(8080);
