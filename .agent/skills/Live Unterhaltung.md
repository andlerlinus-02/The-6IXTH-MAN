---
name: "Live Unterhaltung"
description: "Applies the neon glassmorphism UI look, animated blobs, and a reactive 4-bar audio visualizer from 'The 6IXTH MAN'."
---

# Live Unterhaltung UI Skill

This skill captures the specific 'My Lil Homie' look and feel (from 'The 6IXTH MAN'). It provides a dark-mode, neon-accented, glassmorphic UI with animated background blobs and an animated 4-bar audio visualizer. 

## 1. Required Dependencies

Whenever applying this look and feel to a React project (specifically Vite + React), ensure the following packages are installed:

```bash
npm install framer-motion lucide-react
```

## 2. Global Styling (index.css)

Add the following CSS variables and base styles to `index.css` to create the deep dark background, glassmorphism panel effects, and animated background blobs.

```css
:root {
  --bg-deep: #050511;
  --bg-glass: rgba(255, 255, 255, 0.05);
  --bg-glass-heavy: rgba(10, 10, 20, 0.8);

  --accent-neon-pink: #f472b6;   /* Pink-400 */
  --accent-neon-blue: #38bdf8;   /* Sky-400 */
  --accent-neon-purple: #c084fc; /* Purple-400 */

  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.6);

  --blob-1: #ff0080;
  --blob-2: #7928ca;
  --blob-3: #0070f3;

  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color-scheme: dark;
  color: var(--text-primary);
  background-color: var(--bg-deep);
}

body {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  /* Include a background image url if necessary */
  background: var(--bg-deep);
}

#root {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Background Gradients/Blobs */
.ambient-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1; /* Above BG, below content */
  overflow: hidden;
  filter: blur(80px);
  opacity: 0.4;
  pointer-events: none;
}

.blob {
  position: absolute;
  border-radius: 50%;
  animation: float 20s infinite alternate;
}

.blob:nth-child(1) { top: -10%; right: -10%; width: 60vw; height: 60vw; background: var(--blob-1); animation-delay: -5s; }
.blob:nth-child(2) { bottom: -10%; left: -20%; width: 70vw; height: 70vw; background: var(--blob-2); animation-delay: 0s; }
.blob:nth-child(3) { top: 40%; left: 40%; width: 40vw; height: 40vw; background: var(--blob-3); animation-delay: -10s; }

@keyframes float {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20px, -20px) scale(1.1); }
  100% { transform: translate(-20px, 20px) scale(0.9); }
}

/* Layout */
.app-container {
  width: 100%;
  max-width: 480px;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Header */
.header {
  padding: 2rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}
.header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(to right, #fff, #ccc);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.status-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.status-badge.live { border-color: var(--accent-neon-pink); color: var(--accent-neon-pink); box-shadow: 0 0 10px rgba(244, 114, 182, 0.2); }

/* Glass Buttons */
.controls-area {
  padding: 3rem 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  z-index: 10;
}
.btn-control {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.btn-control:hover { transform: scale(1.1); background: rgba(255, 255, 255, 0.2); }
.btn-control:active { transform: scale(0.95); }
.btn-main { width: 80px; height: 80px; background: #3b82f6; }
.btn-danger { background: #ef4444; border-color: #ef4444; }
```

## 3. Audio Visualizer Component (`src/components/AudioVisualizer.jsx`)

Create the 4-bar visualizer using Framer Motion. This component reacts to `isActive` and `mode` ("listening", "speaking", "processing", "idle").

```jsx
import React from 'react';
import { motion } from 'framer-motion';

export default function AudioVisualizer({ isActive, mode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', height: '100px' }}>
            {[0, 1, 2, 3].map(i => (
                <VisualizerBar key={i} index={i} mode={mode} isActive={isActive} />
            ))}
        </div>
    );
}

const VisualizerBar = ({ index, mode, isActive }) => {
    let animate = {};
    let colors = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6']; // Blue -> Purple -> Pink

    if (!isActive || mode === 'idle') {
        animate = { height: 10, opacity: 0.3 };
    } else if (mode === 'listening') {
        animate = { height: [20, 40, 20], opacity: 0.8, transition: { duration: 1.5, repeat: Infinity, delay: index * 0.2, ease: "easeInOut" } };
    } else if (mode === 'speaking') {
        animate = { height: [30, 80, 40, 90, 30], opacity: 1, transition: { duration: 0.8, repeat: Infinity, repeatType: "reverse", delay: index * 0.1, ease: "easeInOut" } };
    } else if (mode === 'processing') {
        animate = { height: [15, 25, 15], opacity: 0.6, transition: { duration: 0.5, repeat: Infinity, delay: index * 0.1 } };
    }

    return (
        <motion.div
            style={{
                width: '16px',
                backgroundColor: colors[index],
                borderRadius: '8px',
                boxShadow: `0 0 15px ${colors[index]}80`
            }}
            initial={{ height: 10 }}
            animate={animate}
        />
    );
};
```

## 4. Scaffold Usage (App Container)

In the main application component, structure the app with the ambient background blobs, the header, visualizer area, and controls:

```jsx
import { Phone, Mic, MicOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AudioVisualizer from './AudioVisualizer';

export default function ChatInterface() {
    // Add necessary state here (isConnected, visualizerMode, etc.)
    return (
        <div className="app-container">
            <div className="ambient-bg">
                <div className="blob"></div>
                <div className="blob"></div>
                <div className="blob"></div>
            </div>
            
            <div className="header">
                <div className="status-badge live">LIVE</div>
                <h1>App Name</h1>
                <div className="user-name-badge">User</div>
            </div>

            <div className="visualizer-area" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AudioVisualizer isActive={true} mode="idle" />
            </div>

            <div className="controls-area">
                <motion.button className="btn-control btn-main"><Phone size={32} /></motion.button>
            </div>
        </div>
    );
}
```

## 5. Environment Variables (.env)

Always use a `.env` file to store variable parameters and secrets. Ensure `.env` is added to `.gitignore`. Provide a `.env.example` file for others. Example `.env` configuration:

```env
VITE_GOOGLE_API_KEY=your_api_key_here
VITE_GOOGLE_MODEL=gemini-2.0-flash-exp
VITE_GOOGLE_VOICE=Puck
```

In Vite projects, access these via `import.meta.env.VITE_VARIABLE_NAME`.

## 6. Agent Configuration & Knowledge Base

To ensure better separation of concerns and easier maintenance, always store the agent's prompts and knowledge in separate Markdown files, rather than hardcoding them into JavaScript/TypeScript files.

Create a `data` directory (e.g., `src/data/`) and include:

1. **`system_prompt.md`**: Contains the core agent instruction set, persona constraints, and behavior guidelines.
2. **`knowledge.md`**: Contains facts, business logic, or specific knowledge the agent should use to answer queries.

Example of how to import them in Vite (using the `?raw` suffix to import markdown as raw strings):

```jsx
import systemPrompt from '../data/system_prompt.md?raw';
import knowledgeBase from '../data/knowledge.md?raw';

// Example: Pass them into the LiveClient setup
// const client = new LiveClient(API_KEY, MODEL, VOICE, knowledgeBase, systemPrompt, tools);
```
