var express = require('express');
var WebSocket = require('faye-websocket');
var liveObj = require('../live');

var router = express.Router();

var livePlay = [];
var removePlay = function (id) {
  console.log('Calling removePlay', id);
  var index = indexInArray(livePlay, id, 'id');
  if (index >= 0) {
    livePlay[index] = null;
    livePlay.splice(index, 1);
  }
};

router.get('/', (req, res) => {
  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[GET /live]', err);
      return res.write('Internal Server Error');
    }

    connection.query('SELECT * FROM live',function (err, rows) {
      connection.release();

      if (err) {
        console.error('[GET /live]', err);
        return res.write('Internal Server Error');
      }

      res.render('admin/live', {user: req.user, livePlay, lives: rows, dateFormat});
    });
  });
});
router.get('/control', (req, res) => {
  if (livePlay.length == 0)
    return res.redirect('/live');

  if (!req.query || !req.query.id)
    return res.redirect('/live');

  res.render('admin/live_control', {user: req.user, id: req.query.id});
});
router.get('/display', (req, res) => {
  if (livePlay.length == 0)
    return res.redirect('/live');

  if (!req.query || !req.query.id)
    return res.redirect('/live');

  res.render('admin/live_display', {user: req.user, id: req.query.id});
});
router.get('/display_control', (req, res) => {
  if (livePlay.length == 0)
    return res.redirect('/live');

  res.render('admin/live_display_control', {user: req.user});
});
router.get('/setup', (req, res) => {
  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[GET /live/setup]', err);
      return res.write('Internal Server Error');
    }

    connection.query('SELECT * FROM user WHERE type = 2',function (err, voters) {
      if (err) {
        connection.release();
        console.error('[GET /live/setup]', err);
        return res.write('Internal Server Error');
      }

      connection.query('SELECT * FROM player',function (err, players) {
        if (err) {
          connection.release();
          console.error('[GET /live/setup]', err);
          return res.write('Internal Server Error');
        }

        connection.query('SELECT * FROM profile',function (err, profiles) {
          connection.release();

          if (err) {
            console.error('[GET /live/setup]', err);
            return res.write('Internal Server Error');
          }

          res.render('admin/live_setup', {user: req.user, voters, players, profiles});
        });
      });
    });
  });
});
router.post('/setup', (req, res) => {
  if (req.user.type != 1 || !req.body)
    return res.status(403).write('Access Denied');

  if (req.body.id) {
    if (indexInArray(livePlay, req.body.id, 'id') >= 0)
      return res.json({id: req.body.id});

    pool.getConnection(function (err, connection) {
      if (err) {
        console.error('[POST /live/setup]', err);
        return res.json({error: '处理时发生错误'});
      }

      connection.query('SELECT * FROM live WHERE id = ?', req.body.id, function (err, rows) {
        connection.release();

        if (err) {
          console.error('[POST /live/setup]', err);
          return res.json({error: '处理时发生错误'});
        }

        if (rows.length != 1) {
          return res.json({error: '请求的内容不存在'})
        }

        new liveObj(rows[0], function (err, live) {
          if (err) {
            console.error('[POST /live/setup]', err);
            return res.json({error: '处理时发生错误'});
          }

          livePlay.push(live);
          live.ondispose = function () {
            removePlay(live.id);
          };
          res.json({id: rows[0].id});
        });
      });
    });
  } else if (req.body.setting) {
    try {
      var _setting = JSON.parse(req.body.setting);
    }
    catch (e) {
      return res.json({error: '提供的内容不合法'});
    }

    pool.getConnection(function (err, connection) {
      if (err) {
        console.error('[POST /live/setup]', err);
        return res.json({error: '处理时发生错误'});
      }

      var setting = {
        setting: req.body.setting,
        finished: 0,
        timestamp: Math.floor(Date.now() / 1000)
      };
      connection.query('INSERT INTO live SET ?', setting, function (err, rows) {
        connection.release();

        if (err) {
          console.error('[POST /live/setup]', err);
          return res.json({error: '处理时发生错误'});
        }

        setting.id = rows.insertId;
        setting.new = 1;
        new liveObj(setting, function (err, live) {
          if (err) {
            console.error('[POST /live/setup]', err);
            return res.json({error: '处理时发生错误'});
          }

          livePlay.push(live);
          live.ondispose = function () {
            removePlay(live.id);
          };
          res.json({id: rows.insertId});
        });
      });
    });
  } else {
    return res.json({error: '提供的内容不合法'});
  }
});

