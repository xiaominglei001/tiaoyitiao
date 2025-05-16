class GameScene extends eui.Component implements eui.UIComponent {
	// 游戏场景组
	public blockPanel: eui.Group;
	// 小 i
	public player: eui.Image;
	// 游戏场景中的积分
	public scoreLabel: eui.Label;
	// 所有方块资源的数组
	private blockSourceNames: Array<string> = [];
	// 按下的音频
	private pushVoice: egret.Sound;
	// 按下音频的SoundChannel对象
	private pushSoundChannel: egret.SoundChannel;
	// 弹跳的音频
	private jumpVoice: egret.Sound;
	// 所有方块的数组
	private blockArr: Array<eui.Image> = [];
	// 所有回收方块的数组
	private reBackBlockArr: Array<eui.Image> = [];
	// 当前的盒子（最新出现的盒子）
	private currentBlock: eui.Image;
	// 下一个盒子方向(1靠右侧出现/-1靠左侧出现)
	public direction: number = 1;
	// 随机盒子距离跳台的距离
	private minDistance = 240;
	private maxDistance = 400;
	// tanθ角度值
	public tanAngle: number = 0.556047197640118;

	// 跳的距离
	public jumpDistance: number = 0;
	// 判断是否是按下状态
	private isReadyJump = false;
	// 落脚点
	private targetPos: egret.Point;
	// 左侧跳跃点
	private leftOrigin = { "x": 180, "y": 350 };
	// 右侧跳跃点
	private rightOrigin = { "x": 505, "y": 350 };
	// 游戏中得分
	private score = 0;

	// 游戏结束场景
	public overPanel: eui.Group;
	public overScoreLabel: eui.Label;
	public restart: eui.Button;

	// 1. 新增词库、题目索引、倒计时等变量
	private wordList: Array<any> = [];
	private currentWordIndex: number = 0;
	private quizPanel: eui.Group; // 题目弹窗
	private quizTimer: egret.Timer;
	private quizTimeLeft: number = 10;
	private quizTimeLabel: eui.Label;
	private quizCallback: (isCorrect: boolean) => void;
	private quizOptions: Array<any> = [];
	private quizAnswer: string = '';
	private quizOptionBtns: Array<eui.Button> = [];
	private quizWordLabel: eui.Label;
	private quizIsActive: boolean = false;
	// 新增音频相关变量
	private wordAudio: egret.Sound;
	private wordAudioChannel: egret.SoundChannel;
	private audioLoadingIcon: eui.Image; // 显示加载音频时的图标
	private playAudioBtn: eui.Button; // 播放音频按钮
	// 新增弹窗背景遮罩
	private quizMask: egret.Shape;

	// 1. 新增变量：答题顺序和答题结果
	private quizOrder: number[] = [];
	private quizResult: boolean[] = [];
	// 新增变量：跟踪是否有过错误回答
	private hadWrongAnswer: boolean = false;

	public constructor() {
		super();
	}

	protected partAdded(partName: string, instance: any): void {
		super.partAdded(partName, instance);
	}
	protected childrenCreated(): void {
		super.childrenCreated();
		this.init();
		this.reset();
		// 2. 游戏开始时加载词库
		this.loadWordList();
	}
	private init() {
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
		}, this)
	}
	// 按下的事件逻辑
	private onKeyDown() {
		// 播放按下的音频
		this.pushSoundChannel = this.pushVoice.play(0, 1);
		// 变形
		egret.Tween.get(this.player).to({
			scaleY: 0.5
		}, 3000)

		this.isReadyJump = true;
	}
	// 放开
	private onKeyUp() {
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
		this.pushSoundChannel.stop()
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
		egret.Tween.get(this).to({ factor: 1 }, 500).call(() => {
			this.player.scaleY = 1;
			this.jumpDistance = 0;
			// 判断跳跃是否成功
			this.judgeResult();
		});
		// 执行小人空翻动画
		this.player.anchorOffsetY = this.player.height / 2;

		egret.Tween.get(this.player).to({ rotation: this.direction > 0 ? 360 : -360 }, 200).call(() => {
			this.player.rotation = 0
		}).call(() => {
			this.player.anchorOffsetY = this.player.height - 20;
		});


	}
	// 重置游戏
	public reset() {
		// 清空舞台
		this.blockPanel.removeChildren();
		this.blockArr = [];
		// 添加一个方块
		let blockNode = this.createBlock();
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
	}
	// 添加一个方块
	private addBlock() {
		// 随机一个方块
		let blockNode = this.createBlock();
		// 设置位置
		let distance = this.minDistance + Math.random() * (this.maxDistance - this.minDistance);
		if (this.direction > 0) {
			blockNode.x = this.currentBlock.x + distance;
			blockNode.y = this.currentBlock.y - distance * this.tanAngle;
		} else {
			blockNode.x = this.currentBlock.x - distance;
			blockNode.y = this.currentBlock.y - distance * this.tanAngle;
		}
		this.currentBlock = blockNode;
	}
	// 工厂方法,创建一个方块
	private createBlock(): eui.Image {
		var blockNode = null;
		if (this.reBackBlockArr.length) {
			// 回收池里面有,则直接取
			blockNode = this.reBackBlockArr.splice(0, 1)[0];
		} else {
			// 回收池里面没有,则重新创建
			blockNode = new eui.Image();
		}
		// 使用随机背景图
		let n = Math.floor(Math.random() * this.blockSourceNames.length);
		blockNode.source = this.blockSourceNames[n];
		this.blockPanel.addChild(blockNode);
		// 设置方块的锚点
		blockNode.anchorOffsetX = 222;
		blockNode.anchorOffsetY = 78;
		// 把新创建的block添加进入blockArr里
		this.blockArr.push(blockNode);
		return blockNode;
	}


	private judgeResult() {
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
			}, 1000).call(() => {
				// 开始创建下一个方块
				this.addBlock();
				// 让屏幕重新可点;
				this.blockPanel.touchEnabled = true;
			})
			// console.log('x' + x);
			console.log(this.currentBlock.x);
		} else {
			// 失败,弹出重新开始的panel
			console.log('游戏失败!')
			this.overPanel.visible = true;
			this.overScoreLabel.text = this.score.toString();
		}
	}
	//
