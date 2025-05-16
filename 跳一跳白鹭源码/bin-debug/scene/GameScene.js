var __reflect = (this && this.__reflect) || function (p, c, t) {
    p.__class__ = c, t ? t.push(c) : t = [c], p.__types__ = p.__types__ ? t.concat(p.__types__) : t;
};
var __extends = this && this.__extends || function __extends(t, e) { 
 function r() { 
 this.constructor = t;
}
for (var i in e) e.hasOwnProperty(i) && (t[i] = e[i]);
r.prototype = e.prototype, t.prototype = new r();
};
var GameScene = (function (_super) {
    __extends(GameScene, _super);
    function GameScene() {
        var _this = _super.call(this) || this;
        // 所有方块资源的数组
        _this.blockSourceNames = [];
        // 所有方块的数组
        _this.blockArr = [];
        // 所有回收方块的数组
        _this.reBackBlockArr = [];
        // 下一个盒子方向(1靠右侧出现/-1靠左侧出现)
        _this.direction = 1;
        // 随机盒子距离跳台的距离
        _this.minDistance = 240;
        _this.maxDistance = 400;
        // tanθ角度值
        _this.tanAngle = 0.556047197640118;
        // 跳的距离
        _this.jumpDistance = 0;
        // 判断是否是按下状态
        _this.isReadyJump = false;
        // 左侧跳跃点
        _this.leftOrigin = { "x": 180, "y": 350 };
        // 右侧跳跃点
        _this.rightOrigin = { "x": 505, "y": 350 };
        // 游戏中得分
        _this.score = 0;
        // 1. 新增词库、题目索引、倒计时等变量
        _this.wordList = [];
        _this.currentWordIndex = 0;
        _this.quizTimeLeft = 10;
        _this.quizOptions = [];
        _this.quizAnswer = '';
        _this.quizOptionBtns = [];
        _this.quizIsActive = false;
        return _this;
    }
    GameScene.prototype.partAdded = function (partName, instance) {
        _super.prototype.partAdded.call(this, partName, instance);
    };
    GameScene.prototype.childrenCreated = function () {
        _super.prototype.childrenCreated.call(this);
        this.init();
        this.reset();
        // 2. 游戏开始时加载词库
        this.loadWordList();
    };
    GameScene.prototype.init = function () {
        this.blockSourceNames = ["block1_png", "block2_png", "block3_png"];
        // 初始化音频
        this.pushVoice = RES.getRes('push_mp3');
        this.jumpVoice = RES.getRes('jump_mp3');
        // 添加触摸事件
        this.blockPanel.touchEnabled = true;
        this.blockPanel.addEventListener(egret.TouchEvent.TOUCH_BEGIN, this.onKeyDown, this);
        this.blockPanel.addEventListener(egret.TouchEvent.TOUCH_END, this.onKeyUp, this);
        // 绑定结束按钮
        this.restart.addEventListener(egret.TouchEvent.TOUCH_TAP, this.restartHandler, this);
        // 设置玩家的锚点
        this.player.anchorOffsetX = this.player.width / 2;
        this.player.anchorOffsetY = this.player.height - 20;
        // 心跳计时器
        egret.Ticker.getInstance().register(function (dt) {
            dt /= 1000;
            if (this.isReadyJump) {
                this.jumpDistance += 300 * dt;
            }
        }, this);
    };
    // 按下的事件逻辑
    GameScene.prototype.onKeyDown = function () {
        // 播放按下的音频
        this.pushSoundChannel = this.pushVoice.play(0, 1);
        // 变形
        egret.Tween.get(this.player).to({
            scaleY: 0.5
        }, 3000);
        this.isReadyJump = true;
    };
    // 放开
    GameScene.prototype.onKeyUp = function () {
        var _this = this;
        // 判断是否是在按下状态
        if (!this.isReadyJump) {
            return;
        }
        // 声明落点坐标
        if (!this.targetPos) {
            this.targetPos = new egret.Point();
        }
        // 立刻让屏幕不可点,等小人落下后重新可点
        this.blockPanel.touchEnabled = false;
        // 停止播放按压音频,并且播放弹跳音频
        this.pushSoundChannel.stop();
        this.jumpVoice.play(0, 1);
        // 清楚所有动画
        egret.Tween.removeAllTweens();
        this.blockPanel.addChild(this.player);
        // 结束跳跃状态
        this.isReadyJump = false;
        // 落点坐标
        this.targetPos.x = this.player.x + this.jumpDistance * this.direction;
        // 根据落点重新计算斜率,确保小人往目标中心跳跃
        this.targetPos.y = this.player.y + this.jumpDistance * (this.currentBlock.y - this.player.y) / (this.currentBlock.x - this.player.x) * this.direction;
        // 执行跳跃动画
        egret.Tween.get(this).to({ factor: 1 }, 500).call(function () {
            _this.player.scaleY = 1;
            _this.jumpDistance = 0;
            // 判断跳跃是否成功
            _this.judgeResult();
        });
        // 执行小人空翻动画
        this.player.anchorOffsetY = this.player.height / 2;
        egret.Tween.get(this.player).to({ rotation: this.direction > 0 ? 360 : -360 }, 200).call(function () {
            _this.player.rotation = 0;
        }).call(function () {
            _this.player.anchorOffsetY = _this.player.height - 20;
        });
    };
    // 重置游戏
    GameScene.prototype.reset = function () {
        // 清空舞台
        this.blockPanel.removeChildren();
        this.blockArr = [];
        // 添加一个方块
        var blockNode = this.createBlock();
        blockNode.touchEnabled = false;
        // 设置方块的起始位置
        blockNode.x = 200;
        blockNode.y = this.height / 2 + blockNode.height;
        this.currentBlock = blockNode;
        // 摆正小人的位置
        this.player.y = this.currentBlock.y;
        this.player.x = this.currentBlock.x;
        this.blockPanel.addChild(this.player);
        this.direction = 1;
        // 添加积分
        this.blockPanel.addChild(this.scoreLabel);
        // 添加下一个方块
        this.addBlock();
    };
    // 添加一个方块
    GameScene.prototype.addBlock = function () {
        // 随机一个方块
        var blockNode = this.createBlock();
        // 设置位置
        var distance = this.minDistance + Math.random() * (this.maxDistance - this.minDistance);
        if (this.direction > 0) {
            blockNode.x = this.currentBlock.x + distance;
            blockNode.y = this.currentBlock.y - distance * this.tanAngle;
        }
        else {
            blockNode.x = this.currentBlock.x - distance;
            blockNode.y = this.currentBlock.y - distance * this.tanAngle;
        }
        this.currentBlock = blockNode;
    };
    // 工厂方法,创建一个方块
    GameScene.prototype.createBlock = function () {
        var blockNode = null;
        if (this.reBackBlockArr.length) {
            // 回收池里面有,则直接取
            blockNode = this.reBackBlockArr.splice(0, 1)[0];
        }
        else {
            // 回收池里面没有,则重新创建
            blockNode = new eui.Image();
        }
        // 使用随机背景图
        var n = Math.floor(Math.random() * this.blockSourceNames.length);
        blockNode.source = this.blockSourceNames[n];
        this.blockPanel.addChild(blockNode);
        // 设置方块的锚点
        blockNode.anchorOffsetX = 222;
        blockNode.anchorOffsetY = 78;
        // 把新创建的block添加进入blockArr里
        this.blockArr.push(blockNode);
        return blockNode;
    };
    GameScene.prototype.judgeResult = function () {
        var _this = this;
        // 根据this.jumpDistance来判断跳跃是否成功
        if (Math.pow(this.currentBlock.x - this.player.x, 2) + Math.pow(this.currentBlock.y - this.player.y, 2) <= 70 * 70) {
            // 更新积分
            this.score++;
            this.scoreLabel.text = this.score.toString();
            // 随机下一个方块出现的位置
            this.direction = Math.random() > 0.5 ? 1 : -1;
            // 当前方块要移动到相应跳跃点的距离
            var blockX, blockY;
            blockX = this.direction > 0 ? this.leftOrigin.x : this.rightOrigin.x;
            blockY = this.height / 2 + this.currentBlock.height;
            // 小人要移动到的点.
            var playerX, PlayerY;
            playerX = this.player.x - (this.currentBlock.x - blockX);
            PlayerY = this.player.y - (this.currentBlock.y - blockY);
            // 更新页面
            this.update(this.currentBlock.x - blockX, this.currentBlock.y - blockY);
            // 更新小人的位置
            egret.Tween.get(this.player).to({
                x: playerX,
                y: PlayerY
            }, 1000).call(function () {
                // 开始创建下一个方块
                _this.addBlock();
                // 让屏幕重新可点;
                _this.blockPanel.touchEnabled = true;
            });
            // console.log('x' + x);
            console.log(this.currentBlock.x);
        }
        else {
            // 失败,弹出重新开始的panel
            console.log('游戏失败!');
            this.overPanel.visible = true;
            this.overScoreLabel.text = this.score.toString();
        }
    };
    //
    GameScene.prototype.update = function (x, y) {
        egret.Tween.removeAllTweens();
        for (var i = this.blockArr.length - 1; i >= 0; i--) {
            var blockNode = this.blockArr[i];
            if (blockNode.x + (blockNode.width - 222) < 0 || blockNode.x - 222 > this.width || blockNode.y - 78 > this.height) {
                // 方块超出屏幕,从显示列表中移除
                this.blockPanel.removeChild(blockNode);
                this.blockArr.splice(i, 1);
                // 添加到回收数组中
                this.reBackBlockArr.push(blockNode);
            }
            else {
                // 没有超出屏幕的话,则移动
                egret.Tween.get(blockNode).to({
                    x: blockNode.x - x,
                    y: blockNode.y - y
                }, 1000);
            }
        }
        console.log(this.blockArr);
    };
    // 重新一局
    GameScene.prototype.restartHandler = function () {
        // 隐藏结束场景
        this.overPanel.visible = false;
        // 置空积分
        this.score = 0;
        this.scoreLabel.text = this.score.toString();
        // 开始防止方块
        this.reset();
        // 游戏场景可点
        this.blockPanel.touchEnabled = true;
    };
    Object.defineProperty(GameScene.prototype, "factor", {
        //添加factor的set,get方法,注意用public  
        get: function () {
            return 0;
        },
        //计算方法参考 二次贝塞尔公式  
        set: function (value) {
            this.player.x = (1 - value) * (1 - value) * this.player.x + 2 * value * (1 - value) * (this.player.x + this.targetPos.x) / 2 + value * value * (this.targetPos.x);
            this.player.y = (1 - value) * (1 - value) * this.player.y + 2 * value * (1 - value) * (this.targetPos.y - 300) + value * value * (this.targetPos.y);
        },
        enumerable: true,
        configurable: true
    });
    // 2. 加载词库，优先网络，失败用本地
    GameScene.prototype.loadWordList = function () {
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'http://yourwind.site:15001/py/get_bookunit_word?refresh=0&bookId=48&unitId=235', true);
        xhr.setRequestHeader('Referer', 'https://www.yourwind.fun');
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    try {
                        var res = JSON.parse(xhr.responseText);
                        if (res.data && res.data.length > 0) {
                            // 题库格式兼容
                            self.wordList = res.data[0];
                            self.currentWordIndex = 0;
                            self.showQuizPanel();
                            return;
                        }
                    }
                    catch (e) { }
                }
                // 网络失败，读取本地
                var localXhr_1 = new XMLHttpRequest();
                localXhr_1.open('GET', 'data.json', true);
                localXhr_1.onreadystatechange = function () {
                    if (localXhr_1.readyState == 4) {
                        if (localXhr_1.status == 200) {
                            try {
                                var data = JSON.parse(localXhr_1.responseText);
                                if (data && data.data && data.data.length > 0) {
                                    self.wordList = data.data[0];
                                    self.currentWordIndex = 0;
                                    self.showQuizPanel();
                                    return;
                                }
                            }
                            catch (e) { }
                        }
                        alert('词库加载失败！');
                    }
                };
                localXhr_1.send();
            }
        };
        xhr.send();
    };
    // 3. 题目弹窗生成与逻辑
    GameScene.prototype.showQuizPanel = function () {
        if (!this.wordList || this.wordList.length === 0)
            return;
        this.quizIsActive = true;
        // 先移除旧弹窗
        if (this.quizPanel && this.quizPanel.parent) {
            this.quizPanel.parent.removeChild(this.quizPanel);
        }
        // 取当前单词
        var word = this.wordList[this.currentWordIndex];
        // 随机生成选项
        var options = [word.zh];
        while (options.length < 3) {
            var idx = Math.floor(Math.random() * this.wordList.length);
            var zh = this.wordList[idx].zh;
            if (options.indexOf(zh) === -1)
                options.push(zh);
        }
        // 打乱选项
        options = options.sort(function () { return Math.random() - 0.5; });
        this.quizOptions = options;
        this.quizAnswer = word.zh;
        // 创建弹窗
        var panel = new eui.Group();
        panel.width = 500;
        panel.height = 300;
        panel.horizontalCenter = 0;
        panel.verticalCenter = 0;
        // 用Shape绘制背景色
        var bg = new egret.Shape();
        bg.graphics.beginFill(0x222222, 0.95);
        bg.graphics.drawRect(0, 0, 500, 300);
        bg.graphics.endFill();
        panel.addChild(bg);
        // 英文单词
        var wordLabel = new eui.Label();
        wordLabel.text = "'" + word.en + "' \u7684\u610F\u601D\u662F?";
        wordLabel.size = 36;
        wordLabel.textColor = 0xffffff;
        wordLabel.horizontalCenter = 0;
        wordLabel.top = 30;
        panel.addChild(wordLabel);
        this.quizWordLabel = wordLabel;
        // 选项按钮
        this.quizOptionBtns = [];
        for (var i = 0; i < 3; i++) {
            var btn = new eui.Button();
            btn.label = options[i];
            btn.width = 160;
            btn.height = 60;
            btn.horizontalCenter = (i === 1 ? 120 : (i === 0 ? -120 : 0));
            btn.top = 100 + (i === 2 ? 80 : 0);
            btn.addEventListener(egret.TouchEvent.TOUCH_TAP, this.onQuizOptionTap, this);
            panel.addChild(btn);
            this.quizOptionBtns.push(btn);
        }
        // 倒计时
        var timeLabel = new eui.Label();
        timeLabel.text = '时间: 10';
        timeLabel.size = 32;
        timeLabel.textColor = 0xffff00;
        timeLabel.horizontalCenter = 0;
        timeLabel.bottom = 30;
        panel.addChild(timeLabel);
        this.quizTimeLabel = timeLabel;
        // 添加到场景
        this.addChild(panel);
        this.quizPanel = panel;
        // 启动倒计时
        this.quizTimeLeft = 10;
        if (this.quizTimer) {
            this.quizTimer.stop();
            this.quizTimer.removeEventListener(egret.TimerEvent.TIMER, this.onQuizTimer, this);
        }
        this.quizTimer = new egret.Timer(1000, 10);
        this.quizTimer.addEventListener(egret.TimerEvent.TIMER, this.onQuizTimer, this);
        this.quizTimer.addEventListener(egret.TimerEvent.TIMER_COMPLETE, this.onQuizTimeout, this);
        this.quizTimer.start();
    };
    // 选项点击
    GameScene.prototype.onQuizOptionTap = function (e) {
        if (!this.quizIsActive)
            return;
        var btn = e.currentTarget;
        var isCorrect = btn.label === this.quizAnswer;
        this.quizIsActive = false;
        this.quizTimer.stop();
        this.removeQuizPanel();
        this.handleQuizResult(isCorrect);
    };
    // 倒计时
    GameScene.prototype.onQuizTimer = function () {
        this.quizTimeLeft--;
        this.quizTimeLabel.text = '时间: ' + this.quizTimeLeft;
    };
    GameScene.prototype.onQuizTimeout = function () {
        if (!this.quizIsActive)
            return;
        this.quizIsActive = false;
        this.removeQuizPanel();
        this.handleQuizResult(false);
    };
    GameScene.prototype.removeQuizPanel = function () {
        if (this.quizPanel && this.quizPanel.parent) {
            this.quizPanel.parent.removeChild(this.quizPanel);
        }
    };
    // 4. 处理答题结果，前进/后退
    GameScene.prototype.handleQuizResult = function (isCorrect) {
        if (isCorrect) {
            // 正确，前进一格
            this.jumpForward();
        }
        else {
            // 错误，后退一格
            this.jumpBackward();
        }
    };
    // 前进一格
    GameScene.prototype.jumpForward = function () {
        var _this = this;
        // 更新分数
        this.score++;
        this.scoreLabel.text = this.score.toString();
        // 随机下一个方块出现的位置
        this.direction = Math.random() > 0.5 ? 1 : -1;
        // 当前方块要移动到相应跳跃点的距离
        var blockX, blockY;
        blockX = this.direction > 0 ? this.leftOrigin.x : this.rightOrigin.x;
        blockY = this.height / 2 + this.currentBlock.height;
        // 小人要移动到的点
        var playerX, PlayerY;
        playerX = this.player.x - (this.currentBlock.x - blockX);
        PlayerY = this.player.y - (this.currentBlock.y - blockY);
        // 更新页面
        this.update(this.currentBlock.x - blockX, this.currentBlock.y - blockY);
        // 更新小人的位置并添加下一个方块
        egret.Tween.get(this.player).to({
            x: playerX,
            y: PlayerY
        }, 1000).call(function () {
            // 创建下一个方块
            _this.addBlock();
            // 屏幕可点击
            _this.blockPanel.touchEnabled = true;
            // 进入下一题
            _this.currentWordIndex++;
            if (_this.currentWordIndex >= _this.wordList.length) {
                _this.currentWordIndex = 0;
            }
            // 动画完成后再显示下一个题目
            _this.showQuizPanel();
        });
    };
    // 后退一格
    GameScene.prototype.jumpBackward = function () {
        var _this = this;
        // 回退到上一个方块，或初始位置
        if (this.score > 0) {
            this.score--;
            this.scoreLabel.text = this.score.toString();
            // 回退动画
            // 小人要移动到的回退点
            var playerX = this.currentBlock.x;
            var playerY = this.currentBlock.y;
            // 播放回退动画
            egret.Tween.get(this.player).to({
                x: playerX,
                y: playerY
            }, 1000).call(function () {
                // 动画完成后再显示下一个题目
                _this.currentWordIndex++;
                if (_this.currentWordIndex >= _this.wordList.length) {
                    _this.currentWordIndex = 0;
                }
                _this.showQuizPanel();
            });
        }
        else {
            // 回到初始位置，弹窗提示重新开始
            this.showRestartPanel();
        }
    };
    // 5. 回到初始位置弹窗
    GameScene.prototype.showRestartPanel = function () {
        var _this = this;
        var panel = new eui.Group();
        panel.width = 400;
        panel.height = 200;
        panel.horizontalCenter = 0;
        panel.verticalCenter = 0;
        // 用Shape绘制背景色
        var bg = new egret.Shape();
        bg.graphics.beginFill(0x222222, 0.95);
        bg.graphics.drawRect(0, 0, 400, 200);
        bg.graphics.endFill();
        panel.addChild(bg);
        var label = new eui.Label();
        label.text = '已回到起点，是否重新开始？';
        label.size = 32;
        label.textColor = 0xffffff;
        label.horizontalCenter = 0;
        label.top = 40;
        panel.addChild(label);
        var btn = new eui.Button();
        btn.label = '重新开始';
        btn.width = 160;
        btn.height = 60;
        btn.horizontalCenter = 0;
        btn.bottom = 40;
        btn.addEventListener(egret.TouchEvent.TOUCH_TAP, function () {
            if (panel.parent)
                panel.parent.removeChild(panel);
            _this.score = 0;
            _this.scoreLabel.text = _this.score.toString();
            _this.currentWordIndex = 0;
            _this.showQuizPanel();
        }, this);
        panel.addChild(btn);
        this.addChild(panel);
    };
    return GameScene;
}(eui.Component));
__reflect(GameScene.prototype, "GameScene", ["eui.UIComponent", "egret.DisplayObject"]);
