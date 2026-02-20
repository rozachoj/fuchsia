// === SERIAL COMMUNICATION ===
let serialConnected = false;
let lastDataTime = 0;

// === SMOOTHING FOR STABLE SENSOR VALUES ===
const SMOOTHING_WINDOW = 10;
let soilMoistureHistory = [];
let oxygenHistory = [];
let heartRateHistory = [];

// Sensor data
let sensorData = {
  soilMoisture: 600,
  oxygen: 350,
  heartRate: 0
};

// Plant system
let plant = [];
let growthCounter = 0;
let time = 0;
let leaves = [];
let flowers = [];
let plantAge = 0;
let autoGrowth = true;

// === REAL PLANT'S PLANTING DATE ===
const PLANTING_DATE = new Date('2025-11-11');
let lastUpdateTime = null;

// Plant images
let branchImage;
let leafImage;
let flowerImage;

// =====================================================
// POSITION CONTROLS - CHANGE THESE TO ADJUST
// =====================================================

// Plant starting position (bottom of screen)
let plantBaseY = 0; // Will be set to bottom of screen
let plantStartHeight = 100; // Initial stem height (increased for larger plant)

// =====================================================

// Debug flag
let showDebugInfo = true;

function preload() {
  branchImage = loadImage('fuchsia_branch.png');
  leafImage = loadImage('fuchsia_leaf.png');
  flowerImage = loadImage('fuchsia_flower.png');
  
  console.log("All images loaded!");
}

// === SMOOTHING FUNCTION ===
function getSmoothedValue(history, newValue, windowSize) {
  history.push(newValue);
  while (history.length > windowSize) {
    history.shift();
  }
  if (history.length === 0) return newValue;
  let sum = 0;
  for (let i = 0; i < history.length; i++) {
    sum += history[i];
  }
  return Math.round(sum / history.length);
}

function calculateRealPlantAge() {
  const now = new Date();
  const ageInMillis = now - PLANTING_DATE;
  const ageInDays = ageInMillis / (1000 * 60 * 60 * 24);
  return ageInDays * 100;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // Set plant base to bottom of screen
  plantBaseY = windowHeight;
  
  // Initialize plant age
  plantAge = calculateRealPlantAge();
  lastUpdateTime = new Date();
  
  // Expose function to receive serial data from HTML
  window.handleSerialData = function(data) {
    processSerialData(data);
  };
  
  console.log("Fuchsia Plant Simulation Started!");
  console.log("Canvas size:", windowWidth, "x", windowHeight);
  
  // Initialize plant
  resetPlant();
}

function resetPlant() {
  plant = [];
  leaves = [];
  flowers = [];
  growthCounter = 0;
  
  plantAge = calculateRealPlantAge();
  lastUpdateTime = new Date();
  
  // Calculate plant starting position (bottom center of screen)
  let baseX = windowWidth / 2;
  let baseY = plantBaseY;
  
  if (showDebugInfo) {
    console.log("Plant starting position:");
    console.log("  Base X:", baseX);
    console.log("  Base Y:", baseY);
  }
  
  // Create initial stem segment (growing upward from bottom)
  plant.push(new StemSegment(baseX, baseY, baseX, baseY - plantStartHeight, 0, -PI/2, 12)); // Increased thickness for larger plant
}