var indexInArray = function (arr, item, key) {
  var i;
  if (key) {
    for (i = 0; i < arr.length; i++) {
      if (arr[i][key] == item) return i;
    }
  } else {
    for (i = 0; i < arr.length; i++) {
      if (arr[i] == item) return i;
    }
  }
  return -1;
};

var wsAuthUser = function (request, ws, data) {
  var arr = data.substr(1).split('|');
  if (arr.length == 2) {
    pool.getConnection(function(err, connection) {
      if (err) return ws.close(1007, '数据连接异常');

      connection.query('SELECT * FROM user WHERE id = ?', [arr[0]], function(err, rows) {
        connection.release();
        if (!ws) return;
        if (err) return ws.close(1007, '数据连接异常');

        if (rows.length == 1 && rows[0].token == arr[1]) {
          if (rows[0].type != 1 && rows[0].type != 2) { // allow only manager and voter
            return ws.close(1007, '数据连接异常');
          }
          console.log(request.connection.remoteAddress, 'WS VERIFIED (Type: ', rows[0].type, ')', rows[0].id);

          ws.userType = rows[0].type;
          ws.userName = rows[0].username;
          ws.nickName = rows[0].nickname;
          ws.userId = rows[0].id;
          ws.device = ws.userType == 2 ? rows[0].password : '';

          var liveList = [{
            username: ws.userName,
            nickname: ws.nickName
          }];
          for (var i = 0; i < livePlay.length; i++) {
            liveList[i+1] = {
              id: livePlay[i].id,
              name: livePlay[i].livePlay.setting.name
            }
          }
          // 发送登录成功提示
          ws.send('A' + JSON.stringify(liveList));

          setTimeout(function () {
            if (ws && !ws.handler && !ws.closed) {
              ws.close(4102, '未在规定的时间内完成认证');
            }
          }, 20000);
        } else {
          ws.close(4101, '凭证已失效');
        }
      });
    });
  } else {
    ws.close(4109, '凭证格式错误');
  }
};

var webSocket = function(request, socket, body) {
  if (WebSocket.isWebSocket(request)) {
    var ws = new WebSocket(request, socket, body);
    ws.id = Date.now() + Math.random();
    setTimeout(function () {
      if (ws && !ws.userId && !ws.closed) {
        ws.close(4102, '未在规定的时间内完成认证');
      }
    }, 5000);
    console.log(request.connection.remoteAddress, 'WS CONNECT');
    /*
      0 Keep Alive
      * 提示信息
      A 鉴权（上行）
      B 比赛信息（下行）
      C 流程控制（下行）
      D 评分（上行）
      E 评分批量数据（下行）
      F 评委连接状况（下行）
      G 选手信息（下行）
      H 评分重置（上行）
      */
    ws.on('message', function(event) {
      if (!ws) return;
      if (livePlay.length == 0) {
        return ws.close(4001, '没有正在进行的比赛');
      }

      var dataType = event.data.charAt(0), arr;

      if (!ws.userType) {
        if (dataType != 'A') {
          ws.close(1007, 'Unsupported Data')
        } else {
          wsAuthUser(request, ws, event.data);
        }
      } else {
        if (dataType == '0')
          return ws.send(event.data);

        if (ws.handler) {
          try {
            ws.handler(ws, dataType, event.data);
          }
          catch (e) {
            console.error('Error happened handling messages: ', e.message, e.stack);
          }
        } else {
          if (dataType == '@') {
            arr = event.data.substr(1).split('|');
            var id = arr[0], index = indexInArray(livePlay, id, 'id');
            if (index < 0)
              return ws.close(4004, '指定的比赛不存在');
            else {
              if (ws.userType == 1 && arr[1] == 3) {
                // Manager connecting as displayer
                ws.userType = 3;
              }
              livePlay[index].attachClient(ws);
            }
          } else {
            ws.close(1007, 'Unsupported Data');
          }
        }
      }
    });

    ws.on('close', function(event) {
      console.log(request.connection.remoteAddress, 'WS CLOSE', event.code, event.reason);
      ws.closed = true;
      try {
        if (ws.detach)
          ws.detach(ws);
      }
      catch (e) {
        console.error('Error happened detaching ws', e.message, e.stack)
      }

      ws = null;
    });
  }
};

module.exports = {
  router,
  webSocket
};