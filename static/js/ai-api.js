
/**
 * Gemini API 통신 코어 모듈
 * 사용자의 브라우저 로컬 스토리지에 저장된 API Key를 가져와서 
 * Google 서버와 직접 통신합니다. (보안 BYOK 방식)
 */

import { handleAiToolCall } from "./ai-tools.js";

// 사용할 AI 백엔드 주소 (배포 후 Cloud Run URL로 교체 필요)
const AI_BACKEND_URL = "/api/chat";

// 브라우저가 열려있는 동안 유지되는 대화 기록 (컨텍스트 유지를 위함)
let sessionHistory = [];

export function clearAiChatHistory() {
    sessionHistory = [];
}

export async function fetchGeminiChat(dashboardContext, userMessage) {
    // 사용자가 입력해둔 자신의 API Key 가져오기
    const apiKey = localStorage.getItem("smokelyze_gemini_key");

    // 2. 초기 대화 기록 구성 + 이전 대화 기억(컨텍스트 유지)
    let contents = [
        ...sessionHistory,
        {
            role: "user",
            parts: [{ text: userMessage }]
        }
    ];

    try {
        // 최대 15번까지 핑퐁(Function Calling -> 결과 응답 -> 다시 질문)을 반복할 수 있는 에이전트 루프
        for (let turn = 0; turn < 15; turn++) {
            // [중요] 매 턴마다 최신 대시보드 상태(Context)를 다시 생성하여 AI에게 전달
            // 그래야 AI가 방금 수행한 도구 호출(날짜 변경 등)의 결과를 인지할 수 있음
            const currentContext = typeof generateContext === "function" ? generateContext() : dashboardContext;

            const requestBody = {
                contents: contents,
                dashboardContext: currentContext
            };

            const response = await fetch(AI_BACKEND_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(apiKey ? { "X-API-Key": apiKey } : {})
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`[Gemini API Error] ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0) {
                if (data.promptFeedback && data.promptFeedback.blockReason) {
                    throw new Error(`AI response blocked (Reason: ${data.promptFeedback.blockReason})`);
                }
                console.error("[Gemini API] Empty candidates:", data);
                throw new Error("AI returned no response.");
            }

            const candidate = data.candidates[0];

            if (candidate.finishReason === "SAFETY" || candidate.finishReason === "BLOCKLIST") {
                throw new Error("AI response blocked due to safety/security filters.");
            }

            // [Important] Lite 모델이 복잡한 분석 도중 아무 파트 없이 STOP 하는 경우 대비
            if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                if (candidate.finishReason === "STOP") {
                    // [Fix] 만약 도구 호출을 이미 수행했다면, 비어있는 응답이라도 성공으로 간주
                    const hasToolResponse = contents.some(msg => msg.role === "tool");
                    if (hasToolResponse) {
                        return {
                            type: "text",
                            text: "[System] Analysis and map updates completed successfully.",
                            usage: data.usageMetadata
                        };
                    }

                    console.warn("[Gemini API] Model failed to reason. Returning guidance.");
                    return {
                        type: "text",
                        text: "I'm sorry, the analysis was interrupted. **Please try again or break your question into steps.**",
                        usage: data.usageMetadata
                    };
                }
                console.error("[Gemini API] Response structure error. Full Candidate:", JSON.stringify(candidate, null, 2));
                throw new Error(`AI returned an invalid message structure. (Finish reason: ${candidate.finishReason || "unknown"})`);
            }

            const modelResponseContent = candidate.content;
            const parts = modelResponseContent.parts;

            // 4-1. 함수(버튼 조작/데이터 추출)를 호출하라고 응답이 왔을 경우
            const functionCallParts = parts.filter(p => p.functionCall);
            if (functionCallParts.length > 0) {
                const functionResponseParts = [];

                // [Fix] 백엔드에서 미리 실행해서 보내준 결과값이 있다면 매핑
                const backendResultsMap = {};
                if (data.backendResults) {
                    data.backendResults.forEach(br => {
                        backendResultsMap[br.functionResponse.name] = br.functionResponse.response;
                    });
                }

                for (const part of functionCallParts) {
                    const funcName = part.functionCall.name;
                    const funcArgs = part.functionCall.args;

                    let resultMsg;
                    // 백엔드 실행 결과가 있으면 그것을 사용, 없으면 프론트엔드 도구 실행
                    if (backendResultsMap[funcName]) {
                        console.log(`[AI Logic] Using cached backend result for: ${funcName}`);
                        resultMsg = backendResultsMap[funcName];
                    } else {
                        console.log(`[AI Logic] Executing frontend tool: ${funcName}`);
                        resultMsg = await handleAiToolCall(funcName, funcArgs);
                    }

                    functionResponseParts.push({
                        functionResponse: {
                            name: funcName,
                            response: typeof resultMsg === "object" ? resultMsg : { result: resultMsg }
                        }
                    });
                }

                // [Fix] Ensure map has a moment to process transitions
                if (functionCallParts.some(p => p.functionCall.name === "move_to_location")) {
                    await new Promise(r => setTimeout(r, 600));
                }
                
                // [Safety Net] If backend passed BQ coordinates (because AI may skip move_to_location),
                // execute move_to_location NOW before the next loop iteration sends a new HTTP request.
                if (data.autoMoveCoords && !functionCallParts.some(p => p.functionCall.name === "move_to_location")) {
                    console.log(`[AI Safety Net] Auto-moving to [${data.autoMoveCoords.lat}, ${data.autoMoveCoords.lon}]`);
                    await handleAiToolCall("move_to_location", data.autoMoveCoords);
                }
                
                // AI의 "함수 쓸게!"라는 메시지를 대화 기록에 추가
                contents.push(modelResponseContent);

                // [Standard] Gemini API expects "tool" role for tool responses. 
                contents.push({
                    role: "tool",
                    parts: functionResponseParts
                });

                continue;
            }
            
            // 4-1b. Safety net: if backend detected AI skipped move_to_location, auto-execute it
            if (data.autoMoveCoords) {
                console.log(`[AI Safety Net] Auto-moving to [${data.autoMoveCoords.lat}, ${data.autoMoveCoords.lon}]`);
                await handleAiToolCall("move_to_location", data.autoMoveCoords);
            }
            
            // 4-2. 최종 일반 텍스트 대답일 경우 (모든 텍스트 파트를 합쳐서 반환)
            const textParts = parts.filter(p => p.text);
            if (textParts.length > 0) {
                const combinedText = textParts.map(p => p.text).join("");

                // 성공적으로 응답을 받았으므로, 현재까지의 대화(contents)를 세션 히스토리에 저장
                contents.push(modelResponseContent);

                // [Intelligent Compaction]: Clean up heavy function results from older turns
                let trimmedHistory = [...contents];

                // Keep last 20 messages to avoid losing the initial user request during tool calls
                if (trimmedHistory.length > 20) {
                    trimmedHistory = trimmedHistory.slice(trimmedHistory.length - 20);
                }

                while (trimmedHistory.length > 0 && trimmedHistory[0].role !== "user") {
                    trimmedHistory.shift();
                }

                // Summarize old data extraction results to save tokens in future turns
                sessionHistory = trimmedHistory.map((msg, idx) => {
                    if (idx >= trimmedHistory.length - 2) return msg;

                    if (msg.role === "tool") {
                        const compactedParts = msg.parts.map(p => {
                            if (p.functionResponse && p.functionResponse.name === "extract_summary_aqs") {
                                return {
                                    functionResponse: {
                                        name: "extract_summary_aqs",
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