function processSerialData(data) {
  if (!data) return;
  
  data = data.trim();
  if (data.length === 0) return;
  
  console.log("Raw data received:", data);
  
  let parts;
  if (data.includes(',')) {
    parts = data.split(',');
  } else if (data.includes(';')) {
    parts = data.split(';');
  } else {
    parts = data.split(/\s+/);
  }
  
  console.log("Parsed parts:", parts);
  
  if (parts.length >= 1) {
    let soilVal = parseFloat(parts[0]);
    if (!isNaN(soilVal)) {
      sensorData.soilMoisture = getSmoothedValue(soilMoistureHistory, soilVal, SMOOTHING_WINDOW);
    }
    
    if (parts.length >= 2) {
      let oxygenVal = parseFloat(parts[1]);
      if (!isNaN(oxygenVal)) {
        sensorData.oxygen = getSmoothedValue(oxygenHistory, oxygenVal, SMOOTHING_WINDOW);
      }
    }
    
    if (parts.length >= 3) {
      let heartVal = parseFloat(parts[2]);
      if (!isNaN(heartVal)) {
        sensorData.heartRate = getSmoothedValue(heartRateHistory, heartVal, SMOOTHING_WINDOW);
      }
    }
    
    serialConnected = true;
    lastDataTime = millis();
    
    console.log("Updated sensors - Soil:", sensorData.soilMoisture, 
                "O2:", sensorData.oxygen, 
                "Heart:", sensorData.heartRate);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  // Update plant base Y to new bottom
  let oldBaseY = plantBaseY;
  plantBaseY = windowHeight;
  let offsetY = plantBaseY - oldBaseY;
  
  // Move all plant segments
  for (let segment of plant) {
    segment.baseStartY += offsetY;
    segment.baseEndY += offsetY;
    segment.startY += offsetY;
    segment.endY += offsetY;
  }
  
  // Move all leaves
  for (let leaf of leaves) {
    leaf.y += offsetY;
  }
  
  // Move all flowers
  for (let flower of flowers) {
    flower.y += offsetY;
  }
  
  console.log("Window resized - Offset Y:", offsetY);
}

function drawBackground() {
  let topColor = color(135, 206, 235);
  let bottomColor = color(240, 248, 255);
  
  for (let y = 0; y < height; y++) {
    let inter = map(y, 0, height, 0, 1);
    let c = lerpColor(topColor, bottomColor, inter);
    stroke(c);
    line(0, y, width, y);
  }
}

function draw() {
  drawBackground();
  
  time += 0.02;
  
  const now = new Date();
  if (lastUpdateTime) {
    const timePassed = now - lastUpdateTime;
    const daysPassed = timePassed / (1000 * 60 * 60 * 24);
    plantAge += daysPassed * 100;
  }
  lastUpdateTime = now;
  
  if (autoGrowth) {
    growthCounter++;
    let growthSpeed = getGrowthSpeed();
    if (growthCounter > growthSpeed && plant.length < 150) {
      if (shouldGrow()) {
        growPlant();
      }
      growthCounter = 0;
    }
  }
  
  updatePlant();
  drawPlant();
  
  // Draw debug text only if enabled
  if (showDebugInfo) {
    drawDebugInfo();
  }
}

function drawDebugInfo() {
  push();
  fill(255, 255, 0);
  noStroke();
  textSize(12);
  
  let yPos = 20;
  text("DEBUG INFO:", 15, yPos);
  text("plantStartHeight: " + plantStartHeight, 15, yPos + 20);
  text("Base Y: " + Math.round(plantBaseY), 15, yPos + 35);
  text("Auto growth: " + (autoGrowth ? "ON" : "OFF"), 15, yPos + 50);
  text("Plant age: " + nf(plantAge/100, 1, 1) + " days", 15, yPos + 65);
  text("Leaves: " + leaves.length, 15, yPos + 80);
  text("Flowers: " + flowers.length, 15, yPos + 95);
  text("Soil moisture: " + sensorData.soilMoisture, 15, yPos + 110);
  text("O2: " + sensorData.oxygen, 15, yPos + 125);
  
  // Key controls help
  text("CONTROLS:", width - 150, 20);
  text("SPACE: Grow", width - 150, 40);
  text("R: Reset plant", width - 150, 55);
  text("A: Toggle auto growth", width - 150, 70);
  text("8/9: Plant height", width - 150, 85);
  text("7: Toggle debug", width - 150, 100);
  
  pop();
}

function shouldGrow() {
  let moistureFactor = map(sensorData.soilMoisture, 200, 800, 0, 1);
  moistureFactor = constrain(moistureFactor, 0, 1);
  
  if (sensorData.soilMoisture < 250 || sensorData.soilMoisture > 750) {
    return false;
  }
  
  let growthChance = moistureFactor * 0.35;
  if (plantAge < 300) growthChance *= 0.6;
  growthChance += leaves.length * 0.002;
  
  return random() < growthChance;
}

function getGrowthSpeed() {
  if (plantAge < 200) return 35;
  if (plant.length < 10) return 30;
  if (plant.length < 30) return 25;
  if (plant.length < 50) return 20;
  return 18;
}

function growPlant() {
  let growingSegments = plant.filter(segment => 
    segment.canGrow && random() < segment.growthProbability
  );
  
  if (growingSegments.length === 0) return;
  
  let segment = random(growingSegments);
  let growthType = random();
  
  if (plant.length < 6) {
    if (growthType < 0.85) extendStem(segment);
    else createLeaf(segment);
  } else if (plant.length < 20) {
    if (growthType < 0.35) extendStem(segment);
    else if (growthType < 0.65) createBranch(segment);
    else createLeaf(segment);
  } else {
    if (growthType < 0.15) extendStem(segment);
    else if (growthType < 0.25) createBranch(segment);
    else if (growthType < 0.9) createLeaf(segment);
    else createFlower(segment);
  }
}

function extendStem(segment) {
  let angle = segment.angle + random(-0.4, 0.4);
  let length = random(35, 55) * (1 - segment.generation * 0.08); // Increased length for larger plant
  let newX = segment.endX + cos(angle) * length;
  let newY = segment.endY + sin(angle) * length;
  let newThickness = segment.thickness * 0.96;
  let newSegment = new StemSegment(segment.endX, segment.endY, newX, newY, 
                                   segment.generation + 1, angle, newThickness);
  plant.push(newSegment);
}

function createBranch(segment) {
  let branchAngle = segment.angle + random(-PI/2.2, PI/2.2);
  let branchLength = random(28, 45) * (1 - segment.generation * 0.12); // Increased length for larger plant
  let newX = segment.endX + cos(branchAngle) * branchLength;
  let newY = segment.endY + sin(branchAngle) * branchLength;
  let branchThickness = segment.thickness * 0.75;
  let branch = new StemSegment(segment.endX, segment.endY, newX, newY, 
                               segment.generation + 1, branchAngle, branchThickness);
  branch.growthProbability = segment.growthProbability * 0.85;
  plant.push(branch);
}

function createLeaf(segment) {
  let leaf = {
    x: segment.endX,
    y: segment.endY,
    size: random(1.2, 1.8), // Increased size for larger plant
    angle: segment.angle + random(-PI/3, PI/3),
    age: 0,
    maxAge: random(800, 1200),
    swayPhase: random(TWO_PI),
    swayAmount: random(0.5, 1.5),
    colorVariation: random(0.8, 1.2),
    isAttached: true
  };
  leaves.push(leaf);
}

function createFlower(segment) {
  let flower = {
    x: segment.endX,
    y: segment.endY,
    size: random(1.2, 1.8), // Increased size for larger plant
    angle: segment.angle + random(-PI/4, PI/4),
    age: 0,
    maxAge: random(600, 900),
    swayPhase: random(TWO_PI),
    swayAmount: random(0.3, 0.8),
    colorVariation: random(0.9, 1.1),
    bloomProgress: 0,
    isBlooming: false
  };
  flowers.push(flower);
}

function updatePlant() {
  for (let segment of plant) {
    segment.updateSway(time);
  }
  
  for (let i = leaves.length - 1; i >= 0; i--) {
    let leaf = leaves[i];
    leaf.age++;
    leaf.swayOffset = sin(time * 2 + leaf.swayPhase) * leaf.swayAmount;
    
    if (leaf.age > leaf.maxAge) {
      leaf.isAttached = false;
      leaf.y += 0.5;
      leaf.angle += 0.01;
      
      if (leaf.y > height + 50) {
        leaves.splice(i, 1);
      }
    }
  }
  
  for (let i = flowers.length - 1; i >= 0; i--) {
    let flower = flowers[i];
    flower.age++;
    flower.swayOffset = sin(time * 1.5 + flower.swayPhase) * flower.swayAmount;
    
    if (flower.age < 30) {
      flower.bloomProgress = flower.age / 30;
    } else {
      flower.bloomProgress = 1;
      flower.isBlooming = true;
    }
    
    if (flower.age > flower.maxAge) {
      flowers.splice(i, 1);
    }
  }
}

function drawPlant() {
  for (let segment of plant) {
    segment.draw();
  }
  
  for (let leaf of leaves) {
    drawRealLeaf(leaf);
  }
  
  for (let flower of flowers) {
    drawRealFlower(flower);
  }
}

function drawRealLeaf(leaf) {
  if (!leafImage) {
    drawFallbackLeaf(leaf);
    return;
  }
  
  push();
  translate(leaf.x, leaf.y + leaf.swayOffset);
  rotate(leaf.angle);
  
  let alpha = 255;
  if (!leaf.isAttached) {
    alpha = map(leaf.age, leaf.maxAge, leaf.maxAge + 100, 255, 0);
  }
  
  tint(255 * leaf.colorVariation, 255, 255, alpha);
  imageMode(CENTER);
  
  let leafSize = 45 * leaf.size; // Increased base size for larger plant
  image(leafImage, 0, 0, leafSize, leafSize);
  
  pop();
}

function drawRealFlower(flower) {
  if (!flowerImage) {
    drawFallbackFlower(flower);
    return;
  }
  
  push();
  translate(flower.x, flower.y + flower.swayOffset);
  
  let scaleFactor = flower.bloomProgress;
  let alpha = 255;
  
  if (flower.age > flower.maxAge - 100) {
    alpha = map(flower.age, flower.maxAge - 100, flower.maxAge, 255, 0);
  }
  
  tint(255 * flower.colorVariation, 255, 255, alpha);
  rotate(flower.angle);
  imageMode(CENTER);
  
  let flowerSize = 40 * flower.size * scaleFactor; // Increased base size for larger plant
  image(flowerImage, 0, 0, flowerSize, flowerSize);
  
  pop();
}

function drawFallbackLeaf(leaf) {
  push();
  translate(leaf.x, leaf.y + leaf.swayOffset);
  rotate(leaf.angle);
  
  let alpha = leaf.isAttached ? 200 : 100;
  fill(50, 150, 70, alpha);
  noStroke();
  
  beginShape();
  vertex(0, 0);
  for (let i = 0; i <= TWO_PI; i += 0.2) {
    let r = 18 * leaf.size * (0.5 + 0.5 * sin(i * 2));
    let x = cos(i) * r;
    let y = sin(i) * r * 0.6;
    curveVertex(x, y);
  }
  endShape(CLOSE);
  
  pop();
}

function drawFallbackFlower(flower) {
  push();
  translate(flower.x, flower.y + flower.swayOffset);
  
  let alpha = 180;
  if (flower.age > flower.maxAge - 100) {
    alpha = map(flower.age, flower.maxAge - 100, flower.maxAge, 180, 0);
  }
  
  for (let i = 0; i < 5; i++) {
    push();
    rotate((TWO_PI / 5) * i + flower.angle);
    fill(255, 100, 150, alpha);
    noStroke();
    ellipse(0, -15 * flower.size, 18 * flower.size, 9 * flower.size);
    pop();
  }
  
  fill(255, 220, 0, alpha);
  ellipse(0, 0, 12 * flower.size, 12 * flower.size);
  
  pop();
}

class StemSegment {
  constructor(startX, startY, endX, endY, generation, angle, thickness) {
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;
    this.angle = angle;
    this.thickness = thickness;
    this.generation = generation;
    this.canGrow = true;
    
    this.growthProbability = map(generation, 0, 10, 0.9, 0.15);
    this.growthProbability = max(this.growthProbability, 0.05);
    
    this.isRoot = false;
    
    this.baseStartX = startX;
    this.baseStartY = startY;
    this.baseEndX = endX;
    this.baseEndY = endY;
    
    this.color = this.calculateColor();
    this.textureOffset = random(1000);
  }
  
  calculateColor() {
    if (this.isRoot) return color(101, 67, 33);
    
    let brown = color(120, 80, 60);
    let green = color(100, 130, 60);
    let blendAmount = constrain(this.generation / 12, 0, 1);
    
    return lerpColor(brown, green, blendAmount);
  }
  
  updateSway(time) {
    let swayIntensity = 1 - (this.generation * 0.08);
    swayIntensity = max(swayIntensity, 0.3);
    
    let swayAmount = sin(time * 0.8 + this.generation * 0.3 + this.textureOffset) * swayIntensity * 1.5;
    
    this.startX = this.baseStartX + swayAmount;
    this.endX = this.baseEndX + swayAmount * 1.2;
    
    let verticalSway = cos(time * 0.6 + this.generation * 0.4) * swayIntensity * 0.5;
    this.startY = this.baseStartY + verticalSway;
    this.endY = this.baseEndY + verticalSway;
  }
  
  draw() {
    let dx = this.endX - this.startX;
    let dy = this.endY - this.startY;
    let segmentLength = sqrt(dx * dx + dy * dy);
    
    if (segmentLength < 0.1) return;
    
    let segmentAngle = atan2(dy, dx);
    
    if (branchImage && branchImage.width > 0) {
      push();
      translate(this.startX, this.startY);
      rotate(segmentAngle);
      
      let tintColor = this.color;
      tint(red(tintColor), green(tintColor), blue(tintColor), 220);
      
      imageMode(CORNER);
      
      let drawWidth = segmentLength;
      let drawHeight = this.thickness * 6; // Increased for larger plant
      
      let heightVariation = 1 + noise(this.textureOffset + time * 0.5) * 0.2;
      drawHeight *= heightVariation;
      
      image(branchImage, 0, -drawHeight/2, drawWidth, drawHeight);
      
      pop();
    } else {
      stroke(this.color);
      strokeWeight(this.thickness);
      line(this.startX, this.startY, this.endX, this.endY);
      
      strokeWeight(max(1, this.thickness * 0.3));
      stroke(red(this.color) - 20, green(this.color) - 10, blue(this.color) - 10, 150);
      let steps = 4;
      for (let i = 0; i <= steps; i++) {
        let t = i / steps;
        let x = lerp(this.startX, this.endX, t);
        let y = lerp(this.startY, this.endY, t);
        let offset = sin(t * PI + time) * this.thickness * 0.3;
        line(x + offset, y, x - offset, y);
      }
    }
  }
}

function mousePressed() {
  // Water the plant when clicking anywhere
  sensorData.soilMoisture = min(800, sensorData.soilMoisture + 100);
  console.log("Watered! Soil:", sensorData.soilMoisture);
}

function keyPressed() {
  if (key === ' ') {
    growPlant();
    console.log("Manual growth.");
  }
  
  if (key === 'r' || key === 'R') {
    resetPlant();
    sensorData.soilMoisture = 650;
    console.log("Plant reset!");
  }
  
  if (key === 'a' || key === 'A') {
    autoGrowth = !autoGrowth;
    console.log("Auto growth:", autoGrowth ? "ON" : "OFF");
  }
  
  if (key === '7') {
    showDebugInfo = !showDebugInfo;
    console.log("Debug info:", showDebugInfo ? "ON" : "OFF");
  }
  
  if (key === '8') {
    plantStartHeight = max(20, plantStartHeight - 10);
    console.log("plantStartHeight decreased to:", plantStartHeight);
    // Only affects new plants, not existing ones
  }
  
  if (key === '9') {
    plantStartHeight += 10;
    console.log("plantStartHeight increased to:", plantStartHeight);
    // Only affects new plants, not existing ones
  }
}
