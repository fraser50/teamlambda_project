/*
This file will be used for creating all the tables and foreign keys needed by the website.

TODO:
  - Add foreign keys
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
    admin CHAR(1) NOT NULL,
    avatar VARCHAR(32)
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
    PRIMARY KEY (userID, groupID)
);