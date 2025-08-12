// server.js (Postgres-ready, legge DATABASE_URL)
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

if (!DB_URL) console.warn('Warning: DATABASE_URL not set. The server will fail to connect.');

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Run seed SQL if DB empty
async function seedIfEmpty(sqlPath){
  try {
    const check = await pool.query("SELECT to_regclass('public.users') AS exists;");
    if (check.rows[0] && check.rows[0].exists) {
      const cnt = await pool.query('SELECT COUNT(*)::int AS c FROM users;');
      if (cnt.rows[0].c > 0) { console.log('DB already seeded.'); return; }
    }
  } catch(e){
    console.log('Seed check failed (probably no tables yet). Will try to run seed.');
  }
  if (!fs.existsSync(sqlPath)) { console.log('Seed file missing:', sqlPath); return; }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Running seed SQL...');
  try { await pool.query(sql); console.log('Seed done.'); }
  catch(err){ console.error('Seed error:', err.message); }
}

(async ()=>{
  try {
    await pool.connect();
    console.log('Connected to Postgres');
    const candidates = [path.join(__dirname,'init_postgres_full.sql'), path.join(__dirname,'db','init_postgres_full.sql')];
    for (const p of candidates) if (fs.existsSync(p)) { await seedIfEmpty(p); break; }
  } catch(e){ console.error('DB connection error:', e.message); }
})();

