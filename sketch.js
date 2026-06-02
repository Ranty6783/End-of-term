let video;
let handposeModel;
let predictions = [];
let statusText;
let gestureText;

function setup() {
  const canvas = createCanvas(640, 480);
  canvas.parent(document.body);

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  statusText = select('#status');
  gestureText = select('#gesture');

  statusText.html('載入手勢模型…');
  handposeModel = ml5.handpose(video, modelReady);
  handposeModel.on('predict', gotHands);
}

function draw() {
  background(40);

  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);

  if (predictions.length > 0) {
    drawHand(predictions[0]);
  }
  pop();

  if (predictions.length > 0) {
    const gesture = recognizeGesture(predictions[0]);
    gestureText.html('手勢：' + gesture);
  } else {
    gestureText.html('手勢：未偵測到手部');
  }
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

function recognizeGesture(prediction) {
  const landmarks = prediction.landmarks;
  const fingers = [4, 8, 12, 16, 20];
  const mcp = [2, 5, 9, 13, 17];
  const extended = [];

  for (let i = 0; i < fingers.length; i++) {
    const tip = landmarks[fingers[i]];
    const pip = landmarks[mcp[i]];
    extended.push(tip[1] < pip[1]);
  }

  const thumbExtended = extended[0];
  const indexExtended = extended[1];
  const middleExtended = extended[2];
  const ringExtended = extended[3];
  const pinkyExtended = extended[4];

  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended && !thumbExtended) {
    return 'V 字手勢 (和平)';
  }
  if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return '大拇指朝上';
  }
  if (indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended) {
    return '張開手掌';
  }
  if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return '握拳';
  }

  return '未知手勢';
}
