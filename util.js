const crypto = require("crypto");
var conn = undefined;

function setConnection(c) {
    conn = c;
}

// Generate a session for a given user, and provides the session ID to the given callback
function createSession(userID, ip, callback) {
    var currentTime = new Date();
    var sessionString = crypto.randomBytes(32).toString("hex");

    conn.query("INSERT INTO sessions (sessionString,userID,creationDate,creationIP) VALUES (?,?,?,?)",
    [sessionString, userID, currentTime, ip], function (error, results, fields) {
        if (error) throw error;

        callback(sessionString);
    });
}

function parseCookies(cookies) {
    var cookieDict = {};
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
    var cookies = parseCookies(rawCookies);

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

// This function tries to authenticate a user and will send them to the login page if they're not logged in
function authenticateUser(req, res, next) {
    getUserFromCookies(req.headers.cookie, function(user) {
        if (user) {
            req.user = user;
            next();

        } else {
            return res.redirect("/login");
        }
    });
}

// This function tries to authenticate a user but will still let them in if they're not logged in
function authenticateUserOptional(req, res, next) {
    getUserFromCookies(req.headers.cookie, function(user) {
        if (user) req.user = user;
        next();
    });
}

// This function tries to authenticate an admin and will send them to the homepage if they aren't
function authenticateAdmin(req, res, next) {
    getUserFromCookies(req.headers.cookie, function(user) {
        if (user) {
            if (user.admin != 'Y') {
                return res.redirect("/");
            }
            req.user = user;
            next();

        } else {
            return res.redirect("/login");
        }
    });
}

var rankMappings = {
    //owner: o, admin: a, moderator: m, normal: n, guest: g
    o: "Owner",
    a: "Admin",
    m: "Moderator",
    n: "Normal"
    
}

// This function returns whether the given group rank is allowed to access and modify group settings
function canAccessGroupSettings(rank) {
    return rank == 'o' || rank == 'a';
}

function filter(lst, func) {
    var retlist = [];

    lst.forEach(function(v, i) {
        if (func(v)) {
            retlist.push(v);
        }
    });

    return retlist;
}

exports.setConnection = setConnection;
exports.createSession = createSession;
exports.parseCookies = parseCookies;
exports.authenticateUser = authenticateUser;
exports.authenticateUserOptional = authenticateUserOptional;
exports.authenticateAdmin = authenticateAdmin;
exports.rankMappings = rankMappings;
exports.canAccessGroupSettings = canAccessGroupSettings;
exports.filter = filter;