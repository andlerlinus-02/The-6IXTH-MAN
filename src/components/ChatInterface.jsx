import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, X, Keyboard, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveClient } from '../logic/live-client';
import AudioVisualizer from './AudioVisualizer';
import knowledgeBase from '../data/knowledge2.md?raw';
import systemPrompt from '../data/system_prompt2.md?raw';

export default function ChatInterface() {
    const [isConnected, setIsConnected] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [visualizerMode, setVisualizerMode] = useState('idle'); // idle, listening, speaking
    const [isKeyboardMode, setIsKeyboardMode] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [error, setError] = useState(null);
    const [userName, setUserName] = useState(localStorage.getItem("userName") || "");

    // Config
    const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
    const MODEL = import.meta.env.VITE_GOOGLE_MODEL || "gemini-2.0-flash-exp";
    const VOICE = import.meta.env.VITE_GOOGLE_VOICE || "Puck";

    const clientRef = useRef(null);
    const speakingTimeoutRef = useRef(null);

    useEffect(() => {
        // Initialize client
        if (!API_KEY) {
            setError("Missing API Key in .env");
            return;
        }

        try {
            // Prepare System Prompt
            // Prepare System Prompt
            let currentSystemPrompt = systemPrompt;
            if (userName) {
                currentSystemPrompt = `[CRITICAL: The user's name is "${userName}". ALWAYS address them by this name naturally in conversation. Never ask for their name again.]\n\n` + currentSystemPrompt;
            } else {
                currentSystemPrompt = `[CRITICAL: You do NOT know the user's name yet. Your HIGHEST PRIORITY is to find out their name. Ask for it naturally at the start. As soon as they tell you, IMMEDIATEY call the 'save_user_details' tool.]\n\n` + currentSystemPrompt;
            }

            // Define Tools
            const tools = [
                {
                    name: "save_user_details",
                    description: "Save the user's name to internal memory. Call this function immediately when the user provides their name.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING", description: "The user's first name" }
                        },
                        required: ["name"]
                    }
                }
            ];

            clientRef.current = new LiveClient(API_KEY, MODEL, VOICE, knowledgeBase, currentSystemPrompt, tools);

            // Setup callbacks
            clientRef.current.onOpen = () => {
                setIsConnected(true);
                setVisualizerMode('listening');
                setError(null);
            };

            clientRef.current.onSetupComplete = () => {
                clientRef.current.sendText("System: The microphone is now connected. Please initiate the conversation actively based on your ACTIVE START PROTOCOL.");
            };

            clientRef.current.onClose = () => {
                setIsConnected(false);
                setVisualizerMode('idle');
            };

            clientRef.current.onError = (err) => {
                setError("Connection Error. Check console: " + err);
                setIsConnected(false);
                setVisualizerMode('idle');
            };

            clientRef.current.onToolCall = async (name, args) => {
                console.log("Tool Called:", name, args);
                if (name === "save_user_details") {
                    setUserName(args.name);
                    localStorage.setItem("userName", args.name);
                    // Force a re-render or update (handled by state)
                    return { success: true, message: `User name saved as ${args.name}. Address them as ${args.name} from now on.` };
                }
                return { error: "Unknown tool" };
            };

            // We hook into the streamer to detect "speaking"
            // Since we can't easily hook into the instance method directly without modifying the class,
            // we will wrap the addPCM16 method of the internal streamer if possible, or just
            // trust the client to trigger an event if we modified it. 
            // Workaround: We will use a proxy in the client or just trigger state here when we *would* send data?
            // Actually, let's modify the client to emit an event on audio received. 
            // For now, we monkey-patch the client's handleMessage in a safe way or just wait for v2.
            // Simplest: We won't get perfect lip-sync but we can trigger "speaking" for a bit when data arrives.

            const originalHandleMessage = clientRef.current.handleMessage.bind(clientRef.current);
            clientRef.current.handleMessage = (msg) => {
                originalHandleMessage(msg);
                if (msg.serverContent?.modelTurn?.parts?.some(p => p.inlineData?.mimeType?.startsWith('audio/'))) {
                    setVisualizerMode('speaking');

                    // Reset to listening after a rough estimate or debounce
                    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
                    speakingTimeoutRef.current = setTimeout(() => {
                        setVisualizerMode('listening');
                    }, 2000); // 2 seconds "speaking" visual persistence per chunk? Crude but works for visual flair.
                }
            };

        } catch (e) {
            setError(e.message);
        }

        return () => {
            if (clientRef.current) {
                clientRef.current.disconnect();
            }
        };

    }, [API_KEY, MODEL, VOICE]); // Removed userName to prevent disconnect loop

    const handleToggleConnection = () => {
        if (isConnected) {
            clientRef.current.disconnect();
        } else {
            if (!API_KEY) {
                setError("No API Key provided.");
                return;
            }
            clientRef.current.connect();
        }
    };

    const handleToggleMic = () => {
        // Toggle logic would ideally mute the recorder stream
        // For now, visual only
        setIsMicOn(!isMicOn);
    };

    const handleInterrupt = () => {
        if (isConnected && visualizerMode === 'speaking') {
            // Stop playback
            if (clientRef.current.streamer) {
                clientRef.current.streamer.stop();
                // Re-init streamer context for next turn immediately
                clientRef.current.streamer.init();
            }
            setVisualizerMode('listening');
        }
    };

    const handleToggleKeyboard = () => {
        setIsKeyboardMode(!isKeyboardMode);
    };

    const handleSendText = () => {
        if (!textInput.trim() || !clientRef.current) return;

        clientRef.current.sendText(textInput);
        setTextInput('');
        setIsKeyboardMode(false); // Optional: close keyboard after sending? Or keep it open. Let's keep it open or just clear text.
        // Let's just clear text for now.
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendText();
        }
    };

    return (
        <div className="app-container" onClick={handleInterrupt}>
            {/* Background Blobs */}
            <div className="ambient-bg">
                <div className="blob"></div>
                <div className="blob"></div>
                <div className="blob"></div>
            </div>

            <div className="header">
                <div>
                    <div className={`status-badge ${isConnected ? 'live' : ''}`}>
                        {isConnected ? 'LIVE' : 'OFFLINE'}
                    </div>
                </div>
                <h1>my lil homie</h1>
                <div>
                    {userName && (
                        <motion.div
                            className="user-name-badge"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <span style={{ opacity: 0.7 }}>User:</span> {userName}
                        </motion.div>
                    )}
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    {error}
                </div>
            )}

            <div className="visualizer-area">
                <AudioVisualizer
                    isActive={isConnected}
                    mode={visualizerMode}
                />
            </div>

            <div className="controls-area">
                <AnimatePresence>
                    {!isConnected ? (
                        <motion.button
                            className="btn-control btn-main"
                            onClick={handleToggleConnection}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            <Phone size={32} />
                        </motion.button>
                    ) : (
                        <>
                            <div className="controls-row">
                                <motion.button
                                    className={`btn-control ${isMicOn ? '' : 'btn-muted'}`}
                                    onClick={handleToggleMic}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                                </motion.button>

                                <motion.button
                                    className={`btn-control ${isKeyboardMode ? 'active' : ''}`}
                                    onClick={handleToggleKeyboard}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.05 }}
                                >
                                    <Keyboard size={24} />
                                </motion.button>

                                <motion.button
                                    className="btn-control btn-danger"
                                    onClick={handleToggleConnection}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <X size={32} />
                                </motion.button>
                            </div>

                            {isKeyboardMode && (
                                <motion.div
                                    className="keyboard-input-container"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                >
                                    <input
                                        type="text"
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Type your message..."
                                        className="glass-input"
                                        autoFocus
                                    />
                                    <button className="btn-send" onClick={handleSendText}>
                                        <Send size={20} />
                                    </button>
                                </motion.div>
                            )}
                        </>
                    )}
                </AnimatePresence>
            </div>

            <div style={{
                position: 'absolute',
                bottom: '10px',
                width: '100%',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                opacity: 0.5
            }}>
                Powered by Gemini 2.0 Flash Exp
            </div>
        </div>
    );
}
