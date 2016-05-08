var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var app = express();
SHA256 = require("crypto-js/sha256");
randString = function (len) {
  len = len || 32;
  var $chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_()[]{}';
  var maxPos = $chars.length;
  var pwd = '';
  for (i = 0; i < len; i++) {
    pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return pwd;
};
dateFormat = function (date, format) {
  if (!format) format = 'yyyy-MM-dd hh:mm:ss';
  date = new Date(date * 1000);

  var map = {
    "M": date.getMonth() + 1, //月份
    "d": date.getDate(), //�?
    "h": date.getHours(), //小时
    "m": date.getMinutes(), //�?
    "s": date.getSeconds(), //�?
    "q": Math.floor((date.getMonth() + 3) / 3), //季度
    "S": date.getMilliseconds() //毫秒
  };
  format = format.replace(/([yMdhmsqS])+/g, function(all, t){
    var v = map[t];
    if(v !== undefined){
      if(all.length > 1){
        v = '0' + v;
        v = v.substr(v.length-2);
      }
      return v;
    }
    else if(t === 'y'){
      return (date.getFullYear() + '').substr(4 - all.length);
    }
    return all;
  });
  return format;
};
var config = require('./config.json');
var mysql = require('mysql');
pool  = mysql.createPool(config.mysql);

app.set('trust proxy', '10.0.0.12');
app.set('view engine', 'jade');
app.set('views', path.join(__dirname, 'views'));

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger(':remote-addr -- :date :method :url HTTP/:http-version :status :res[content-length] - :response-time ms'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser("COOKIE-KEY"));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/login', (req, res) => {
  var isApp = req.query && req.query.app;
  if (isApp) {
    res.header('Access-Control-Allow-Origin',  '*');
  }

  if (!req.body || !req.body.un || !req.body.pw) {
    return res.json({ error: '请将表单填写完整' });
  }

  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[POST /login]', err);
      return res.json({ error: '登录时发生错误' });
    }

    connection.query('SELECT * FROM user WHERE username = ?', [req.body.un], function(err, rows) {
      if (err) {
        connection.release();
        console.error('[POST /login]', err);
        return res.json({ error: '登录时发生错误' });
      }

      if (rows.length == 1 && rows[0].type != 2 &&
          rows[0].password == SHA256(rows[0].salt + '><' + SHA256(req.body.pw).toString() + '>/<' + rows[0].salt).toString()) {
        if (isApp) {
          var user = rows[0];
          connection.query('SELECT id,username,nickname,password FROM user WHERE type = 2', function(err, rows) {
            connection.release();
            if (err) {
              console.error('[POST /login]', err);
              return res.json({ error: '获取凭据列表时发生错误' });
            }

            res.json({
              id: user.id,
              cookie: user.id + '|' + user.token.substr(0, 32),
              token: user.token,
              list: rows
            });
          });
        } else {
          connection.release();

          res.cookie('user', rows[0].id + '|' + rows[0].token.substr(0, 32), { signed: true, httpOnly: true });
          res.json({});
        }
      } else {
        connection.release();
        res.json({ error: '用户名或密码错误' });
      }
    });
  });
});
app.use((req, res, next) => {
  req.user = {
    id: 0,
    type: 0
  };

  var sign = null;
  if (req.signedCookies && req.signedCookies.user) {
    sign = req.signedCookies.user;
  } else if (req.body && req.body.cookie) {
    sign = req.body.cookie;
  }

  if (sign) {
    var arr = sign.split('|');
    if (arr.length == 2) {
      pool.getConnection(function(err, connection) {
        if (err) return next(err);

        connection.query('SELECT * FROM user WHERE id = ?', [arr[0]], function(err, rows) {
          connection.release();

          if (rows.length == 1 && rows[0].token.substr(0, 32) == arr[1]) {
            req.user = rows[0];

            if (req.method != 'GET' && req.method != 'HEAD' && req.method != 'OPTIONS') {
              if ((!req.body || req.body.token != req.user.token) &&
                  (!req.query || req.query.token != req.user.token)) {
                return res.status(403).send('Access Denied');
              }
            }
            next();
          } else {
            res.clearCookie('user');
            res.render('login');
          }
        });
      });
    } else {
      res.clearCookie('user');
      res.render('login');
    }
  } else {
    res.render('login');
  }
});
app.post('/acquire', (req, res) => {
  res.header('Access-Control-Allow-Origin',  '*');

  if (!req.user || req.user.type != 1 || !req.body || !req.body.id || !req.body.device) {
    return res.json({ error: '请求格式错误' });
  }

  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[POST /acquire]', err);
      return res.json({ error: '请求凭证时发生错误' });
    }

    connection.query('SELECT type FROM user WHERE id = ?', [req.body.id], function(err, rows) {
      if (err) {
        connection.release();
        console.error('[POST /acquire]', err);
        return res.json({ error: '请求凭证时发生错误' });
      }

      if (rows.length == 1 && rows[0].type == 2) {
        var token = randString(64);
        connection.query('UPDATE user SET password = ?, token = ? WHERE id = ?', [req.body.device, token, req.body.id], function(err, rows) {
          connection.release();
          if (err) {
            console.error('[POST /acquire]', err);
            return res.json({ error: '请求凭证时发生错误' });
          }

          res.json({
            id: req.body.id,
            token
          })
        });
      } else {
        connection.release();
        return res.json({ error: '无法提供相应的凭证' });
      }
    });
  });
});

app.use('/profile', require('./controllers/profile'));
app.use('/user',    require('./controllers/user'));
app.use('/player',  require('./controllers/player'));
app.use('/history',  require('./controllers/history'));

var liveManager = require('./controllers/live');
app.use('/live', liveManager.router);

app.get('/', (req, res) => {
  res.redirect('/live');
});

app.get('/user/player', (req, res) => {
  res.render('admin/user_player', {user: req.user, view: 'index'});
});

var httpServer = app.listen(7902, () => {
  console.log('Vote server listening on port 7902!');
});

httpServer.on('upgrade', liveManager.webSocket);
