var helper = require('./public/script/helper');

var Live = function (live, cb) {
  var i,j,k;
  if (typeof live.setting != 'object') {
    try {
      live.setting = JSON.parse(live.setting);
    }
    catch (e) {
      return cb(e);
    }
  }

  this.id = live.id;
  this.ondispose = null;
  this.livePlay = null;
  this.managerSocket = null;
  this.displayerSocket = null;
  this.voterList = [];
  this.voterSocket = [];
  this.votingList = {
    id: [],
    step: -1
  };
  this.playerList = [];
  this.playerToVote = [];
  this.scoreList = [];
  this.ondispose = function () {};

  // 初始化评委列表
  for (i = 0; i < live.setting.voter.length; i++) {
    this.voterList[i] = {
      id: live.setting.voter[i],
      index: i,
      nickname: '-',
      device: 'Unknown',
      status: 0
    };
    this.voterSocket[i] = null;
  }

  // 生成评分数组
  for (i = 0; i < live.setting.procedure.length; i++) {
    this.scoreList[i] = [];

    for (j = 0; j < live.setting.player.length; j++) {
      this.scoreList[i][j] = {
        id: live.setting.player[j],
        result: -1,
        extra: 0
      };

      if (live.setting.procedure[i].type == 1) { // 评分环节
        this.scoreList[i][j].score = [];
        for (k = 0; k < live.setting.voter.length; k++) {
          this.scoreList[i][j].score[k] = -1;
        }
      }
    }
  }

  // 初始化选手列表
  this.loadPlayer(live.setting.player, (err) => {
    if (err) return cb(err);

    // 载入可能存在的历史评分数据
    this.loadHistory(live, (err) => {
      if (err) return cb(err);

      console.log('[live] Step', this.votingList.step);
      if (this.votingList.step == -1) {
        console.log('[live] reset playerToVote due to step -1');
        this.playerToVote.length = 0;
      }

      // 应用比赛设置
      this.livePlay = live;

      cb(null, this);
    });
  });
};

module.exports = Live;

var live = Live.prototype;

live.dispose = function () {
  var i;
  this.livePlay = null;
  this.voterList.length = 0;
  this.votingList.id.length = 0;
  this.votingList.step = -1;
  this.playerList.length = 0;
  this.playerToVote.length = 0;
  this.scoreList.length = 0;

  console.log('[live] Closing connections');
  // 关闭所有评委连接
  for (i = 0; i < this.voterList.length; i++) {
    if (this.voterSocket[i])
      this.voterSocket[i].close(4001, '比赛已结束');
  }

  // 关闭主持人连接
  if (this.managerSocket) {
    this.managerSocket.close(4001, '比赛已结束');
  }

  // 关闭演示人连接
  if (this.displayerSocket) {
    this.displayerSocket.close(4001, '比赛已结束');
  }

  this.managerSocket = null;
  this.displayerSocket = null;
  this.voterSocket.length = 0;

  console.log('[live] Calling callback.');
  if (this.ondispose)
    this.ondispose();
};

live.setScore = function (player, voter, step, score, live) {
  if (!live)
    live = this.livePlay;

  score = parseFloat(score);
  step = parseInt(step);
  if (isNaN(score) || isNaN(step))
    return -1;

  if (step < 0 || step >= live.setting.procedure.length)
    return -1;

  score = Math.round(score * 100) / 100;

  var playerIndex = helper.indexInArray(live.setting.player, player);

  if (playerIndex < 0)
    return -1;

  if (voter == -1) { // 附加分
    this.scoreList[step][playerIndex].extra = score;
  } else {
    if (voter == 0) { // 总分
      this.scoreList[step][playerIndex].result = score;
    } else {
      if (live.setting.procedure[step].type != 1)
        return -1;

      // 评委分
      if (score > 100 || score < 0)
        return -1;

      var voterIndex = helper.indexInArray(live.setting.voter, voter);

      if (voterIndex < 0)
        return -1;

      /* 在不发回重评的情况下不允许再次评分 */
      // 备注：导入评分时，从后往前导入，故会保留最后一次评分
      if (this.scoreList[step][playerIndex].score[voterIndex] != -1)
        return -2;

      this.scoreList[step][playerIndex].score[voterIndex] = score;
    }
  }
  return 1;
};

live.writeScore = function (player, voter, step, score, live) {
  if (!live)
    live = this.livePlay;

  pool.getConnection((err, connection) => {
    console.log('[live] writeScore '+player+', '+voter+', '+step+', '+score);

    if (err) {
      console.error('live::writeScore', err);
      return;
    }

    var setting = {
      live: live.id,
      voter,
      player,
      step,
      score,
      timestamp: Math.round(Date.now() / 1000)
    };

    connection.query('INSERT INTO vote_log SET ?', setting, (err, rows) => {
      connection.release();

      if (err) {
        console.error('live::writeScore', err);
      }
    });
  });
};

