// Trace — Visual Recursion Debugger
// 
// Built this because I was print-debugging fib(8) 
// for like the 100th time and realized I'm drawing
// trees in my head. Why not let the computer do it?
//
// Still very rough. CSS is a mess. Need help there.

let steps = [];
let currentStep = 0;
let isPlaying = false;
let playInterval = null;
let speed = 600; // ms between steps, tweak this later
let treeNodes = {};
let treeRoot = null;
let seenNodes = new Set(); // tracks which nodes we've animated in

// grabbed these from DOM, kept it simple
const runBtn = document.getElementById('runBtn');
const playBtn = document.getElementById('playBtn');
const stepBackBtn = document.getElementById('stepBackBtn');
const stepForwardBtn = document.getElementById('stepForwardBtn');
const resetBtn = document.getElementById('resetBtn');
const algoSelect = document.getElementById('algoSelect');
const paramInput = document.getElementById('paramInput');
const statCalls = document.getElementById('statCalls');
const statDepth = document.getElementById('statDepth');
const statResult = document.getElementById('statResult');
const treeSvg = document.getElementById('treeSvg');
const treeGroup = document.getElementById('treeGroup');
const emptyState = document.getElementById('emptyState');
const callStackList = document.getElementById('callStackList');

// TRACE GENERATION

// this runs the actual algorithm but records every single call/return
// so we can replay it later. bit hacky but works.

function generateTrace(algo, n) {
  steps = [];
  treeNodes = {};
  seenNodes = new Set();
  let callId = 0; // unique id for each call, used to link parent-child
  
  if (algo === 'fib') {
    // plain recursive fib — explodes exponentially, good for viz
    function fib(k, depth) {
      const myId = callId++;
      // parent is whoever called last. works because recursion is synchronous
      const parentId = steps.length > 0 ? steps[steps.length - 1].callId : null;
      
      steps.push({
        type: 'call',
        callId: myId,
        parentId: parentId,
        value: k,
        depth: depth,
        result: null
      });
      
      // base case
      if (k <= 1) {
        steps.push({
          type: 'return',
          callId: myId,
          value: k,
          depth: depth,
          result: k
        });
        return k;
      }
      
      // recursive case — left then right, always
      const left = fib(k - 1, depth + 1);
      const right = fib(k - 2, depth + 1);
      const result = left + right;
      
      steps.push({
        type: 'return',
        callId: myId,
        value: k,
        depth: depth,
        result: result
      });
      
      return result;
    }
    
    fib(n, 0);
  }
  
  else if (algo === 'fibMemo') {
    // memoized version — way fewer calls, good for comparison
    const memo = {}; // local memo, resets each run
    
    function fibMemo(k, depth) {
      const myId = callId++;
      const parentId = steps.length > 0 ? steps[steps.length - 1].callId : null;
      
      // check memo first
      if (memo[k] !== undefined) {
        steps.push({
          type: 'memo',
          callId: myId,
          parentId: parentId,
          value: k,
          depth: depth,
          result: memo[k]
        });
        return memo[k];
      }
      
      steps.push({
        type: 'call',
        callId: myId,
        parentId: parentId,
        value: k,
        depth: depth,
        result: null
      });
      
      if (k <= 1) {
        memo[k] = k;
        steps.push({
          type: 'return',
          callId: myId,
          value: k,
          depth: depth,
          result: k
        });
        return k;
      }
      
      const left = fibMemo(k - 1, depth + 1);
      const right = fibMemo(k - 2, depth + 1);
      const result = left + right;
      memo[k] = result;
      
      steps.push({
        type: 'return',
        callId: myId,
        value: k,
        depth: depth,
        result: result
      });
      
      return result;
    }
    
    fibMemo(n, 0);
  }
  
  // reset to start
  currentStep = 0;
  buildTree();
  renderTree();
  updateDisplay();
  
  console.log(`Generated ${steps.length} steps for ${algo}(n=${n})`);
}

// ============================================
// TREE LAYOUT — top down, no overlap
// ============================================

// builds the tree structure from steps, then positions everything
// using post-order traversal. took me a while to get the x-pos right.

