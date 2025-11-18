
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const moneyEl = document.getElementById("money");
const livesEl = document.getElementById("lives");
const waveEl = document.getElementById("wave");
const maxWaveEl = document.getElementById("maxWave");
const scoreEl = document.getElementById("score");
const xpEl = document.getElementById("xp");
const levelEl = document.getElementById("level");
const speedLabelEl = document.getElementById("speedLabel");
const messageEl = document.getElementById("message");
const loadingOverlay = document.getElementById("loadingOverlay");

const btnStartWave = document.getElementById("btnStartWave");
const btnPause = document.getElementById("btnPause");
const btnSpeedDown = document.getElementById("btnSpeedDown");
const btnSpeedUp = document.getElementById("btnSpeedUp");
const towerBarEl = document.getElementById("towerBar");

const selectedTitleEl = document.getElementById("selectedTitle");
const selectedStatsEl = document.getElementById("selectedStats");
const btnUpgradeA = document.getElementById("btnUpgradeA");
const btnUpgradeB = document.getElementById("btnUpgradeB");
const btnSell = document.getElementById("btnSell");

const btnFreeze = document.getElementById("btnFreeze");
const btnStorm = document.getElementById("btnStorm");

// Grid
const TILE_SIZE = 40;
const GRID_COLS = canvas.width / TILE_SIZE;
const GRID_ROWS = canvas.height / TILE_SIZE;

// Path
const path = [
  [0, 5],
  [3, 5],
  [3, 3],
  [7, 3],
  [7, 8],
  [12, 8],
  [12, 4],
  [15, 4]
];

function buildPathPoints(path) {
  const pts = path.map(([c, r]) => ({
    x: c * TILE_SIZE + TILE_SIZE / 2,
    y: r * TILE_SIZE + TILE_SIZE / 2
  }));
  let totalDist = 0;
  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    segments.push({
      ax: a.x,
      ay: a.y,
      bx: b.x,
      by: b.y,
      len,
      startDist: totalDist,
      endDist: totalDist + len
    });
    totalDist += len;
  }
  return { pts, segments, totalDist };
}
const pathData = buildPathPoints(path);

function isPathTile(col, row) {
  return path.some(([c, r]) => c === col && r === row);
}
function worldToGrid(x, y) {
  return {
    col: Math.floor(x / TILE_SIZE),
    row: Math.floor(y / TILE_SIZE)
  };
}
function gridToWorldCenter(col, row) {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2
  };
}
function getEnemyPosition(enemy) {
  const dist = enemy.dist;
  const segs = pathData.segments;
  if (dist >= pathData.totalDist) {
    const lastSeg = segs[segs.length - 1];
    return { x: lastSeg.bx, y: lastSeg.by };
  }
  for (let s of segs) {
    if (dist >= s.startDist && dist <= s.endDist) {
      const t = (dist - s.startDist) / s.len;
      const x = s.ax + (s.bx - s.ax) * t;
      const y = s.ay + (s.by - s.ay) * t;
      return { x, y };
    }
  }
  const first = segs[0];
  return { x: first.ax, y: first.ay };
}

const MAX_WAVES = 20;
maxWaveEl.textContent = MAX_WAVES.toString();

const gameState = {
  money: 300,
  lives: 20,
  wave: 0,
  score: 0,
  xp: 0,
  level: 1,
  paused: false,
  speed: 1,
  currentWaveSpawns: [],
  waveTimer: 0,
  waveActive: false,
  gameOver: false,
  gameWon: false,
  freezeTimer: 0,
  stormUsed: false,
  freezeUsed: false
};

