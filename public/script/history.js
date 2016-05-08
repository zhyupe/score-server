G.call('live/manager');
(function () {
  var data = {
    scoreList: [],
    resultList: [],

    live: {},
    player: [],
    voter: []
  }, controlLock = false;

  var loadHistory = function (id) {
    if (controlLock) return;
    controlLock = true;

    $.post('/history', {id: id, token: wsToken}, function (_data) {
      var scoreArr, liveData;
      if (_data.error) {
        alert(_data.error);
        controlLock = false;
      } else {
        liveData = _data.shift();
        playerList.load(liveData.player);
        procedure.load(liveData.live.procedure, liveData.live.result);

        data.player = liveData.player;
        data.live = liveData.live;
        data.voter = liveData.voter;

        scoreArr = scoreList.load(_data);

        data.resultList = scoreArr[0];
        data.scoreList = scoreArr[1];

        controlLock = false;
      }
    });

    $('#historyWrap').show();
  };

  new Vue({
    el: '#historyWrap',
    data: data,
    methods: {
      printConfirm: function (step) {
        data.printStep = step;
        window.open('/history/confirm', 'confWin', 'resizable=yes');
      },
      genXlsx: function () {
        if (controlLock) return;
        controlLock = true;

        var wb = new Workbook(), i, j, k, _data, ws, ws_name, rank, rankScore, scoreArr, temp, sizeArr;
        var sortedResultList = helper.sortScore(data.resultList), sortedScoreList = [];

        for (i = 0; i < data.scoreList.length; i++) {
          sortedScoreList[i] = helper.sortScore(data.scoreList[i]);
        }

        // Generate a Workbook

        // Generating summary sheet
        ws = {};
        ws['!merges'] = [
          {s: {c: 0, r: 0}, e: {c: 6, r: 0}},
          {s: {c: 1, r: 1}, e: {c: 6, r: 1}},
          {s: {c: 0, r: 2}, e: {c: 6, r: 2}},
          {s: {c: 1, r: 5}, e: {c: 6, r: 5}},
          {s: {c: 1, r: 6}, e: {c: 6, r: 6}},
          //{s: {c: 0, r: 8}, e: {c: 1, r: 8}},
          {s: {c: 2, r: 8}, e: {c: 3, r: 8}},
          {s: {c: 5, r: 8}, e: {c: 6, r: 8}}];
        ws['!cols'] = [
          {wch: 12},
          {wch: 2},
          {wch: 10},
          {wch: 15},
          {wch: 2},
          {wch: 15},
          {wch: 15}
        ];

        _data = [
          ['天外天评分系统 评分报表'],
          ['生成时间', new Date()],
          ['© 2016 天外天工作室 / Designed By Zhyupe'],
          [],
          ['比赛信息'],
          ['比赛名称', data.live.name],
          ['开始时间', new Date(data.live.timestamp * 1000)],
          [],
          ['比赛流程', null, '评委信息', null, null, '选手信息'],
          ['环节', null, '登录名', '显示名', null, '姓名', '学校']
        ];

        writeArrayToSheet(ws, _data);
        for (i = 0; i < data.live.procedure.length; i++) {
          writeArrayToSheet(ws, [[data.live.procedure[i].name]], 0, 10 + i);
        }
        for (i = 0; i < data.voter.length; i++) {
          writeArrayToSheet(ws, [[data.voter[i].username, data.voter[i].nickname]], 2, 10 + i);
        }
        for (i = 0; i < data.player.length; i++) {
          writeArrayToSheet(ws, [[data.player[i].name, data.player[i].school]], 5, 10 + i);
        }

        ws_name = "概况";
        wb.SheetNames.push(ws_name);
        wb.Sheets[ws_name] = ws;

        // Generating score sheets
        for (i = -1; i < data.scoreList.length; i++) {
          _data = [
            ['学校', '姓名']
          ];
          sizeArr = [
            {wch: 15},
            {wch: 15}
          ];

          if (i == -1) {
            for (j = 0; j < data.live.procedure.length; j++) {
              _data[0][j + 2] = data.live.procedure[j].name;
              sizeArr[j + 2] = {wch: 12};
            }
            ws_name = '总分';
          } else {
            // skip voter and extra output for non-voting procedure
            if (data.live.procedure[i].type != 1) {
              j = 0;
            } else {
              for (j = 0; j < data.voter.length; j++) {
                _data[0][j + 2] = data.voter[j].nickname;
                sizeArr[j + 2] = {wch: 12};
              }

              _data[0][j + 2] = '附加分';
              sizeArr[j + 2] = {wch: 8};
              j++;
            }

            ws_name = data.live.procedure[i].name;
          }

          _data[0][j + 2] = (i == -1 || data.live.procedure[i].type != 3) ? '总分' : '折算分';
          sizeArr[j + 2] = {wch: 8};

          if (i != -1 && data.live.procedure[i].type != 3) {
            _data[0][j + 3] = '折算分';
            sizeArr[j + 3] = {wch: 8};
            j++;
          }

          _data[0][j + 3] = '排名';
          sizeArr[j + 3] = {wch: 6};

          rank = 1;
          rankScore = -3;

          // scoreLists has the same object count as resultList
          var sList = i == -1 ? sortedResultList : sortedScoreList[i];
          for (j = 0; j < sList.length; j++) {
            temp = playerList.id(sList[j].id);
            _data[j + 1] = [temp.school, temp.name];

            if (i == -1) {
              for (k = 0; k < sList[j].computed.length; k++) {
                _data[j + 1][k + 2] = {
                  t: 'n',
                  v: sList[j].computed[k],
                  z: '0.00'
                };
              }
            } else {
              // skip voter and extra output for non-voting procedure
              if (data.live.procedure[i].type != 1) {
                k = 0;
              } else {
                scoreArr = helper.avgScore(sList[j].score);

                for (k = 0; k < sList[j].score.length; k++) {
                  _data[j + 1][k + 2] = sList[j].score[k];

                  if (_data[j + 1][k + 2] == -1) {
                    _data[j + 1][k + 2] = '未评分';
                  } else if (scoreArr.count > 3) {
                    // add color if the score is ignored (max/min)
                    if (scoreArr.max == _data[j + 1][k + 2]) {
                      _data[j + 1][k + 2] = {
                        t: 'n',
                        v: _data[j + 1][k + 2],
                        s: {
                          font: {
                            color: 'FF009900'
                          }
                        },
                        z: '0'
                      };
                    } else if (scoreArr.min == _data[j + 1][k + 2]) {
                      _data[j + 1][k + 2] = {
                        t: 'n',
                        v: _data[j + 1][k + 2],
                        s: {
                          font: {
                            color: 'FFFF9900'
                          }
                        },
                        z: '0'
                      };
                    }
                  }
                }
                _data[j + 1][k + 2] = {
                  t: 'n',
                  v: sList[j].extra,
                  z: '0.00'
                };
                k++;
              }
            }

            // result
            if (sList[j].result == -1) {
              _data[j + 1][k + 2] = '未评分';
            } else {
              _data[j + 1][k + 2] = {
                t: 'n',
                v: sList[j].result,
                z: '0.00'
              };
            }

            // computed
            if (i != -1 && data.live.procedure[i].type != 3) {
              _data[j + 1][k + 3] = {
                t: 'n',
                v: sList[j].computed,
                z: '0.00'
              };
              k++;
            }

            if (rankScore != sList[j].result) {
              rank = j + 1;
              rankScore = sList[j].result;
            }

            _data[j + 1][k + 3] = rank;
          }

          ws = {};
          writeArrayToSheet(ws, _data);

          ws['!cols'] = sizeArr;

          wb.SheetNames.push(ws_name);
          wb.Sheets[ws_name] = ws;
        }

        var wbout = XLSX.write(wb, {bookType: 'xlsx', bookSST: true, type: 'binary'});

        function s2ab(s) {
          var buf = new ArrayBuffer(s.length);
          var view = new Uint8Array(buf);
          for (var i = 0; i < s.length; ++i)
            view[i] = s.charCodeAt(i) & 0xFF;
          return buf;
        }

        saveAs(new Blob([s2ab(wbout)], {type: "application/octet-stream"}), "天外天评分-" + data.live.name + ".xlsx");
        controlLock = false;
      }
    }
  });

  window.onhashchange = function () {
    var hash = window.location.hash.replace(/^#P?/, '');

    if (hash == 0) {
      $('#historyWrap').hide();
      return
    }

    loadHistory(hash);
  };
  window.onhashchange();

  var datenum =  function (v, date1904) {
    if(date1904) v+=1462;
    var epoch = Date.parse(v);
    return (epoch - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
  };
  var Workbook = function () {
    if(!(this instanceof Workbook)) return new Workbook();
    this.SheetNames = [];
    this.Sheets = {};
  };
  var writeArrayToSheet = function(ws, data, offsetX, offsetY) {
    var range = !!ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: {c: 10000000, r: 10000000}, e: {c: 0, r: 0} };
    if (!offsetX || offsetX < 0) offsetX = 0;
    if (!offsetY || offsetY < 0) offsetY = 0;

    for (var R = 0; R < data.length; ++R) {
      for (var C = 0; C < data[R].length; ++C) {
        if (range.s.r > R+offsetY) range.s.r = R+offsetY;
        if (range.s.c > C+offsetX) range.s.c = C+offsetX;
        if (range.e.r < R+offsetY) range.e.r = R+offsetY;
        if (range.e.c < C+offsetX) range.e.c = C+offsetX;

        var cell = { v: data[R][C] };
        if(cell.v == null) continue;
        var cell_ref = XLSX.utils.encode_cell({c:C+offsetX,r:R+offsetY});

        if(typeof cell.v === 'number') cell.t = 'n';
        else if(typeof cell.v === 'boolean') cell.t = 'b';
        else if(cell.v instanceof Date) {
          cell.t = 'n'; cell.z = XLSX.SSF._table[14];
          cell.v = datenum(cell.v);
          cell.z = 'yyyy-mm-dd hh:mm;@'
        }
        else if(typeof cell.v === 'object') cell = cell.v;
        else cell.t = 's';

        ws[cell_ref] = cell;
        //console.log(cell_ref, cell);
      }
    }

    if (range.s.c < 10000000)
      ws['!ref'] = XLSX.utils.encode_range(range);
  };

  window._debugData = data;
  window.getData = function () {
    return data;
  }
})();