const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DB_PATH = path.join(DATA_DIR, 'db.sqlite');
const db = new sqlite3.Database(DB_PATH);

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'gojo-secret-key-change-this',
  resave: false,
  saveUninitialized: false
}));

function isAdminLoggedIn(req) {
  return req.session && req.session.user && req.session.user.isAdmin;
}

// Ensure DB tables exist
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
});

// Home
app.get('/', (req, res) => {
  db.all("SELECT * FROM movies ORDER BY id DESC", (err, movies) => {
    if (err) return res.status(500).send('DB error');
    res.render('index', { movies, user: req.session.user || null });
  });
});

// Movie detail
app.get('/movie/:id', (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM movies WHERE id = ?", [id], (err, movie) => {
    if (err || !movie) return res.status(404).send('Movie not found');
    res.render('movie', { movie, user: req.session.user || null });
  });
});

// Admin login page
app.get('/admin/login', (req, res) => {
  res.render('admin_login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM admins WHERE username = ?", [username], async (err, admin) => {
    if (err || !admin) return res.render('admin_login', { error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.render('admin_login', { error: 'Invalid credentials' });
    req.session.user = { username: admin.username, isAdmin: true };
    res.redirect('/admin');
  });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Admin panel
app.get('/admin', (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  db.all("SELECT * FROM movies ORDER BY id DESC", (err, movies) => {
    res.render('admin_index', { movies, user: req.session.user });
  });
});

app.get('/admin/add', (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  res.render('admin_add', { error: null });
});

app.post('/admin/add', (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  const { title, type, year, poster_url, trailer_url, drive_id, description } = req.body;
  db.run(
    `INSERT INTO movies (title, type, year, poster_url, trailer_url, drive_id, description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, type, year, poster_url, trailer_url, drive_id, description],
    function(err) {
      if (err) return res.render('admin_add', { error: 'DB error' });
      res.redirect('/admin');
    }
  );
});

app.get('/admin/edit/:id', (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  db.get("SELECT * FROM movies WHERE id = ?", [req.params.id], (err, movie) => {
    if (err || !movie) return res.redirect('/admin');
    res.render('admin_edit', { movie, error: null });
  });
});

app.post('/admin/edit/:id', (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  const id = req.params.id;
  const { title, type, year, poster_url, trailer_url, drive_id, description } = req.body;
  db.run(
    `UPDATE movies SET title=?, type=?, year=?, poster_url=?, trailer_url=?, drive_id=?, description=? WHERE id=?`,
    [title, type, year, poster_url, trailer_url, drive_id, description, id],
    function(err) {
      res.redirect('/admin');
    }
  );
});

app.get('/admin/delete/:id', (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  db.run("DELETE FROM movies WHERE id = ?", [req.params.id], (err) => {
    res.redirect('/admin');
  });
});

// start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
