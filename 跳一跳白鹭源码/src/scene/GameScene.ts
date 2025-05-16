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
		let xhr = new XMLHttpRequest();
		xhr.open('GET', 'http://yourwind.site:15001/py/get_bookunit_word?refresh=0&bookId=48&unitId=235', true);
		xhr.setRequestHeader('Referer', 'https://www.yourwind.fun');
		xhr.onreadystatechange = function () {
			if (xhr.readyState == 4) {
				if (xhr.status == 200) {
					try {
						let res = JSON.parse(xhr.responseText);
						if (res.data && res.data.length > 0) {
							// 题库格式兼容
							self.wordList = res.data[0];
							self.currentWordIndex = 0;
							self.showQuizPanel();
							return;
						}
					} catch (e) {}
				}
				// 网络失败，读取本地
				let localXhr = new XMLHttpRequest();
				localXhr.open('GET', 'data.json', true);
				localXhr.onreadystatechange = function () {
					if (localXhr.readyState == 4) {
						if (localXhr.status == 200) {
							try {
								let data = JSON.parse(localXhr.responseText);
								if (data && data.data && data.data.length > 0) {
									self.wordList = data.data[0];
									self.currentWordIndex = 0;
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
	// 3. 题目弹窗生成与逻辑
	private showQuizPanel() {
		if (!this.wordList || this.wordList.length === 0) return;
		this.quizIsActive = true;
		// 先移除旧弹窗
		if (this.quizPanel && this.quizPanel.parent) {
			this.quizPanel.parent.removeChild(this.quizPanel);
		}
		// 取当前单词
		let word = this.wordList[this.currentWordIndex];
		
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
		panel.height = 400;
		panel.horizontalCenter = 0;
		panel.verticalCenter = 0;
		// 用Shape绘制背景色
		let bg = new egret.Shape();
		bg.graphics.beginFill(0x222222, 0.95);
		bg.graphics.drawRoundRect(0, 0, 500, 400, 20, 20);
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
		timeLabel.bottom = 10;
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
		
		if (this.quizPanel && this.quizPanel.parent) {
			this.quizPanel.parent.removeChild(this.quizPanel);
		}
	}
	// 4. 处理答题结果，前进/后退
	private handleQuizResult(isCorrect: boolean) {
		if (isCorrect) {
			// 正确，前进一格
			this.jumpForward();
		} else {
			// 错误，只减分不后退
			this.reduceScore();
		}
	}
	// 新方法：只减分，不后退
	private reduceScore() {
		// 减少分数
		if (this.score > 0) {
			this.score--;
			this.scoreLabel.text = this.score.toString();
			
			// 显示分数减少的提示（可选）
			this.showScoreReduceTip();
			
			// 如果分数已经为0，立即显示重新开始弹窗
			if (this.score === 0) {
				this.showRestartPanel();
				return; // 防止继续显示下一题
			}
			
			// 继续下一题
			this.currentWordIndex++;
			if (this.currentWordIndex >= this.wordList.length) {
				this.currentWordIndex = 0;
			}
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
					this.currentWordIndex++;
					if (this.currentWordIndex >= this.wordList.length) {
						this.currentWordIndex = 0;
					}
					
					// 跳跃完成后显示下一题
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
		label.text = '已回到起点，是否重新开始？';
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
			// 移除弹窗和遮罩
			if (panel.parent) panel.parent.removeChild(panel);
			if (maskShape.parent) maskShape.parent.removeChild(maskShape);
			
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
		
		// 重置词库索引
		this.currentWordIndex = 0;
		
		// 清除所有方块和相关对象
		this.blockPanel.removeChildren();
		this.blockArr = [];
		this.reBackBlockArr = [];
		
		// 重置玩家位置状态
		this.player.rotation = 0;
		this.player.scaleY = 1;
		this.isReadyJump = false;
		this.jumpDistance = 0;
		
		// 重置方向
		this.direction = 1;
		
		// 停止所有计时器和动画
		egret.Tween.removeAllTweens();
		if (this.quizTimer) {
			this.quizTimer.stop();
			this.quizTimer.removeEventListener(egret.TimerEvent.TIMER, this.onQuizTimer, this);
			this.quizTimer.removeEventListener(egret.TimerEvent.TIMER_COMPLETE, this.onQuizTimeout, this);
		}
		
		// 重置场景（调用原有的reset方法）
		this.reset();
		
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
}