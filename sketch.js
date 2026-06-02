// ============= Global Game Variables =============
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 32;
const DROP_INTERVAL = 800; // ms

let grid = [];
let currentPiece = null;
let gameRunning = true;
let isGameOver = false;
let score = 0;
let lastDropTime = 0;
let command = 'IDLE';
let commandTimestamp = 0;
let handModelReady = false;
let handDetected = false;

// Tetris pieces shapes and colors
const TETROMINOES = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: '#00F0F0'
  },
  O: {
    shape: [[1, 1], [1, 1]],
    color: '#F0F000'
  },
  T: {
    shape: [[0, 1, 0], [1, 1, 1]],
    color: '#A000F0'
  },
  L: {
    shape: [[1, 0], [1, 0], [1, 1]],
    color: '#F0A000'
  },
  J: {
    shape: [[0, 1], [0, 1], [1, 1]],
    color: '#0000F0'
  },
  S: {
    shape: [[0, 1, 1], [1, 1, 0]],
    color: '#00F000'
  },
  Z: {
    shape: [[1, 1, 0], [0, 1, 1]],
    color: '#F00000'
  }
};

const TETROMINO_NAMES = Object.keys(TETROMINOES);

// ============= Piece Class =============
class Piece {
  constructor() {
    const name = TETROMINO_NAMES[Math.floor(Math.random() * TETROMINO_NAMES.length)];
    const data = TETROMINOES[name];
    this.shape = data.shape.map(row => [...row]);
    this.color = data.color;
    this.x = Math.floor(COLS / 2) - Math.ceil(this.shape[0].length / 2);
    this.y = 0;
  }

  draw(offsetX, offsetY, p) {
    p.fill(this.color);
    p.stroke(255);
    p.strokeWeight(1);
    for (let row = 0; row < this.shape.length; row++) {
      for (let col = 0; col < this.shape[row].length; col++) {
        if (this.shape[row][col]) {
          p.rect(offsetX + (this.x + col) * BLOCK_SIZE,
               offsetY + (this.y + row) * BLOCK_SIZE,
               BLOCK_SIZE - 1, BLOCK_SIZE - 1);
        }
      }
    }
  }

  moveLeft() {
    if (this.canMove(-1, 0)) {
      this.x--;
    }
  }

  moveRight() {
    if (this.canMove(1, 0)) {
      this.x++;
    }
  }

  rotate() {
    const oldShape = this.shape;
    this.shape = this.shape[0].map((_, i) => this.shape.map(row => row[i]).reverse());
    
    if (!this.canMove(0, 0)) {
      this.shape = oldShape;
    }
  }

  moveDown() {
    if (this.canMove(0, 1)) {
      this.y++;
      return true;
    }
    return false;
  }

  canMove(dx, dy) {
    for (let row = 0; row < this.shape.length; row++) {
      for (let col = 0; col < this.shape[row].length; col++) {
        if (this.shape[row][col]) {
          const newX = this.x + col + dx;
          const newY = this.y + row + dy;
          
          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return false;
          }
          
          if (newY >= 0 && grid[newY][newX]) {
            return false;
          }
        }
      }
    }
    return true;
  }

  lock() {
    for (let row = 0; row < this.shape.length; row++) {
      for (let col = 0; col < this.shape[row].length; col++) {
        if (this.shape[row][col]) {
          const y = this.y + row;
          const x = this.x + col;
          if (y >= 0) {
            grid[y][x] = this.color;
          }
        }
      }
    }
  }
}

function initGame() {
  grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
  currentPiece = new Piece();
  score = 0;
  gameRunning = true;
  isGameOver = false;
}

function spawnNewPiece() {
  currentPiece = new Piece();
  if (!currentPiece.canMove(0, 0)) {
    gameRunning = false;
    isGameOver = true;
  }
}

function checkLineClears() {
  const rowsToDelete = [];
  
  // 检测满行
  for (let row = ROWS - 1; row >= 0; row--) {
    let isFull = true;
    for (let col = 0; col < COLS; col++) {
      if (!grid[row][col]) {
        isFull = false;
        break;
      }
    }
    if (isFull) {
      rowsToDelete.push(row);
    }
  }
  
  // 消除满行
  if (rowsToDelete.length > 0) {
    // 从下到上删除
    for (let i = rowsToDelete.length - 1; i >= 0; i--) {
      grid.splice(rowsToDelete[i], 1);
      grid.unshift(Array(COLS).fill(null));
    }
    
    // 计分
    const lineCount = rowsToDelete.length;
    const scores = [0, 100, 300, 500, 800];
    score += scores[lineCount] || 0;
  }
  
  return rowsToDelete.length;
}

