var express = require('express');
var router = express.Router();

router.get('/', (req, res) => {
  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[GET /profile]', err);
      return res.write('Internal Server Error');
    }

    connection.query('SELECT * FROM profile',function (err, rows) {
      connection.release();

      if (err) {
        console.error('[GET /profile]', err);
        return res.write('Internal Server Error');
      }

      res.render('admin/profile', {user: req.user, profiles: rows});
    });
  });
});

router.post('/', (req, res) => {
  if (req.user.type != 1 || !req.body)
    return res.status(403).write('Access Denied');

  var data = {
    name: req.body.name,
    result: req.body.result,
    procedure: req.body.procedure
  };

  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[POST /profile]', err);
      return res.json({ error: '处理时发生错误' });
    }

    if (req.body.id != '0') {
      connection.query('UPDATE profile SET ? WHERE id = ?', [data, req.body.id], function (err, rows) {
        connection.release();

        if (err) {
          console.error('[POST /profile]', err);
          return res.json({ error: '处理时发生错误' });
        }

        res.json({})
      });
    } else {
      connection.query('INSERT INTO profile SET ?', data, function (err, rows) {
        connection.release();

        if (err) {
          console.error('[POST /profile]', err);
          return res.json({ error: '处理时发生错误' });
        }

        res.json({})
      });
    }
  });
});

module.exports = router;