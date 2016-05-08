var express = require('express');
var router = express.Router();

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

router.get('/', (req, res) => {
  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[GET /history]', err);
      return res.write('Internal Server Error');
    }

    connection.query('SELECT * FROM live',function (err, rows) {
      connection.release();

      if (err) {
        console.error('[GET /history]', err);
        return res.write('Internal Server Error');
      }

      res.render('admin/history', {user: req.user, lives: rows, dateFormat});
    });
  });
});

router.get('/confirm', (req, res) => {
  res.render('admin/history_confirm');
});

router.post('/', (req, res) => {
  var id = 0;
  if (req.body && req.body.id)
    id = parseInt(req.body.id);
  if (isNaN(id))
    id = 0;

  if (id == 0) {
    return res.json({ error: "请求的内容不存在" });
  }

  pool.getConnection(function(err, connection) {
    if (err) {
      console.error('[POST /history]', err);
      return res.json({ error: "Internal Server Error" });
    }

    console.log('[history] Loading ', id);
    connection.query('SELECT * FROM live WHERE id = ?', id,function (err, lives) {
      if (err) {
        connection.release();
        console.error('[POST /history]', err);
        return res.json({ error: "Internal Server Error" });
      }

      if (lives.length != 1)
        return res.json({ error: "请求的内容不存在" });

      var live = lives[0], scoreList = [];
      var i, j, k;

      console.log('[history] Parsing live setting');
      if (typeof live.setting != 'object') {
        try {
          live.setting = JSON.parse(live.setting);
        }
        catch (e) {
          console.error('[GET /history]', e);
          return res.json({ error: "解析设置时出错" });
        }
      }

      scoreList[0] = {
        live: {
          id: live.id,
          finished: live.finished,
          timestamp: live.timestamp,
          name: live.setting.name,
          procedure: live.setting.procedure,
          result: live.setting.result
        },
        player: [],
        voter: []
      };
      // 生成评分数组
      for (i = 1; i <= live.setting.procedure.length; i++) {
        scoreList[i] = [];
        for (j = 0; j < live.setting.player.length; j++) {
          scoreList[i][j] = {
            id: live.setting.player[j],
            index: j,
            score: [],
            extra: 0,
            result: -1
          };

          if (i == 0) {
            for (k = 0; k < live.setting.procedure.length; k++) {
              scoreList[i][j].score[k] = -1;
            }
          } else {
            for (k = 0; k < live.setting.voter.length; k++) {
              scoreList[i][j].score[k] = -1;
            }
          }
        }
      }

      console.log('[history] Loading player');
      connection.query('SELECT * FROM player WHERE id in (?)', [live.setting.player], (err, players) => {
        if (err) {
          connection.release();
          console.error('[POST /history]', err);
          return res.json({ error: "Internal Server Error" });
        }

        console.log('[history] Loaded player', players.length, '/', live.setting.player.length);
        var i, index;
        for (i = 0; i < live.setting.player.length; i++) {
          index = indexInArray(players, live.setting.player[i], 'id');
          if (index == -1) {
            scoreList[0].player[i] = {
              no: '不存在的选手',
              name: '不存在的选手',
              school: '不存在的选手',
              photo: '/notfound.jpg',
              id: live.setting.player[i]
            };
            console.log('[history] Unknown player id', live.setting.player[i]);
          } else {
            scoreList[0].player[i] = players[index];
          }
        }

        console.log('[history] Loading voter');
        connection.query('SELECT * FROM user WHERE id in (?)', [live.setting.voter], (err, voters) => {
          if (err) {
            connection.release();
            console.error('[POST /history]', err);
            return res.json({ error: "Internal Server Error" });
          }

          console.log('[history] Loaded voter', voters.length, '/', live.setting.voter.length);
          var i, index;
          for (i = 0; i < live.setting.voter.length; i++) {
            index = indexInArray(voters, live.setting.voter[i], 'id');
            if (index == -1) {
              scoreList[0].voter[i] = {
                username: '不存在的评委',
                nickname: '不存在的评委',
                id: live.setting.voter[i]
              };
              console.log('[history] Unknown voter id', live.setting.voter[i]);
            } else {
              scoreList[0].voter[i] = {
                username: voters[index].username,
                nickname: voters[index].nickname,
                id: voters[index].id
              };
            }
          }

          console.log('[history] Loading history');
          connection.query('SELECT * FROM vote_log WHERE live = ? ORDER BY id DESC', [id], (err, rows) => {
            connection.release();

            if (err) {
              console.error('[POST /history]', err);
              return res.json({ error: "Internal Server Error" });
            }

            console.log('[history] Loaded history', rows.length);
            for (i = 0; i < rows.length; i++) {
              var score = parseFloat(rows[i].score);
              var step = parseInt(rows[i].step);
              if (isNaN(score) || isNaN(step))
                continue;

              if (step < 0 || step >= live.setting.procedure.length)
                continue;

              // 评分数组从 1 开始，故将 step 递增
              step++;

              var playerIndex = indexInArray(live.setting.player, rows[i].player);
              if (playerIndex < 0)
                continue;

              if (rows[i].voter == 0) {
                scoreList[step][playerIndex].result = score;
              } else if (rows[i].voter == -1) {
                scoreList[step][playerIndex].extra = score;
              } else {
                var voterIndex = indexInArray(live.setting.voter, rows[i].voter);

                if (voterIndex < 0)
                  continue;

                /* 在不发回重评的情况下不允许再次评分 */
                // 备注：导入评分时，从后往前导入，故会保留最后一次评分
                if (scoreList[step][playerIndex].score[voterIndex] != -1)
                  continue;

                scoreList[step][playerIndex].score[voterIndex] = score;
              }
            }

            res.json(scoreList);
          });
        });
      });
    });
  });
});
module.exports = router;