live.loadPlayer = function (player, cb) {
  pool.getConnection((err, connection) => {
    if (err) {
      return cb(err);
    }

    connection.query('SELECT * FROM player WHERE id in (?)', [player], (err, rows) => {
      connection.release();

      if (err) {
        return cb(err);
      }

      console.log('[live] Loaded player', rows.length, '/', player.length);
      var i, index;
      for (i = 0; i < player.length; i++) {
        index = helper.indexInArray(rows, player[i], 'id');
        if (index == -1) {
          this.playerList[i] = {
            no: '不存在的选手',
            name: '不存在的选手',
            school: '不存在的选手',
            photo: '/notfound.jpg',
            id: player[i]
          };
          console.log('[live] Unknown player id', player[i]);
        } else {
          this.playerList[i] = rows[index];
        }
        this.playerToVote.push(player[i]);
      }
      console.log('[live] playerToVote count', this.playerToVote.length);

      cb();
    });
  });
};

live.loadHistory = function (live, cb) {
  pool.getConnection((err, connection) => {
    if (err) {
      return cb(err);
    }

    connection.query('SELECT * FROM vote_log WHERE live = ? ORDER BY step DESC,id DESC', [live.id], (err, rows) => {
      connection.release();

      if (err) {
        return cb(err);
      }

      console.log('[live] Loaded score', rows.length);
      var i;
      for (i = 0; i < rows.length; i++) {
        if (rows[i].step > this.votingList.step)
          this.votingList.step = rows[i].step;

        this.setScore(rows[i].player, rows[i].voter, rows[i].step, rows[i].score, live);
        if (rows[i].voter == 0 && this.votingList.step == rows[i].step) {
          var player = helper.indexInArray(this.playerToVote, rows[i].player);
          if (player >= 0) {
            this.playerToVote.splice(player, 1);
          }
        }
      }

      cb();
    });
  });
};

live.attachClient = function (ws) {
  var i,j;
  ws.send('B' + JSON.stringify({
      id: this.livePlay.id,
      name: this.livePlay.setting.name,
      result: this.livePlay.setting.result,
      procedure: this.livePlay.setting.procedure
    }));

  if (ws.userType == 2) {
    var voter = helper.indexInArray(this.livePlay.setting.voter, ws.userId);
    if (voter < 0) {
      return ws.close(4003, '提供的凭证无法连接此比赛')
    }

    if (this.voterSocket[voter]) {
      this.voterSocket[voter].close(4002, '有另一终端使用此凭证连接');
      this.voterSocket[voter] = null;
    }

    this.voterList[voter].nickname = ws.nickName;
    this.voterList[voter].device = ws.device;
    this.voterList[voter].status = 1;

    this.voterSocket[voter] = ws;
    ws.index = voter;

    if (this.managerSocket) {
      // 将评委信息推送至主持人
      this.managerSocket.send('F' + JSON.stringify(this.voterList[voter]));
    }

    ws.send('C' + JSON.stringify(this.votingList));

    // 推送选手信息
    ws.send('G' + JSON.stringify(this.playerList));
    // 推送评委评分历史
    var scoreArray = [[]];
    for (i = 0; i < this.livePlay.setting.procedure.length; i++) {
      scoreArray[i] = [];
      for (j = 0; j < this.livePlay.setting.player.length; j++) {
        if (this.scoreList[i][j].score) {
          scoreArray[i][j] = this.scoreList[i][j].score[voter];
        } else {
          scoreArray[i][j] = 0;
        }
      }
    }
    ws.send('E' + JSON.stringify(scoreArray));
  } else if (ws.userType == 3) {
    if (this.displayerSocket) {
      this.displayerSocket.close(4002, '有另一终端使用此凭证连接');
      this.displayerSocket = null;
    }

    this.displayerSocket = ws;
    this.livePlay.displayer = {
      id: ws.userId,
      username: ws.userName,
      nickname: ws.nickName
    };

    ws.send('C' + JSON.stringify(this.votingList));

    // 推送选手信息
    ws.send('G' + JSON.stringify(this.playerList));
    // 推送展示者评分
    var scoreArray = [this.scoreList[0]];
    for (i = 0; i < this.livePlay.setting.procedure.length; i++) {
      scoreArray[i] = [];
      for (j = 0; j < this.livePlay.setting.player.length; j++) {
        scoreArray[i][j] = this.scoreList[i][j].result;
      }
    }
    ws.send('E' + JSON.stringify(scoreArray));
  } else {
    if (this.managerSocket) {
      this.managerSocket.close(4002, '有另一终端使用此凭证连接');
      this.managerSocket = null;
    }

    this.managerSocket = ws;
    this.livePlay.manager = {
      id: ws.userId,
      username: ws.userName,
      nickname: ws.nickName
    };

    // 将评委信息推送至主持人
    ws.send('F' + JSON.stringify(this.voterList));

    // 将选手信息推送至主持人
    ws.send('G' + JSON.stringify({
        list: this.playerList,
        queue: this.playerToVote
      }));

    // 将评分信息推送至主持人
    ws.send('E' + JSON.stringify(this.scoreList));

    ws.send('C' + JSON.stringify(this.votingList));
  }

  ws.handler = (ws, dataType, data) => {
    this.handleMessage(ws, dataType, data);
  };
  ws.detach = (ws) => {
    this.detachClient(ws);
  }
};