function drawGrid(offsetX, offsetY, p) {
  p.stroke(50);
  p.strokeWeight(1);
  
  for (let row = 0; row <= ROWS; row++) {
    p.line(offsetX, offsetY + row * BLOCK_SIZE,
         offsetX + COLS * BLOCK_SIZE, offsetY + row * BLOCK_SIZE);
  }
  for (let col = 0; col <= COLS; col++) {
    p.line(offsetX + col * BLOCK_SIZE, offsetY,
         offsetX + col * BLOCK_SIZE, offsetY + ROWS * BLOCK_SIZE);
  }
  
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col]) {
        p.fill(grid[row][col]);
        p.stroke(255);
        p.strokeWeight(1);
        p.rect(offsetX + col * BLOCK_SIZE, offsetY + row * BLOCK_SIZE,
             BLOCK_SIZE - 1, BLOCK_SIZE - 1);
      }
    }
  }
}

// ============= Camera Sketch (Instance Mode) =============
const cameraSketch = (p) => {
  let video;
  let handposeModel;
  let predictions = [];
  let statusText;
  let gestureText;
  let commandText;
  let lastRotateTime = 0;
  const ROTATE_COOLDOWN = 300;
  const ROTATE_FRAME_THRESHOLD = 3;
  const LR_FRAME_THRESHOLD = 2;
  let rotateFrameCount = 0;
  let leftFrameCount = 0;
  let rightFrameCount = 0;
  let lastDetected = 'NONE';

  p.setup = function() {
    p.pixelDensity(1);
    const canvas = p.createCanvas(280, 210);
    canvas.elt.style.width = '280px';
    canvas.elt.style.height = '210px';
    canvas.parent('#camera-container');

    video = p.createCapture({ video: { width: 1280, height: 720 } });
    video.size(1280, 720);
    video.elt.width = 1280;
    video.elt.height = 720;
    video.elt.style.width = '280px';
    video.elt.style.height = '210px';
    video.hide();

    statusText = p.select('#status');
    gestureText = p.select('#gesture');
    commandText = p.select('#command');

    statusText.html('載入手勢模型…');
    handposeModel = ml5.handpose(video, modelReady);
    handposeModel.on('predict', gotHands);
  };

  p.draw = function() {
    p.background(40);

    p.push();
    p.translate(p.width, 0);
    p.scale(-1, 1);
    p.image(video, 0, 0, p.width, p.height);

    if (predictions.length > 0) {
      drawHand(predictions[0]);
    }
    p.pop();

    if (predictions.length > 0) {
      const detected = detectGestureState(predictions[0]);
      gestureText.html('手勢：' + detected);

      const now = p.millis();

      // Reset frame counters if gesture changes
      if (detected !== lastDetected) {
        rotateFrameCount = 0;
        leftFrameCount = 0;
        rightFrameCount = 0;
        lastDetected = detected;
      }

      // Priority 1: ROTATE (握拳)
      if (detected === 'CLOSE_PALM') {
        rotateFrameCount++;
        if (rotateFrameCount >= ROTATE_FRAME_THRESHOLD && now - lastRotateTime > ROTATE_COOLDOWN) {
          command = 'ROTATE';
          commandTimestamp = now;
          lastRotateTime = now;
          rotateFrameCount = 0;
        }
      } else {
        rotateFrameCount = 0;
      }

      // Priority 2: LEFT/RIGHT (only if not rotating)
      if (command !== 'ROTATE') {
        if (detected === 'LEFT_TILT') {
          leftFrameCount++;
          rightFrameCount = 0;
          if (leftFrameCount >= LR_FRAME_THRESHOLD) {
            command = 'LEFT';
            commandTimestamp = now;
            leftFrameCount = 0;
          }
        } else if (detected === 'RIGHT_TILT') {
          rightFrameCount++;
          leftFrameCount = 0;
          if (rightFrameCount >= LR_FRAME_THRESHOLD) {
            command = 'RIGHT';
            commandTimestamp = now;
            rightFrameCount = 0;
          }
        } else {
          leftFrameCount = 0;
          rightFrameCount = 0;
        }
      } else {
        leftFrameCount = 0;
        rightFrameCount = 0;
      }
    } else {
      gestureText.html('手勢：未偵測到手部');
      rotateFrameCount = 0;
      leftFrameCount = 0;
      rightFrameCount = 0;
    }

    if (commandText) commandText.html('輸出：' + command);
  };

  function modelReady() {
    handModelReady = true;
    statusText.html('模型已載入，請將手放入畫面中。');
  }

  function gotHands(results) {
    predictions = results;
    if (predictions.length > 0) {
      if (!handDetected) {
        handDetected = true;
        lastDropTime = p.millis();
      }
    }
  }

  function drawHand(prediction) {
    const landmarks = prediction.landmarks;
    const scaleX = p.width / 1280;
    const scaleY = p.height / 720;

    p.stroke(0, 255, 130);
    p.strokeWeight(2);
    p.noFill();

    const scaled = landmarks.map(([x, y]) => [x * scaleX, y * scaleY]);

    for (let i = 0; i < scaled.length; i++) {
      const [x, y] = scaled[i];
      p.ellipse(x, y, 8, 8);
    }

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20]
    ];

    for (let segment of connections) {
      const [i, j] = segment;
      const [x1, y1] = scaled[i];
      const [x2, y2] = scaled[j];
      p.line(x1, y1, x2, y2);
    }
  }

  function detectGestureState(prediction) {
    const landmarks = prediction.landmarks;

    const fingers = [4, 8, 12, 16, 20];
    const mcp = [2, 5, 9, 13, 17];
    const extended = [];
    for (let i = 0; i < fingers.length; i++) {
      const tip = landmarks[fingers[i]];
      const base = landmarks[mcp[i]];
      extended.push(tip[1] < base[1]);
    }

    const indexExtended = extended[1];
    const middleExtended = extended[2];
    const ringExtended = extended[3];
    const pinkyExtended = extended[4];

    if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'CLOSE_PALM';
    }

    const index_mcp = landmarks[5];
    const pinky_mcp = landmarks[17];
    const deltaX_visual = index_mcp[0] - pinky_mcp[0];
    const TILT_THRESHOLD = 40;
    if (deltaX_visual > TILT_THRESHOLD) {
      return 'RIGHT_TILT';
    }
    if (deltaX_visual < -TILT_THRESHOLD) {
      return 'LEFT_TILT';
    }

    return 'NONE';
  }
};

