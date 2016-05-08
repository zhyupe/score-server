var express = require('express');
var router = express.Router();

router.get('/', (req, res) => {
  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[GET /user]', err);
      return res.write('Internal Server Error');
    }

    connection.query('SELECT * FROM user',function (err, rows) {
      connection.release();

      if (err) {
        console.error('[GET /user]', err);
        return res.write('Internal Server Error');
      }

      res.render('admin/user', {user: req.user, users: rows});
    });
  });
});

router.post('/', (req, res) => {
  if (req.user.type != 1 || !req.body)
    return res.status(403).write('Access Denied');

  var data = {
    username: req.body.username,
    nickname: req.body.nickname,
    type: req.body.type
  };

  if (data.type != 2 && req.body.password) {
    data.salt = randString(16);
    data.password = SHA256(data.salt + '><' + SHA256(req.body.password).toString() + '>/<' + data.salt).toString();
    data.token = randString(64);
  }

  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[POST /user]', err);
      return res.json({ error: '处理时发生错误' });
    }

    if (req.body.id) {
      if (req.user.id == req.body.id && data.type != 1) {
        return res.json({ error: '不允许修改当前用户的用户类型' });
      }

      if (data.type == 2) {
        data.salt = '';
      }

      connection.query('UPDATE user SET ? WHERE id = ?', [data, req.body.id], function (err, rows) {
        connection.release();

        if (err) {
          console.error('[POST /user]', err);
          return res.json({ error: '处理时发生错误' });
        }

        res.json({})
      });
    } else {
      if (!data.token) data.token = randString(64);
      if (!data.password) data.password = '';
      if (!data.salt) data.salt = '';

      connection.query('INSERT INTO user SET ?', data, function (err, rows) {
        connection.release();

        if (err) {
          console.error('[POST /user]', err);
          return res.json({ error: '处理时发生错误' });
        }

        res.json({})
      });
    }
  });
});

router.post('/delete', (req, res) => {
  if (req.user.type != 1 || !req.body || !req.body.id)
    return res.status(403).write('Access Denied');

  if (req.user.id == req.body.id) {
    return res.json({ error: '不允许删除当前用户' });
  }

  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[POST /user/delete]', err);
      return res.json({error: '处理时发生错误'});
    }

    connection.query('DELETE FROM user WHERE id = ?', req.body.id, function (err, rows) {
      connection.release();

      if (err) {
        console.error('[POST /user/delete]', err);
        return res.json({error: '处理时发生错误'});
      }

      res.json({});
    });
  });
});

module.exports = router;