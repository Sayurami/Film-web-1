const express = require('express');
const session = require('express-session');
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

let db, adminsCollection, moviesCollection;
const client = new MongoClient(MONGO_URI);

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db(MONGO_DBNAME);
    adminsCollection = db.collection("admins");
    moviesCollection = db.collection("movies");
    console.log("MongoDB connected!");
  }
}

// ================= EXPRESS CONFIG =================
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'gojo-secret-key-change-this',
  resave: false,
  saveUninitialized: false
}));

function isAdminLoggedIn(req) {
  return req.session && req.session.user && req.session.user.isAdmin;
}

// ================= ROUTES =================

// Home
app.get('/', async (req, res) => {
  await connectDB();
  const movies = await moviesCollection.find().sort({ _id: -1 }).toArray();
  res.render('index', { movies, user: req.session.user || null });
});

// Movie detail
app.get('/movie/:id', async (req, res) => {
  await connectDB();
  const movie = await moviesCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!movie) return res.status(404).send('Movie not found');
  res.render('movie', { movie, user: req.session.user || null });
});

// Admin login
app.get('/admin/login', (req, res) => res.render('admin_login', { error: null }));

app.post('/admin/login', async (req, res) => {
  await connectDB();
  const { username, password } = req.body;
  const admin = await adminsCollection.findOne({ username });
  if (!admin) return res.render('admin_login', { error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, admin.password);
  if (!ok) return res.render('admin_login', { error: 'Invalid credentials' });
  req.session.user = { username: admin.username, isAdmin: true };
  res.redirect('/admin');
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/admin', async (req, res) => {
  await connectDB();
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  const movies = await moviesCollection.find().sort({ _id: -1 }).toArray();
  res.render('admin_index', { movies, user: req.session.user });
});

// Add movie
app.get('/admin/add', (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  res.render('admin_add', { error: null });
});

app.post('/admin/add', async (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  await connectDB();
  const { title, type, year, poster_url, trailer_url, drive_id, description } = req.body;
  await moviesCollection.insertOne({ title, type, year, poster_url, trailer_url, drive_id, description });
  res.redirect('/admin');
});

// Edit movie
app.get('/admin/edit/:id', async (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  await connectDB();
  const movie = await moviesCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!movie) return res.redirect('/admin');
  res.render('admin_edit', { movie, error: null });
});

app.post('/admin/edit/:id', async (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  await connectDB();
  const { title, type, year, poster_url, trailer_url, drive_id, description } = req.body;
  await moviesCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { title, type, year, poster_url, trailer_url, drive_id, description } }
  );
  res.redirect('/admin');
});

// Delete movie
app.get('/admin/delete/:id', async (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin/login');
  await connectDB();
  await moviesCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.redirect('/admin');
});

// ================= EXPORT APP FOR VERCEL =================
module.exports = app;
