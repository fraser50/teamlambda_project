This is the private repository for the Team Lambda group project. All code should go here.
NOTE: README not finished!

# Setup
The first step for setting up the website is installing NodeJS and MariaDB.

After these are installed, a database should be created and environment variables should be set to tell the server the database details.
The easiest way of setting this up is creating a .env file with contents similar to the below:
MYSQL_HOST=127.0.0.1
MYSQL_USER=test
MYSQL_PASS=1234
MYSQL_DB=lambdadb

You will also need to run db.sql on the database. (TODO: Make this automatic)

To install all modules needed to run the server, CD into the teamlambda_project diretory and run "npm install"
After this completes, the server can be run using "node server.js"

The server runs on port 8080 and can be accessed from a browser using the address: http://127.0.0.1:8080
NOTE: When signing up, the email address should end in "@hw.ac.uk".