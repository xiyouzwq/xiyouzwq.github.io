// 判断是否有 requestAnimationFrame 方法，如果有则模拟实现
window.requestAnimFrame =
window.requestAnimationFrame ||
window.webkitRequestAnimationFrame ||
window.mozRequestAnimationFrame ||
window.oRequestAnimationFrame ||
window.msRequestAnimationFrame ||
function(callback) {
    window.setTimeout(callback, 1000 / 30);
};
// 元素
var container = document.getElementById('game');
var levelText = document.querySelector('.game-level');
var nextLevelText = document.querySelector('.game-next-level');
var totalScoreText = document.querySelector('.game-info-text .score');
var allSuccessText = document.querySelector('.game-all-success > .game-info-text .score');
//画布
var canvas = document.getElementById('canvas');
var context = canvas.getContext('2d');
// 更新画布相关信息
var canvasWidth = canvas.clientWidth;
var canvasHeight = canvas.clientHeight;
//配置文件
var CONFIG = {
  status: 'start', // 游戏开始默认为开始中
  level: 1, // 游戏默认等级
  totalLevel: 6, // 总共的关卡
  numPerLine: 7, // 游戏默认每行10个aim
  canvasPadding: 28, // 默认画布的间隔
  bulletSize: 10, // 默认子弹长度
  bulletSpeed: 10, // 默认子弹的移动速度
  enemySpeed: 2, // 默认敌人移动距离
  enemySize: 50, // 默认敌人的尺寸
  enemyGap: 10,  // 默认敌人之间的间距
  enemyIcon: './img/enemy.png',
  enemyBoomIcon: './img/boom.png',
  enemyDirection: 'right', // 默认敌人是往右移动
  planeSpeed: 5, // 默认飞机每一步移动的距离
  planeSize: {
    width: 60,
    height: 100
  }, // 默认飞机的尺寸,
  planeIcon: './img/plane.png',
};
/**
 * 整个游戏对象
 */
