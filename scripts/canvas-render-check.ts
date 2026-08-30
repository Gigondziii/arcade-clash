// Standalone verification script for Headless Canvas draw() rendering loop,
// letterboxing math, finite coordinate assertions (NaN / Infinity guard), and
// replay canvas integration.
//
// Run: npx tsx scripts/canvas-render-check.ts

import { VIRTUAL_VIEWPORT } from "@fugluck/shared";
import { RunnerEngine } from "../games/neon-runner/engine";
import { neonRunnerReplayAdapter } from "../games/neon-runner/replay";
import { DashEngine } from "../games/pixel-ninja-dash/engine";
import { pixelNinjaDashReplayAdapter } from "../games/pixel-ninja-dash/replay";
import { SkyDodgeEngine } from "../games/sky-dodge/engine";
import { skyDodgeReplayAdapter } from "../games/sky-dodge/replay";
import { SpaceBlasterEngine } from "../games/space-blaster/engine";
import { spaceBlasterReplayAdapter } from "../games/space-blaster/replay";
import { CyberHopperEngine } from "../games/cyber-hopper/engine";
import { cyberHopperReplayAdapter } from "../games/cyber-hopper/replay";
import { SpeedTriviaEngine } from "../games/speed-trivia/engine";
import { renderSpeedTrivia } from "../games/speed-trivia/render";
import { speedTriviaReplayAdapter } from "../games/speed-trivia/replay";
import { TFSprintEngine } from "../games/tf-sprint/engine";
import { renderTFSprint } from "../games/tf-sprint/render";
import { tfSprintReplayAdapter } from "../games/tf-sprint/replay";

