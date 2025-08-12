Gestionale Scolastico — Full MVP
================================

Contenuto
--------
- backend/ : server Express + SQLite. Serve anche la pagina frontend statica in backend/public.
- Default admin: admin@scuola.local / admin123

Quickstart locale
-----------------
1. Entra nella cartella backend:
   cd backend
2. Installa dipendenze:
   npm install
3. Avvia:
   npm start
4. Apri http://localhost:3000

Endpoints principali
--------------------
- POST /api/register_family -> registra un account FAMILY (public)
- POST /api/login -> ricevi token
- POST /api/register -> (ADMIN) crea TEACHER/FAMILY
- GET /api/students, POST /api/students, GET /api/students/:id
- POST /api/grades, GET /api/students/:id/grades
- GET/POST /api/announcements
- POST /api/families/link -> (ADMIN) collega family a student
- GET /api/family/students -> (FAMILY) lista studenti collegati

Deploy (consigliato)
--------------------
Opzione rapida via GitHub -> Railway (backend):
1. Crea un repo su GitHub e push.
2. Su Railway scegli 'Deploy from GitHub repo' e collega il repo.
3. Setta env var in Railway:
   - JWT_SECRET (stringa segreta)
Railway fornirà un URL pubblico: https://<tuo-progetto>.up.railway.app

Nota sulla produzione
---------------------
Per produzione usa PostgreSQL, HTTPS e backup. Questo progetto è un MVP per iniziare velocemente.