function buildTree() {
  const nodes = {};
  
  // first pass: create all nodes from 'call' steps
  for (const step of steps) {
    if (step.type === 'call') {
      nodes[step.callId] = {
        callId: step.callId,
        value: step.value,
        depth: step.depth,
        parentId: step.parentId,
        children: [],
        result: null,
        x: 0,
        y: 0
      };
    }
    // attach results from return/memo steps
    if ((step.type === 'return' || step.type === 'memo') && nodes[step.callId]) {
      nodes[step.callId].result = step.result;
    }
  }
  
  // link parents to children
  treeRoot = null;
  for (const id in nodes) {
    const node = nodes[id];
    if (node.parentId !== null && nodes[node.parentId]) {
      nodes[node.parentId].children.push(node);
    } else {
      treeRoot = node;
    }
  }
  
  // layout: post-order to get x positions, fixed y per depth
  // H_SPACING controls horizontal gap, V_SPACING vertical
  let leafIndex = 0;
  const H_SPACING = 90;
  const V_SPACING = 85;
  
  function layout(node) {
    if (node.children.length === 0) {
      // leaf: assign sequential x
      node.x = leafIndex++ * H_SPACING;
      node.y = node.depth * V_SPACING;
    } else {
      // internal: x is average of children, y is depth * spacing
      for (const child of node.children) {
        layout(child);
      }
      const firstX = node.children[0].x;
      const lastX = node.children[node.children.length - 1].x;
      node.x = (firstX + lastX) / 2;
      node.y = node.depth * V_SPACING;
    }
  }
  
  if (treeRoot) {
    layout(treeRoot);
    // center root at x=0 so tree is centered on screen
    const offset = treeRoot.x;
    function shift(node) {
      node.x -= offset;
      for (const child of node.children) shift(child);
    }
    shift(treeRoot);
  }
  
  treeNodes = nodes;
}

// RENDER — SVG tree with rough filter

// draws the tree as SVG. circles for nodes, lines for edges.
// using SVG filter to get that hand-drawn wobbly look.
// tried canvas first but SVG is easier for this.

