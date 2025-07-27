const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);


const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', 
  database: 'tracking_app'
});


db.connect(err => {
  if (err) {
    console.error('CANNOT CONNECTION MySQL', err);
    return;
  }
  console.log(' CONNECTION MySQL');
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));


app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.query(
    'SELECT * FROM users WHERE username=? AND password=?',
    [username, password],
    (err, results) => {
      if (err) return res.sendStatus(500);
      if (results.length > 0) {
        res.json({ success: true, token: 'dummy-token' });
      } else {
        res.json({ success: false });
      }
    }
  );
});

app.post('/add-child', (req, res) => {
  const { name, age } = req.body;
  db.query(
    'INSERT INTO children (name, age) VALUES (?, ?)',
    [name, age],
    err => {
      if (err) return res.sendStatus(500);
      res.json({ success: true });
    }
  );
});


app.get('/children', (req, res) => {
  db.query('SELECT * FROM children', (err, results) => {
    if (err) return res.sendStatus(500);
    res.json(results);
  });
});


app.post('/update-location', (req, res) => {
  const { child_id, lat, lng } = req.body;

  
  if (!child_id || !lat || !lng) {
    return res.status(400).json({ error: 'الرجاء إرسال جميع البيانات المطلوبة: child_id, lat, lng' });
  }

  
  db.query(
    'INSERT INTO locations (child_id, latitude, longitude) VALUES (?, ?, ?)',
    [child_id, lat, lng],
    (err) => {
      if (err) {
        console.error(' ERROR SAVE LOCATION', err); 
        return res.status(500).json({ error: 'FIALD SAVE LOCATION' });
      }

      
      io.emit('locationUpdate', { child_id, lat, lng });

      
      io.emit('locationNotification', {
        message: `تم تحديث موقع الطفل: Lat ${lat}, Lng ${lng}`
      });

      
      res.status(200).json({ success: true });
    }
  );
});


app.get('/latest-location/:childId', (req, res) => {
  const childId = req.params.childId;
  db.query(
    'SELECT latitude AS lat, longitude AS lng FROM locations WHERE child_id = ? ORDER BY timestamp DESC LIMIT 1',
    [childId],
    (err, results) => {
      if (err) return res.sendStatus(500);
      if (results.length > 0) {
        res.json(results[0]);
      } else {
        res.json({});
      }
    }
  );
});


app.get('/location-history/:childId/:date', (req, res) => {
  const { childId, date } = req.params;
  db.query(
    'SELECT latitude AS lat, longitude AS lng, timestamp FROM locations WHERE child_id = ? AND DATE(timestamp) = ? ORDER BY timestamp ASC',
    [childId, date],
    (err, results) => {
      if (err) return res.sendStatus(500);
      res.json(results);
    }
  );
});


app.post('/register', (req, res) => {
  const { username, password } = req.body;
  db.query(
    'SELECT * FROM users WHERE username = ?',
    [username],
    (err, results) => {
      if (err) return res.sendStatus(500);

      if (results.length > 0) {
        return res.json({ success: false, message: 'المستخدم موجود بالفعل' });
      }

      
      db.query(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, password],
        (err) => {
          if (err) return res.sendStatus(500);
          res.json({ success: true });
        }
      );
    }
  );
});


server.listen(3000, '0.0.0.0', () => {
  console.log('SERVER RUNING ON http://0.0.0.0:3000');
});