private update(x, y) {
		egret.Tween.removeAllTweens();
		for (var i: number = this.blockArr.length - 1; i >= 0; i--) {
			var blockNode = this.blockArr[i];
			if (blockNode.x + (blockNode.width - 222) < 0 || blockNode.x - 222 > this.width || blockNode.y - 78 > this.height) {
				// 方块超出屏幕,从显示列表中移除
				this.blockPanel.removeChild(blockNode);
				this.blockArr.splice(i, 1);
				// 添加到回收数组中
				this.reBackBlockArr.push(blockNode);
			} else {
				// 没有超出屏幕的话,则移动
				egret.Tween.get(blockNode).to({
					x: blockNode.x - x,
					y: blockNode.y - y
				}, 1000)
			}
		}
		console.log(this.blockArr);

	}
	// 重新一局
	private restartHandler() {
		// 隐藏结束场景
		this.overPanel.visible = false;
		// 置空积分
		this.score = 0;
		this.scoreLabel.text = this.score.toString();
		// 开始防止方块
		this.reset();
		// 游戏场景可点
		this.blockPanel.touchEnabled = true;
	}
	//添加factor的set,get方法,注意用public  
	public get factor(): number {
		return 0;
	}
	//计算方法参考 二次贝塞尔公式  
	public set factor(value: number) {
		this.player.x = (1 - value) * (1 - value) * this.player.x + 2 * value * (1 - value) * (this.player.x + this.targetPos.x) / 2 + value * value * (this.targetPos.x);
		this.player.y = (1 - value) * (1 - value) * this.player.y + 2 * value * (1 - value) * (this.targetPos.y - 300) + value * value * (this.targetPos.y);
	}
	// 2. 加载词库，优先网络，失败用本地
	private loadWordList() {
		let self = this;
		
		// 从URL参数中获取bookId和unitId
		let bookId = "48";
		let unitId = "236";
		
		try {
			// 尝试从URL参数中获取
			const urlParams = new URLSearchParams(window.location.search);
			const urlBookId = urlParams.get('bookId');
			const urlUnitId = urlParams.get('unitId');
			
			// 如果URL中有参数，则使用URL参数值
			if (urlBookId) bookId = urlBookId;
			if (urlUnitId) unitId = urlUnitId;
			
			console.log(`从URL获取参数: bookId=${bookId}, unitId=${unitId}`);
		} catch (e) {
			console.error("获取URL参数失败:", e);
			// 失败时使用默认值
		}
		
		let xhr = new XMLHttpRequest();
		xhr.open('GET', `https://res.yourwind.fun/py/get_bookunit_word?refresh=0&bookId=${bookId}&unitId=${unitId}`, true);
		xhr.onreadystatechange = function () {
			if (xhr.readyState == 4) {
				if (xhr.status == 200) {
					try {
						let res = JSON.parse(xhr.responseText);
						if (res.data && res.data.length > 0) {
							// 题库格式兼容
							self.wordList = res.data[0];
							self.quizOrder = self.shuffleOrder(self.wordList.length);
							self.quizResult = [];
							self.currentWordIndex = 0;
							self.hadWrongAnswer = false; // 重置错误回答标志
							self.showQuizPanel();
							return;
						}
					} catch (e) {}
				}
				// 网络失败，使用RES加载本地data.json
				try {
					// 尝试使用RES系统获取资源
					let data = RES.getRes("data_json");
					if (data && data.data && data.data.length > 0) {
						self.wordList = data.data[0];
						self.quizOrder = self.shuffleOrder(self.wordList.length);
						self.quizResult = [];
						self.currentWordIndex = 0;
						self.hadWrongAnswer = false;
						self.showQuizPanel();
						return;
					}
				} catch (e) {
					console.error("加载RES资源失败", e);
				}
				
				// 如果RES加载失败，尝试直接加载文件（兼容旧版本）
				let localXhr = new XMLHttpRequest();
				localXhr.open('GET', 'data.json', true);
				localXhr.onreadystatechange = function () {
					if (localXhr.readyState == 4) {
						if (localXhr.status == 200) {
							try {
								let data = JSON.parse(localXhr.responseText);
								if (data && data.data && data.data.length > 0) {
									self.wordList = data.data[0];
									self.quizOrder = self.shuffleOrder(self.wordList.length);
									self.quizResult = [];
									self.currentWordIndex = 0;
									self.hadWrongAnswer = false; // 重置错误回答标志
									self.showQuizPanel();
									return;
								}
							} catch (e) {}
						}
						alert('词库加载失败！');
					}
				};
				localXhr.send();
			}
		};
		xhr.send();
	}
	// 新增打乱顺序方法
	private shuffleOrder(len: number): number[] {
		let arr = Array.from({length: len}, (_, i) => i);
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}
	// 3. 题目弹窗生成与逻辑
	private showQuizPanel() {
		if (!this.wordList || this.wordList.length === 0) return;
		if (this.quizOrder.length === 0) {
			// 全部答完，统计分数
			const correctCount = this.quizResult.filter(x => x).length;
			// 判断是否全部回答正确：所有答案正确且没有出现过错误回答
			const isPerfect = correctCount === this.wordList.length && !this.hadWrongAnswer;
			this.showFinalPanel(isPerfect, correctCount, this.wordList.length);
			return;
		}
		
		// 禁用游戏场景的触控事件，确保只能点击弹窗
		this.blockPanel.touchEnabled = false;
		
		if (this.quizPanel && this.quizPanel.parent) {
			this.quizPanel.parent.removeChild(this.quizPanel);
		}
		
		// 创建全屏遮罩阻止点击
		let maskShape = new egret.Shape();
		maskShape.graphics.beginFill(0x000000, 0.01); // 几乎透明但能拦截点击
		maskShape.graphics.drawRect(0, 0, this.stage.stageWidth, this.stage.stageHeight);
		maskShape.graphics.endFill();
		maskShape.touchEnabled = true; // 确保可接收触摸事件
		this.addChild(maskShape);
		this.quizMask = maskShape; // 保存遮罩引用
		
		// 取当前单词（按乱序）
		let word = this.wordList[this.quizOrder[0]];
		
		// 加载并播放单词音频
		this.loadAndPlayWordAudio(word.ourWordAudio);
		
		// 随机生成选项
		let options = [word.zh];
		while (options.length < 3) {
			let idx = Math.floor(Math.random() * this.wordList.length);
			let zh = this.wordList[idx].zh;
			if (options.indexOf(zh) === -1) options.push(zh);
		}
		// 打乱选项
		options = options.sort(() => Math.random() - 0.5);
		this.quizOptions = options;
		this.quizAnswer = word.zh;
		// 创建弹窗
		let panel = new eui.Group();
		panel.width = 500;
		panel.height = 500;
		panel.horizontalCenter = 0;
		panel.verticalCenter = 0;
		// 用Shape绘制背景色
		let bg = new egret.Shape();
		bg.graphics.beginFill(0x222222, 0.95);
		bg.graphics.drawRoundRect(0, 0, 500, 500, 20, 20);
		bg.graphics.endFill();
		panel.addChild(bg);
		// 英文单词
		let wordLabel = new eui.Label();
		wordLabel.text = `'${word.en}' 的意思是?`;
		wordLabel.size = 52;
		wordLabel.fontFamily = "Microsoft YaHei,Arial,黑体,sans-serif";
		wordLabel.textColor = 0xffffff;
		wordLabel.horizontalCenter = 0;
		wordLabel.top = 30;
		panel.addChild(wordLabel);
		this.quizWordLabel = wordLabel;
		
		// 选项按钮
		this.quizOptionBtns = [];
		for (let i = 0; i < 3; i++) {
			let btn = new eui.Button();
			btn.label = options[i];
			btn.width = 160;
			btn.height = 60;
			btn.horizontalCenter = 0;
			btn.top = 120 + i * 80;
			btn.addEventListener(egret.TouchEvent.TOUCH_TAP, this.onQuizOptionTap, this);
			panel.addChild(btn);
			this.quizOptionBtns.push(btn);
		}
		// 倒计时
		let timeLabel = new eui.Label();
		timeLabel.text = '时间: 10';
		timeLabel.size = 48;
		timeLabel.fontFamily = "Microsoft YaHei,Arial,黑体,sans-serif";
		timeLabel.textColor = 0xffff00;
		timeLabel.horizontalCenter = 0;
		timeLabel.bottom = 40;
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
		
		// 激活题目响应状态，使选项可点击
		this.quizIsActive = true;
	}
	// 选项点击
	private onQuizOptionTap(e: egret.TouchEvent) {
		if (!this.quizIsActive) return;
		let btn = e.currentTarget as eui.Button;
		let isCorrect = btn.label === this.quizAnswer;
		this.quizIsActive = false;
		this.quizTimer.stop();
		this.removeQuizPanel();
		this.handleQuizResult(isCorrect);
	}
	// 倒计时
	private onQuizTimer() {
		this.quizTimeLeft--;
		this.quizTimeLabel.text = '时间: ' + this.quizTimeLeft;
	}
	private onQuizTimeout() {
		if (!this.quizIsActive) return;
		this.quizIsActive = false;
		this.removeQuizPanel();
		this.handleQuizResult(false);
	}
	private removeQuizPanel() {
		// 停止播放音频
		if (this.wordAudioChannel) {
			this.wordAudioChannel.stop();
			this.wordAudioChannel = null;
		}
		
		// 移除遮罩
		if (this.quizMask && this.quizMask.parent) {
			this.quizMask.parent.removeChild(this.quizMask);
		}
		
		if (this.quizPanel && this.quizPanel.parent) {
			this.quizPanel.parent.removeChild(this.quizPanel);
		}
	}
	// 4. 处理答题结果，前进/后退
	private handleQuizResult(isCorrect: boolean) {
		const idx = this.quizOrder[0];
		this.quizResult[idx] = isCorrect;
		if (isCorrect) {
			// 答对后移除该单词
			this.quizOrder.shift();
			this.jumpForward();
		} else {
			this.reduceScore();
		}
	}
	// 新方法：只减分，不后退
	private reduceScore() {
		// 减少分数
		if (this.score > 0) {
			this.score--;
			this.scoreLabel.text = this.score.toString();
			
			// 记录出现了错误回答
			this.hadWrongAnswer = true;
			
			// 显示分数减少的提示（可选）
			this.showScoreReduceTip();
			
			// 如果分数已经为0，立即显示重新开始弹窗
			if (this.score === 0) {
				this.showRestartPanel();
				return; // 防止继续显示下一题
			}
			
			// 继续下一题
			this.showQuizPanel();
		} else {
			// 分数已为0，提示是否重新开始
			this.showRestartPanel();
		}
	}
	// 显示分数减少的提示
	private showScoreReduceTip() {
		// 创建一个临时文本提示
		let tipLabel = new eui.Label();
		tipLabel.text = "-1";
		tipLabel.size = 40;
		tipLabel.textColor = 0xff0000;
		tipLabel.x = this.scoreLabel.x + this.scoreLabel.width + 10;
		tipLabel.y = this.scoreLabel.y;
		this.addChild(tipLabel);
		
		// 添加动画效果
		egret.Tween.get(tipLabel)
			.to({ y: tipLabel.y - 50, alpha: 0 }, 1000)
			.call(() => {
				if (tipLabel.parent) {
					tipLabel.parent.removeChild(tipLabel);
				}
			});
	}
	// 前进一格
	private jumpForward() {
		// 模拟按压和松开的过程，实现真实跳跃效果
		
		// 确保当前可以跳跃
		this.blockPanel.touchEnabled = true;
		
		// 先模拟按下，角色变形
		this.onKeyDown();
		
		// 计算精确的跳跃距离，确保跳到方块中心
		setTimeout(() => {
			// 计算当前方块与下一个方块之间的精确距离
			let nextBlock = this.currentBlock;
			let currentPosition = { x: this.player.x, y: this.player.y };
			
			// 计算水平和垂直距离
			let deltaX = nextBlock.x - currentPosition.x;
			let deltaY = nextBlock.y - currentPosition.y;
			
			// 计算直线距离
			let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
			
			// 设置精确的跳跃距离
			// 由于跳跃距离在onKeyUp中会乘以direction，所以这里需要考虑方向
			this.jumpDistance = Math.abs(distance);
			
			// 模拟松开，触发跳跃
			this.onKeyUp();
			
			// 在原有的judgeResult里增加分数和切换到下一题
			// 我们需要重写judgeResult方法的行为
			
			// 记录当前的judgeResult引用
			const originalJudgeResult = this.judgeResult;
			
			// 临时重写judgeResult方法
			this.judgeResult = () => {
				// 还原原始方法，避免影响下次跳跃
				this.judgeResult = originalJudgeResult;
				
				// 确保判定为跳跃成功
				// 更新积分
				this.score++;
				this.scoreLabel.text = this.score.toString();
				
				// 随机下一个方块出现的位置
				this.direction = Math.random() > 0.5 ? 1 : -1;
				
				// 执行原有的位置更新逻辑
				var blockX, blockY;
				blockX = this.direction > 0 ? this.leftOrigin.x : this.rightOrigin.x;
				blockY = this.height / 2 + this.currentBlock.height;
				
				var playerX, PlayerY;
				playerX = this.player.x - (this.currentBlock.x - blockX);
				PlayerY = this.player.y - (this.currentBlock.y - blockY);
				
				this.update(this.currentBlock.x - blockX, this.currentBlock.y - blockY);
				
				// 更新小人的位置
				egret.Tween.get(this.player).to({
					x: playerX,
					y: PlayerY
				}, 1000).call(() => {
					// 开始创建下一个方块
					this.addBlock();
					// 让屏幕重新可点
					this.blockPanel.touchEnabled = true;
					
					// 进入下一题
					this.showQuizPanel();
				});
			};
		}, 300); // 只需短暂延迟，模拟按压感
	}
	// 后退一格（保留方法但不再使用，除非需要恢复此功能）
	private jumpBackward() {
		// 此方法保留但不再使用
		// 回退到上一个方块，或初始位置
		if (this.score > 0) {
			this.score--;
			this.scoreLabel.text = this.score.toString();
			
			// 回退动画
			// 小人要移动到的回退点（往回一格）
			let prevBlockIndex = this.blockArr.length - 2; // 上一个方块索引
			if (prevBlockIndex >= 0) {
				let prevBlock = this.blockArr[prevBlockIndex];
				
				// 播放回退动画
				egret.Tween.get(this.player).to({
					x: prevBlock.x,
					y: prevBlock.y
				}, 1000).call(() => {
					// 动画完成后再显示下一个题目
					this.currentWordIndex++;
					if (this.currentWordIndex >= this.wordList.length) {
						this.currentWordIndex = 0;
					}
					this.showQuizPanel();
				});
			} else {
				// 如果没有上一个方块，回到初始位置
				egret.Tween.get(this.player).to({
					x: 200, // 初始x坐标
					y: this.height / 2 + this.currentBlock.height // 初始y坐标
				}, 1000).call(() => {
					this.currentWordIndex++;
					if (this.currentWordIndex >= this.wordList.length) {
						this.currentWordIndex = 0;
					}
					this.showQuizPanel();
				});
			}
		} else {
			// 回到初始位置，弹窗提示重新开始
			this.showRestartPanel();
		}
	}
	// 5. 修改重新开始弹窗
	private showRestartPanel() {
		// 创建遮罩层，避免点击其他区域
		let maskShape = new egret.Shape();
		maskShape.graphics.beginFill(0x000000, 0.5);
		maskShape.graphics.drawRect(0, 0, this.width, this.height);
		maskShape.graphics.endFill();
		this.addChild(maskShape);
		
		let panel = new eui.Group();
		panel.width = 400;
		panel.height = 200;
		panel.horizontalCenter = 0;
		panel.verticalCenter = 0;
		
		// 用Shape绘制背景色
		let bg = new egret.Shape();
		bg.graphics.beginFill(0x222222, 0.95);
		bg.graphics.drawRoundRect(0, 0, 400, 200, 20, 20);
		bg.graphics.endFill();
		panel.addChild(bg);
		
		let label = new eui.Label();
		label.text = '成绩为0，是否重新开始？';
		label.size = 32;
		label.textColor = 0xffffff;
		label.horizontalCenter = 0;
		label.top = 40;
		panel.addChild(label);
		
		let btn = new eui.Button();
		btn.label = '重新开始';
		btn.width = 160;
		btn.height = 60;
		btn.horizontalCenter = 0;
		btn.bottom = 40;
		btn.addEventListener(egret.TouchEvent.TOUCH_TAP, () => {
			if (panel.parent) panel.parent.removeChild(panel);
			
			// 移除遮罩
			if (maskShape.parent) maskShape.parent.removeChild(maskShape);
			
			// 重新洗牌词库顺序
			this.quizOrder = this.shuffleOrder(this.wordList.length);
			this.quizResult = [];
			this.currentWordIndex = 0;
			this.hadWrongAnswer = false; // 重置错误回答标志
			
			// 完全重置游戏到初始状态
			this.completeGameReset();
		}, this);
		panel.addChild(btn);
		this.addChild(panel);
	}
	// 新增方法：完全重置游戏到初始状态
	private completeGameReset() {
		// 重置分数
		this.score = 0;
		this.scoreLabel.text = this.score.toString();
		
		// 确保所有计时器和动画停止
		egret.Tween.removeAllTweens();
		if (this.quizTimer) {
			this.quizTimer.stop();
			this.quizTimer.removeEventListener(egret.TimerEvent.TIMER, this.onQuizTimer, this);
			this.quizTimer.removeEventListener(egret.TimerEvent.TIMER_COMPLETE, this.onQuizTimeout, this);
		}
		
		// 确保弹窗被移除
		if (this.quizPanel && this.quizPanel.parent) {
			this.quizPanel.parent.removeChild(this.quizPanel);
			this.quizPanel = null;
		}
		
		// 重置玩家位置状态
		this.player.rotation = 0;
		this.player.scaleY = 1;
		this.isReadyJump = false;
		this.jumpDistance = 0;
		
		// 重置方向
		this.direction = 1;
		
		// 清除所有方块和相关对象
		this.blockPanel.removeChildren();
		this.blockArr = [];
		this.reBackBlockArr = [];
		
		// 重置错误回答标志
		this.hadWrongAnswer = false;
		
		// 重置场景（调用原有的reset方法）
		this.reset();
		
		// 确保场景可交互
		this.blockPanel.touchEnabled = true;
		
		// 重新显示题目
		this.showQuizPanel();
	}
	// 新增方法：加载并播放单词音频
	private loadAndPlayWordAudio(audioUrl: string) {
		if (!audioUrl) {
			console.log('单词没有音频URL');
			return;
		}
		
		// 清除之前的音频
		if (this.wordAudioChannel) {
			this.wordAudioChannel.stop();
			this.wordAudioChannel = null;
		}
		
		// 加载新音频
		let sound: egret.Sound = new egret.Sound();
		sound.addEventListener(egret.Event.COMPLETE, () => {
			// 音频加载完成，播放
			this.wordAudio = sound;
			this.wordAudioChannel = sound.play(0, 1);
			
			// 清除加载音频时的图标
			if (this.audioLoadingIcon && this.audioLoadingIcon.parent) {
				this.audioLoadingIcon.parent.removeChild(this.audioLoadingIcon);
			}
			
			// 显示播放音频按钮
			if (this.playAudioBtn) {
				this.playAudioBtn.visible = true;
			}
		}, this);
		
		sound.addEventListener(egret.IOErrorEvent.IO_ERROR, () => {
			// 音频加载失败
			console.error('音频加载失败:', audioUrl);
			
			// 清除加载音频时的图标
			if (this.audioLoadingIcon && this.audioLoadingIcon.parent) {
				this.audioLoadingIcon.parent.removeChild(this.audioLoadingIcon);
			}
		}, this);
		
		// 加载音频URL
		sound.load(audioUrl);
	}
	// 新增 showFinalPanel 方法
	private showFinalPanel(isPerfect: boolean, correctCount: number, total: number) {
		// 禁用游戏场景触控
		this.blockPanel.touchEnabled = false;
		
		// 创建结果面板
		let panel = new eui.Group();
		panel.width = 500;
		panel.height = 300;
		panel.horizontalCenter = 0;
		panel.verticalCenter = 0;
		
		// 满分动画先放，确保在最底层
		if (isPerfect) {
			// 直接调用全屏放礼花，添加到舞台而非面板中
			this.showFireworks(this);
		}
		
		// 创建全屏遮罩阻止点击，但允许礼花显示
		let maskShape = new egret.Shape();
		maskShape.graphics.beginFill(0x000000, 0.01); // 几乎透明但能拦截点击
		maskShape.graphics.drawRect(0, 0, this.stage.stageWidth, this.stage.stageHeight);
		maskShape.graphics.endFill();
		maskShape.touchEnabled = true; // 确保可接收触摸事件
		this.addChild(maskShape);
		
		// 用Shape绘制背景色，但不使用全屏遮罩
		let bg = new egret.Shape();
		bg.graphics.beginFill(0x222222, 0.9); // 调低透明度让礼花更明显
		bg.graphics.drawRoundRect(0, 0, 500, 300, 20, 20);
		bg.graphics.endFill();
		panel.addChild(bg);

		let label = new eui.Label();
		label.size = 40;
		label.textColor = 0xffffff;
		label.horizontalCenter = 0;
		label.top = 40;
		if (isPerfect) {
			label.text = `太棒了！全部回答正确！\n分数：${total}/${total}`;
		} else if (correctCount === total) {
			// 有重复作答，显示实际得分
			label.text = `回答中有部分出错哦。\n还需认真复习！\n分数：${this.score}/${total}`;
		} else {
			// 部分回答正确，显示实际得分
			label.text = `答题结束！\n分数：${this.score}/${total}`;
		}
		panel.addChild(label);

		let btn = new eui.Button();
		btn.label = '重新开始';
		btn.width = 160;
		btn.height = 60;
		btn.horizontalCenter = 0;
		btn.bottom = 40;
		btn.addEventListener(egret.TouchEvent.TOUCH_TAP, () => {
			if (panel.parent) panel.parent.removeChild(panel);
			
			// 移除遮罩
			if (maskShape.parent) maskShape.parent.removeChild(maskShape);
			
			// 重新洗牌词库顺序
			this.quizOrder = this.shuffleOrder(this.wordList.length);
			this.quizResult = [];
			this.currentWordIndex = 0;
			this.hadWrongAnswer = false; // 重置错误回答标志
			
			// 完全重置游戏到初始状态
			this.completeGameReset();
		}, this);
		panel.addChild(btn);
		this.addChild(panel);
	}

	// 简单彩色礼花动画
	private showFireworks(parent: egret.DisplayObjectContainer) {
		// 创建更多、更大的礼花粒子
		const particleCount = 100; // 增加粒子数量
		const screenWidth = this.stage.stageWidth;
		const screenHeight = this.stage.stageHeight;
		
		// 创建多组礼花，不同位置爆发
		const burstCount = 5;
		for (let b = 0; b < burstCount; b++) {
			// 随机爆发点
			const burstX = Math.random() * screenWidth * 0.8 + screenWidth * 0.1;
			const burstY = Math.random() * screenHeight * 0.6 + screenHeight * 0.2;
			
			// 每组礼花的粒子
			for (let i = 0; i < particleCount / burstCount; i++) {
				let color = Math.floor(Math.random() * 0xffffff);
				let circle = new egret.Shape();
				circle.graphics.beginFill(color);
				circle.graphics.drawCircle(0, 0, 3 + Math.random() * 8);
				circle.graphics.endFill();
				circle.x = burstX;
				circle.y = burstY;
				parent.addChild(circle);
				
				// 随机角度和距离
				let angle = Math.random() * Math.PI * 2;
				let distance = 50 + Math.random() * 300;
				let tx = circle.x + Math.cos(angle) * distance;
				let ty = circle.y + Math.sin(angle) * distance;
				
				// 添加闪烁效果和随机速度
				const duration = 800 + Math.random() * 1200;
				egret.Tween.get(circle)
					.to({ x: tx, y: ty, alpha: 0.8 }, duration * 0.5)
					.to({ alpha: 0 }, duration * 0.5)
					.call(() => { 
						if (circle.parent) circle.parent.removeChild(circle); 
					});
			}
		}
		
		// 添加3秒后再次爆发的效果，增强持续感
		setTimeout(() => {
			if (parent.stage) { // 确保还在舞台上
				this.showDelayedFireworks(parent);
			}
		}, 800);
	}
	
	// 延迟爆发的第二波礼花
	private showDelayedFireworks(parent: egret.DisplayObjectContainer) {
		const particleCount = 80;
		const screenWidth = this.stage.stageWidth;
		const screenHeight = this.stage.stageHeight;
		
		// 随机爆发点
		const burstX = Math.random() * screenWidth * 0.8 + screenWidth * 0.1;
		const burstY = Math.random() * screenHeight * 0.6 + screenHeight * 0.2;
		
		for (let i = 0; i < particleCount; i++) {
			let color = Math.floor(Math.random() * 0xffffff);
			let circle = new egret.Shape();
			circle.graphics.beginFill(color);
			circle.graphics.drawCircle(0, 0, 2 + Math.random() * 6);
			circle.graphics.endFill();
			circle.x = burstX;
			circle.y = burstY;
			parent.addChild(circle);
			
			let angle = Math.random() * Math.PI * 2;
			let distance = 50 + Math.random() * 250;
			let tx = circle.x + Math.cos(angle) * distance;
			let ty = circle.y + Math.sin(angle) * distance;
			
			const duration = 700 + Math.random() * 1000;
			egret.Tween.get(circle)
				.to({ x: tx, y: ty, alpha: 0.7 }, duration * 0.6)
				.to({ alpha: 0 }, duration * 0.4)
				.call(() => { 
					if (circle.parent) circle.parent.removeChild(circle); 
				});
		}
	}
}