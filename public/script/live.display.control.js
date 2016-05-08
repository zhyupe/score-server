G.call('live/manager');
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

  window.playerList = window.opener.playerList;
  var _data = window.opener.registerControl(closeWindow);

  var vm = new Vue({
    el: '#controlWrap',
    data: _data,
    methods: {
      showScreen: function (id) {
        window.opener.showScreen(id);
      },
      stopAuto: function () {
        window.opener.stopAuto();
      },
      initSocket: function () {
        window.opener.initSocket();
      },
      editScreen: function (id) {
        if (id == -1) {
          vm.editing = { type: 'new', 'new': 1 };
        } else {
          vm.editing = vm.displayList[id];
          vm.editing.id = Date.now() + Math.random();
        }
      },
      toggleAuto: function () {
        if (vm.auto) {
          window.opener.stopAuto();
        } else {
          if (confirm('确定要开启自动播放吗？\n将会从第一屏幕开始以 10 秒间隔播放。'))
            window.opener.checkAuto(0);
        }
      },
      toggleIntercept: function () {
        if (vm.intercept) {
          if (confirm('确定要关闭拦截模式吗？\n将会自动播放服务器推送的内容。'))
            vm.intercept = false;
        } else {
          if (confirm('确定要打开拦截模式吗？\n服务器推送的内容将不会自动显示（返回标题时除外）。'))
            vm.intercept = true;
        }
      },
      pushEditing: function () {
        vm.editing.new = 0;
        vm.editing.id = Date.now() + Math.random();
        if (vm.editing.type == 'html')
          vm.editing.name = '自定义内容';
        vm.displayList.push(vm.editing);
      },
      showEditing: function () {
        var index = helper.indexInArray(vm.displayList, vm.editing.id, 'id');
        if (index < 0) {
          return alert('找不到请求的内容');
        } else {
          window.opener.showScreen(index);
        }
      },
      setPlayer: function (id, score) {
        var playerData = playerList.id(id, vm.step);

        vm.editing = {
          type: 'score',
          'new': 1,

          name: playerData.name,
          photo: playerData.photo,
          school: playerData.school,
          no: playerData.no,
          score: score
        };
      }
    }
  });

  window.onunload = function () {
    vm.$destroy();
    window.opener.unloadControl();
  };
})();