function renderTree() {
  treeGroup.innerHTML = ''; // clear previous
  if (!treeRoot) return;
  
  const R = 28; // node radius, feels right
  
  // draw edges first so they appear behind nodes
  function drawEdges(node) {
    for (const child of node.children) {
      // straight line from bottom of parent to top of child
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${node.x},${node.y + R} L ${child.x},${child.y - R}`);
      path.setAttribute('class', 'tree-edge');
      path.setAttribute('data-parent', node.callId);
      path.setAttribute('data-child', child.callId);
      treeGroup.appendChild(path);
      drawEdges(child);
    }
  }
  drawEdges(treeRoot);
  
  // draw nodes
  function drawNodes(node) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'tree-node');
    g.setAttribute('data-callid', node.callId);
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    
    // circle with rough filter
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', R);
    circle.setAttribute('class', 'tree-circle');
    g.appendChild(circle);
    
    // label inside: fib(n)
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'tree-label');
    label.setAttribute('y', '1'); // slight offset for visual center
    label.textContent = `fib(${node.value})`;
    g.appendChild(label);
    
    // result label below, hidden until return
    if (node.result !== null) {
      const res = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      res.setAttribute('class', 'tree-result');
      res.setAttribute('y', R + 18);
      res.textContent = `= ${node.result}`;
      g.appendChild(res);
    }
    
    treeGroup.appendChild(g);
    for (const child of node.children) drawNodes(child);
  }
  drawNodes(treeRoot);
  
  // center the whole tree in the SVG view
  centerView();
}

function centerView() {
  if (!treeRoot) return;
  const rect = treeSvg.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = 80; // start a bit down from top
  treeGroup.setAttribute('transform', `translate(${cx}, ${cy})`);
}

// DISPLAY UPDATE — called every step change
// iska kya kru pata nahi

function updateDisplay() {
  updateStats();
  updateTreeVisuals();
  updateStack();
}

function updateStats() {
  if (!steps.length) return;
  
  let totalCalls = 0;
  let maxDepth = 0;
  
  for (let i = 0; i <= currentStep; i++) {
    if (steps[i].type === 'call') totalCalls++;
    if (steps[i].depth > maxDepth) maxDepth = steps[i].depth;
  }
  
  statCalls.textContent = totalCalls;
  statDepth.textContent = maxDepth + 1;
  statResult.textContent = currentStep === steps.length - 1 ? steps[currentStep].result : '—';
}

function updateTreeVisuals() {
  if (!steps.length) return;
  const step = steps[currentStep];
  
  // clear all previous state classes
  document.querySelectorAll('.tree-node').forEach(el => {
    el.classList.remove('call', 'return', 'memo', 'active', 'entering');
  });
  document.querySelectorAll('.tree-edge').forEach(el => {
    el.classList.remove('active');
  });
  
  // highlight current node
  const nodeEl = document.querySelector(`.tree-node[data-callid="${step.callId}"]`);
  if (nodeEl) {
    // animate entrance on first call
    if (step.type === 'call' && !seenNodes.has(step.callId)) {
      seenNodes.add(step.callId);
      nodeEl.classList.add('entering');
    }
    
    nodeEl.classList.add(step.type, 'active');
  }
  
  // highlight edge from parent
  if (step.parentId !== null) {
    const edge = document.querySelector(`.tree-edge[data-parent="${step.parentId}"][data-child="${step.callId}"]`);
    if (edge) edge.classList.add('active');
  }
}

function updateStack() {
  callStackList.innerHTML = '';
  
  // rebuild stack from steps up to current
  const stack = [];
  for (let i = 0; i <= currentStep; i++) {
    const s = steps[i];
    if (s.type === 'call') {
      stack.push({callId: s.callId, value: s.value, depth: s.depth});
    } else if (s.type === 'return' || s.type === 'memo') {
      const idx = stack.findIndex(x => x.callId === s.callId);
      if (idx !== -1) stack.splice(idx, 1);
    }
  }
  
  if (!stack.length) {
    callStackList.innerHTML = '<div class="stack-item" style="opacity:0.3">Empty</div>';
    return;
  }
  
  // render reversed (deepest on top)
  for (const item of stack.slice().reverse()) {
    const div = document.createElement('div');
    div.className = 'stack-item';
    if (item.callId === steps[currentStep].callId) div.classList.add('active');
    // indent based on depth, cap at 5 so it doesn't go crazy
    const indent = '  '.repeat(Math.min(item.depth, 5));
    div.textContent = indent + `fib(${item.value})`;
    callStackList.appendChild(div);
  }
}

// PLAYBACK CONTROLS

function stepForward() {
  if (currentStep < steps.length - 1) {
    currentStep++;
    updateDisplay();
  }
}

function stepBack() {
  if (currentStep > 0) {
    currentStep--;
    updateDisplay();
  }
}

function togglePlay() {
  if (isPlaying) {
    clearInterval(playInterval);
    isPlaying = false;
    playBtn.textContent = '▶';
  } else {
    isPlaying = true;
    playBtn.textContent = '⏸';
    playInterval = setInterval(() => {
      if (currentStep >= steps.length - 1) {
        togglePlay();
        return;
      }
      stepForward();
    }, speed);
  }
}

function reset() {
  clearInterval(playInterval);
  isPlaying = false;
  playBtn.textContent = '▶';
  currentStep = 0;
  seenNodes.clear();
  updateDisplay();
}

// speed slider — maps 1-10 to ~2000ms down to ~200ms
document.getElementById('speedSlider').addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  speed = 2200 - val * 200;
  if (isPlaying) {
    clearInterval(playInterval);
    playInterval = setInterval(() => {
      if (currentStep >= steps.length - 1) { togglePlay(); return; }
      stepForward();
    }, speed);
  }
});

// EVENT HANDLERS

runBtn.addEventListener('click', () => {
  const algo = algoSelect.value;
  const n = parseInt(paramInput.value);
  
  emptyState.style.display = 'none';
  treeSvg.classList.add('active');
  
  // update code display based on selection
  const codeBlock = document.getElementById('codeBlock');
  if (algo === 'fib') {
    codeBlock.textContent = `def fib(n):
  if n <= 1:
    return n
  return fib(n-1) + fib(n-2)`;
  } else {
    codeBlock.textContent = `def fib(n, memo={}):
  if n in memo:
    return memo[n]
  if n <= 1:
    return n
  memo[n] = fib(n-1) + fib(n-2)
  return memo[n]`;
  }
  
  generateTrace(algo, n);
});

playBtn.addEventListener('click', togglePlay);
stepForwardBtn.addEventListener('click', stepForward);
stepBackBtn.addEventListener('click', stepBack);
resetBtn.addEventListener('click', reset);

// recenter on resize
window.addEventListener('resize', () => {
  if (treeRoot) centerView();
});

console.log('Trace loaded. Click Run to start.');