live.detachClient = function (ws) {
  if (!this.livePlay) return; // disposed
  if (ws.userType) {
    if (ws.userType == 2) {
      if (this.voterSocket[ws.index] && this.voterSocket[ws.index].id != ws.id)
        return;

      this.voterList[ws.index].device = 'Unknown';
      this.voterList[ws.index].status = 0;
      this.voterSocket[ws.index] = null;

      if (this.managerSocket) {
        // 将评委信息推送至主持人
        this.managerSocket.send('F' + JSON.stringify(this.voterList[ws.index]));
      }
    } else if (ws.userType == 3)  {
      if (this.displayerSocket && this.displayerSocket.id != ws.id)
        return;

      this.displayerSocket = null;
      this.livePlay.displayer = null;
    } else {
      if (this.managerSocket && this.managerSocket.id != ws.id)
        return;

      this.managerSocket = null;
      this.livePlay.manager = null;
    }
  }
};

live.handleMessage = function (ws, dataType, data) {
  if (ws.userType == 3) return;

  var arr;
  if (dataType == 'C') {
    var ids = data.substr(1);
    if (ws.userType == 2) {
      if (this.votingList.step + '|' + this.votingList.id.join('|') == ids) {
        this.voterList[ws.index].status = ids;

        if (this.managerSocket) {
          // 将评委信息推送至主持人
          this.managerSocket.send('F' + JSON.stringify(this.voterList[ws.index]));
        }
      } else {
        // 重新推送选手信息
        ws.send('C'+JSON.stringify(this.votingList));
      }
    } else {
      arr = ids.split('|');

      var step = arr.shift();
      if (step == 'finished') {
        console.log('[live] Step', this.votingList.step);
        console.log('[live] Finished.', this.id);

        pool.getConnection((err, connection) => {
          if (err) {
            console.error('live::setFinished', err);
            return;
          }

          connection.query('UPDATE live SET finished = 1 WHERE id = ?', [this.id], (err, rows) => {
            connection.release();

            if (err) {
              console.error('live::setFinished', err);
            }
          });
        });

        console.log('[live] Calling dispose function');
        this.dispose();
        return;
      }

      step = parseInt(step);
      if (step < 0 || step >= this.livePlay.setting.procedure.length)
        return ws.send('*没有第 ' + step + ' 个环节');

      if (this.livePlay.setting.procedure[step] == 1 && arr.length > helper.MAX_VOTING) {
        return ws.send('*最多只能同时对 ' + helper.MAX_VOTING + ' 个选手评分')
      }

      var newIds = [];

      if (step == this.votingList.step) {
        for (i = this.votingList.id.length - 1; i >= 0; --i) {
          index = helper.indexInArray(this.playerList, this.votingList.id[i], 'id');
          if (this.scoreList[this.votingList.step][index].result == -1)
            this.playerToVote.unshift(this.votingList.id[i]);
        }

        for (i = 0; i < arr.length; i++) {
          ids = helper.indexInArray(this.playerList, arr[i], 'id');
          if (ids < 0) {
            return ws.send('*选手 ' + arr[i] + ' 不存在');
          }

          newIds[i] = arr[i];
        }

        for (i = 0; i < arr.length; i++) {
          ids = helper.indexInArray(this.playerToVote, arr[i]);
          if (ids >= 0) {
            this.playerToVote.splice(ids, 1);
          }
        }
        console.log('[live] Voting', newIds.join(', '));
      } else {
        console.log('[live] Step', step);

        this.playerToVote.length = 0;

        for (i = 0; i < this.livePlay.setting.player.length; i++) {
          if (this.scoreList[step][i].result == -1)
            this.playerToVote.push(this.livePlay.setting.player[i]);
        }

        console.log('[live] playerToVote count', this.playerToVote.length);
      }

      this.managerSocket.send('G' + JSON.stringify({
          queue: this.playerToVote
        }));

      this.votingList.id = newIds;
      this.votingList.step = step;

      var notification = 'C' + JSON.stringify(this.votingList);

      // 推送至所有评委连接
      for (i = 0; i < this.voterList.length; i++) {
        if (this.voterSocket[i])
          this.voterSocket[i].send(notification);
      }

      // 推送至主持人连接
      if (this.managerSocket) {
        this.managerSocket.send(notification);
      }

      // 推送至展示人连接
      if (this.displayerSocket) {
        this.displayerSocket.send(notification);
      }
    }
    return;
  }

  if (dataType == 'D') {
    arr = data.substr(1).split('|');
    if (arr.length == 2 || arr.length == 3) {
      if (helper.indexInArray(this.votingList.id, arr[0]) < 0) {
        return ws.send('*不能对这个选手评分');
      }

      if (ws.userType != 2) {
        var playerIndex = helper.indexInArray(this.playerList, arr[0], 'id');

        if (playerIndex < 0) {
          return ws.send('*不能对这个选手评分');
        }

        var extraScore = 0, i;
        if (arr[2]) {
          extraScore = parseFloat(arr[2]);
        }
        if (isNaN(arr[2])) {
          extraScore = 0;
        }

        var retScore = parseFloat(arr[1]);
        if (isNaN(retScore)) {
          return ws.send('*评分错误，请修正')
        }

        // 设定附加分
        var ret = this.setScore(arr[0], -1, this.votingList.step, extraScore);
        if (ret == -1) {
          return ws.send('*评分失败');
        }

        // 设定总分
        ret = this.setScore(arr[0], 0, this.votingList.step, arr[1]);
        if (ret == -1) {
          ws.send('*评分失败');
        } else {
          this.writeScore(arr[0], -1, this.votingList.step, extraScore);
          this.writeScore(arr[0], 0, this.votingList.step, retScore);
          ws.send('D' + arr[0] + '|' + arr[1] + '|0|' + this.votingList.step);

          // 推送至展示连接
          if (this.displayerSocket)
            this.displayerSocket.send('D' + arr[0] + '|' + arr[1] + '|0|' + this.votingList.step);

          var notification = 'C' + JSON.stringify({
              id: [],
              data: [],
              step: this.votingList.step
            });

          // 推送至所有评委连接
          for (i = 0; i < this.voterList.length; i++) {
            if (this.voterSocket[i])
              this.voterSocket[i].send(notification);
          }
        }
      } else {
        var ret = this.setScore(arr[0], ws.userId, this.votingList.step, arr[1]);
        if (ret == -1) {
          ws.send('*评分失败');
        } else if (ret == -2) {
          ws.send('D'+arr[0]+'|-2|' + this.votingList.step);
        } else {
          this.writeScore(arr[0], ws.userId, this.votingList.step, arr[1]);
          ws.send(data + '|' + this.votingList.step);

          // 推送至主持人连接
          if (this.managerSocket) {
            this.managerSocket.send(data + '|' + ws.userId + '|' + this.votingList.step);
          }
        }
      }
    } else {
      ws.close(1002, '协议错误-D');
    }
    return;
  }

  if (dataType == 'H') {
    if (ws.userType == 2) return;
    if (this.votingList.id.length == 0) return;
    if (this.livePlay.setting.procedure[this.votingList.step].type != 1) return;

    arr = data.substr(1);
    var index, j;
    if (arr == '0') {
      for (i = 0; i < this.votingList.id.length; i++) {
        index = helper.indexInArray(this.playerList, this.votingList.id[i], 'id');
        if (index < 0) continue;

        for (j = 0; j < this.voterList.length; j++) {
          this.scoreList[this.votingList.step][index].score[j] = -1;
        }
      }

      ws.send(data + '|' + this.votingList.id.join('|'));

      var notification = 'H' + this.votingList.id.join('|');

      // 推送至所有评委连接
      for (i = 0; i < this.voterList.length; i++) {
        if (this.voterSocket[i])
          this.voterSocket[i].send(notification);
      }
    } else {
      j = helper.indexInArray(this.voterList, arr, 'id');
      if (j < 0) {
        return ws.send('*选定的评委不存在');
      }

      for (i = 0; i < this.votingList.id.length; i++) {
        index = helper.indexInArray(this.playerList, this.votingList.id[i], 'id');
        if (index < 0) continue;

        this.scoreList[this.votingList.step][index].score[j] = -1;
      }

      ws.send(data + '|' + this.votingList.id.join('|'));
      if (this.voterSocket[j])
        this.voterSocket[j].send('H' + this.votingList.id.join('|'));
    }
    console.log('[live] ReVote, voter', arr);
    return;
  }

  console.log('[live] Unknown command ' + dataType + ' : ' + data);
};
