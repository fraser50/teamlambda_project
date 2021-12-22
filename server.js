const express = require("express");
const path = require("path");

const app = express();

app.get("/", function(req, res) {
    res.send("<html><body><h1>TODO: add main page</h1></body></html>");
});

app.get("/login", function(req, res) {
    res.sendFile(path.join(__dirname, "login.html"));
});

// TODO: Use a static directory for things like stylesheets, images, etc
app.get("/style.css", function(req, res) {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.listen(8080);