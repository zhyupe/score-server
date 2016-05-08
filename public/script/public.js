(function () {
  var _func = {};
  window.G = {
    reg: function (name, func) {
      _func[name] = func;
    },
    call: function (name, arg) {
      if (Array.isArray(name)) {
        for (var i = 0; i < name.length; i++)
          G.call(name[i], arg);
      } else {
        if (_func[name])
          _func[name].apply(window, arg);
      }
    }
  };
})();

G.reg('global/side', function () {
  var $bodyEl = $('body'),
    $sidedrawerEl = $('#sidedrawer');

  function showSidedrawer() {
    // show overlay
    var options = {
      onclose: function () {
        $sidedrawerEl
          .removeClass('active')
          .appendTo(document.body);
      }
    };

    var $overlayEl = $(mui.overlay('on', options));

    // show element
    $sidedrawerEl.appendTo($overlayEl);
    setTimeout(function () {
      $sidedrawerEl.addClass('active');
    }, 20);
  }

  function hideSidedrawer() {
    $bodyEl.toggleClass('hide-sidedrawer');
  }

  $('.js-show-sidedrawer').on('click', showSidedrawer);
  $('.js-hide-sidedrawer').on('click', hideSidedrawer);
});
G.reg('global/procedure', function () {
  var $p = $('#procedure');
  var pId = -1;

  window.loadProfile = function (id) {
    var data;
    if (id == 0) {
      data = {
        id: 0,
        name: '',
        procedure: [],
        result: ''
      }
    } else {
      data = $('#profile-' + id).data('json');
      if (!data) return;

      try {
        if (typeof data.procedure == 'string')
          data.procedure = JSON.parse(data.procedure);
      }
      catch (e) {
        console.error(data.procedure);
        data.procedure = [];
      }
    }

    clearProcedure();
    $('#proWrap').show();

    $('#f_id').val(data.id);
    $('#f_ti').val(data.name.replace(/\n/g, '\\n'));
    $('#f_re').val(data.result);

    for (var i = 0; i < data.procedure.length; i++) {
      makeProcedure(data.procedure[i].name, data.procedure[i].type, data.procedure[i].exp)
    }
  };

  window.clearProcedure = function () {
    pId = -1;
    $p.children().remove();
  };

  window.makeProcedure = function (name, type, exp) {
    type = parseInt(type);
    if (isNaN(type) || type < 0 || type > 3)
      type = 0;

    pId++;
    var obj = $('<div class="mui-row">' +
      '<div class="mui-col-xs-1 mui-textfield">' +
      '<span class="twt-label">$' + pId + '</span>' +
      '</div>' +
      '<div class="mui-col-xs-4 mui-textfield">' +
      '<input type="text" class="p-name" value="' + (name || '').replace(/"/g, "&quot;") + '">' +
      '<label>环节名称</label>' +
      '</div>' +
      '<div class="mui-col-xs-2 mui-textfield">' +
      '<div class="mui-dropdown">' +
      '<input class="p-type" type="hidden" value="' + type + '">' +
      '<button type="button" data-mui-toggle="dropdown" class="mui-btn">' +
      '<span class="p-type-show">' + ['请选择', '评分', '预设分', '展示'][type] + '</span>&nbsp;<span class="mui-caret"></span>' +
      '</button>' +
      '<ul class="mui-dropdown__menu">' +
      '<li><a href="javascript:void(0)" onclick="setType(this, 1, \'评分\')" title="由评委评分的环节">评分</a></li>' +
      '<li><a href="javascript:void(0)" onclick="setType(this, 2, \'预设分\')" title="由后台提交评分的环节">预设分</a></li>' +
      '<li><a href="javascript:void(0)" onclick="setType(this, 3, \'展示\')" title="不评分，以一定的条件展示评分">展示</a></li>' +
      '</ul></div>' +
      '<label>类型</label>' +
      '</div>' +
      '<div class="mui-col-xs-5 mui-textfield">' +
      '<input type="text" class="p-exp" value="' + (exp || '$' + pId).replace(/"/g, "&quot;") + '">' +
      '<label>显示公式</label>' +
      '</div>' +
      '</div>');
    obj.appendTo($p);
  };
  window.setType = function (obj, no, name) {
    obj = $(obj).parent().parent().parent();
    obj.find('.p-type').val(no);
    obj.find('.p-type-show').html(name);
  };
  window.collectProcedure = function () {
    var ret = [];
    $p.children().each(function (i, e) {
      var name = $(e).find('.p-name').val(),
        type = $(e).find('.p-type').val(),
        exp = $(e).find('.p-exp').val();
      if (!name || !type || !exp) return;

      ret.push({
        name: name,
        type: type,
        exp: exp
      });
    });
    return ret;
  }
});

G.reg('profile', function () {
  window.newProfile = function () {
    window.location.hash = '#new';
    loadProfile(0)
  };

  window.onhashchange = function () {
    var hash = window.location.hash.replace(/^#P?/, '');
    if (hash == 'new') return;

    if (hash <= 0) {
      $('#proWrap').hide();
      return
    }

    loadProfile(hash);
  };

  window.onhashchange();

  $('#ctrlForm').submit(function () {
    event.preventDefault();

    var data = {
      id: $('#f_id').val(),
      name: $('#f_ti').val().replace(/\\n/g, '\n'),
      result: $('#f_re').val(),
      procedure: collectProcedure(),
      token: G.token
    };

    data.procedure = JSON.stringify(data.procedure);
    $.post('/profile', data, function (data) {
      if (data.error) {
        alert(data.error);
      } else {
        window.location.href = '/profile';
      }
    })
  });
});
G.reg('user', function () {
  window.setUserType = function (type, name) {
    $('#f_uth').val(type);
    $('#f_ut').text(name);

    if (type == 2) {
      $('#pw_on').hide();
      $('#pw_off').show();
    } else {
      $('#pw_off').hide();
      $('#pw_on').show();
    }
  };

  window.setUserWrap = function (data) {
    if (!data) {
      data = {
        id: 0,
        username: '',
        nickname: '',
        type: 0,
        typename: '请选择'
      }
    }

    $('#f_id').val(data.id);
    $('#f_un').val(data.username);
    $('#f_nn').val(data.nickname);
    $('#f_pw').val('');

    if (data.id == 0) {
      $('#userNew').show();
      $('#userEdit').hide();
      $('#f_un').prop('readonly', false);
    } else {
      $('#userNew').hide();
      $('#userEdit').show();
      $('#f_un').prop('readonly', true);
    }
    setUserType(data.type, data.typename);
  };
  window.delUser = function (id) {
    $.post('/user/delete', {
      id: id,
      token: G.token
    }, function (data) {
      if (data.error) {
        alert(data.error);
      } else {
        window.location.href = '/user';
      }
    })
  };
  $('#userForm').submit(function () {
    event.preventDefault();

    var data = {
      id: $('#f_id').val(),
      username: $('#f_un').val(),
      nickname: $('#f_nn').val(),
      password: $('#f_pw').val(),
      type: $('#f_uth').val(),
      token: G.token
    };

    if (data.password) {
      data.password = Sha256.hash(data.username + '>/<' + Sha256.hash(data.password) + '><' + data.username)
    }

    $.post('/user', data, function (data) {
      if (data.error) {
        alert(data.error);
      } else {
        window.location.href = '/user';
      }
    });
  });
});
G.reg('player', function () {
  window.togglePlayer = function (id, obj) {
    var result = $(obj).data('status') ? 0 : 1;
    $.post('/player/status', {
      id: id,
      status: result,
      token: G.token
    }, function (data) {
      if (data.error) {
        alert(data.error);
      } else {
        $(obj).data('status', result);
        if (result) {
          $(obj).html('标记出局');
          $(obj).parent().parent().removeClass('out');
        } else {
          $(obj).html('取消出局');
          $(obj).parent().parent().addClass('out');
        }
      }
    })
  };
  window.uploadFile = function (files) {
    if (!files[0]) return;
    if (files[0].type != 'image/png' && files[0].type != 'image/jpeg') return alert('只支持 jpg,jpeg,png 格式');
    if (files[0].size > 4 * 1024 * 1024) return alert('只能上传 4MB 以下的文件');

    $('#f_ph').addClass('loading');
    var formData = new FormData();
    formData.append('avatar', files[0]);

    $.ajax({
      url: '/player/photo?token=' + G.token,
      contentType: false,
      data: formData,
      processData: false,
      type: 'POST',
      cache: false,
      dataType: 'json'
    }).done(function (data) {
      $('#f_ph').removeClass('loading');

      if (data.error) {
        alert(data.error)
      } else {
        $('#f_ph').attr('src', data.photo);
        $('#f_fh').val(data.photo);
      }
    });
  };
  window.setPlayerWrap = function (data) {
    if (!data) {
      data = {
        id: 0,
        no: '',
        name: '',
        school: '',
        photo: '/notfound.jpg'
      }
    }

    $('#f_id').val(data.id);
    $('#f_un').val(data.name);
    $('#f_nn').val(data.no);
    $('#f_sn').val(data.school);

    $('#f_ph').attr('src', data.photo);
    $('#f_fh').val(data.photo);

    if (data.id == 0) {
      $('#playerNew').show();
      $('#playerEdit').hide();
    } else {
      $('#playerNew').hide();
      $('#playerEdit').show();
    }
  };
  window.delPlayer = function (id) {
    $.post('/player/delete', {
      id: id,
      token: G.token
    }, function (data) {
      if (data.error) {
        alert(data.error);
      } else {
        window.location.href = '/player';
      }
    })
  };
  $('#playerForm').submit(function () {
    event.preventDefault();

    var data = {
      id: $('#f_id').val(),
      name: $('#f_un').val(),
      no: $('#f_nn').val(),
      school: $('#f_sn').val(),
      photo: $('#f_fh').val(),
      token: G.token
    };

    $.post('/player', data, function (data) {
      if (data.error) {
        alert(data.error);
      } else {
        window.location.href = '/player';
      }
    });
  });
});

G.reg('live', function () {
  window.reloadProfile = function (id) {
    if (!confirm('注意：此操作将立即继续未完成的比赛')) return;

    $.post('/live/setup', {
      id: id,
      token: G.token
    }, function (data) {
      if (data.error) {
        alert(data.error);
      } else {
        window.location.href = '/live/control?id='+data.id;
      }
    })
  };
});
G.reg('live/setup', function () {
  window.submitLive = function () {
    var data = {
      result: $('#f_re').val(),
      name: $('#f_ti').val().replace(/\\n/g, '\n'),
      procedure: collectProcedure(),
      voter: [],
      player: []
    };

    $('#voterList').find('.selected').each(function (i, e) {
      data.voter.push($(e).data('id'))
    });

    $('#playerList').find('.selected').each(function (i, e) {
      data.player.push($(e).data('id'))
    });

    var confirmStr = '请确认比赛信息\n\n' +
      '名称：' + data.name + '\n' +
      '环节：\n';
    for (var i = 0; i < data.procedure.length; i++) {
      confirmStr += data.procedure[i].name + '\n';
    }
    confirmStr += '\n评委：' + data.voter.length + ' 人';
    confirmStr += '\n选手：' + data.player.length + ' 人';

    if (!confirm(confirmStr)) return;

    $.post('/live/setup', {
      setting: JSON.stringify(data),
      token: G.token
    }, function (data) {
      if (data.error) {
        alert(data.error);
      } else {
        window.location.href = '/live/control?id=' + data.id;
      }
    })
  };
});

G.reg('live/manager', function () {
  if (typeof Vue !== 'undefined') {
    Vue.filter('formatScore', helper.formatScore);
    Vue.filter('formatAvgScore', helper.formatAvgScore);
    Vue.filter('formatResultScore', helper.formatResultScore);
    Vue.filter('formatCountScore', helper.formatCountScore);
    Vue.filter('formatVoterScore', helper.formatVoterScore);
    Vue.filter('playerById', function (value, style) {
      var player;
      if (style === 'list') {
        player = playerList.id(value);
        return player.name + '<div class="mui--text-dark-secondary">'+player.school+', '+player.no+'</div>';
      } else {
        player = playerList.id(value);
        return player.name;
      }
    });
    Vue.filter('parseDisplay', function (p, mode) {
      if (mode === 'type') {
        if (p == 'score')
          return '得分';
        if (p == 'html')
          return '内容';
        return '请选择';
      } else {
        if (p.new)
          return '新建屏幕';
        if (p.type === 'score') {
          return '[得分] ' + p.no + '号 ' + p.name + '：' + p.score + ' 分';
        } else if (p.type == 'html') {
          return '[内容] ' + p.name;
        } else {
          return '[未设定的内容]'
        }
      }
    });
  }

  var _playerList = [], _scoreList = [], _resultList = [], _procedure = [], _resultExp;
  var clone = function (arr) {
    if (typeof arr !== 'object')
      return arr;

    var newArr = {};
    for (var k in arr) {
      newArr[k] = arr[k];
    }

    return newArr;
  };

  window.procedure = {
    load: function (arr, result) {
      _procedure = arr;
      _resultExp = result;
      var index = -1;

      for (var i = 0; i < _procedure.length; i++) {
        if (_procedure[i].type == 1) {
          _procedure[i].no = ++index;
        } else {
          _procedure[i].no = -1;
        }
      }

      return _procedure;
    }
  };

  window.scoreList = {
    load: function (arr) {
      // clear old data
      _scoreList = arr; _resultList = [];

      var i, j;
      // i = player index
      for (i = 0; i < _scoreList[0].length; i++) {
        _resultList[i] = {
          id: _scoreList[0][i].id,
          original: [],
          computed: [],
          result: -1
        };

        // j = procedure index
        // set procedure score to result list
        for (j = 0; j < _scoreList.length; j++) {
          _resultList[i].original[j] = _scoreList[j][i].result;
        }

        // compute score
        for (j = 0; j < _scoreList.length; j++) {
          _resultList[i].computed[j] = helper.computeScore(_resultList[i].original, _procedure[j].exp);
          _scoreList[j][i].computed = _resultList[i].computed[j];

          if (_procedure[j].type == 3) {
            // display procedure, write computed score to result.
            _scoreList[j][i].result = _scoreList[j][i].computed;
          }
        }

        _resultList[i].result = helper.computeScore(_resultList[i].original, _resultExp);
      }

      return [_resultList, _scoreList];
    },

    setScore: function (player, step, voter, score) {
      if (voter == -1) {
        _scoreList[step][player].result = score;

        helper.$set(_resultList[player].original, step, score);

        // i = procedure index
        for (var i = 0; i < _scoreList.length; i++) {
          helper.$set(_resultList[player].computed, i, helper.computeScore(_resultList[player].original, _procedure[i].exp));
          _scoreList[i][player].computed = _resultList[player].computed[i];

          if (_procedure[i].type == 3) {
            // display procedure, write computed score to result.
            _scoreList[i][player].result = _scoreList[i][player].computed;
          }
        }

        _resultList[player].result = helper.computeScore(_resultList[player].original, _resultExp);
      } else {
        helper.$set(_scoreList[step][player].score, voter, score);
      }
    }
  };

  window.playerList = {
    load: function (arr) {
      for (var i = 0; i < arr.length; i++)
        arr[i].index = i;

      _playerList = arr;
      return _playerList;
    },
    index: function (index, step) {
      var ret;
      if (_playerList[index]) {
        if (typeof step === 'number' && _procedure[step]) {
          step = _procedure[step].no;

          if (typeof step !== 'number')
            step = -1;
        } else {
          step = -1;
        }

        if (step !== -1) {
          ret = clone(_playerList[index]);
          ret.no = ret.no.split(',')[step];
          return ret;
        } else {
          return _playerList[index];
        }
      } else {
        ret = '!' + index + '!';
        return {
          id: ret,
          name: ret,
          no: ret,
          school: ret,
          index: -1,
          photo: '/notfound.jpg'
        };
      }
    },
    indexOf: function (id) {
      return helper.indexInArray(_playerList, id, 'id');
    },
    id: function (id, step) {
      return playerList.index(playerList.indexOf(id), step);
    }
  };
});