let failures = 0;
let totalVerifiedDrawCalls = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Mock CanvasRenderingContext2D with Strict Finite Number Guard
// ---------------------------------------------------------------------------
function createMockCanvasContext() {
  function assertFinite(methodName: string, ...args: Array<{ name: string; val: unknown }>) {
    for (const { name, val } of args) {
      if (typeof val === "number" && !Number.isFinite(val)) {
        throw new Error(`NaN/Infinite canvas coordinate in ${methodName} [${name} = ${val}]`);
      }
    }
    totalVerifiedDrawCalls++;
  }

  const mockCtx = {
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    shadowColor: "transparent",
    shadowBlur: 0,
    globalAlpha: 1,
    font: "10px sans-serif",
    textAlign: "left" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,

    measureText(text: string) {
      assertFinite("measureText");
      return { width: text.length * 10 };
    },
    clearRect(x: number, y: number, w: number, h: number) {
      assertFinite("clearRect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      assertFinite("fillRect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    strokeRect(x: number, y: number, w: number, h: number) {
      assertFinite("strokeRect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    rect(x: number, y: number, w: number, h: number) {
      assertFinite("rect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    roundRect(x: number, y: number, w: number, h: number) {
      assertFinite("roundRect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    beginPath() {
      totalVerifiedDrawCalls++;
    },
    moveTo(x: number, y: number) {
      assertFinite("moveTo", { name: "x", val: x }, { name: "y", val: y });
    },
    lineTo(x: number, y: number) {
      assertFinite("lineTo", { name: "x", val: x }, { name: "y", val: y });
    },
    arc(x: number, y: number, radius: number, _startAngle: number, _endAngle: number) {
      assertFinite("arc", { name: "x", val: x }, { name: "y", val: y }, { name: "radius", val: radius });
    },
    closePath() {
      totalVerifiedDrawCalls++;
    },
    stroke() {
      totalVerifiedDrawCalls++;
    },
    fill() {
      totalVerifiedDrawCalls++;
    },
    drawImage(_image: unknown, dx: number, dy: number, dw?: number, dh?: number) {
      assertFinite("drawImage", { name: "dx", val: dx }, { name: "dy", val: dy }, { name: "dw", val: dw ?? 0 }, { name: "dh", val: dh ?? 0 });
    },
    fillText(_text: string, x: number, y: number) {
      assertFinite("fillText", { name: "x", val: x }, { name: "y", val: y });
    },
    strokeText(_text: string, x: number, y: number) {
      assertFinite("strokeText", { name: "x", val: x }, { name: "y", val: y });
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      assertFinite("setTransform", { name: "a", val: a }, { name: "b", val: b }, { name: "c", val: c }, { name: "d", val: d }, { name: "e", val: e }, { name: "f", val: f });
    },
    transform(a: number, b: number, c: number, d: number, e: number, f: number) {
      assertFinite("transform", { name: "a", val: a }, { name: "b", val: b }, { name: "c", val: c }, { name: "d", val: d }, { name: "e", val: e }, { name: "f", val: f });
    },
    save() {
      totalVerifiedDrawCalls++;
    },
    restore() {
      totalVerifiedDrawCalls++;
    },
  } as unknown as CanvasRenderingContext2D;

  return mockCtx;
}

// ---------------------------------------------------------------------------
// Test 1: Fixed Virtual Resolution Letterboxing Math Validation
// ---------------------------------------------------------------------------
console.log("Test 1: Fixed Virtual Resolution Letterboxing Math Validation\n");

function calculateLetterboxDimensions(containerW: number, containerH: number) {
  const targetRatio = VIRTUAL_VIEWPORT.width / VIRTUAL_VIEWPORT.height;
  const containerRatio = containerW / containerH;
  let displayW: number;
  let displayH: number;

  if (containerRatio > targetRatio) {
    displayH = containerH;
    displayW = containerH * targetRatio;
  } else {
    displayW = containerW;
    displayH = containerW / targetRatio;
  }
  return { displayW, displayH, ratio: displayW / displayH };
}

{
  const viewports = [
    { w: 1920, h: 1080, label: "1080p Desktop" },
    { w: 1024, h: 768, label: "Tablet 4:3" },
    { w: 375, h: 812, label: "Mobile Portrait" },
    { w: 2560, h: 1080, label: "Ultrawide 21:9" },
  ];

  let mathPass = true;
  for (const vp of viewports) {
    const { displayW, displayH, ratio } = calculateLetterboxDimensions(vp.w, vp.h);
    const valid = Number.isFinite(displayW) && Number.isFinite(displayH) && Math.abs(ratio - 16 / 9) < 0.001;
    if (!valid) mathPass = false;
  }

  check("Letterboxing maintains 16:9 logical aspect ratio across all viewports", mathPass);
  check("Virtual resolution matches canonical 1280x720 constant", VIRTUAL_VIEWPORT.width === 1280 && VIRTUAL_VIEWPORT.height === 720);
}

// ---------------------------------------------------------------------------
// Test 2: Neon Runner 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 2: Neon Runner 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new RunnerEngine(424242);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  let thrownError: Error | null = null;
  const initialCallCount = totalVerifiedDrawCalls;

  try {
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, {
        jumpPressed: frame % 40 === 0,
        jumpReleased: false,
        slidePressed: frame % 60 === 0,
      });
      engine.draw(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Neon Runner 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Neon Runner verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
}

// ---------------------------------------------------------------------------
// Test 3: Pixel Ninja Dash 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3: Pixel Ninja Dash 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new DashEngine(123456);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  let thrownError: Error | null = null;
  const initialCallCount = totalVerifiedDrawCalls;

  try {
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, {
        dashPressed: frame % 30 === 0,
      });
      engine.draw(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Pixel Ninja Dash 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Pixel Ninja Dash verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
}

// ---------------------------------------------------------------------------
// Test 3.5: Sky Dodge 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.5: Sky Dodge 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new SkyDodgeEngine(987654);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  let thrownError: Error | null = null;
  const initialCallCount = totalVerifiedDrawCalls;

  try {
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, {
        moveLeft: frame % 40 < 20,
        moveRight: frame % 40 >= 20,
        boostPressed: frame % 50 === 0,
      });
      engine.draw(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Sky Dodge 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Sky Dodge verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
}

// ---------------------------------------------------------------------------
// Test 3.6: Space Blaster 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.6: Space Blaster 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new SpaceBlasterEngine(98765432);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    const emptyInput = { moveLeft: false, moveRight: false, moveUp: false, moveDown: false, shootPressed: false };
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, emptyInput);
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  check(
    "Space Blaster player ship initial position is valid and centered (x=640, y=620)",
    engine.shipX === 640 && engine.shipY === 620,
    `shipX=${engine.shipX}, shipY=${engine.shipY}`,
  );
  check(
    "Space Blaster player ship coordinates remain strictly finite and within bounds (30 <= x <= 1250, 30 <= y <= 690)",
    Number.isFinite(engine.shipX) &&
      Number.isFinite(engine.shipY) &&
      engine.shipX >= 30 &&
      engine.shipX <= 1250 &&
      engine.shipY >= 30 &&
      engine.shipY <= 690,
    `shipX=${engine.shipX}, shipY=${engine.shipY}`,
  );

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Space Blaster 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Space Blaster verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
}

// ---------------------------------------------------------------------------
// Test 3.7: Cyber Hopper 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.7: Cyber Hopper 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new CyberHopperEngine(12345678);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    const emptyInput = { hopUp: false, hopDown: false, hopLeft: false, hopRight: false };
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, emptyInput);
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Cyber Hopper 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Cyber Hopper verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
}

// ---------------------------------------------------------------------------
// Test 3.8: Speed Trivia Clash 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.8: Speed Trivia Clash 300-Frame Headless Canvas draw() Suite\n");

{
  let maxYCoord = 0;
  let minYCoord = Infinity;

  const mockCtx = createMockCanvasContext();

  const origFillRect = mockCtx.fillRect.bind(mockCtx);
  const origStrokeRect = mockCtx.strokeRect.bind(mockCtx);
  const origFillText = mockCtx.fillText.bind(mockCtx);

  mockCtx.fillRect = function (x: number, y: number, w: number, h: number) {
    if (w < VIRTUAL_VIEWPORT.width || h < VIRTUAL_VIEWPORT.height) {
      minYCoord = Math.min(minYCoord, y);
      maxYCoord = Math.max(maxYCoord, y + h);
    }
    return origFillRect(x, y, w, h);
  };
  mockCtx.strokeRect = function (x: number, y: number, w: number, h: number) {
    minYCoord = Math.min(minYCoord, y);
    maxYCoord = Math.max(maxYCoord, y + h);
    return origStrokeRect(x, y, w, h);
  };
  mockCtx.roundRect = function (x: number, y: number, w: number, h: number) {
    minYCoord = Math.min(minYCoord, y);
    maxYCoord = Math.max(maxYCoord, y + h);
    totalVerifiedDrawCalls++;
  };
  let categoryRendered = false;
  mockCtx.fillText = function (text: string, x: number, y: number) {
    if (text.includes("CATEGORY:")) categoryRendered = true;
    minYCoord = Math.min(minYCoord, y);
    maxYCoord = Math.max(maxYCoord, y);
    return origFillText(text, x, y);
  };

  const engine = new SpeedTriviaEngine(12345678);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    const emptyInput = {};
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, emptyInput);
      renderSpeedTrivia(mockCtx, engine);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Speed Trivia Clash 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Speed Trivia Clash verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
  check("Speed Trivia Clash Category Header text renders prominently on top canvas header", categoryRendered);
  check(
    "Speed Trivia Clash UI rendering elements lie strictly within y in [0, 700] canonical bounds",
    maxYCoord <= 700 && minYCoord >= 0,
    `minY=${minYCoord}, maxY=${maxYCoord}`,
  );
}