const towerTypes = {
  gunner: {
    id: "gunner",
    name: "Gunner",
    baseCost: 80,
    color: "#22c55e",
    bulletColor: "#bef264",
    range: 130,
    damage: 10,
    fireRate: 1.8,
    splash: 0,
    slow: 0,
    tags: ["starter", "single"],
    desc: "Balanced tower. Cheap, solid single target DPS.",
    pathA: [
      { cost: 60, desc: "+25% dmg, +10% fire rate" },
      { cost: 90, desc: "+25% dmg, +10% fire rate" },
      { cost: 120, desc: "Big crit chance vs all enemies" }
    ],
    pathB: [
      { cost: 60, desc: "+30% range" },
      { cost: 90, desc: "+20% range, +small slow" },
      { cost: 120, desc: "Becomes mini support (range aura)" }
    ]
  },
  sniper: {
    id: "sniper",
    name: "Sniper",
    baseCost: 140,
    color: "#38bdf8",
    bulletColor: "#e0f2fe",
    range: 240,
    damage: 28,
    fireRate: 0.65,
    splash: 0,
    slow: 0,
    tags: ["long range", "high dmg"],
    desc: "High range single target. Great vs tough enemies.",
    pathA: [
      { cost: 90, desc: "+40% dmg" },
      { cost: 120, desc: "+40% dmg, +10% fire rate" },
      { cost: 160, desc: "Bonus vs bosses & tanks" }
    ],
    pathB: [
      { cost: 90, desc: "+25% range" },
      { cost: 120, desc: "+15% range, slight pierce" },
      { cost: 160, desc: "Shots pierce multiple enemies" }
    ]
  },
  splash: {
    id: "splash",
    name: "Blaster",
    baseCost: 130,
    color: "#f97316",
    bulletColor: "#fed7aa",
    range: 150,
    damage: 14,
    fireRate: 1.2,
    splash: 60,
    slow: 0,
    tags: ["area", "crowd"],
    desc: "Area damage. Great vs swarms.",
    pathA: [
      { cost: 80, desc: "+30% splash radius" },
      { cost: 110, desc: "+30% dmg, +radius" },
      { cost: 150, desc: "Huge splash & hit flash" }
    ],
    pathB: [
      { cost: 80, desc: "+fire rate" },
      { cost: 110, desc: "+fire rate, small burn dmg" },
      { cost: 150, desc: "Burn over time on hit" }
    ]
  },
  frost: {
    id: "frost",
    name: "Frost",
    baseCost: 120,
    color: "#a855f7",
    bulletColor: "#e9d5ff",
    range: 150,
    damage: 6,
    fireRate: 1.5,
    splash: 40,
    slow: 0.35,
    tags: ["slow", "control"],
    desc: "Slows enemies in area.",
    pathA: [
      { cost: 80, desc: "+slow amount" },
      { cost: 110, desc: "+slow & +radius" },
      { cost: 150, desc: "Massive slow aura" }
    ],
    pathB: [
      { cost: 80, desc: "+damage" },
      { cost: 110, desc: "+damage & fire rate" },
      { cost: 150, desc: "Frozen enemies take bonus dmg" }
    ]
  },
  support: {
    id: "support",
    name: "Relay",
    baseCost: 160,
    color: "#eab308",
    bulletColor: "#facc15",
    range: 110,
    damage: 0,
    fireRate: 0,
    splash: 0,
    slow: 0,
    tags: ["buff", "aura"],
    desc: "Buffs towers near it.",
    pathA: [
      { cost: 90, desc: "+dmg aura strength" },
      { cost: 130, desc: "+fire rate aura" },
      { cost: 170, desc: "Big range & strong aura" }
    ],
    pathB: [
      { cost: 90, desc: "+range aura" },
      { cost: 130, desc: "More range & small slow aura" },
      { cost: 170, desc: "Global tiny buff" }
    ]
  }
};

const enemyTypes = {
  normal: {
    id: "normal",
    name: "Runner",
    color: "#ef4444",
    speed: 60,
    maxHpBase: 40,
    rewardBase: 10,
    size: 18
  },
  fast: {
    id: "fast",
    name: "Sprinter",
    color: "#fb923c",
    speed: 95,
    maxHpBase: 25,
    rewardBase: 11,
    size: 15
  },
  tank: {
    id: "tank",
    name: "Brute",
    color: "#7c3aed",
    speed: 45,
    maxHpBase: 85,
    rewardBase: 18,
    size: 22
  },
  swarm: {
    id: "swarm",
    name: "Swarm",
    color: "#22c55e",
    speed: 70,
    maxHpBase: 16,
    rewardBase: 5,
    size: 12
  },
  regen: {
    id: "regen",
    name: "Regenerator",
    color: "#22d3ee",
    speed: 60,
    maxHpBase: 55,
    rewardBase: 16,
    size: 18
  },
  shield: {
    id: "shield",
    name: "Shielded",
    color: "#facc15",
    speed: 55,
    maxHpBase: 70,
    rewardBase: 20,
    size: 20
  },
  boss: {
    id: "boss",
    name: "Boss",
    color: "#f472b6",
    speed: 45,
    maxHpBase: 260,
    rewardBase: 80,
    size: 28
  }
};

const projectileStyles = {
  gunner: "basic",
  sniper: "sniper",
  splash: "splash",
  frost: "frost",
  support: "support"
};

let towers = [];
let enemies = [];
let bullets = [];

let selectedTowerTypeId = "gunner";
let selectedTower = null;

let hover = { x: 0, y: 0, col: -1, row: -1, has: false };

const sprites = {
  towers: {},
  enemies: {},
  projectiles: {}
};

let globalTime = 0;

// Sprite loading
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadSprites() {
  const tasks = [];

  for (const towerId of Object.keys(towerTypes)) {
    sprites.towers[towerId] = {};
    for (let tier = 1; tier <= 3; tier++) {
      sprites.towers[towerId][tier] = [];
      for (let f = 0; f < 4; f++) {
        const path = `assets/sprites/towers/${towerId}/${towerId}_t${tier}_f${f}.png`;
        const p = loadImage(path).then(img => {
          sprites.towers[towerId][tier][f] = img;
        });
        tasks.push(p);
      }
    }
  }

  for (const enemyId of Object.keys(enemyTypes)) {
    sprites.enemies[enemyId] = [];
    for (let f = 0; f < 4; f++) {
      const path = `assets/sprites/enemies/${enemyId}/${enemyId}_f${f}.png`;
      const p = loadImage(path).then(img => {
        sprites.enemies[enemyId][f] = img;
      });
      tasks.push(p);
    }
  }

  const projIds = ["basic", "sniper", "splash", "frost", "support"];
  for (const pid of projIds) {
    const path = `assets/sprites/projectiles/proj_${pid}.png`;
    const p = loadImage(path).then(img => {
      sprites.projectiles[pid] = img;
    });
    tasks.push(p);
  }

  await Promise.all(tasks);
}

