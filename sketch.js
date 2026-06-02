// ============= Global Game Variables =============
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 25;
const DROP_INTERVAL = 800; // ms

let grid = [];
let currentPiece = null;
let gameRunning = true;
let lastDropTime = 0;
let currentCommand = '--';
let commandTimestamp = 0;

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
}

function spawnNewPiece() {
  currentPiece = new Piece();
  if (!currentPiece.canMove(0, 0)) {
    gameRunning = false;
  }
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
  let lastLRTime = 0;
  const LR_COOLDOWN = 200;

  p.setup = function() {
    const canvas = p.createCanvas(280, 210);
    canvas.parent('#camera-container');

    video = p.createCapture(p.VIDEO);
    video.size(280, 210);
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

      if (detected === 'RIGHT_TILT') {
        if (now - lastLRTime > LR_COOLDOWN) {
          currentCommand = 'RIGHT';
          lastLRTime = now;
          commandTimestamp = now;
        }
      } else if (detected === 'LEFT_TILT') {
        if (now - lastLRTime > LR_COOLDOWN) {
          currentCommand = 'LEFT';
          lastLRTime = now;
          commandTimestamp = now;
        }
      }

      if (detected === 'CLOSE_PALM') {
        currentCommand = 'ROTATE';
        commandTimestamp = now;
      }
    } else {
      gestureText.html('手勢：未偵測到手部');
    }

    if (commandText) commandText.html('輸出：' + currentCommand);
  };

  function modelReady() {
    statusText.html('模型已載入，請將手放入畫面中。');
  }

  function gotHands(results) {
    predictions = results;
  }

  function drawHand(prediction) {
    const landmarks = prediction.landmarks;
    p.stroke(0, 255, 130);
    p.strokeWeight(2);
    p.noFill();

    for (let i = 0; i < landmarks.length; i++) {
      const [x, y] = landmarks[i];
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
      const [x1, y1] = landmarks[i];
      const [x2, y2] = landmarks[j];
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
    const canvas = p.createCanvas(COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);
    canvas.parent('#game-container');
    initGame();
  };

  p.draw = function() {
    p.background(0);
    
    const offsetX = 0;
    const offsetY = 0;
    
    drawGrid(offsetX, offsetY, p);
    
    const now = p.millis();
    if (now - lastDropTime > DROP_INTERVAL) {
      if (!currentPiece.moveDown()) {
        currentPiece.lock();
        spawnNewPiece();
      }
      lastDropTime = now;
    }
    
    if (currentCommand === 'LEFT' && commandTimestamp > 0) {
      currentPiece.moveLeft();
      currentCommand = '--';
    } else if (currentCommand === 'RIGHT' && commandTimestamp > 0) {
      currentPiece.moveRight();
      currentCommand = '--';
    } else if (currentCommand === 'ROTATE' && commandTimestamp > 0) {
      currentPiece.rotate();
      currentCommand = '--';
    }
    
    if (currentPiece) {
      currentPiece.draw(offsetX, offsetY, p);
    }
    
    if (!gameRunning) {
      p.fill(255, 0, 0);
      p.textSize(32);
      p.textAlign(p.CENTER, p.CENTER);
      p.text('GAME OVER', p.width / 2, p.height / 2);
    }
  };
};

// ============= Initialize Both Sketches =============
new p5(cameraSketch);
new p5(gameSketch);