// Auth (demo: plaintext passwords from seed)
app.post('/api/login', async (req,res)=>{
  const { username, password } = req.body;
  if(!username||!password) return res.status(400).json({ error:'username & password required' });
  try{
    const r = await pool.query('SELECT id,username,password,role,name FROM users WHERE username=$1 LIMIT 1',[username]);
    if (!r.rows.length) return res.status(401).json({ error:'Invalid credentials' });
    const user = r.rows[0];
    // demo: plaintext compare (seed uses plaintext). In production usare bcrypt.
    if (password !== user.password) return res.status(401).json({ error:'Invalid credentials' });
    const token = jwt.sign({ id:user.id, username:user.username, role:user.role, name:user.name }, JWT_SECRET, { expiresIn:'12h' });
    res.json({ token, user:{ id:user.id, username:user.username, role:user.role, name:user.name } });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

function auth(req,res,next){
  const h = req.headers.authorization;
  if(!h) return res.status(401).json({ error:'No token' });
  const token = h.split(' ')[1];
  try{ req.user = jwt.verify(token, JWT_SECRET); next(); } catch(e){ res.status(401).json({ error:'Invalid token' }); }
}

// Basic endpoints (students, summary, announcements)
app.get('/api/students', auth, async (req,res)=>{
  try{ const r = await pool.query('SELECT * FROM students ORDER BY class, last_name, first_name'); res.json(r.rows); }
  catch(e){ res.status(500).json({ error: e.message }); }
});

app.get('/api/students/:id/summary', auth, async (req,res)=>{
  const id = Number(req.params.id);
  try{
    const st = await pool.query('SELECT * FROM students WHERE id=$1',[id]);
    if(!st.rows.length) return res.status(404).json({ error:'Student not found' });
    const grades = await pool.query('SELECT * FROM grades WHERE student_id=$1 ORDER BY date DESC',[id]);
    const perSubject = await pool.query('SELECT subject, ROUND(AVG(score)::numeric,2) as avg, COUNT(*) as count FROM grades WHERE student_id=$1 GROUP BY subject',[id]);
    const overall = (await pool.query('SELECT ROUND(AVG(score)::numeric,2) as overall FROM grades WHERE student_id=$1',[id])).rows[0].overall;
    res.json({ student: st.rows[0], grades: grades.rows, perSubject: perSubject.rows, overall });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

app.get('/api/announcements', auth, async (req,res)=>{ try{ const r = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC'); res.json(r.rows); }catch(e){ res.status(500).json({ error: e.message }); }});
app.post('/api/announcements', auth, async (req,res)=>{ try{ const { title, text, class:cls } = req.body; const r = await pool.query('INSERT INTO announcements (title,text,class) VALUES ($1,$2,$3) RETURNING *',[title,text,cls]); res.json(r.rows[0]); }catch(e){ res.status(500).json({ error: e.message }); }});

// Email to parent (Gmail example)
app.post('/api/students/:id/send-email', auth, async (req,res)=>{
  const id = Number(req.params.id);
  const { subject, message } = req.body;
  try{
    const st = await pool.query('SELECT * FROM students WHERE id=$1',[id]);
    if(!st.rows.length) return res.status(404).json({ error:'Student not found' });
    const student = st.rows[0];
    if(!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return res.status(500).json({ error:'Email not configured' });
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
      secure: true,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    const info = await transporter.sendMail({ from: `"Scuola" <${process.env.EMAIL_USER}>`, to: student.parent_email, subject: subject||'Comunicazione scuola', text: message||'' });
    res.json({ success:true, info: info.response });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, ()=> console.log(`Server listening on ${PORT}`));
// server.js (Postgres-ready, legge DATABASE_URL)
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

if (!DB_URL) console.warn('Warning: DATABASE_URL not set. The server will fail to connect.');

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Run seed SQL if DB empty
async function seedIfEmpty(sqlPath){
  try {
    const check = await pool.query("SELECT to_regclass('public.users') AS exists;");
    if (check.rows[0] && check.rows[0].exists) {
      const cnt = await pool.query('SELECT COUNT(*)::int AS c FROM users;');
      if (cnt.rows[0].c > 0) { console.log('DB already seeded.'); return; }
    }
  } catch(e){
    console.log('Seed check failed (probably no tables yet). Will try to run seed.');
  }
  if (!fs.existsSync(sqlPath)) { console.log('Seed file missing:', sqlPath); return; }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Running seed SQL...');
  try { await pool.query(sql); console.log('Seed done.'); }
  catch(err){ console.error('Seed error:', err.message); }
}

(async ()=>{
  try {
    await pool.connect();
    console.log('Connected to Postgres');
    const candidates = [path.join(__dirname,'init_postgres_full.sql'), path.join(__dirname,'db','init_postgres_full.sql')];
    for (const p of candidates) if (fs.existsSync(p)) { await seedIfEmpty(p); break; }
  } catch(e){ console.error('DB connection error:', e.message); }
})();

// Auth (demo: plaintext passwords from seed)
app.post('/api/login', async (req,res)=>{
  const { username, password } = req.body;
  if(!username||!password) return res.status(400).json({ error:'username & password required' });
  try{
    const r = await pool.query('SELECT id,username,password,role,name FROM users WHERE username=$1 LIMIT 1',[username]);
    if (!r.rows.length) return res.status(401).json({ error:'Invalid credentials' });
    const user = r.rows[0];
    // demo: plaintext compare (seed uses plaintext). In production usare bcrypt.
    if (password !== user.password) return res.status(401).json({ error:'Invalid credentials' });
    const token = jwt.sign({ id:user.id, username:user.username, role:user.role, name:user.name }, JWT_SECRET, { expiresIn:'12h' });
    res.json({ token, user:{ id:user.id, username:user.username, role:user.role, name:user.name } });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

function auth(req,res,next){
  const h = req.headers.authorization;
  if(!h) return res.status(401).json({ error:'No token' });
  const token = h.split(' ')[1];
  try{ req.user = jwt.verify(token, JWT_SECRET); next(); } catch(e){ res.status(401).json({ error:'Invalid token' }); }
}

// Basic endpoints (students, summary, announcements)
app.get('/api/students', auth, async (req,res)=>{
  try{ const r = await pool.query('SELECT * FROM students ORDER BY class, last_name, first_name'); res.json(r.rows); }
  catch(e){ res.status(500).json({ error: e.message }); }
});

app.get('/api/students/:id/summary', auth, async (req,res)=>{
  const id = Number(req.params.id);
  try{
    const st = await pool.query('SELECT * FROM students WHERE id=$1',[id]);
    if(!st.rows.length) return res.status(404).json({ error:'Student not found' });
    const grades = await pool.query('SELECT * FROM grades WHERE student_id=$1 ORDER BY date DESC',[id]);
    const perSubject = await pool.query('SELECT subject, ROUND(AVG(score)::numeric,2) as avg, COUNT(*) as count FROM grades WHERE student_id=$1 GROUP BY subject',[id]);
    const overall = (await pool.query('SELECT ROUND(AVG(score)::numeric,2) as overall FROM grades WHERE student_id=$1',[id])).rows[0].overall;
    res.json({ student: st.rows[0], grades: grades.rows, perSubject: perSubject.rows, overall });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

app.get('/api/announcements', auth, async (req,res)=>{ try{ const r = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC'); res.json(r.rows); }catch(e){ res.status(500).json({ error: e.message }); }});
app.post('/api/announcements', auth, async (req,res)=>{ try{ const { title, text, class:cls } = req.body; const r = await pool.query('INSERT INTO announcements (title,text,class) VALUES ($1,$2,$3) RETURNING *',[title,text,cls]); res.json(r.rows[0]); }catch(e){ res.status(500).json({ error: e.message }); }});

// Email to parent (Gmail example)
app.post('/api/students/:id/send-email', auth, async (req,res)=>{
  const id = Number(req.params.id);
  const { subject, message } = req.body;
  try{
    const st = await pool.query('SELECT * FROM students WHERE id=$1',[id]);
    if(!st.rows.length) return res.status(404).json({ error:'Student not found' });
    const student = st.rows[0];
    if(!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return res.status(500).json({ error:'Email not configured' });
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
      secure: true,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    const info = await transporter.sendMail({ from: `"Scuola" <${process.env.EMAIL_USER}>`, to: student.parent_email, subject: subject||'Comunicazione scuola', text: message||'' });
    res.json({ success:true, info: info.response });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, ()=> console.log(`Server listening on ${PORT}`));