// Helpers / UI
function message(text) {
  messageEl.textContent = text;
}
function addXP(amount) {
  gameState.xp += amount;
  const xpForNext = gameState.level * 100;
  if (gameState.xp >= xpForNext) {
    gameState.xp -= xpForNext;
    gameState.level++;
    gameState.money += 50;
    message(`Level up! Global bonus & +$50.`);
  }
}

// Wave config
function buildWaveConfig(wave) {
  const configs = [];
  const baseCount = 7 + wave * 2;

  if (wave < 5) {
    configs.push({ type: "normal", count: baseCount, interval: 0.8 });
    if (wave >= 2) configs.push({ type: "fast", count: 3 + wave, interval: 0.6 });
  } else if (wave < 10) {
    configs.push({ type: "normal", count: baseCount - 4, interval: 0.7 });
    configs.push({ type: "fast", count: 4 + wave, interval: 0.55 });
    configs.push({ type: "swarm", count: 3 + Math.floor(wave / 2), interval: 0.4 });
    configs.push({ type: "tank", count: 2 + Math.floor(wave / 3), interval: 1.2 });
  } else if (wave < 15) {
    configs.push({ type: "normal", count: baseCount - 6, interval: 0.65 });
    configs.push({ type: "fast", count: 6 + wave, interval: 0.5 });
    configs.push({ type: "swarm", count: 6 + Math.floor(wave / 2), interval: 0.35 });
    configs.push({ type: "tank", count: 3 + Math.floor(wave / 2), interval: 1.1 });
    configs.push({ type: "regen", count: 3 + Math.floor(wave / 3), interval: 0.9 });
  } else {
    configs.push({ type: "normal", count: baseCount - 6, interval: 0.6 });
    configs.push({ type: "fast", count: 7 + wave, interval: 0.45 });
    configs.push({ type: "swarm", count: 7 + Math.floor(wave / 2), interval: 0.3 });
    configs.push({ type: "tank", count: 4 + Math.floor(wave / 2), interval: 1.0 });
    configs.push({ type: "regen", count: 5 + Math.floor(wave / 3), interval: 0.8 });
    configs.push({ type: "shield", count: 4 + Math.floor(wave / 3), interval: 1.0 });
  }

  if (wave % 5 === 0) {
    configs.push({ type: "boss", count: 1 + Math.floor(wave / 10), interval: 3.0 });
  }

  const spawnEvents = [];
  let t = 0;
  for (const c of configs) {
    for (let i = 0; i < c.count; i++) {
      spawnEvents.push({ time: t, type: c.type });
      t += c.interval;
    }
    t += 0.8;
  }
  return spawnEvents;
}

function spawnEnemy(typeId) {
  const et = enemyTypes[typeId];
  if (!et) return;
  const hpScale = 1 + gameState.wave * 0.4;
  const hp = Math.round(et.maxHpBase * hpScale);
  const reward = Math.round(et.rewardBase + gameState.wave * 1.2);
  enemies.push({
    typeId,
    dist: 0,
    speed: et.speed,
    baseSpeed: et.speed,
    maxHp: hp,
    hp,
    reward,
    alive: true,
    slowFactor: 1,
    slowTimer: 0,
    regenTimer: 0,
    shieldHp: typeId === "shield" ? Math.round(hp * 0.4) : 0,
    boss: typeId === "boss",
    hitFlash: 0
  });
}

function startNextWave() {
  if (gameState.wave >= MAX_WAVES || gameState.waveActive || gameState.gameOver) return;
  gameState.wave++;
  gameState.waveActive = true;
  gameState.waveTimer = 0;
  gameState.currentWaveSpawns = buildWaveConfig(gameState.wave);
  gameState.freezeTimer = 0;
  gameState.stormUsed = false;
  gameState.freezeUsed = false;
  syncAbilityButtons();
  message(`Wave ${gameState.wave} started! Prepare.`);
}

// Towers & bullets
function createTower(typeId, col, row) {
  const tt = towerTypes[typeId];
  const pos = gridToWorldCenter(col, row);
  const tower = {
    id: Date.now() + ":" + Math.random(),
    typeId,
    x: pos.x,
    y: pos.y,
    col,
    row,
    base: tt,
    level: 0,
    path: null,
    totalInvested: tt.baseCost,
    range: tt.range,
    damage: tt.damage,
    fireRate: tt.fireRate,
    splash: tt.splash,
    slow: tt.slow,
    cooldown: 0,
    pierce: 0,
    burn: false,
    bonusVsBoss: false,
    bonusAura: { dmg: 0, fireRate: 0, range: 0, slowAura: 0 }
  };
  towers.push(tower);
  return tower;
}

