const crypto = require("crypto");
var conn = undefined;

function setConnection(c) {
    conn = c;
}

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

function authenticateUser(req, res, next) {
    getUserFromCookies(req.headers.cookie, function(user) {
        if (user) {
            req.user = user;
            next();

        } else {
            return req.redirect("/login");
        }
    });
}
exports.setConnection = setConnection;
exports.createSession = createSession;
exports.parseCookies = parseCookies;
exports.getUserFromCookies = getUserFromCookies;
exports.authenticateUser = authenticateUser;