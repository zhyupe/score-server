(function (self) {
  // From artTemplate
  var KEYWORDS =
    // 关键字
    'break,case,catch,continue,debugger,default,delete,do,else,false'
    + ',finally,for,function,if,in,instanceof,new,null,return,switch,this'
    + ',throw,true,try,typeof,var,void,while,with'

      // 保留字
    + ',abstract,boolean,byte,char,class,const,double,enum,export,extends'
    + ',final,float,goto,implements,import,int,interface,long,native'
    + ',package,private,protected,public,short,static,super,synchronized'
    + ',throws,transient,volatile'

      // ECMA 5 - use strict
    + ',arguments,let,yield'

    + ',undefined';

  var REMOVE_RE = /\/\*[\w\W]*?\*\/|\/\/[^\n]*\n|\/\/[^\n]*$|"(?:[^"\\]|\\[\w\W])*"|'(?:[^'\\]|\\[\w\W])*'|\s*\.\s*[$\w\.]+/g;
  var SPLIT_RE = /[^\w$]+/g;
  var KEYWORDS_RE = new RegExp(["\\b" + KEYWORDS.replace(/,/g, '\\b|\\b') + "\\b"].join('|'), 'g');
  var NUMBER_RE = /^\d[^,]*|,\d[^,]*/g;
  var BOUNDARY_RE = /^,+|,+$/g;
  var SPLIT2_RE = /^$|,+/;

  // 获取变量
  var getVariable = function (code) {
    return code
      .replace(REMOVE_RE, '')
      .replace(SPLIT_RE, ',')
      .replace(KEYWORDS_RE, '')
      .replace(NUMBER_RE, '')
      .replace(BOUNDARY_RE, '')
      .split(SPLIT2_RE);
  };

  var computeHelper = {
    round: function (score) {
      return Math.round(score * 100) / 100;
    },
    floor: function (score) {
      return Math.floor(computeHelper.round(score));
    },
    ceil: function (score) {
      return Math.floor(computeHelper.round(score));
    },
    number: function (score) {
      score = parseFloat(score);
      return isNaN(score) ? 0 : score;
    }
  };

  var helper = {
    /**
     * 最大同时评分选手数（建议：(0,3]）
     */
    MAX_VOTING: 3,
    /**
     * 获取 item 在 arr 中的索引值
     * @param arr 数组
     * @param item 查找项
     * @param key 如果 arr 为 [object]，指定要查找的属性值
     * @returns {number}
     */
    indexInArray: function (arr, item, key) {
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
    },
    /**
     * 将 item 置于 arr[index]
     * @param arr 数组
     * @param index 索引
     * @param item 内容
     * @returns {Array}
     */
    setItem: function (arr, index, item) {
      var backup = [], i;
      for (i = 0; i < arr.length; i++)
        backup[i] = arr[i];

      backup[index] = item;
      return backup;
    },
    /**
     * 计算平均分数（若 >= 4 个分数，去极值）
     * @param score 分数数组
     * @returns {{max: number, min: number, count: number, result: number}}
     */
    avgScore: function (score) {
      var maxScore = -1, minScore = -1, retScore = 0, retCount = 0;

      for (var i = 0; i < score.length; i++) {
        // Ensure the score is number.
        score[i] = helper.parseScore(score[i]);

        if (score[i] == -1)
          continue;

        retCount++;

        if (score[i] > maxScore)
          maxScore = score[i];
        if (score[i] < minScore || minScore == -1)
          minScore = score[i];

        retScore += score[i];
      }

      if (retCount >= 5) {
        retScore = Math.round(100 * (retScore - minScore - maxScore) / (retCount - 2)) / 100;
      } else if (retCount > 0) {
        retScore = Math.round(100 * retScore / retCount) / 100;
      }

      return {
        max: maxScore,
        min: minScore,
        count: retCount,
        result: retScore
      };
    },
    /**
     * 以一般格式输出分数
     * @param score 分数
     * @returns 分数 或 未提交
     */
    formatScore: function (score) {
      if (score == -1)
        return '未提交';
      else
        return helper.toFixed(score);
    },
    /**
     * 输出平均分数
     * @param scoreObj 分数对象
     * @param count 是否输出统计
     * @returns {*}
     */
    formatAvgScore: function (scoreObj, count) {
      var scoreArr = helper.avgScore(scoreObj.score);
      if (!!count) {
        return helper.toFixed(scoreArr.result) + '<div class="mui--text-dark-secondary" style="color:' + (scoreArr.count == scoreObj.score.length ? 'green' : 'red') + '">' + scoreArr.count + '/' + scoreObj.score.length + '</div>';
      } else {
        return helper.toFixed(scoreArr.result);
      }
    },
    /**
     * 处理分数并以 总分 的格式输出
     * @param scoreObj 分数对象
     * @returns {*}
     */
    formatResultScore: function (scoreObj) {
      var scoreArr;
      if (scoreObj.score) {
        scoreArr = helper.avgScore(scoreObj.score);
      } else {
        // non-voting procedure
        scoreArr = { result: 0 };
      }

      scoreArr.result += helper.parseScore(scoreObj.extra);
      scoreArr.result = computeHelper.round(scoreArr.result);

      var output = (scoreArr.result > 100 || scoreArr.result < 0)
        ? ('<span style="color:red">'+helper.toFixed(scoreArr.result)+'</span>')
        : helper.toFixed(scoreArr.result);

      if (scoreArr.result == scoreObj.result) {
        return output;
      } else if (scoreObj.result == -1) {
        return output + '<br><span class="mui--text-dark-secondary">(未提交)</span>';
      } else {
        return output + '<br><span class="mui--text-dark-secondary">('+scoreObj.result+')</span>';
      }
    },
    /**
     * 处理评委评分
     * @param score 分数
     * @param array 分数数组
     * @returns {*}
     */
    formatVoterScore: function (score, array) {
      if (score == -1)
        return '未评分';

      var scoreArr = helper.avgScore(array);
      if (scoreArr.count >= 5) {
        if (scoreArr.max == score) {
          return '<span style="color:#090">' + helper.toFixed(score) + '</span>';
        }
        if (scoreArr.min == score) {
          return '<span style="color:#f90">' + helper.toFixed(score) + '</span>';
        }
      }

      return helper.toFixed(score);
    },
    /**
     * 以表达式计算显示的分数
     * @param array 总分分数数组
     * @param expression 表达式
     * @returns {*}
     */
    computeScore: function (array, expression) {
      var uniq = {}, varCode = '', i, count = array.length;
      var vars = getVariable(expression);
      for (i = 0; i < vars.length; i++) {
        if (!vars[i] || uniq[vars[i]])
          continue;

        if (computeHelper[vars[i]]) {
          varCode += ',' + vars[i] + '=$helper.' + vars[i];
        } else if (vars[i].charAt(0) == '$') {
          var id = parseInt(vars[i].substr(1));
          if (isNaN(id) || id >= array.length) {
            varCode += ',' + vars[i] + '=$data.' + vars[i];
          } else {
            varCode += ',' + vars[i] + '=$data.score[' + id + ']';
          }
        } else {
          varCode += ',' + vars[i] + '=$data.' + vars[i];
        }
        uniq[vars[i]] = true;
      }

      var original = [];
      for (i = 0; i < array.length; i++) {
        if (array[i] == -1) {
          original[i] = 0;
          count--;
        } else {
          original[i] = array[i];
        }
      }


      var func = new Function('$data', '$helper', 'try{var $out' + varCode + ';return ('+expression+');}catch(e){console.error(e);return -2;}');
      var score = computeHelper.number(func.call(null, {score: original, count: count}, computeHelper));
      return computeHelper.round(score);
    },
    /**
     * 分数排序
     * @param list 原始分数列表
     * @returns {Array}
     */
    sortScore: function (list) {
      var newArr = [], i;
      for (i = 0; i < list.length; i++) {
        newArr[i] = list[i];
      }

      newArr.sort(function (a, b) {
        return b.result - a.result;
      });

      return newArr;
    },
    /**
     * 将数字转换为两位小数的字符串
     * @param score 数字
     * @param addSpan 是否在小数部分加入 span
     * @returns {string}
     */
    toFixed: function (score, addSpan) {
      score = Math.round(score * 100).toString();
      if (score.length == 1)
        score = '00' + score;
      else if (score.length == 2)
        score = '0' + score;

      if (addSpan)
        return score.substr(0, score.length - 2) + '<span>.' + score.substr(-2) + '</span>';
      else
        return score.substr(0, score.length - 2) + '.' + score.substr(-2);
    },
    /**
     * 将分数转换为数字
     * @param score 分数
     * @returns {*}
     */
    parseScore: function (score) {
      if (typeof score !== 'number')
        score = computeHelper.number(score);

      return computeHelper.round(score);
    },
    /**
     * 更改数组中的元素
     * @param obj
     * @param index
     * @param value
     */
    $set: function (obj, index, value) {
      if (obj.$set) {
        obj.$set(index, value);
      } else {
        obj[index] = value;
      }
    }
  };

  if (typeof exports !== 'undefined') {
    module.exports = helper;
  } else if (typeof window !== 'undefined') {
    window.helper = helper;
  } else {
    self.helper = helper;
  }
})(this);