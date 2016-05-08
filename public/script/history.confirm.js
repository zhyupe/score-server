(function () {
  var closeWindow = function () {
    window.opener = null;
    window.open('', '_self');
    window.close();
  };

  if (!window.opener) {
    alert('不能直接打开此页面，请在展示页左下角点击图标进入。');
    closeWindow();
    return;
  }

  var html = '', tempHtml = '', data = window.opener.getData(), playerList = window.opener.playerList;
  var voter, player, score;
  if (!data) {
    alert('获取比赛数据失败，请刷新页面重试。');
    closeWindow();
    return;
  }

  if (data.live.procedure[data.printStep].type != 1) {
    alert('不能打印此环节的确认表。');
    closeWindow();
    return;
  }

  // generate a new player array and sort by no
  var newPlayer = [];
  for (player = 0; player < data.player.length; player++) {
    newPlayer.push(playerList.index(player, data.printStep));
  }

  newPlayer.sort(function (a, b) {
    if (a.no == b.no)
      return 0;

    return a.no > b.no ? 1 : -1;
  });

  var header = '<div class="twt-print">' +
    '<div class="mui--text-title">' + data.live.name + '</div>' +
    '<div class="mui--text-subhead">' + data.live.procedure[data.printStep].name + '环节 APP评分确认表</div>';
  var footer = '<div class="mui--text-subhead">如分数无误，请在此处签字：<div class="mui-textfield" style="display:inline-block;width:200px"><input type="text" disabled></div></div></div>';
  var colNum = Math.ceil(newPlayer.length / 15), col;
  var rowNum = colNum > 1 ? 15 : newPlayer.length, row;

  for (voter = 0; voter < data.voter.length; voter++) {
    tempHtml = header;
    tempHtml += '<p style="margin:10px 0">评分人：' + data.voter[voter].nickname + '</p>';

    tempHtml += '<table class="twt-table"><thead><tr>';
    for (col = 0; col < colNum; col++) {
      tempHtml += '<th>选手编号</th><th>得分</th>';
    }
    tempHtml += '</tr></thead><tbody>';
    for (row = 0; row < rowNum; row++) {
      tempHtml += '<tr>';
      for (col = 0; col < colNum; col++) {
        player = row + 15 * col;
        if (newPlayer[player]) {
          score = data.scoreList[data.printStep][newPlayer[player].index].score[voter];
          tempHtml += '<td>' + newPlayer[player].no + ' 号</td><td>' +
            (score == -1 ? '未评分' : helper.toFixed(score)) + '</td>';
        } else {
          tempHtml += '<td>&nbsp;</td><td>&nbsp;</td>';
        }
      }
      tempHtml += '</tr>';
    }
    tempHtml += '</tbody></table>';

    tempHtml += footer;
    html += tempHtml;
  }

  $('#confirmWrap').html(html);
  window.print();
})();