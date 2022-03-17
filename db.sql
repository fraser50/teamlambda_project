/*
This file will be used for creating all the tables and foreign keys needed by the website.

TODO:
  - Add scrapbook table (each item uploaded should be initially flagged as hidden to allow moderation)
        --> scrapbooks should store license information (https://creativecommons.org/)
        --> should scrapbooks support being owned by multiple people?
        -- > A captions table will likely be needed to store multiple captions for each scrapbook
  - Add scrapbook membership table (allow a scrapbook to be added to multiple groups)
  - Add comment table (each comment will belong to a scrapbook and will be posted by a user)
  - Add reports table (for allowing users to report content, mainly comments)
  - Perhaps a table for private messages? (Might not be suitable for a collaborative platform, and might be a pain to moderate)
  - Changes to existing fields, and other changes

*/

CREATE TABLE IF NOT EXISTS users(
    userID INTEGER PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(32) NOT NULL UNIQUE,
    pass VARCHAR(64) NOT NULL,
    admin CHAR(1) NOT NULL DEFAULT 'N',
    avatar VARCHAR(32),
    approved CHAR(1) NOT NULL DEFAULT 'N'
);

CREATE TABLE IF NOT EXISTS sessions(
    sessionID INTEGER PRIMARY KEY AUTO_INCREMENT,
    sessionString CHAR(64) NOT NULL UNIQUE,
    userID INTEGER NOT NULL,
    creationDate TIMESTAMP NOT NULL,
    creationIP VARCHAR(64) NOT NULL,
    lastUse TIMESTAMP,
    FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groups(
    groupID INTEGER PRIMARY KEY AUTO_INCREMENT,
    groupName VARCHAR(32) NOT NULL UNIQUE,
    groupDesc VARCHAR(500),
    groupAvatar VARCHAR(32),
    private CHAR(1) NOT NULL
);

CREATE TABLE IF NOT EXISTS groupMembership(
    userID INTEGER NOT NULL,
    groupID INTEGER NOT NULL,
    groupRank CHAR(1) NOT NULL,
    dateJoined DATE,
    favourite CHAR(1) NOT NULL,
    PRIMARY KEY (userID, groupID),
    FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE,
    FOREIGN KEY (groupID) REFERENCES groups(groupID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groupImageMembership(
    groupID INTEGER NOT NULL,
    uploadID INTEGER NOT NULL,
    dateAdded DATE,
    PRIMARY KEY (groupID, uploadID),
    FOREIGN KEY (uploadID) REFERENCES upload(uploadID) ON DELETE CASCADE,
    FOREIGN KEY (groupID) REFERENCES groups(groupID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS upload( 
    uploadID INTEGER PRIMARY KEY AUTO_INCREMENT,
    userID INTEGER NOT NULL,
    licenseType VARCHAR(150) NOT NULL,
    datePosted DATE,
    caption VARCHAR(500) NOT NULL,
    fName VARCHAR(64) NOT NULL,
    FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS uploadComments(
    commentID INTEGER PRIMARY KEY AUTO_INCREMENT,
    userID INTEGER NOT NULL,
    uploadID INTEGER NOT NULL,
    datePosted DATE,
    commentContent VARCHAR(500) NOT NULL,
    FOREIGN KEY (uploadID) REFERENCES upload(uploadID) ON DELETE CASCADE,
    FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE
);