function getTowerTier(t) {
  if (t.level >= 3) return 3;
  if (t.level >= 1) return 2;
  return 1;
}

function applyUpgrade(tower, pathLabel) {
  const base = tower.base;
  const path = pathLabel === "A" ? base.pathA : base.pathB;
  if (!path) return;
  if (tower.path && tower.path !== pathLabel) {
    message("This tower is locked into the other path.");
    return;
  }
  const idx = tower.level;
  if (idx >= path.length) {
    message("This path is fully upgraded.");
    return;
  }
  const up = path[idx];
  if (gameState.money < up.cost) {
    message("Not enough money for upgrade.");
    return;
  }
  gameState.money -= up.cost;
  tower.level++;
  tower.path = pathLabel;
  tower.totalInvested += up.cost;

  if (tower.typeId === "gunner") {
    if (pathLabel === "A") {
      if (idx === 0 || idx === 1) {
        tower.damage *= 1.25;
        tower.fireRate *= 1.1;
      } else if (idx === 2) {
        tower.critChance = 0.25;
        tower.critMult = 2.0;
      }
    } else {
      if (idx === 0) {
        tower.range *= 1.3;
      } else if (idx === 1) {
        tower.range *= 1.2;
        tower.slow = Math.max(tower.slow, 0.15);
      } else if (idx === 2) {
        tower.bonusAura.dmg += 0.12;
        tower.bonusAura.range += 0.1;
      }
    }
  } else if (tower.typeId === "sniper") {
    if (pathLabel === "A") {
      if (idx === 0 || idx === 1) {
        tower.damage *= 1.4;
        if (idx === 1) tower.fireRate *= 1.1;
      } else {
        tower.bonusVsBoss = true;
      }
    } else {
      if (idx === 0) {
        tower.range *= 1.25;
      } else if (idx === 1) {
        tower.range *= 1.15;
        tower.pierce = Math.max(tower.pierce, 1);
      } else {
        tower.pierce = 2;
      }
    }
  } else if (tower.typeId === "splash") {
    if (pathLabel === "A") {
      if (idx === 0) {
        tower.splash *= 1.3;
      } else if (idx === 1) {
        tower.splash *= 1.3;
        tower.damage *= 1.3;
      } else {
        tower.splash *= 1.4;
        tower.hitFlash = true;
      }
    } else {
      if (idx === 0 || idx === 1) {
        tower.fireRate *= 1.15;
        tower.damage *= 1.15;
        if (idx === 1) tower.burn = true;
      } else {
        tower.burn = true;
        tower.damage *= 1.3;
      }
    }
  } else if (tower.typeId === "frost") {
    if (pathLabel === "A") {
      if (idx === 0) {
        tower.slow += 0.1;
      } else if (idx === 1) {
        tower.slow += 0.1;
        tower.splash *= 1.2;
      } else {
        tower.globalSlow = true;
      }
    } else {
      if (idx === 0) {
        tower.damage *= 1.3;
      } else if (idx === 1) {
        tower.damage *= 1.2;
        tower.fireRate *= 1.1;
      } else {
        tower.bonusFrozen = 0.3;
      }
    }
  } else if (tower.typeId === "support") {
    if (pathLabel === "A") {
      if (idx === 0) {
        tower.bonusAura.dmg += 0.15;
      } else if (idx === 1) {
        tower.bonusAura.fireRate += 0.15;
      } else {
        tower.range *= 1.3;
        tower.bonusAura.dmg += 0.1;
        tower.bonusAura.fireRate += 0.1;
      }
    } else {
      if (idx === 0) {
        tower.bonusAura.range += 0.15;
      } else if (idx === 1) {
        tower.bonusAura.range += 0.15;
        tower.bonusAura.slowAura += 0.1;
      } else {
        tower.globalBuff = true;
      }
    }
  }

  message(`${tower.base.name} upgraded along Path ${pathLabel} (Lv ${tower.level}).`);
  syncSelectedTowerUI();
}

function getProjectileStyleForTower(tower) {
  return projectileStyles[tower.typeId] || "basic";
}

function createBullet(tower, target) {
  bullets.push({
    x: tower.x,
    y: tower.y,
    target,
    towerId: tower.id,
    damage: tower.effDamage || tower.damage,
    speed: 260,
    splash: tower.splash,
    slow: tower.slow,
    pierce: tower.pierce || 0,
    burn: tower.burn || false,
    bonusVsBoss: tower.bonusVsBoss || false,
    bonusFrozen: tower.bonusFrozen || 0,
    color: tower.base.bulletColor,
    critChance: tower.critChance || 0,
    critMult: tower.critMult || 1.5,
    styleId: getProjectileStyleForTower(tower)
  });
}