// ============= Game Sketch (Instance Mode) =============
const gameSketch = (p) => {
  p.setup = function() {
    p.pixelDensity(1);
    const canvas = p.createCanvas(COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);
    canvas.elt.style.width = `${COLS * BLOCK_SIZE}px`;
    canvas.elt.style.height = `${ROWS * BLOCK_SIZE}px`;
    canvas.parent('#game-container');
    initGame();
  };

  p.keyPressed = function() {
    if ((p.key === 'r' || p.key === 'R') && isGameOver) {
      initGame();
      return false;
    }
  };

  p.draw = function() {
    p.background(0);
    
    const offsetX = 0;
    const offsetY = 0;
    
    drawGrid(offsetX, offsetY, p);
    
    if (handModelReady && handDetected && gameRunning && !isGameOver) {
      const now = p.millis();
      if (now - lastDropTime > DROP_INTERVAL) {
        if (!currentPiece.moveDown()) {
          currentPiece.lock();
          checkLineClears();
          spawnNewPiece();
        }
        lastDropTime = now;
      }
    } else if (!handModelReady || !handDetected) {
      p.fill(255);
      p.textSize(18);
      p.textAlign(p.CENTER, p.CENTER);
      if (!handModelReady) {
        p.text('等待手勢模型載入...', p.width / 2, p.height / 2);
      } else {
        p.text('偵測到手勢後開始下落', p.width / 2, p.height / 2);
      }
    }
    
    if (gameRunning && !isGameOver) {
      if (command === 'LEFT' && commandTimestamp > 0) {
        currentPiece.moveLeft();
        command = 'IDLE';
      } else if (command === 'RIGHT' && commandTimestamp > 0) {
        currentPiece.moveRight();
        command = 'IDLE';
      } else if (command === 'ROTATE' && commandTimestamp > 0) {
        currentPiece.rotate();
        command = 'IDLE';
      }
    }
    
    if (currentPiece && !isGameOver) {
      currentPiece.draw(offsetX, offsetY, p);
    }
    
    // Display score in top-right corner
    p.fill(255);
    p.textSize(20);
    p.textAlign(p.RIGHT, p.TOP);
    p.text('Score: ' + score, p.width - 10, 10);
    
    if (isGameOver) {
      p.fill(0, 0, 0, 200);
      p.rect(0, 0, p.width, p.height);
      
      p.fill(255, 0, 0);
      p.textSize(48);
      p.textAlign(p.CENTER, p.CENTER);
      p.text('GAME OVER', p.width / 2, p.height / 2 - 60);
      
      p.fill(255);
      p.textSize(32);
      p.text('Score: ' + score, p.width / 2, p.height / 2 + 20);
      
      p.textSize(20);
      p.text('按 R 鍵重新開始', p.width / 2, p.height / 2 + 80);
    }
  };
};

// ============= Initialize Both Sketches =============
new p5(cameraSketch);
new p5(gameSketch);
