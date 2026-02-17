/**
 * LIVE CLIENT
 * Wrapper for Gemini Multimodal Live API
 */

import { AudioRecorder, AudioStreamer } from './audio-utils';

const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export class LiveClient {
    constructor(apiKey, model, voice, knowledge, systemPrompt) {
        this.apiKey = apiKey;
        this.model = model;
        this.voice = voice || "Puck";
        this.knowledge = knowledge || "";
        this.systemPrompt = systemPrompt || "You are a helpful assistant.";
        this.ws = null;
        this.recorder = null;
        this.streamer = null;
        this.isConnected = false;

        // Event callbacks
        this.onOpen = () => { };
        this.onClose = () => { };
        this.onError = () => { };
        this.onAudioLevel = () => { }; // For visualizer
    }

    connect() {
        const url = `${WS_URL}?key=${this.apiKey}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log("Connected to Gemini Live");
            this.isConnected = true;
            this.setupSession();
            this.startAudio();
            this.onOpen();
        };

        this.ws.onmessage = async (event) => {
            const data = event.data;
            let response;
            try {
                if (data instanceof Blob) {
                    const text = await data.text();
                    response = JSON.parse(text);
                } else {
                    response = JSON.parse(data);
                }
            } catch (e) {
                console.error("Error parsing WS message", e);
                return;
            }

            this.handleMessage(response);
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket Error:", error);
            this.onError(error);
        };

        this.ws.onclose = () => {
            console.log("Disconnected from Gemini Live");
            this.isConnected = false;
            this.stopAudio();
            this.onClose();
        };
    }

    setupSession() {
        const setupMsg = {
            setup: {
                model: `models/${this.model}`,
                system_instruction: {
                    parts: [{
                        text: this.getSystemInstruction()
                    }]
                },
                generation_config: {
                    response_modalities: ["AUDIO"],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: this.voice
                            }
                        }
                    }
                }
            }
        };
        this.send(setupMsg);
    }

    getSystemInstruction() {
        let instruction = this.systemPrompt;

        // Append Knowledge
        if (this.knowledge) {
            instruction += `\n\n[CONTEXT/KNOWLEDGE BASE]\nUse the following information to answer questions if relevant:\n${this.knowledge}`;
        }

        return instruction;
    }

    handleMessage(msg) {
        // Handle Audio
        if (msg.serverContent?.modelTurn?.parts) {
            const parts = msg.serverContent.modelTurn.parts;
            for (const part of parts) {
                if (part.inlineData && part.inlineData.mimeType.startsWith("audio/")) {
                    // Play audio
                    this.streamer.addPCM16(part.inlineData.data);
                }
            }
        }

        // Setup Complete
        if (msg.setupComplete) {
            console.log("Session Setup Complete");
        }
    }

    startAudio() {
        this.streamer = new AudioStreamer();
        this.recorder = new AudioRecorder((base64Data) => {
            this.sendAudioChunk(base64Data);
        });
        this.recorder.start();
    }

    stopAudio() {
        if (this.recorder) {
            this.recorder.stop();
            this.recorder = null;
        }
        if (this.streamer) {
            this.streamer.stop();
            this.streamer = null;
        }
    }

    sendAudioChunk(base64Data) {
        const msg = {
            realtime_input: {
                media_chunks: [
                    {
                        mime_type: "audio/pcm;rate=16000",
                        data: base64Data
                    }
                ]
            }
        };
        this.send(msg);
    }

    sendText(text) {
        const msg = {
            client_content: {
                turns: [
                    {
                        role: "user",
                        parts: [{ text: text }]
                    }
                ],
                turn_complete: true
            }
        };
        this.send(msg);
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        this.stopAudio();
    }
}
