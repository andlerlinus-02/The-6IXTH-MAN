/**
 * LIVE CLIENT
 * Wrapper for Gemini Multimodal Live API
 */

import { AudioRecorder, AudioStreamer } from './audio-utils';

const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export class LiveClient {
    constructor(apiKey, model, voice, knowledge, systemPrompt, tools) {
        this.apiKey = apiKey;
        this.model = model;
        this.voice = voice || "Puck";
        this.knowledge = knowledge || "";
        this.systemPrompt = systemPrompt || "You are a helpful assistant.";
        this.tools = tools || [];
        this.ws = null;
        this.recorder = null;
        this.streamer = null;
        this.isConnected = false;

        // Event callbacks
        this.onOpen = () => { };
        this.onClose = () => { };
        this.onError = () => { };
        this.onAudioLevel = () => { }; // For visualizer
        this.onToolCall = async () => null; // Returns tool response
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
                tools: this.tools.length > 0 ? [{ function_declarations: this.tools }] : undefined,
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

    async handleMessage(msg) {
        // console.log("Received:", JSON.stringify(msg).substring(0, 200)); // Debug log

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

        // Handle Tool Calls (Robust Check)
        const toolCall = msg.toolCall || msg.serverContent?.toolCall || msg.serverContent?.tool_call;

        if (toolCall) {
            console.log("Tool Call detected:", toolCall);
            const functionCalls = toolCall.functionCalls || toolCall.function_calls;

            if (functionCalls && functionCalls.length > 0) {
                const responses = [];
                for (const call of functionCalls) {
                    const args = call.args || call.arguments;
                    console.log("Processing Function:", call.name, args);
                    try {
                        const result = await this.onToolCall(call.name, args);
                        responses.push({
                            id: call.id,
                            name: call.name,
                            response: { result: result }
                        });
                    } catch (err) {
                        console.error("Tool Execution Error:", err);
                        responses.push({
                            id: call.id,
                            name: call.name,
                            response: { error: JSON.stringify(err) }
                        });
                    }
                }
                this.sendToolResponse(responses);
            }
        }

        // Setup Complete
        if (msg.setupComplete) {
            console.log("Session Setup Complete");
        }
    }

    sendToolResponse(functionResponses) {
        const msg = {
            tool_response: {
                function_responses: functionResponses
            }
        };
        this.send(msg);
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