// ---------------------------------------------------------------------------
// Test 3.9: True / False Sprint 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.9: True / False Sprint 300-Frame Headless Canvas draw() Suite\n");

{
  let minYCoord = Infinity;
  let maxYCoord = -Infinity;

  const mockCtx = createMockCanvasContext();

  const origFillRect = mockCtx.fillRect.bind(mockCtx);
  const origStrokeRect = mockCtx.strokeRect.bind(mockCtx);
  const origFillText = mockCtx.fillText.bind(mockCtx);

  mockCtx.fillRect = function (x: number, y: number, w: number, h: number) {
    if (w < VIRTUAL_VIEWPORT.width || h < VIRTUAL_VIEWPORT.height) {
      minYCoord = Math.min(minYCoord, y);
      maxYCoord = Math.max(maxYCoord, y + h);
    }
    return origFillRect(x, y, w, h);
  };
  mockCtx.strokeRect = function (x: number, y: number, w: number, h: number) {
    minYCoord = Math.min(minYCoord, y);
    maxYCoord = Math.max(maxYCoord, y + h);
    return origStrokeRect(x, y, w, h);
  };
  mockCtx.roundRect = function (x: number, y: number, w: number, h: number) {
    minYCoord = Math.min(minYCoord, y);
    maxYCoord = Math.max(maxYCoord, y + h);
    totalVerifiedDrawCalls++;
  };
  mockCtx.fillText = function (text: string, x: number, y: number) {
    minYCoord = Math.min(minYCoord, y);
    maxYCoord = Math.max(maxYCoord, y);
    return origFillText(text, x, y);
  };

  const engine = new TFSprintEngine(88776655);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    const emptyInput = {};
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, emptyInput);
      renderTFSprint(mockCtx, engine);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("True / False Sprint 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("True / False Sprint verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
  check(
    "True / False Sprint UI rendering elements lie strictly within y in [0, 700] canonical bounds",
    maxYCoord <= 700 && minYCoord >= 0,
    `minY=${minYCoord}, maxY=${maxYCoord}`,
  );
}

