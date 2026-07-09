# Trace

A real-time visual debugger for recursive algorithms. Paste code. Hit Run. Watch the call tree animate.

## What it does

- Takes recursive code and generates a step-by-step execution trace
- Visualizes the recursion tree with animated node states (call → active → return)
- Shows live call stack, call count, and max depth
- Supports memoization visualization (sparse tree vs. full tree)

## Current state

- ✅ Trace engine (Fibonacci recursive + memoized)
- ✅ SVG tree renderer with hand-drawn aesthetic
- ✅ Playback controls (play, pause, step, speed)
- ✅ Call stack panel
- 🚧 More algorithms (DFS, backtracking, segment trees)
- 🚧 Code parser (currently hardcoded algorithms)
- 🚧 Visual polish pass

## Tech stack

Vanilla JS + SVG. No frameworks. ~400 lines total.

## Why

I built this because I was print-debugging `fib(8)` for the hundredth time and realized I was drawing the tree in my head. Why not let the computer draw it?

## Demo

[Screen recording link or GIF here]