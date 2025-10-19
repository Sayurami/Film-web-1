// server.js
const express = require('express');
const cookieSession = require('cookie-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

// ===================== MongoDB CONFIG =====================
const MONGO_USERNAME = "mongo";
const MONGO_PASSWORD = "oPUThvVacCFrJGoxlriBbRmtdlyVtlKL";
const MONGO_HOST = "ballast.proxy.rlwy.net";
const MONGO_PORT = "27465";
const MONGO_DBNAME = "film_web";

const MONGO_URI = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}`;

let client;
async function getCollections() {
  if (!client) client = new MongoClient(MONGO_URI);
  if (!client.isConnected?.()) await client.connect();
  const db = client.db(MONGO_DBNAME);
  return {
    adminsCollection: db.collection("admins"),
    moviesCollection: db.collection("movies"),
  };
}

// ================= EXPRESS CONFIG =================
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Use cookie-based session for serverless
app.use(cookieSession({
  name: 'gojo-session',
  keys: ['gojo-secret-key-change-this'],
  maxAge: 24 * 60 * 60 * 1000 // 1 day
}));

function isAdminLoggedIn(req) {
  return req.session && req.session.user && req.session.user.isAdmin;
}

// ================= ROUTES =================

// Home page
app.get('/', async (req, res) => {
  try {
    const { moviesCollection } = await getCollections();
    const movies = await moviesCollection.find().sort({ _id: -1 }).toArray();
    res.render('index', { movies, user: req.session.user || null });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Movie detail
app.get('/movie/:id', async (req, res) => {
  try {
    const { moviesCollection } = await getCollections();
    const movie = await moviesCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!movie) return res.status(404).send('Movie not found');
    res.render('movie', { movie, user: req.session.user || null });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Admin login page
app.get('/admin/login', (req, res) => res.render('admin_login', { error: null }));

app.post('/admin/login', async (req, res) => {
  try {
    const { adminsCollection } = await getCollections();
    const { username, password } = req.body;
    const admin = await adminsCollection.findOne({ username });
    if (!admin) return res.render('admin_login', { error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.render('admin_login', { error: 'Invalid credentials' });

    req.session.user = { username: admin.username, isAdmin: true };
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get('/admin/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

// Admin panel
app.get('/admin', async (req, res) => {
  try {
    if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
    const { moviesCollection } = await getCollections();
    const movies = await moviesCollection.find().sort({ _id: -1 }).toArray();
    res.render('admin_index', { movies, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Add movie
app.get('/admin/add', (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  res.render('admin_add', { error: null });
});

app.post('/admin/add', async (req, res) => {
  try {
    if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
    const { moviesCollection } = await getCollections();
    const { title, type, year, poster_url, trailer_url, drive_id, description } = req.body;
    await moviesCollection.insertOne({ title, type, year, poster_url, trailer_url, drive_id, description });
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Edit movie
app.get('/admin/edit/:id', async (req, res) => {
  try {
    if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
    const { moviesCollection } = await getCollections();
    const movie = await moviesCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!movie) return res.redirect('/admin');
    res.render('admin_edit', { movie, error: null });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.post('/admin/edit/:id', async (req, res) => {
  try {
    if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
    const { moviesCollection } = await getCollections();
    const { title, type, year, poster_url, trailer_url, drive_id, description } = req.body;
    await moviesCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { title, type, year, poster_url, trailer_url, drive_id, description } }
    );
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Delete movie
app.get('/admin/delete/:id', async (req, res) => {
  try {
    if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
    const { moviesCollection } = await getCollections();
    await moviesCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ================= EXPORT APP FOR VERCEL =================
module.exports = app;