var GAME = {
  /**
   * 初始化函数,这个函数只执行一次
   * @param  {object} opts 
   * @return {[type]}      [description]
   */
  init: function(opts) {
    var opts = Object.assign({}, opts, CONFIG);
    // 画布的间距
    var padding = opts.canvasPadding;
    var self = this;

    this.padding = padding;
    // 射击目标极限纵坐标
    this.monsterLimitY = canvasHeight - padding - opts.planeSize.height;
    // 射击目标对象极限横坐标
    this.monsterMinX = padding;
    this.monsterMaxX = canvasWidth - padding - opts.enemySize;

    // 飞机对象极限横坐标
    var planeWidth = opts.planeSize.width;
    this.planeMinX = padding;
    this.planeMaxX = canvasWidth - padding - planeWidth;
    this.planePosX = canvasWidth / 2 - planeWidth;
    this.planePosY = this.monsterLimitY;
    // 更新
    this.status = opts.status || 'start';
    this.score = 0;
    //this.keyBoard = new KeyBoard();

    // 加载图片资源，加载完成才能交互
    var resources = [
      opts.enemyIcon, 
      opts.enemyBoomIcon, 
      opts.planeIcon
    ];
    resourceOnload(resources, function(images) {
      // 更新图片
      opts.enemyIconImage = images[0];
      opts.enemyBoomIconImage = images[1];
      opts.planeIconImage = images[2];
      self.opts = opts;//这里把游戏参数对象加入了game对象中成为一个属性
      self.bindEvent();
    })
  },
  bindEvent: function() {
    var self = this;
    var playBtn = document.querySelector('.js-play');
    var replayBtns = document.querySelectorAll('.js-replay');
    var nextBtn = document.querySelector('.js-next');
    // 开始游戏按钮绑定
    playBtn.onclick = function() {
      self.play();
    };
    // 重新玩游戏按钮绑定
    replayBtns.forEach(function (btn) {
      btn.onclick = function() {
        self.opts.level = 1;
        self.play();
        self.score = 0;
        totalScoreText.innerText = self.score;
      };
    })
    // 下一关按钮绑定
    nextBtn.onclick = function() {
      self.opts.level += 1;
      self.play();
    };
  },
  /**
   * 更新游戏状态，分别有以下几种状态：
   * start  游戏前
   * playing 游戏中
   * failed 游戏失败
   * success 游戏成功
   * stop 游戏暂停
   * all-success 游戏通过
   * stop 游戏暂停（可选）
   */
  setStatus: function(status) {
    this.status = status;
    container.setAttribute("data-status", status);
  },
  play: function() {
    // 获取游戏初始化 level
    var self = this;
    var opts = this.opts;
    var padding = this.padding;
    var level = opts.level;
    var numPerLine = opts.numPerLine;
    var monsterGap = opts.enemyGap;
    var monsterSize = opts.enemySize;
    var monsterSpeed = opts.enemySpeed;
    var monsterIconImage = opts.enemyIconImage;
    var monsterBoomIconImage = opts.enemyBoomIconImage;
    var planeIconImage = opts.planeIconImage;
    // 清空射击目标对象数组
    this.monsters = []; 

    // 创建基础 monster 实例
    for (var i = 0; i < level; i++) {
      for (var j = 0; j < numPerLine; j++) {
        // 每个怪兽的创建
        var initOpt = {
          x: padding + j * (monsterSize + monsterGap), 
          y: padding + i * monsterSize,
          width: monsterSize,
          height: monsterSize,
          speed: monsterSpeed,
          imageMonster: monsterIconImage,
          imageBoom: monsterBoomIconImage
        }
        this.monsters.push(new Monster(initOpt));
      }
    }
    //创建飞机
    this.plane = new Plane({
      x: this.planePosX,
      y: this.planePosY,
      minX: this.planeMinX,
      maxX: this.planeMaxX,
      width: opts.planeSize.width,
      height: opts.planeSize.height,
      speed: opts.planeSpeed,
      bulletSize: opts.bulletSize, // 默认子弹长度
      bulletSpeed: opts.bulletSpeed, // 默认子弹的移动速度
      imagePlane: planeIconImage
    });
    //键盘操作对象
    this.keyBoard = new KeyBoard();

    this.renderLevel();
    //进入循环
    this.setStatus('playing');
    this.update();
  },
  update: function() {
    var self = this;
    var opts = this.opts;
    var keyBoard = this.keyBoard;
    var padding = opts.padding;
    var monsters = this.monsters;
    //未执行暂停，才能执行操作
    if(!keyBoard.isPause){
      //清除操作
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      //更新数据对象
      this.updatemonsters();
      this.updatePlane();
      //判断是否退出循环
      if(monsters.length === 0) {

        if(opts.level === opts.totalLevel) {
          endType = 'all-success';
          allSuccessText.innerText = this.score;
        } else {
          endType = 'success';
        }
        this.end(endType);
        
        return;
      }
      if(monsters[monsters.length - 1].y >= this.monsterLimitY) {
        //停止动画
        this.end('failed');
        //游戏失败，最终得分写入
        totalScoreText.innerText = this.score;
        return;
      }
      //绘制对象
      this.draw();
    }
    requestAnimFrame(function() {
      self.update()
    });
  },
  //更新飞机操作
  updatePlane: function() {
    var plane = this.plane;
    var keyBoard = this.keyBoard;
    // 如果按了左方向键或者长按左方向键
    if (keyBoard.pressedLeft) {
      plane.moveLeftRight('left');
    }
    // 如果按了右方向键或者长按右方向键
    if (keyBoard.pressedRight) {
      plane.moveLeftRight('right');
    }
    // 如果按了上方向键
    if (keyBoard.pressedUp || keyBoard.pressedSpace) {
      // 飞机射击子弹
      plane.shoot();
      // 取消飞机射击
      keyBoard.pressedUp = false;
      keyBoard.pressedSpace = false;
    }
  },
  /**
   * 更新敌人实例数组
   */
  updatemonsters: function() {
    var opts = this.opts;
    var padding = opts.padding;
    var monsters = this.monsters;
    var plane = this.plane;
    var i = monsters.length;

    // 判断目标元素是否需要向下
    var monsterNeedDown = false; 
    // 获取当前目标实例数组中最小的横坐标和最大的横坐标
    var monstersBoundary = getHorizontalBoundary(monsters);

    // 判断目标是否到了水平边界，是的话更换方向且需要向下
    if (monstersBoundary.minX < this.monsterMinX 
      || monstersBoundary.maxX > this.monsterMaxX ) {
      opts.enemyDirection = opts.enemyDirection === 'right' ? 'left' : 'right'; 
      monsterNeedDown = true;
    }

    // 循环更新怪兽
    while (i--) {
      var monster = monsters[i];
      // 是否需要向下移动
      if (monsterNeedDown) {
        monster.moveDown();
      }
      // 水平位移
      monster.moveLeftRight(opts.enemyDirection);
      switch(monster.monsterStatus) {
        case 'normal':
          // 判断是否击中未爆炸的敌人
          if (plane.hasHit(monster)) {
            // 设置爆炸时长展示第一帧）
            monster.booming();
          }
          break;
        case 'booming':
          monster.booming();
          break;
        case 'boomed':
          this.monsters.splice(i, 1);
          this.score += 1;
      }
    }
  },
  end: function(status){
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    this.setStatus(status);
  },
  draw: function() {
    this.currentScore();
    this.plane.draw();
    this.monsters.forEach(function(monster){
      monster.draw();
    });
  },
  renderLevel: function() {
    levelText.innerText = '当前Level：' + this.opts.level;
    nextLevelText.innerText = '下一个Level： ' + (this.opts.level + 1);
  },
  currentScore: function() {
    context.font = '18px 黑体';
    context.fillStyle = '#fff';
    context.fillText('分数：' + this.score, 20, 38);
  }
};


