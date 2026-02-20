
/**
 * Gemini API 통신 코어 모듈
 * 사용자의 브라우저 로컬 스토리지에 저장된 API Key를 가져와서 
 * Google 서버와 직접 통신합니다. (보안 BYOK 방식)
 */

import { smokelyzeAiTools, handleAiToolCall } from "./ai-tools.js";

// 사용할 AI 모델 이름 (향후 gemini-3.0-flash 등으로 손쉽게 교체 가능)
const GEMINI_MODEL = "gemini-2.5-flash";

// 브라우저가 열려있는 동안 유지되는 대화 기록 (컨텍스트 유지를 위함)
let sessionHistory = [];

export function clearAiChatHistory() {
    sessionHistory = [];
}

export async function fetchGeminiChat(systemInstruction, userMessage) {
    // 1. 보안 영역: 기기에서 사용자가 입력해둔 키 가져오기
    const apiKey = localStorage.getItem("smokelyze_gemini_key");
    if (!apiKey) {
        throw new Error("API Key not found. Please register your key in [Profiles] > [Settings] > [Google Gemini API] menu first.");
    }

    // 통신할 목표 지점 (Google 생성형 AI 서버)
    const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    // 2. 초기 대화 기록 구성 + 이전 대화 기억(컨텍스트 유지)
    let contents = [
        ...sessionHistory,
        {
            role: "user",
            parts: [{ text: userMessage }]
        }
    ];

    const generationConfig = {
        temperature: 0.2,
        maxOutputTokens: 2048,
    };

    try {
        // 최대 10번까지 핑퐁(Function Calling -> 결과 응답 -> 다시 질문)을 반복할 수 있는 에이전트 루프
        for (let turn = 0; turn < 10; turn++) {
            const requestBody = {
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: contents,
                tools: smokelyzeAiTools,
                generationConfig: generationConfig
            };

            const response = await fetch(endpointUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`[Gemini API Error] ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0) {
                // 혹시 프롬프트 차단(블락) 응답인지 확인
                if (data.promptFeedback && data.promptFeedback.blockReason) {
                    throw new Error(`AI response blocked (Reason: ${data.promptFeedback.blockReason})`);
                }
                throw new Error("AI returned no response.");
            }

            const candidate = data.candidates[0];

            if (candidate.finishReason === "SAFETY" || candidate.finishReason === "BLOCKLIST") {
                throw new Error("AI response blocked due to safety/security filters.");
            }

            if (!candidate.content || !candidate.content.parts) {
                console.error("[Gemini API] Unknown response format:", candidate);
                throw new Error(`AI returned an invalid message. (Finish reason: ${candidate.finishReason || "unknown"})`);
            }

            const modelResponseContent = candidate.content;
            const parts = modelResponseContent.parts;

            // 4-1. 함수(버튼 조작/데이터 추출)를 호출하라고 응답이 왔을 경우
            const functionCallParts = parts.filter(p => p.functionCall);
            if (functionCallParts.length > 0) {
                const functionResponseParts = [];
                for (const part of functionCallParts) {
                    const funcName = part.functionCall.name;
                    const funcArgs = part.functionCall.args;

                    const resultMsg = await handleAiToolCall(funcName, funcArgs);

                    functionResponseParts.push({
                        functionResponse: {
                            name: funcName,
                            response: { result: resultMsg }
                        }
                    });
                }

                // AI의 "함수 쓸게!"라는 메시지를 대화 기록에 추가
                contents.push(modelResponseContent);

                // 앱(브라우저)의 "함수 결과는 이거야!"라는 메시지를 대화 기록에 추가
                contents.push({
                    role: "function",
                    parts: functionResponseParts
                });

                // 루프가 계속 돌면서 결과를 반영한 최종 답변을 생성하러 올라감
                continue;
            }

            // 4-2. 최종 일반 텍스트 대답일 경우 (모든 텍스트 파트를 합쳐서 반환)
            const textParts = parts.filter(p => p.text);
            if (textParts.length > 0) {
                const combinedText = textParts.map(p => p.text).join("");

                // 성공적으로 응답을 받았으므로, 현재까지의 대화(contents)를 세션 히스토리에 저장
                contents.push(modelResponseContent);

                // [Intelligent Compaction]: Clean up heavy function results from older turns
                let trimmedHistory = [...contents];

                // Keep only last 20 messages for context
                if (trimmedHistory.length > 20) {
                    trimmedHistory = trimmedHistory.slice(trimmedHistory.length - 20);
                }

                while (trimmedHistory.length > 0 && trimmedHistory[0].role !== "user") {
                    trimmedHistory.shift();
                }

                // Summarize old data extraction results to save tokens in future turns
                sessionHistory = trimmedHistory.map((msg, idx) => {
                    if (idx >= trimmedHistory.length - 2) return msg;

                    if (msg.role === "function") {
                        const compactedParts = msg.parts.map(p => {
                            if (p.functionResponse && p.functionResponse.name === "extract_map_data") {
                                return {
                                    functionResponse: {
                                        name: "extract_map_data",
                                        response: { result: "[Old data result pruned to save tokens]" }
                                    }
                                };
                            }
                            return p;
                        });
                        return { ...msg, parts: compactedParts };
                    }
                    return msg;
                });

                return {
                    type: "text",
                    text: combinedText,
                    usage: data.usageMetadata // { promptTokenCount, candidatesTokenCount, totalTokenCount }
                };
            }

            throw new Error("AI returned a response in an uninterpretable format.");
        }

        throw new Error("Analysis stopped because it was too complex (Turn limit reached).");

    } catch (error) {
        console.error("fetchGeminiChat Error:", error);
        throw error;
    }
}

