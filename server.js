const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_FILE = process.env.DB_FILE || './data/db.sqlite';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const PORT = process.env.PORT || 3000;

if (!fs.existsSync('./data')) fs.mkdirSync('./data');

const db = new sqlite3.Database(DB_FILE);

function runSql(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function getSql(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
function allSql(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// init tables
const init = async ()=>{
  await runSql(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    name TEXT
  )`);
  await runSql(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT,
    lastName TEXT,
    birthDate TEXT,
    class TEXT
  )`);
  await runSql(`CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    studentId INTEGER,
    relation TEXT
  )`);
  await runSql(`CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId INTEGER,
    teacherId INTEGER,
    subject TEXT,
    type TEXT,
    score REAL,
    date TEXT
  )`);
  await runSql(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    text TEXT,
    class TEXT,
    createdAt TEXT
  )`);
  // default admin
  const admin = await getSql(`SELECT * FROM users WHERE role='ADMIN' LIMIT 1`);
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 8);
    await runSql(`INSERT INTO users (email,password,role,name) VALUES (?,?,?,?)`, ['admin@scuola.local', hash, 'ADMIN', 'Admin']);
    console.log('Created default admin: admin@scuola.local / admin123');
  }
};

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '12h' });
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'No token' });
  const token = h.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// public family signup (creates a FAMILY user)
// used by parents to self-register
app.post('/api/register_family', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const exists = await getSql(`SELECT * FROM users WHERE email = ?`, [email]);
  if (exists) return res.status(400).json({ error: 'Email already registered' });
  const hash = bcrypt.hashSync(password, 8);
  const r = await runSql(`INSERT INTO users (email,password,role,name) VALUES (?,?,?,?)`, [email,hash,'FAMILY',name||email]);
  const user = await getSql(`SELECT id,email,role,name FROM users WHERE id = ?`, [r.lastID]);
  const token = generateToken(user);
  res.json({ user, token });
});

// login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await getSql(`SELECT * FROM users WHERE email = ?`, [email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = generateToken(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

// admin: create teacher/family users
app.post('/api/register', authMiddleware, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const { email, password, role, name } = req.body;
  const hash = bcrypt.hashSync(password, 8);
  try {
    const r = await runSql(`INSERT INTO users (email,password,role,name) VALUES (?,?,?,?)`, [email, hash, role, name]);
    res.json({ id: r.lastID, email, role, name });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// list users (admin)
app.get('/api/users', authMiddleware, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const rows = await allSql(`SELECT id,email,role,name FROM users ORDER BY role`);
  res.json(rows);
});

// Students CRUD (ADMIN/TEACHER)
app.get('/api/students', authMiddleware, async (req, res) => {
  const rows = await allSql(`SELECT * FROM students ORDER BY lastName, firstName`);
  res.json(rows);
});
app.post('/api/students', authMiddleware, async (req, res) => {
  if (!['ADMIN','TEACHER'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const { firstName, lastName, birthDate, class: cls } = req.body;
  const r = await runSql(`INSERT INTO students (firstName,lastName,birthDate,class) VALUES (?,?,?,?)`, [firstName,lastName,birthDate,cls]);
  const student = await getSql(`SELECT * FROM students WHERE id = ?`, [r.lastID]);
  res.json(student);
});
app.get('/api/students/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const s = await getSql(`SELECT * FROM students WHERE id = ?`, [id]);
  if (!s) return res.status(404).end();
  res.json(s);
});
app.put('/api/students/:id', authMiddleware, async (req, res) => {
  if (!['ADMIN','TEACHER'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  const { firstName, lastName, birthDate, class: cls } = req.body;
  await runSql(`UPDATE students SET firstName=?,lastName=?,birthDate=?,class=? WHERE id=?`, [firstName,lastName,birthDate,cls,id]);
  const s = await getSql(`SELECT * FROM students WHERE id = ?`, [id]);
  res.json(s);
});

// Grades
app.post('/api/grades', authMiddleware, async (req, res) => {
  if (!['ADMIN','TEACHER'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const { studentId, subject, type, score } = req.body;
  const r = await runSql(`INSERT INTO grades (studentId,teacherId,subject,type,score,date) VALUES (?,?,?,?,?,?)`, [studentId, req.user.id, subject, type, score, new Date().toISOString()]);
  const g = await getSql(`SELECT * FROM grades WHERE id = ?`, [r.lastID]);
  res.json(g);
});
app.get('/api/students/:id/grades', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const rows = await allSql(`SELECT g.*, u.name as teacherName FROM grades g LEFT JOIN users u ON g.teacherId = u.id WHERE g.studentId = ? ORDER BY date DESC`, [id]);
  res.json(rows);
});

// Announcements
app.get('/api/announcements', authMiddleware, async (req, res) => {
  const rows = await allSql(`SELECT * FROM announcements ORDER BY createdAt DESC`);
  res.json(rows);
});
app.post('/api/announcements', authMiddleware, async (req, res) => {
  if (!['ADMIN','TEACHER'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const { title, text, class: cls } = req.body;
  const r = await runSql(`INSERT INTO announcements (title,text,class,createdAt) VALUES (?,?,?,?)`, [title,text,cls,new Date().toISOString()]);
  const a = await getSql(`SELECT * FROM announcements WHERE id = ?`, [r.lastID]);
  res.json(a);
});

// Family read-only: link families to students
app.get('/api/family/students', authMiddleware, async (req, res) => {
  if (req.user.role !== 'FAMILY') return res.status(403).json({ error: 'Forbidden' });
  const rows = await allSql(`SELECT s.* FROM students s JOIN families f ON f.studentId = s.id WHERE f.userId = ?`, [req.user.id]);
  res.json(rows);
});

// endpoint to link family to student (ADMIN only)
app.post('/api/families/link', authMiddleware, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const { userId, studentId, relation } = req.body;
  const r = await runSql(`INSERT INTO families (userId,studentId,relation) VALUES (?,?,?)`, [userId, studentId, relation]);
  res.json({ id: r.lastID, userId, studentId, relation });
});

// Serve SPA fallback
app.get('*', (req, res) => {
  const p = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(p)) res.sendFile(p);
  else res.status(404).end();
});

init().then(()=>{
  app.listen(PORT, ()=> console.log('Server listening on port', PORT));
}).catch(err=>{
  console.error('Failed to init DB', err);
});