function getTowerAt(col, row) {
  return towers.find(t => t.col === col && t.row === row) || null;
}

// Drawing
function drawGrid() {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      if (isPathTile(col, row)) {
        const t = gameState.wave;
        const hueShift = (t * 8) % 360;
        ctx.fillStyle = `hsl(${20 + hueShift}, 70%, 30%)`;
      } else {
        ctx.fillStyle = "#022c22";
      }
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "#00000044";
      ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
    }
  }
  ctx.save();
  ctx.strokeStyle = "#22d3ee88";
  ctx.lineWidth = 4;
  ctx.beginPath();
  pathData.pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  ctx.restore();

  const [baseCol, baseRow] = path[path.length - 1];
  const baseX = baseCol * TILE_SIZE;
  const baseY = baseRow * TILE_SIZE;
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(baseX + 8, baseY + 8, TILE_SIZE - 16, TILE_SIZE - 16);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BASE", baseX + TILE_SIZE / 2, baseY + TILE_SIZE / 2 + 4);
}

function drawTowerRangePreview() {
  if (hover.has && !gameState.gameOver && !gameState.gameWon) {
    const tt = towerTypes[selectedTowerTypeId];
    if (tt) {
      const { x, y } = gridToWorldCenter(hover.col, hover.row);
      ctx.save();
      ctx.strokeStyle = tt.color + "55";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, tt.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (selectedTower) {
    ctx.save();
    ctx.strokeStyle = selectedTower.base.color + "aa";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(selectedTower.x, selectedTower.y, selectedTower.effRange || selectedTower.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawTowers() {
  const frame = Math.floor(globalTime * 8) % 4;
  for (let t of towers) {
    const tier = getTowerTier(t);
    const spriteSet = sprites.towers[t.typeId];
    const img = spriteSet && spriteSet[tier] && spriteSet[tier][frame];
    if (img) {
      const size = 48;
      ctx.drawImage(img, t.x - size / 2, t.y - size / 2, size, size);
    } else {
      const col = t.base.color;
      ctx.save();
      ctx.shadowColor = col + "aa";
      ctx.shadowBlur = 10;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (selectedTower && selectedTower.id === t.id) {
      ctx.save();
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawEnemies() {
  const frame = Math.floor(globalTime * 6) % 4;
  for (let e of enemies) {
    if (!e.alive) continue;
    const et = enemyTypes[e.typeId];
    const pos = getEnemyPosition(e);
    const spriteSet = sprites.enemies[e.typeId];
    const img = spriteSet && spriteSet[frame];

    if (img) {
      const size = 40;
      const bob = Math.sin(globalTime * 6) * 2;
      ctx.drawImage(img, pos.x - size / 2, pos.y - size / 2 + bob, size, size);
    } else {
      const size = et.size || 18;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      let color = et.color;
      if (e.hitFlash > 0) {
        color = "#f9fafb";
        e.hitFlash -= 0.02;
      }
      ctx.fillStyle = color;
      ctx.shadowColor = color + "aa";
      ctx.shadowBlur = 10;
      if (e.boss) {
        ctx.beginPath();
        ctx.arc(0, 0, size / 2 + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f9a8d4";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const hpRatio = Math.max(0, e.hp) / e.maxHp;
    const barWidth = (et.size || 18) + 16;
    const barHeight = 4;
    ctx.fillStyle = "#020617";
    ctx.fillRect(
      pos.x - barWidth / 2,
      pos.y - (et.size || 18) / 2 - 10,
      barWidth,
      barHeight
    );
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(
      pos.x - barWidth / 2,
      pos.y - (et.size || 18) / 2 - 10,
      barWidth * hpRatio,
      barHeight
    );
  }
}

function drawBullets() {
  for (let b of bullets) {
    const img = sprites.projectiles[b.styleId];
    if (img) {
      const size = 16;
      ctx.drawImage(img, b.x - size / 2, b.y - size / 2, size, size);
    } else {
      ctx.save();
      ctx.fillStyle = b.color || "#facc15";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawOverlay() {
  if (gameState.gameOver || gameState.gameWon) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f9fafb";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(gameState.gameOver ? "Game Over" : "You Win!", canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = "16px sans-serif";
    ctx.fillText("Refresh the page to play again.", canvas.width / 2, canvas.height / 2 + 18);
    ctx.restore();
  }
}

// Auras & updates
function applyAurasToTowers() {
  for (let t of towers) {
    t.rangeMul = 1;
    t.dmgMul = 1;
    t.fireRateMul = 1;
    t.slowAuraBonus = 0;
  }
  const globals = { dmg: 0, fireRate: 0, range: 0, slow: 0 };
  for (let s of towers) {
    if (s.typeId !== "support") continue;
    if (s.globalBuff) {
      globals.dmg += 0.05;
      globals.fireRate += 0.05;
    }
    for (let t of towers) {
      if (t.id === s.id) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d <= s.range) {
        t.dmgMul += s.bonusAura.dmg;
        t.fireRateMul += s.bonusAura.fireRate;
        t.rangeMul += s.bonusAura.range;
        t.slowAuraBonus += s.bonusAura.slowAura;
      }
    }
  }
  if (globals.dmg || globals.fireRate || globals.range) {
    for (let t of towers) {
      t.dmgMul += globals.dmg;
      t.fireRateMul += globals.fireRate;
      t.rangeMul += globals.range;
    }
  }
  for (let t of towers) {
    t.effRange = t.range * (t.rangeMul || 1);
    t.effDamage = t.damage * (t.dmgMul || 1);
    t.effFireRate = t.fireRate * (t.fireRateMul || 1);
  }
}

function findTowerTarget(tower) {
  let best = null;
  let bestDist = Infinity;
  for (let e of enemies) {
    if (!e.alive) continue;
    const pos = getEnemyPosition(e);
    const dx = pos.x - tower.x;
    const dy = pos.y - tower.y;
    const d = Math.hypot(dx, dy);
    if (d <= (tower.effRange || tower.range) && d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

function handleBulletHit(b, hitPos) {
  let target = b.target;
  if (!target || !target.alive) return;

  if (b.slow > 0) {
    target.slowFactor = Math.min(target.slowFactor, 1 - (b.slow + (target.slowAuraBonus || 0)));
    target.slowTimer = 1.2;
  }

  let dmg = b.damage;
  if (b.bonusVsBoss && target.boss) dmg *= 1.5;
  if (b.bonusFrozen && target.slowTimer > 0) dmg *= 1 + b.bonusFrozen;
  if (Math.random() < (b.critChance || 0)) {
    dmg *= b.critMult || 1.5;
  }
  if (target.shieldHp > 0) {
    const used = Math.min(target.shieldHp, dmg * 0.7);
    target.shieldHp -= used;
    dmg -= used;
  }
  if (dmg > 0) target.hp -= dmg;
  target.hitFlash = 1;

  if (b.splash > 0) {
    for (let e of enemies) {
      if (!e.alive || e === target) continue;
      const pos = getEnemyPosition(e);
      const dx = pos.x - hitPos.x;
      const dy = pos.y - hitPos.y;
      const d = Math.hypot(dx, dy);
      if (d <= b.splash) {
        let sd = b.damage * 0.6;
        if (b.burn) sd += 3;
        e.hp -= sd;
        e.hitFlash = 1;
      }
    }
  }
  if (target.hp <= 0 && target.alive) {
    target.alive = false;
    gameState.money += target.reward;
    gameState.score += target.reward * 2;
    addXP(3 + gameState.wave);
  }
}

function update(dt) {
  if (gameState.paused || gameState.gameOver || gameState.gameWon) return;
  dt *= gameState.speed;
  globalTime += dt;

  if (gameState.waveActive) {
    gameState.waveTimer += dt;
    while (gameState.currentWaveSpawns.length > 0 && gameState.currentWaveSpawns[0].time <= gameState.waveTimer) {
      const ev = gameState.currentWaveSpawns.shift();
      spawnEnemy(ev.type);
    }
  }

  for (let e of enemies) {
    if (!e.alive) continue;
    let speed = e.baseSpeed;
    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      speed *= e.slowFactor;
    } else {
      e.slowFactor = 1;
    }
    if (gameState.freezeTimer > 0) {
      speed *= 0.35;
    }
    e.dist += speed * dt;
    if (e.dist >= pathData.totalDist) {
      e.alive = false;
      gameState.lives--;
      if (gameState.lives <= 0) {
        gameState.lives = 0;
        gameState.gameOver = true;
        message("Your base has fallen!");
      }
    }
    if (e.typeId === "regen" && e.hp > 0) {
      e.regenTimer += dt;
      if (e.regenTimer > 1.2) {
        e.regenTimer = 0;
        e.hp = Math.min(e.maxHp, e.hp + 4);
      }
    }
  }
  if (gameState.freezeTimer > 0) {
    gameState.freezeTimer -= dt;
  }
  enemies = enemies.filter(e => e.alive && e.hp > 0);

  applyAurasToTowers();
  for (let t of towers) {
    if (t.fireRate <= 0 && !t.effFireRate) continue;
    const fr = t.effFireRate || t.fireRate;
    t.cooldown -= dt;
    if (t.cooldown <= 0) {
      const target = findTowerTarget(t);
      if (target) {
        createBullet(t, target);
        t.cooldown = 1 / fr;
      } else {
        t.cooldown = 0.1;
      }
    }
  }

  const survivors = [];
  for (let b of bullets) {
    if (!b.target || !b.target.alive || b.target.hp <= 0) continue;
    const pos = getEnemyPosition(b.target);
    const dx = pos.x - b.x;
    const dy = pos.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      handleBulletHit(b, pos);
      if (b.pierce > 0) {
        b.pierce--;
        b.x = pos.x;
        b.y = pos.y;
        survivors.push(b);
      }
      continue;
    }
    const vx = (dx / (dist || 1)) * b.speed * dt;
    const vy = (dy / (dist || 1)) * b.speed * dt;
    b.x += vx;
    b.y += vy;
    survivors.push(b);
  }
  bullets = survivors;

  if (gameState.waveActive && gameState.currentWaveSpawns.length === 0 && enemies.length === 0) {
    gameState.waveActive = false;
    message(`Wave ${gameState.wave} cleared!`);
    addXP(25 + gameState.wave * 4);
    if (gameState.wave >= MAX_WAVES) {
      gameState.gameWon = true;
      message("You survived all waves!");
    } else {
      gameState.money += 80 + gameState.wave * 10;
    }
  }

  syncUI();
}

// UI sync
function syncUI() {
  moneyEl.textContent = Math.floor(gameState.money).toString();
  livesEl.textContent = gameState.lives.toString();
  waveEl.textContent = gameState.wave.toString();
  scoreEl.textContent = gameState.score.toString();
  xpEl.textContent = gameState.xp.toString();
  levelEl.textContent = gameState.level.toString();
  speedLabelEl.textContent = gameState.speed.toFixed(1) + "x";
  btnStartWave.disabled = gameState.waveActive || gameState.gameOver || gameState.gameWon || gameState.wave >= MAX_WAVES;
  btnPause.textContent = gameState.paused ? "Resume" : "Pause";
}

function syncSelectedTowerUI() {
  if (!selectedTower) {
    selectedTitleEl.textContent = "No tower selected";
    selectedStatsEl.textContent = "Click a placed tower to inspect and upgrade.";
    btnUpgradeA.disabled = true;
    btnUpgradeB.disabled = true;
    btnSell.disabled = true;
    btnUpgradeA.textContent = "Path A";
    btnUpgradeB.textContent = "Path B";
    return;
  }
  const t = selectedTower;
  const base = t.base;
  selectedTitleEl.textContent = `${base.name} (Lv ${t.level || 0}) [${t.path || "-"}]`;
  selectedStatsEl.textContent =
    `Damage: ${(t.effDamage || t.damage).toFixed(1)} | Range: ${(t.effRange || t.range).toFixed(0)} | ` +
    `FireRate: ${(t.effFireRate || t.fireRate).toFixed(2)}/s | Splash: ${t.splash.toFixed(0)} | Slow: ${(t.slow * 100).toFixed(0)}%`;

  const baseDef = t.base;
  const pathA = baseDef.pathA;
  const pathB = baseDef.pathB;
  const nextALevel = t.path && t.path !== "A" ? null : pathA[t.level];
  const nextBLevel = t.path && t.path !== "B" ? null : pathB[t.level];

  btnUpgradeA.disabled = !nextALevel || gameState.gameOver || gameState.gameWon;
  btnUpgradeB.disabled = !nextBLevel || gameState.gameOver || gameState.gameWon;

  btnUpgradeA.textContent = nextALevel
    ? `Path A: $${nextALevel.cost} — ${nextALevel.desc}`
    : "Path A: MAX";
  btnUpgradeB.textContent = nextBLevel
    ? `Path B: $${nextBLevel.cost} — ${nextBLevel.desc}`
    : "Path B: MAX";

  btnSell.disabled = gameState.gameOver || gameState.gameWon;
  btnSell.textContent = `Sell (+$${Math.floor(t.totalInvested * 0.7)})`;
}

function syncAbilityButtons() {
  btnFreeze.disabled = gameState.freezeUsed || gameState.gameOver || gameState.gameWon;
  btnStorm.disabled = gameState.stormUsed || gameState.gameOver || gameState.gameWon;
  btnFreeze.textContent = gameState.freezeUsed ? "Freeze (Used)" : "Freeze";
  btnStorm.textContent = gameState.stormUsed ? "Storm (Used)" : "Storm";
}

// Tower bar
function createTowerBar() {
  towerBarEl.innerHTML = "";
  Object.values(towerTypes).forEach(tt => {
    const card = document.createElement("div");
    card.className = "tower-card";
    card.dataset.id = tt.id;

    const head = document.createElement("div");
    head.className = "tower-card-header";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = tt.name;
    const costSpan = document.createElement("span");
    costSpan.className = "tower-cost";
    costSpan.textContent = "$" + tt.baseCost;
    head.appendChild(nameSpan);
    head.appendChild(costSpan);

    const dot = document.createElement("div");
    dot.className = "tower-dot";
    dot.style.background = tt.color;
    dot.style.boxShadow = `0 0 4px ${tt.color}aa`;
    head.appendChild(dot);

    const desc = document.createElement("div");
    desc.className = "tower-desc";
    desc.textContent = tt.desc;

    const tagRow = document.createElement("div");
    tagRow.className = "tag-row";
    tt.tags.forEach(tg => {
      const tag = document.createElement("div");
      tag.className = "tag";
      tag.textContent = tg;
      tagRow.appendChild(tag);
    });

    card.appendChild(head);
    card.appendChild(desc);
    card.appendChild(tagRow);

    card.addEventListener("click", () => {
      selectedTowerTypeId = tt.id;
      selectedTower = null;
      syncSelectedTowerUI();
      updateTowerCardSelection();
      message(`Placing ${tt.name}. Click on a green tile.`);
    });

    towerBarEl.appendChild(card);
  });
  updateTowerCardSelection();
}

function updateTowerCardSelection() {
  const cards = towerBarEl.querySelectorAll(".tower-card");
  cards.forEach(c => {
    c.classList.toggle("selected", c.dataset.id === selectedTowerTypeId);
  });
}

// Input
canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const { col, row } = worldToGrid(x, y);
  hover.x = x;
  hover.y = y;
  hover.col = col;
  hover.row = row;
  hover.has = col >= 0 && row >= 0 && col < GRID_COLS && row < GRID_ROWS;
});

canvas.addEventListener("click", e => {
  if (gameState.gameOver || gameState.gameWon) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const { col, row } = worldToGrid(x, y);
  if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) return;
  const existing = getTowerAt(col, row);
  if (existing) {
    selectedTower = existing;
    syncSelectedTowerUI();
    message(`Selected ${existing.base.name}.`);
    return;
  }
  if (isPathTile(col, row)) {
    message("You can't build on the path.");
    return;
  }
  const ttId = selectedTowerTypeId;
  const tt = towerTypes[ttId];
  if (!tt) return;
  if (gameState.money < tt.baseCost) {
    message("Not enough money to build that tower.");
    return;
  }
  if (towers.some(t => t.col === col && t.row === row)) {
    message("There's already a tower here.");
    return;
  }
  gameState.money -= tt.baseCost;
  const t = createTower(ttId, col, row);
  selectedTower = t;
  syncSelectedTowerUI();
  message(`${tt.name} placed.`);
});

btnStartWave.addEventListener("click", () => {
  startNextWave();
});

btnPause.addEventListener("click", () => {
  gameState.paused = !gameState.paused;
  syncUI();
});

btnSpeedDown.addEventListener("click", () => {
  gameState.speed = Math.max(0.5, gameState.speed - 0.5);
  syncUI();
});
btnSpeedUp.addEventListener("click", () => {
  gameState.speed = Math.max(0.5, Math.min(3, gameState.speed + 0.5));
  syncUI();
});

btnUpgradeA.addEventListener("click", () => {
  if (!selectedTower) return;
  applyUpgrade(selectedTower, "A");
});
btnUpgradeB.addEventListener("click", () => {
  if (!selectedTower) return;
  applyUpgrade(selectedTower, "B");
});

btnSell.addEventListener("click", () => {
  if (!selectedTower) return;
  const refund = Math.floor(selectedTower.totalInvested * 0.7);
  gameState.money += refund;
  towers = towers.filter(t => t.id !== selectedTower.id);
  message(`Tower sold for $${refund}.`);
  selectedTower = null;
  syncSelectedTowerUI();
});

btnFreeze.addEventListener("click", () => {
  if (gameState.freezeUsed || gameState.gameOver || gameState.gameWon) return;
  gameState.freezeTimer = 4.0;
  gameState.freezeUsed = true;
  syncAbilityButtons();
  message("Freeze activated! All enemies slowed briefly.");
});

btnStorm.addEventListener("click", () => {
  if (gameState.stormUsed || gameState.gameOver || gameState.gameWon) return;
  for (let e of enemies) {
    if (!e.alive) continue;
    e.hp -= 40 + gameState.wave * 4;
    e.hitFlash = 1;
    if (e.hp <= 0) {
      e.alive = false;
      gameState.money += e.reward;
      gameState.score += e.reward * 2;
      addXP(5 + gameState.wave);
    }
  }
  gameState.stormUsed = true;
  syncAbilityButtons();
  message("Storm activated! Lightning strikes all enemies.");
});

// Main loop
let lastTime = performance.now();
function loop(timestamp) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  update(dt);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawTowerRangePreview();
  drawTowers();
  drawEnemies();
  drawBullets();
  drawOverlay();
  requestAnimationFrame(loop);
}

// Init
async function init() {
  createTowerBar();
  gameState.money = 300;
  gameState.lives = 20;
  gameState.wave = 0;
  gameState.score = 0;
  gameState.xp = 0;
  gameState.level = 1;
  message("Loading sprites...");
  syncUI();
  syncSelectedTowerUI();
  syncAbilityButtons();
  try {
    await loadSprites();
    loadingOverlay.style.display = "none";
    message("Welcome to NEON PATH TD. Build a few towers, then start Wave 1.");
  } catch (err) {
    console.error("Sprite loading failed", err);
    message("Failed to load sprites (check console). Shapes will be used.");
    loadingOverlay.style.display = "none";
  }
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

init();
