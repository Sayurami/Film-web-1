const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DB_PATH = path.join(DATA_DIR, 'db.sqlite');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    type TEXT,
    year TEXT,
    poster_url TEXT,
    trailer_url TEXT,
    drive_id TEXT,
    description TEXT
  )`);

  const defaultUser = { username: "Sayura", password: "Sayura2008***7" };
  const saltRounds = 10;
  const hash = bcrypt.hashSync(defaultUser.password, saltRounds);

  db.get("SELECT * FROM admins WHERE username = ?", [defaultUser.username], (err, row) => {
    if (!row) {
      db.run("INSERT INTO admins (username, password) VALUES (?, ?)", [defaultUser.username, hash], (e) => {
        if (e) console.error(e);
        else console.log("Inserted default admin");
        db.close();
      });
    } else {
      console.log("Admin already exists");
      db.close();
    }
  });
});
