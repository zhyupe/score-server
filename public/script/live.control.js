G.call('live/manager');
(function () {
  var AUTO_SELECT_COUNT = 1;
  var data = {
    local: {
      controlLock: false,
      step: -1,
      hint: 0
    },
    live: {},
    scoreList: [],
    resultList: [],
    voter: [],
    player: [],
    playerToVote: [],
    votingList: []
  }, websocket = null, timer = null;
  var wsUri = window.location.protocol.replace('http', 'ws') + "//" + window.location.host;

  Vue.filter('formatExtra', {
    // model -> view
    // 在更新 `<input>` 元素之前格式化值
    read: function(val) {
      return val.toString();
    },
    // view -> model
    // 在写回数据之前格式化值
    write: function(val, oldVal, array) {
      if (val.charAt(val.length - 1) === '%') {
        val = +val.substr(0, val.length - 1);
        if (isNaN(val)) {
          return 0;
        }

        var scoreArr = helper.avgScore(array);

        return Math.round(scoreArr.result * val) / 100;
      } else {
        val = +val;
        return isNaN(val) ? 0 : val;
      }
    }
  });

  function init() {
    websocket = new WebSocket(wsUri);
    websocket.onopen = function () {
      websocket.send('A' + wsToken);
    };
    websocket.onclose = function (evt) {
      console.log("DISCONNECTED", evt.code, evt.reason);

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (evt.code == 4001 && data.local.finished) {
        window.location.href = '/history#P' + wsId;
        return;
      }

      alert('与服务器的连接断开 ('+evt.code+')\n' + evt.reason + (evt.code == 1006 ? '\n\n请与技术人员取得联系' : ''));
    };
    websocket.onmessage = function (evt) {
      onMessage(evt)
    };
    websocket.onerror = function (evt) {
      console.log('%cERROR: ' + evt.data, 'color: red;');
    };
  }

  function keepAlive() {
    websocket.send('0');
    timer = setTimeout(keepAlive, 30000);
  }

  function onMessage(evt) {
    var dataType = evt.data.charAt(0), _data, index, i;
    if (dataType == '0')
      return; // Pong
    if (dataType == 'A') {
      data.user = evt.data.substr(1);
      websocket.send('@' + wsId);

      keepAlive();
      return;
    }
    if (dataType == 'B') {
      data.live = JSON.parse(evt.data.substr(1));
      data.live.procedure = procedure.load(data.live.procedure, data.live.result);
      return;
    }
    if (dataType == 'C') {
      data.local.controlLock = false;

      _data = JSON.parse(evt.data.substr(1));
      data.local.step = _data.step;
      data.local.submitted = true;
      _data.data = [];

      if (data.playerToVote.length == 0) {
        // switching procedure
        // _playerToVote is set.

        var newArray = [];
        for (i = 0; i < data._playerToVote.length; i++) {
          newArray.push(playerList.id(data._playerToVote[i], data.local.step));
        }

        newArray.sort(function (a, b) {
          if (a.no == b.no)
            return 0;

          return a.no > b.no ? 1 : -1;
        });

        data.playerToVote = newArray;
      }

      if (_data.id.length > 0) {
        // switching voting
        for (i = 0; i < _data.id.length; i++) {
          index = helper.indexInArray(data.playerToVote, _data.id[i], 'id');
          if (index >= 0) {
            data.playerToVote.splice(index, 1);
          }

          index = playerList.indexOf(_data.id[i]);
          if (index >= 0) {
            _data.data[i] = playerList.index(index, data.local.step);
            _data.data[i].score = data.scoreList[data.local.step][index];

            if (_data.data[i].score.result == -1)
              data.local.submitted = false;
          }
        }
      }
      if (data.local.submitted)
        if (data.playerToVote.length > 0)
          data.local.hint = 1;
        else
          data.local.hint = 3;
      else
        data.local.hint = 2;
      data.votingList = _data.data;
      return;
    }
    if (dataType == 'D') {
      // player|score|voter|step
      _data = evt.data.substr(1).split('|');
      var step = parseInt(_data[3]);
      if (isNaN(step) || step < 0 || step >= data.live.procedure.length)
        return;

      var playerIndex = playerList.indexOf(_data[0]);
      if (playerIndex < 0) return;

      var score = helper.parseScore(_data[1]);

      if (_data[2] == '0') {
        scoreList.setScore(playerIndex, step, -1, score);

        var result = true;
        for (i = 0; i < data.votingList.length; i++) {
          if (data.votingList[i].result == -1) {
            result = false;
          }
        }
        if (result) {
          data.local.submitted = true;
          if (data.playerToVote.length > 0)
            data.local.hint = 1;
          else
            data.local.hint = 3;
        }
      } else {
        var voterIndex = helper.indexInArray(data.voter, _data[2], 'id');
        if (voterIndex < 0) return;

        scoreList.setScore(playerIndex, step, voterIndex, score);
      }
      return;
    }
    if (dataType == 'E') {
      _data = scoreList.load(JSON.parse(evt.data.substr(1)));
      data.resultList = _data[0];
      data.scoreList = _data[1];
      return;
    }
    if (dataType == 'F') {
      _data = JSON.parse(evt.data.substr(1));
      if (Array.isArray(_data))
        data.voter = _data;
      else {
        data.voter[_data.index].nickname = _data.nickname;
        data.voter[_data.index].device = _data.device;
        data.voter[_data.index].status = _data.status;
      }
      return;
    }
    if (dataType == 'G') {
      _data = JSON.parse(evt.data.substr(1));

      if (_data.list) {
        playerList.load(_data.list);
        data.player = _data.list;
      }

      data._playerToVote = _data.queue;
      if (!data.playerToVote)
        data.playerToVote = [];
      else
        data.playerToVote.length = 0;

      return;
    }
    if (dataType == 'H') {
      // voter|players
      _data = evt.data.substr(1).split('|');
      var voter = _data.shift(), j;

      data.local.controlLock = false;
      data.local.submitted = false;
      data.local.hint = 2;

      if (voter == '0') {
        for (i = 0; i < _data.length; i++) {
          index = helper.indexInArray(data.player, _data[i], 'id');
          if (index < 0) continue;

          for (j = 0; j < data.voter.length; j++) {
            helper.$set(data.scoreList[data.local.step][index].score, j, -1);
          }
        }
      } else {
        var voterIndex = helper.indexInArray(data.voter, _data[2], 'id');
        if (voterIndex < 0) return;

        for (i = 0; i < _data.length; i++) {
          index = helper.indexInArray(data.player, _data[i], 'id');
          if (index < 0) continue;

          helper.$set(data.scoreList[data.local.step][index].score, voterIndex, -1);
        }
      }
      return;
    }
    if (dataType == '*') {
      data.local.controlLock = false;
      return alert(evt.data.substr(1));
    }
    console.log('%cRESPONSE: ' + evt.data, 'color: blue;');
  }

  init();
  //window._debugData = data;
  //window._debugWS = websocket;

  var $waiting = $('#waitingPlayer');

  new Vue({
    el: '#controlWrap',
    data: data,
    methods: {
      printConfirm: function (step) {
        data.printStep = step;
        window.open('/history/confirm', 'confWin', 'resizable=yes');
      },
      btnStepPrev: function () {
        if (data.local.controlLock) return;
        if (data.local.step == 0) return;

        if (confirm('确定要切换到上一环节吗？')) {
          data.local.controlLock = true;
          websocket.send('C' + (data.local.step - 1));
        }
      },
      btnStepNext: function () {
        if (data.local.controlLock) return;

        if ((data.votingList.length > 0 && !data.local.submitted || data.playerToVote.length > 0) &&
          !confirm('本环节评分尚未完成！\n确定要切换到下一环节吗？')) return;

        data.local.controlLock = true;
        if (data.local.step >= data.live.procedure.length - 1) {
          websocket.send('Cfinished');
          data.local.finished = true;
        } else {
          websocket.send('C' + (data.local.step + 1));
        }
      },
      btnVotingReset: function (id) {
        if (data.local.controlLock) return;

        var target = null;
        if (id) {
          var index = helper.indexInArray(data.voter, id, 'id');
          if (index >= 0)
            target = data.voter[index];
        }

        if (!confirm('确定要将' + (target ? ' ' + target.nickname + ' ' : '所有评委') + '的评分发回重评吗？')) return;

        data.local.controlLock = true;
        websocket.send('H' + (target ? target.id : '0'));
      },
      btnVotingEnd: function () {
        if (data.local.controlLock) return;

        if ((data.votingList.length > 0 && !data.local.submitted) && !confirm('本轮评分尚未完成！\n确定要结束本轮吗？')) return;

        data.local.controlLock = true;
        websocket.send('C' + data.local.step);
      },
      btnVotingSubmit: function () {
        if (data.local.controlLock) return;

        if (!confirm('确定要提交得分吗？')) return;

        for (var i = 0; i < data.votingList.length; i++) {
          var result = 0, extra = helper.parseScore(data.votingList[i].score.extra);
          if (data.votingList[i].score.score) {
            result = helper.avgScore(data.votingList[i].score.score).result;
          }

          result += extra;
          websocket.send('D' + data.votingList[i].id + '|' + helper.parseScore(result) + '|' + data.votingList[i].score.extra);
        }
      },
      btnToAuto: function () {
        $waiting.find('.mui-panel').each(function (i, e) {
          if (i < AUTO_SELECT_COUNT || data.live.procedure[data.local.step].type != 1) {
            $(e).addClass('selected');
          } else {
            $(e).removeClass('selected');
          }
        });

        this.btnToSubmit();
      },
      btnToSubmit: function () {
        if (data.local.controlLock) return;

        if (data.votingList.length > 0 && !data.local.submitted && !confirm('本轮评分尚未完成！\n确定要提交待评吗？')) return;

        var arr = [];

        $waiting.find('.selected').each(function (i, e) {
          arr.push($(e).attr('data-id'));
        });

        if (arr.length == 0) {
          return alert('请选择选手');
        }

        data.local.controlLock = true;
        websocket.send('C' + data.local.step + '|' + arr.join('|'));
      }
    }
  });

  window.getData = function () {
    return data;
  };
})();