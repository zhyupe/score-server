G.call('live/manager');
(function () {
  var data = {
    scoreList: [],

    displayList: [],

    screen: 0,
    step: 0,

    auto: true,
    live: {},

    editing: { type: 'new', 'new': 1 },
    intercept: false,

    disconnect: { code: 0, reason: ''}
  }, websocket = null, timer = null, autoTimer = null, controlLock = false, controlWin = false;

  var $panel = null, $page = $('#page');

  var wsUri = window.location.protocol.replace('http', 'ws') + "//" + window.location.host;
  var preloadImage = function (src) {
    var photo = new Image();
    photo.src = src;
  };

  window.initSocket = function () {
    data.disconnect.code = 0;
    data.disconnect.reason = '';

    websocket = new WebSocket(wsUri);
    websocket.onopen = function (evt) {
      websocket.send('A' + wsToken);
    };
    websocket.onclose = function (evt) {
      console.log("DISCONNECTED", evt.code, evt.reason);

      data.disconnect.code = evt.code;
      data.disconnect.reason = evt.reason;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      if (evt.code == 4001) {
        var scoreIndex = data.displayList.length; // -1+1;
        generateScoreList();

        stopAuto(); // force auto stop here.
        setTimeout(function () {
          if (!data.intercept) {
            data.auto = true;
            checkAuto(scoreIndex);
          } else {
            data.editing = data.displayList[0];
          }
        }, 50);
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
  };

  function keepAlive() {
    websocket.send('0');
    timer = setTimeout(keepAlive, 30000);
  }

  /**
   * 生成分数列表（html）
   */
  window.generateScoreList = function () {
    var i, j, p, playerData, offset, html, perPage = 10;
    var th = '<table>\n' +
      '<tr class="step-1"><th class="rate">排名</th><th class="player">选手</th><th class="school">单位</th>';

    // generate th
    for (i = 0; i < data.live.procedure.length; i++) {
      th += '<th class="score">' + data.live.procedure[i].name + '</th>';
    }
    th += '<th class="result">总分</th></tr>\n';

    // generate tf
    var tf = '</table>';

    // generate sorted score list
    var sortedScoreList = [];
    for (i = 0; i < data.scoreList.length; i++)
      sortedScoreList[i] = data.scoreList[i];
    sortedScoreList.sort(function (a, b){
      return b.result - a.result;
    });

    var pageCount = Math.ceil(sortedScoreList.length / perPage);

    for (p = 0; p < pageCount; p++) {
      html = th;
      offset = p * perPage;
      for (i = 0; i < perPage; i++) {
        if (!sortedScoreList[i + offset])
          break;

        playerData = playerList.id(sortedScoreList[i + offset].id);
        html += '<tr class="step-' + (i + 2) + '"><td class="rate">' + (i + offset + 1) + '</td><td class="player">' + playerData.name + '</td><td class="school">' + playerData.school + '</td>';
        for (j = 0; j < data.live.procedure.length; j++)
          html += '<td class="score">' + helper.toFixed(sortedScoreList[i + offset].computed[j]) + '</td>';
        html += '<td class="result">' + helper.toFixed(sortedScoreList[i + offset].result) + '</td></tr>\n';
      }
      html += tf;

      data.displayList.push({ type: 'html', html: html, name: '得分列表 第 ' + (p + 1) + ' 页' });
    }
  };

  /**
   * 移除可能已经存在的 panel
   * @param cb 动画完成后的回调函数
   */
  var removePanel = function (cb) {
    var $oldPanel;
    if ($panel) {
      $oldPanel = $panel;
      $oldPanel.removeClass('active');
      setTimeout(function () {
        try {
          $oldPanel.remove();
          $oldPanel = null;
        }
        catch (e) {
          console.error(e);
        }

        cb();
      }, 610);
    } else {
      setTimeout(cb, 10);
    }
  };

  /**
   * 载入屏幕（处理）
   * @param id 屏幕序号
   */
  var loadPanel = function (id) {
    console.log('loadPanel', id);
    data.screen = id;

    var score,newPanel;
    if (data.displayList[id].type == 'score') {
      newPanel = '<div class="panel panel-user"><div class="panel-left"><h3 class="step-1">选手信息</h3>' +
        '<div class="user-info step-1">'+data.displayList[id].no+' 号</div>' +
        '<div class="user-avatar step-1"><img src="'+data.displayList[id].photo+'"/></div></div>' +
        '<div class="panel-right"><h3 class="step-2">得分</h3><div class="user-score step-2">' +
        '<div class="left"><div class="wrap"><div class="circle"></div></div></div>' +
        '<div class="right"><div class="wrap"><div class="circle"></div></div></div>' +
        '<div class="result">0<span>.00</span></div>' +
        '</div></div></div>';

      score = data.displayList[id].score;
      removePanel(function () {
        $panel = $(newPanel).appendTo($page);
        setTimeout(function () {
          $panel.addClass('active');

          // animation for left circle
          if (score > 50) {
            setTimeout(function () {
              $panel.find('.left').find('.circle').css({
                transform: 'rotate('+(score * 3.6)+'deg)',
                transitionDuration: (score - 50) * .02 + 's',
                opacity: 1
              });
            }, 1010);
          }

          // animation for right circle
          $panel.find('.right').find('.circle').css({
            transform: 'rotate(' + (Math.min(score, 50) * 3.6) + 'deg)',
            transitionDuration: Math.min(score, 50) * .02 + 's',
            opacity: score > 0 ? 1 : 0
          });

          // animation for score string
          var $score = $panel.find('.result');
          var animationScore = 0, endTime = Date.now() + score * 20;
          var checkAScore = function () {
            animationScore = score - (endTime - Date.now()) / 20;
            if (animationScore > score) {
              $score.html(helper.toFixed(score, 1));
            } else {
              $score.html(helper.toFixed(animationScore, 1));
              setTimeout(checkAScore, 60);
            }
          };
          setTimeout(checkAScore, 60);
        }, 50);
      });
    } else {
      // html
      removePanel(function () {
        $panel = $('<div class="panel panel-list">' + data.displayList[id].html + '</div>').appendTo($page);
        setTimeout(function () {
          $panel.addClass('active');
        }, 50);
      });
    }
  };

  /**
   * 自动播放处理函数
   * @param id 屏幕序号（可选）
   */
  window.checkAuto = function (id) {
    if (!data.auto) return;
    if (typeof id === 'undefined')
      id = data.screen + 1;

    var stat = showScreen(id, function () {
      autoTimer = setTimeout(function () {
        checkAuto()
      }, 10000);
    }, true);

    if (stat === false)
      stopAuto();
  };

  /**
   * 停止自动播放
   */
  window.stopAuto = function () {
    console.log('Auto stopped');
    data.auto = false;
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  };

  /**
   * 载入屏幕
   * @param id 屏幕序号（允许控制符： + - *）
   * @param cb 回调函数
   * @param fromTimer 是否为自动播放产生的事件
   * @returns {boolean}
   */
  window.showScreen = function (id, cb, fromTimer) {
    if (controlLock && !fromTimer)
      return cb ? cb() : false;
    /*if (id === data.screen)
      return cb ? cb() : false;*/

    if (id === '+')
      return showScreen(data.screen + 1, cb, fromTimer);
    if (id === '-')
      return showScreen(data.screen - 1, cb, fromTimer);
    if (id === '*')
      return showScreen(data.displayList.length - 1, cb, fromTimer);

    if (id < -1 || id >= data.displayList.length) // skip if no such screen.
      return cb ? cb() : false;

    controlLock = true;

    // stop auto page switching if this is a user-fired event
    if (data.auto && !fromTimer) {
      stopAuto();
    }

    console.log('showScreen', id);
    if (id == -1) {
      data.screen = id;

      removePanel(function () {
        $(document.body).removeClass('show-page');
        controlLock = false;
      });
    } else {
      if (data.screen < 0) {
        $(document.body).addClass('show-page');
        setTimeout(function () {
          loadPanel(id);
          if (cb)
            cb();
          controlLock = false;
        }, 400);
      } else {
        loadPanel(id);
        if (cb)
          cb();
        controlLock = false;
      }
    }
  };

  function onMessage(evt) {
    var dataType = evt.data.charAt(0), _data, index, i;
    if (dataType == '0')
      return; // Pong

    if (dataType == 'A') {
      data.user = evt.data.substr(1);
      websocket.send('@' + wsId + '|3');

      keepAlive();
      return;
    }

    if (dataType == 'B') {
      data.live = JSON.parse(evt.data.substr(1));

      $('#liveTitle').html(data.live.name);
      document.title = data.live.name;

      data.live.procedure = procedure.load(data.live.procedure, data.live.result);
      return;
    }

    if (dataType == 'C') {
      _data = JSON.parse(evt.data.substr(1));

      stopAuto();
      showScreen(-1);

      data.step = _data.step;
      data.displayList = [];
      return;
    }
    if (dataType == 'D') {
      // player|score|voter|step
      _data = evt.data.substr(1).split('|');

      // only accept result
      if (_data[2] !== '0')
        return;

      var step = parseInt(_data[3]);
      if (isNaN(step) || step < 0 || step >= data.live.procedure.length)
        return;

      var playerIndex = playerList.indexOf(_data[0]);
      if (playerIndex < 0) return;

      var score = helper.parseScore(_data[1]);

      helper.$set(data.scoreList[playerIndex].original, step, score);

      for (i = 0; i < data.scoreList[playerIndex].original.length; i++) {
        helper.$set(data.scoreList[playerIndex].computed, i, helper.computeScore(data.scoreList[playerIndex].original, data.live.procedure[i].exp));
      }

      data.scoreList[playerIndex].result = helper.computeScore(data.scoreList[playerIndex].original, data.live.result);

      if (step != data.step) // skip if not current step
        return;

      var playerData = playerList.index(playerIndex, step);
      data.displayList.push({ type: 'score', name: playerData.name, school: playerData.school, no: playerData.no, photo: playerData.photo, score: score });

      if (data.auto) return;

      if (!data.intercept) {
        data.auto = true;
        checkAuto(data.displayList.length - 1);
      } else {
        data.editing = data.displayList[data.displayList.length - 1];
      }
      return;
    }

    if (dataType == 'E') {
      var scoreList = [], j;
      _data = JSON.parse(evt.data.substr(1));
      for (i = 0; i < _data[0].length; i++) {
        scoreList[i] = {
          id: playerList.index(i).id,
          original: [],
          computed: [],
          result: -1
        };

        for (j = 0; j < _data.length; j++) {
          scoreList[i].original[j] = _data[j][i];
        }

        for (j = 0; j < _data.length; j++) {
          scoreList[i].computed[j] = helper.computeScore(scoreList[i].original, data.live.procedure[j].exp);
        }

        scoreList[i].result = helper.computeScore(scoreList[i].original, data.live.result);
      }
      data.scoreList = scoreList;
      return;
    }

    if (dataType == 'G') {
      var list = playerList.load(JSON.parse(evt.data.substr(1)));
      for (i = 0; i < list.length; i++)
        preloadImage(list[i].photo);
      return;
    }

    console.log('%cRESPONSE: ' + evt.data, 'color: blue;');
  }

  window.showControl = function () {
    window.open('/live/display_control', 'ctrlWin', 'resizable=yes');
  };

  window.registerControl = function (callback) {
    controlWin = true;

    window.onunload = callback;
    return data;
  };
  window.unloadControl = function () {
    controlWin = false;
  };

  initSocket();
  window._debugData = data;
  window._debugWS = websocket;
  window._m = onMessage;
})();