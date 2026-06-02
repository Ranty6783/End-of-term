let video;
let handposeModel;
let predictions = [];
let statusText;
let gestureText;
let commandText;
let currentCommand = '--';
let lastLRTime = 0;
const LR_COOLDOWN = 200; // ms
let commandTimestamp = 0;

function setup() {
  const canvas = createCanvas(640, 480);
  canvas.parent(document.body);

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  statusText = select('#status');
  gestureText = select('#gesture');
  commandText = select('#command');

  statusText.html('載入手勢模型…');
  handposeModel = ml5.handpose(video, modelReady);
  handposeModel.on('predict', gotHands);
}

function draw() {
  background(40);

  // Mirror the canvas so the view feels natural to the user
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);

  if (predictions.length > 0) {
    drawHand(predictions[0]);
  }
  pop();

  // Gesture detection and state machine (use prediction coordinates)
  if (predictions.length > 0) {
    const detected = detectGestureState(predictions[0]);
    gestureText.html('手勢：' + detected);

    const now = millis();

    // LEFT/RIGHT with 200ms debounce (variable names swapped)
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

    // CLOSE_PALM -> ROTATE (no extra debounce)
    if (detected === 'CLOSE_PALM') {
      currentCommand = 'ROTATE';
      commandTimestamp = now;
    }
  } else {
    gestureText.html('手勢：未偵測到手部');
  }

  // Update UI command display (left-top panel)
  if (commandText) commandText.html('輸出：' + currentCommand);
}

function modelReady() {
  select('#status').html('模型已載入，請將手放入畫面中。');
}

function gotHands(results) {
  predictions = results;
}

function drawHand(prediction) {
  const landmarks = prediction.landmarks;
  stroke(0, 255, 130);
  strokeWeight(2);
  noFill();

  for (let i = 0; i < landmarks.length; i++) {
    const [x, y] = landmarks[i];
    ellipse(x, y, 8, 8);
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
    line(x1, y1, x2, y2);
  }
}

// Detect gesture state returning one of: LEFT_TILT, RIGHT_TILT, V_SIGN, CLOSE_PALM, NONE
function detectGestureState(prediction) {
  const landmarks = prediction.landmarks;

  // finger extension test (tip vs mcp)
  const fingers = [4, 8, 12, 16, 20];
  const mcp = [2, 5, 9, 13, 17];
  const extended = [];
  for (let i = 0; i < fingers.length; i++) {
    const tip = landmarks[fingers[i]];
    const base = landmarks[mcp[i]];
    extended.push(tip[1] < base[1]);
  }

  const thumbExtended = extended[0];
  const indexExtended = extended[1];
  const middleExtended = extended[2];
  const ringExtended = extended[3];
  const pinkyExtended = extended[4];

  // V_SIGN removed per request

  // Closed palm (fist): fingers not extended
  if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return 'CLOSE_PALM';
  }

  // Palm tilt: compare index_mcp (5) and pinky_mcp (17) in visual (mirrored) x
  // Because canvas is mirrored for display, compute visual delta as index.x - pinky.x
  const index_mcp = landmarks[5];
  const pinky_mcp = landmarks[17];
  const deltaX_visual = index_mcp[0] - pinky_mcp[0];
  const TILT_THRESHOLD = 40; // pixels, tweakable
  // swap the returned label names (only names swapped)
  if (deltaX_visual > TILT_THRESHOLD) {
    return 'RIGHT_TILT';
  }
  if (deltaX_visual < -TILT_THRESHOLD) {
    return 'LEFT_TILT';
  }

  return 'NONE';
}