// 初始化
GAME.init();

/**
 * 获取目标对象实例们中最小的横坐标和最大的横坐标
 */
function getHorizontalBoundary(arrs) {
  var minX, maxX;
  arrs.forEach(function (item) {
    if (!minX && !maxX) {
      minX = item.x;
      maxX = item.x;
    } else {
      if (item.x < minX) {
        minX = item.x;
      }
      if (item.x > maxX) {
        maxX = item.x;
      }
    }
  });
  return {
    minX: minX,
    maxX: maxX
  }
}

/**
 * 资源加载
 * @param  {Array} resources 资源列表
 * @return {[type]}           [description]
 */
function resourceOnload(resources, callback) {
 var total = resources.length;
 var finish = 0;
 var images = [];
 for(var i = 0 ; i < total; i++){
    images[i] = new Image()
    images[i].src = resources[i]
    // 图片加载完成
    images[i].onload = function(){
       // 加载完成
       finish += 1;
       if( finish == total){
          //全部加载完成
          callback(images);
       }
    }
 }
}

//基础类
function Element(opts) {
  this.x = opts.x;
  this.y = opts.y;
  this.width = opts.width;
  this.height = opts.height;
  this.speed = opts.speed;
}

Element.prototype.move = function(addX, addY) {
  this.x += addX;
  this.y += addY;
}

Element.prototype.draw = function() {

}

function inheritPrototype(child, parent) {
  var pro = Object.create(parent.prototype);
  pro.constructor = child;
  child.prototype = pro;
}

//怪兽
function Monster(opts) {
  Element.call(this,opts);
  this.monsterStatus = 'normal';
  this.iconMonster = opts.imageMonster;
  this.iconBoom = opts.imageBoom;
  // 特有属性，计算爆炸的帧次
  this.boomCount = 0;
}

inheritPrototype(Monster, Element);

Monster.prototype.moveDown=function() {
  this.move(0, this.height);
},
Monster.prototype.moveLeftRight=function(direction){
  if(direction === 'left') {
    this.move(-this.speed, 0);
  } else {
    this.move(this.speed, 0);
  }
},
Monster.prototype.draw=function() {
  switch(this.monsterStatus) {
    case 'normal':
      context.drawImage(this.iconMonster, this.x, this.y, this.width, this.height);
      break;
    case 'booming':
      context.drawImage(this.iconBoom, this.x, this.y, this.width, this.height);
      break;
  }
}
Monster.prototype.booming = function() {
  this.monsterStatus = 'booming';
  this.boomCount += 1;
  if (this.boomCount > 4) {
    this.monsterStatus = 'boomed';
  }
}


