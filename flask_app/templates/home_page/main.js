const canvas = document.getElementById("aiCanvas");
const ctx = canvas.getContext("2d");
let width, height, centerX, centerY, baseRadius;
const calendarDiv = document.getElementById("calendar");

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  // 将圆心移到画布左侧（取画布宽度的30%）
  centerX = width * 0.3;
  centerY = height / 2;
  baseRadius = Math.min(width, height) * 0.3;
  
  // 更新日历区域尺寸：与圆直径一致，垂直居中对齐，向左移动（右侧边距150px）
  const dia = baseRadius * 2;
  calendarDiv.style.width = dia + "px";
  calendarDiv.style.height = dia + "px";
  calendarDiv.style.top = (centerY - baseRadius) + "px";
  calendarDiv.style.left = (width - dia - 150) + "px";
}
window.addEventListener("resize", resize);
resize();

const layers = [
  { factor: 0.5, type: "static" },
  { factor: 0.75, type: "pulsate" },
  { factor: 1.0, type: "ripple" },
  { factor: 1.25, type: "rotatingArc" }
];

let time = 0;
function drawConcentricLayers() {
  layers.forEach(layer => {
    const r = baseRadius * layer.factor;
    let alpha = 0.15;
    if (layer.type === "pulsate") {
      alpha = 0.1 + 0.1 * Math.abs(Math.sin(time));
    }
    const grad = ctx.createRadialGradient(centerX, centerY, r * 0.1, centerX, centerY, r);
    grad.addColorStop(0, "rgba(0,209,255," + (alpha + 0.1) + ")");
    grad.addColorStop(0.8, "rgba(0,105,200," + alpha + ")");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,209,255," + (alpha + 0.2) + ")";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00d1ff";
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (layer.type === "ripple") {
      let rippleAlpha = 0.3 * Math.abs(Math.sin(time * 2));
      ctx.beginPath();
      ctx.arc(centerX, centerY, r + 3 * Math.abs(Math.sin(time * 2)), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,209,255," + rippleAlpha + ")";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(centerX, centerY);
      const arcAngle = Math.PI / 2;
      const startAngle = time;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, startAngle, startAngle + arcAngle, false);
      ctx.strokeStyle = "#FFFF00";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#FFFF00";
      ctx.stroke();
      ctx.restore();
    }

    if (layer.type === "rotatingArc") {
      const arcAngle = Math.PI / 2;
      let startAngle = time;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, startAngle, startAngle + arcAngle, false);
      ctx.strokeStyle = "rgba(0,209,255,0.8)";
      ctx.lineWidth = 4;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#00d1ff";
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  });
}

class Node {
  constructor() {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * baseRadius * 0.75;
    this.x = centerX + r * Math.cos(angle);
    this.y = centerY + r * Math.sin(angle);
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;
    this.radius = Math.random() * 2 + 1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    const dx = this.x - centerX;
    const dy = this.y - centerY;
    if (Math.hypot(dx, dy) > baseRadius * 0.75) {
      this.vx *= -1;
      this.vy *= -1;
      this.x += this.vx * 2;
      this.y += this.vy * 2;
    }
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#00d1ff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00d1ff";
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

const nodes = [];
const nodeCount = 80;
for (let i = 0; i < nodeCount; i++) {
  nodes.push(new Node());
}
const maxLinkDistance = baseRadius * 0.4;

function animate() {
  time += 0.01;
  ctx.clearRect(0, 0, width, height);
  
  drawConcentricLayers();
  ctx.globalCompositeOperation = "lighter";
  for (let node of nodes) {
    node.update();
    node.draw(ctx);
  }
  
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.hypot(dx, dy);
      if (dist < maxLinkDistance) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.strokeStyle = "rgba(0,209,255," + (1 - dist / maxLinkDistance) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";

  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const timeStr = now.toLocaleTimeString();
  const displayStr = month + "/" + day + " " + timeStr;

  ctx.save();
  ctx.font = "48px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#FFFF00";
  ctx.shadowColor = "#000000";
  ctx.shadowBlur = 10;
  const textY = centerY + baseRadius * 1.25 + 10;
  ctx.fillText(displayStr, centerX, textY);
  ctx.restore();

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