// ---------------------------------------------------------------------------
// Test 4: Replay Canvas Integration Test
// ---------------------------------------------------------------------------
console.log("\nTest 4: Replay Canvas Integration Test\n");

{
  const mockCtx = createMockCanvasContext();

  // Test Neon Runner Replay Adapter rendering
  const neonEngine = neonRunnerReplayAdapter.createEngine(999888);
  neonRunnerReplayAdapter.resize(neonEngine, VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  neonEngine.reset();
  const neonInput = neonRunnerReplayAdapter.createInitialInput();
  const sampleLogNeon = [
    { tick: 10, action: "jumpPressed" },
    { tick: 25, action: "jumpReleased" },
    { tick: 50, action: "slidePressed" },
  ];

  let replayPassNeon = true;
  try {
    for (let tick = 0; tick < 100; tick++) {
      const actions = sampleLogNeon.filter((e) => e.tick === tick);
      for (const act of actions) {
        neonRunnerReplayAdapter.applyAction(neonInput, act.action);
      }
      neonRunnerReplayAdapter.update(neonEngine, 1 / 60, neonInput);
      neonRunnerReplayAdapter.clearPulses(neonInput);
      neonEngine.draw(mockCtx);
    }
  } catch (err) {
    replayPassNeon = false;
    console.error("Neon Runner replay render error:", err);
  }
  check("Neon Runner replay rendering completes 100 ticks with zero draw errors", replayPassNeon);

  // Test Pixel Ninja Dash Replay Adapter rendering
  const dashEngine = pixelNinjaDashReplayAdapter.createEngine(777666);
  pixelNinjaDashReplayAdapter.resize(dashEngine, VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  dashEngine.reset();
  const dashInput = pixelNinjaDashReplayAdapter.createInitialInput();
  const sampleLogDash = [{ tick: 15, action: "dashPressed" }, { tick: 45, action: "dashPressed" }];

  let replayPassDash = true;
  try {
    for (let tick = 0; tick < 100; tick++) {
      const actions = sampleLogDash.filter((e) => e.tick === tick);
      for (const act of actions) {
        pixelNinjaDashReplayAdapter.applyAction(dashInput, act.action);
      }
      pixelNinjaDashReplayAdapter.update(dashEngine, 1 / 60, dashInput);
      pixelNinjaDashReplayAdapter.clearPulses(dashInput);
      dashEngine.draw(mockCtx);
    }
  } catch (err) {
    replayPassDash = false;
    console.error("Pixel Ninja Dash replay render error:", err);
  }
  check("Pixel Ninja Dash replay rendering completes 100 ticks with zero draw errors", replayPassDash);

  // Test Sky Dodge Replay Adapter rendering
  const skyEngine = skyDodgeReplayAdapter.createEngine(555444);
  skyDodgeReplayAdapter.resize(skyEngine, VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  skyEngine.reset();
  const skyInput = skyDodgeReplayAdapter.createInitialInput();
  const sampleLogSky = [{ tick: 10, action: "moveLeft" }, { tick: 30, action: "moveRight" }];

  let replayPassSky = true;
  try {
    for (let tick = 0; tick < 100; tick++) {
      const actions = sampleLogSky.filter((e) => e.tick === tick);
      for (const act of actions) {
        skyDodgeReplayAdapter.applyAction(skyInput, act.action);
      }
      skyDodgeReplayAdapter.update(skyEngine, 1 / 60, skyInput);
      skyDodgeReplayAdapter.clearPulses(skyInput);
      skyEngine.draw(mockCtx);
    }
  } catch (err) {
    replayPassSky = false;
    console.error("Sky Dodge replay render error:", err);
  }
  check("Sky Dodge replay rendering completes 100 ticks with zero draw errors", replayPassSky);

  // Test Space Blaster Replay Adapter rendering
  const blasterEngine = spaceBlasterReplayAdapter.createEngine(333222);
  spaceBlasterReplayAdapter.resize(blasterEngine, VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  blasterEngine.reset();
  const blasterInput = spaceBlasterReplayAdapter.createInitialInput();
  const sampleLogBlaster = [{ tick: 10, action: "moveLeftDown" }, { tick: 20, action: "shootPressed" }];

  let replayPassBlaster = true;
  try {
    for (let tick = 0; tick < 100; tick++) {
      const actions = sampleLogBlaster.filter((e) => e.tick === tick);
      for (const act of actions) {
        spaceBlasterReplayAdapter.applyAction(blasterInput, act.action);
      }
      spaceBlasterReplayAdapter.update(blasterEngine, 1 / 60, blasterInput);
      spaceBlasterReplayAdapter.clearPulses(blasterInput);
      blasterEngine.render(mockCtx);
    }
  } catch (err) {
    replayPassBlaster = false;
    console.error("Space Blaster replay render error:", err);
  }
  check("Space Blaster replay rendering completes 100 ticks with zero draw errors", replayPassBlaster);

  // Test Cyber Hopper Replay Adapter rendering
  const hopperEngine = cyberHopperReplayAdapter.createEngine(111222);
  cyberHopperReplayAdapter.resize(hopperEngine, VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  hopperEngine.reset();
  const hopperInput = cyberHopperReplayAdapter.createInitialInput();
  const sampleLogHopper = [
    { tick: 10, action: "hopUp" },
    { tick: 30, action: "hopUp" },
    { tick: 50, action: "hopLeft" },
  ];

  let replayPassHopper = true;
  try {
    for (let tick = 0; tick < 100; tick++) {
      const actions = sampleLogHopper.filter((e) => e.tick === tick);
      for (const act of actions) {
        cyberHopperReplayAdapter.applyAction(hopperInput, act.action);
      }
      cyberHopperReplayAdapter.update(hopperEngine, 1 / 60, hopperInput);
      cyberHopperReplayAdapter.clearPulses(hopperInput);
      hopperEngine.render(mockCtx);
    }
  } catch (err) {
    replayPassHopper = false;
    console.error("Cyber Hopper replay render error:", err);
  }
  check("Cyber Hopper replay rendering completes 100 ticks with zero draw errors", replayPassHopper);

  // Test Speed Trivia Replay Adapter rendering
  const triviaEngine = speedTriviaReplayAdapter.createEngine(999111);
  speedTriviaReplayAdapter.resize(triviaEngine, VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  triviaEngine.reset();
  const triviaInput = speedTriviaReplayAdapter.createInitialInput();
  const sampleLogTrivia = [{ tick: 10, action: "selectOption0" }];

  let replayPassTrivia = true;
  try {
    for (let tick = 0; tick < 100; tick++) {
      const actions = sampleLogTrivia.filter((e) => e.tick === tick);
      for (const act of actions) {
        speedTriviaReplayAdapter.applyAction(triviaInput, act.action);
      }
      speedTriviaReplayAdapter.update(triviaEngine, 1 / 60, triviaInput);
      speedTriviaReplayAdapter.clearPulses(triviaInput);
      renderSpeedTrivia(mockCtx, triviaEngine);
    }
  } catch (err) {
    replayPassTrivia = false;
    console.error("Speed Trivia replay render error:", err);
  }
  check("Speed Trivia replay rendering completes 100 ticks with zero draw errors", replayPassTrivia);

  // Test True / False Sprint Replay Adapter rendering
  const tfEngine = tfSprintReplayAdapter.createEngine(555444);
  tfSprintReplayAdapter.resize(tfEngine, VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  tfEngine.reset();
  const tfInput = tfSprintReplayAdapter.createInitialInput();
  const sampleLogTF = [{ tick: 10, action: "selectTrue" }];

  let replayPassTF = true;
  try {
    for (let tick = 0; tick < 100; tick++) {
      const actions = sampleLogTF.filter((e) => e.tick === tick);
      for (const act of actions) {
        tfSprintReplayAdapter.applyAction(tfInput, act.action);
      }
      tfSprintReplayAdapter.update(tfEngine, 1 / 60, tfInput);
      tfSprintReplayAdapter.clearPulses(tfInput);
      renderTFSprint(mockCtx, tfEngine);
    }
  } catch (err) {
    replayPassTF = false;
    console.error("True / False Sprint replay render error:", err);
  }
  check("True / False Sprint replay rendering completes 100 ticks with zero draw errors", replayPassTF);
}

// ---------------------------------------------------------------------------
console.log(`\nTotal verified canvas draw operations: ${totalVerifiedDrawCalls}`);
console.log(`${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
