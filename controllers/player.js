var express = require('express');
var multer = require('multer');
var router = express.Router();
var sizeLimit = 4 * 1024 * 1024;
var upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/upload/player')
    },
    filename: function (req, file, cb) {
      var ext = file.originalname.substr(file.originalname.lastIndexOf('.')+1).toLowerCase();
      if (ext == 'jpeg') ext = 'jpg';
      var newName = Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8) + '.' + ext;

      cb(null, newName);
    }
  }),
  fileFilter: function (req, file, cb) {
    if (req.user.type != 1) return cb(null, false);
    if (file.size > sizeLimit) return cb(null, false);
    var ext = file.originalname.substr(file.originalname.lastIndexOf('.')+1).toLowerCase();
    if (ext != 'jpg' && ext != 'jpeg' && ext != 'png') {
      cb(null, false);
    } else {
      cb(null, true);
    }
  }
});

router.get('/', (req, res) => {
  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[GET /player]', err);
      return res.write('Internal Server Error');
    }

    connection.query('SELECT * FROM player',function (err, rows) {
      connection.release();

      if (err) {
        console.error('[GET /player]', err);
        return res.write('Internal Server Error');
      }

      res.render('admin/player', {user: req.user, players: rows});
    });
  });
});

router.post('/', (req, res) => {
  if (req.user.type != 1 || !req.body)
    return res.status(403).write('Access Denied');

  var data = {
    no: req.body.no,
    name: req.body.name,
    school: req.body.school,
    photo: req.body.photo
  };

  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[POST /player]', err);
      return res.json({ error: '处理时发生错误' });
    }

    if (req.body.id) {
      connection.query('UPDATE player SET ? WHERE id = ?', [data, req.body.id], function (err, rows) {
        connection.release();

        if (err) {
          console.error('[POST /player]', err);
          return res.json({ error: '处理时发生错误' });
        }

        res.json({})
      });
    } else {
      data.enabled = 1;
      connection.query('INSERT INTO player SET ?', data, function (err, rows) {
        connection.release();

        if (err) {
          console.error('[POST /player]', err);
          return res.json({ error: '处理时发生错误' });
        }

        res.json({})
      });
    }
  });
});

router.post('/photo', upload.single('avatar'), (req, res) => {
  if (req.user.type != 1)
    return res.status(403).write('Access Denied');

  if (req.file) {
    res.json({ photo: '/upload/player/' + req.file.filename });
  } else {
    res.json({ error: '文件上传失败，可能是不符合要求' })
  }
});

router.post('/delete', (req, res) => {
  if (req.user.type != 1 || !req.body || !req.body.id)
    return res.status(403).write('Access Denied');

  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[POST /player/delete]', err);
      return res.json({error: '处理时发生错误'});
    }

    connection.query('DELETE FROM player WHERE id = ?', req.body.id, function (err, rows) {
      connection.release();

      if (err) {
        console.error('[POST /player/delete]', err);
        return res.json({error: '处理时发生错误'});
      }

      res.json({});
    });
  });
});

router.post('/status', (req, res) => {
  if (req.user.type != 1 || !req.body || !req.body.id)
    return res.status(403).write('Access Denied');

  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[POST /player/status]', err);
      return res.json({error: '处理时发生错误'});
    }

    connection.query('UPDATE player SET enabled = ? WHERE id = ?', [req.body.status == '1' ? 1 : 0, req.body.id], function (err, rows) {
      connection.release();

      if (err) {
        console.error('[POST /player/status]', err);
        return res.json({error: '处理时发生错误'});
      }

      res.json({});
    });
  });
});

module.exports = router;