//飞机
function Plane(opts) {
  Element.call(this,opts);
  this.minX = opts.minX;
  this.maxX = opts.maxX;
  this.iconPlane = opts.imagePlane;

  // 子弹属性
  this.bullets = [];
  this.bulletSpeed = opts.bulletSpeed;
  this.bulletSize = opts.bulletSize;
}

inheritPrototype(Plane, Element);

Plane.prototype.moveLeftRight = function(direction) {
  var speed = this.speed;
  var addX;
  if(direction === 'left') {
    addX = this.x < this.minX ? 0 : -speed;
  } else {
    addX = this.x > this.maxX ? 0 : speed;
  }
  this.move(addX, 0);
}

Plane.prototype.draw = function() {
  context.drawImage(this.iconPlane, this.x, this.y, this.width, this.height);
  this.drawBullets();
}

Plane.prototype.shoot = function() {
  // 创建子弹,子弹位置是居中射出
  var x = this.x + this.width / 2;
  // 创建子弹
  this.bullets.push(new Bullet({
    x: x,
    y: this.y,
    width: 1,
    height: this.bulletSize,
    speed: this.bulletSpeed 
  }));
}

Plane.prototype.drawBullets = function () {
  var bullets = this.bullets;
  var i = bullets.length;
  while (i--) {
    var bullet = bullets[i];
    // 更新子弹的位置
    bullet.fly();
    // 如果子弹对象超出边界,则删除
    if (bullet.y <= 0) {
      //如果子弹实例下降到底部，则需要在drops数组中清除该子弹实例对象
      bullets.splice(i, 1);
    } else {
      // 未超出的则绘画子弹
      bullet.draw();
    }
  }
}

Plane.prototype.hasHit = function(aim) {
  var bullets = this.bullets;
  var hasHit = false;
  for (var j = bullets.length - 1; j >= 0; j--) {
    // 如果子弹击中的是目标对象的范围，则销毁子弹
    if (bullets[j].crash(aim)){
      this.bullets.splice(j, 1);
      hasHit = true;
      break;
    }
  }
  return hasHit;
}

//子弹
function Bullet(opts) {
  Element.call(this, opts);
}
inheritPrototype(Bullet, Element);

Bullet.prototype.fly = function() {
  this.move(0, -this.speed);
}
Bullet.prototype.draw = function(){
  context.beginPath();
  context.strokeStyle = '#fff';
  context.moveTo(this.x, this.y);
  context.lineTo(this.x, this.y - this.height); // 子弹尺寸不支持修改);
  context.closePath();
  context.stroke();
}
Bullet.prototype.crash = function(aim) {
  var crashX = aim.x < this.x && this.x < (aim.x + aim.width);
  var crashY = aim.y < this.y && this.y < (aim.y + aim.height);
  // 如果子弹击中的是目标对象的范围，则销毁子弹
  if (crashX && crashY){
    return true;
  }
  return false;
}
/**
 * 键盘操作相关对象
 */
function KeyBoard() {
  document.onkeydown = this.keydown.bind(this);
  document.onkeyup = this.keyup.bind(this);
}

KeyBoard.prototype = {
  pressedLeft: false, // 是否点击左边
  pressedRight: false, // 是否点击右边
  pressedUp: false, // 是否按了上报
  pressedSpace: false, // 是否按了上报
  isPause: false,//是否暂停
  keydown: function(event) {
  	 // 获取键位
    var key = event.keyCode;
    switch(key) {
      // 点击空格
      case 32: 
      	this.pressedSpace = true;
        break;
      // 点击向左
      case 37: 
        this.pressedLeft = true;
        this.pressedRight = false;
        break;
      // 点击向上
      case 38: 
        this.pressedUp = true;
        break;
      // 点击向右
      case 39: 
        this.pressedLeft = false;
        this.pressedRight = true;
        break;
    } 
  },
  keyup: function(event) {
    // 获取键位
    var key = event.keyCode;
    switch(key) {
      case 32: 
      	this.pressedSpace = false;	
        break;
      case 37:
        this.pressedLeft = false;
      case 38: 
        this.pressedUp = false;
        break;
      case 39: 
        this.pressedRight = false;
        break;
      case 80://暂停键
        if(this.isPause) this.isPause = false;
        else this.isPause = true;
        break;
    } 
  }
};
