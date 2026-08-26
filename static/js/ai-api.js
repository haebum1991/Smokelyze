
/**
 * Gemini API 통신 코어 모듈
 * 사용자의 브라우저 로컬 스토리지에 저장된 API Key를 가져와서 
 * Google 서버와 직접 통신합니다. (보안 BYOK 방식)
 */

import { handleAiToolCall } from "./ai-tools.js";

// 사용할 AI 백엔드 주소 (배포 후 Cloud Run URL로 교체 필요)
const API_URL_AI = "/api/chat";

// 브라우저가 열려있는 동안 유지되는 대화 기록 (컨텍스트 유지를 위함)
let sessionHistory = [];

export function clearAiChatHistory() {
    sessionHistory = [];
}

export async function fetchGeminiChat(dashboardContext, userMessage) {
    // 사용자가 입력해둔 자신의 API Key 가져오기
    const apiKey = localStorage.getItem("smokelyze_gemini_key");

    // 2. 초기 대화 기록 구성 + 이전 대화 기억(컨텍스트 유지)
    let userParts = [{ text: userMessage }];

    let contents = [
        ...sessionHistory,
        {
            role: "user",
            parts: userParts
        }
    ];

    try {
        // 최대 15번까지 핑퐁(Function Calling -> 결과 응답 -> 다시 질문)을 반복할 수 있는 에이전트 루프
        for (let turn = 0; turn < 15; turn++) {
            console.log(`[AI Network] Sending Turn ${turn + 1} request to backend...`);
            const currentContext = typeof generateContext === "function" ? generateContext() : dashboardContext;
            const selectedModel = localStorage.getItem("smokelyze_gemini_model");

            const requestBody = {
                contents: contents,
                dashboardContext: currentContext,
                model: selectedModel
            };

            const response = await fetch(API_URL_AI, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(apiKey ? { "X-API-Key": apiKey } : {})
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errorData = null;
                try {
                    const textBody = await response.text();
                    if (textBody) {
                        errorData = JSON.parse(textBody);
                    }
                } catch (e) {
                    console.error("[Gemini API] Failed to parse error response JSON:", e);
                }

                const errMsg = errorData?.error?.message || response.statusText || "Unknown Error";
                throw new Error(`[Gemini API Error] ${errMsg}`);
            }

            // Safe JSON parsing to avoid "Unexpected end of JSON input"
            const responseText = await response.text();
            if (!responseText) {
                console.error("[Gemini API] Empty response from server. Turn:", turn);
                throw new Error("Empty response from AI backend. The request might have timed out. Please try again with a simpler question.");
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error("[Gemini API] Invalid JSON response:", responseText.substring(0, 100));
                throw new Error("Received an invalid response format from the AI backend.");
            }

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
                    const hasToolResponse = contents.some(msg => msg.parts && msg.parts.some(p => p.functionResponse));
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

                const extraUserParts = [];
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

                    if (resultMsg && typeof resultMsg === "object" && resultMsg.inlineData) {
                        extraUserParts.push({ inlineData: resultMsg.inlineData });
                        const { inlineData, ...cleanResult } = resultMsg;
                        resultMsg = cleanResult;
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
                    await new Promise(r => setTimeout(r, 100));
                }

                // [Safety Net] If backend passed BQ coordinates or date (because AI may skip UI calls),
                // execute them NOW before the next loop iteration sends a new HTTP request.
                if (data.autoChangeDate) {
                    const datePicker = document.getElementById("datePicker");
                    if (datePicker && datePicker.value !== data.autoChangeDate) {
                        console.log(`[AI Safety Net] Auto-changing date to ${data.autoChangeDate}`);
                        await handleAiToolCall("change_date", { date: data.autoChangeDate });
                    }
                }
                if (data.autoMoveCoords && !functionCallParts.some(p => p.functionCall.name === "move_to_location")) {
                    console.log(`[AI Safety Net] Auto-moving to [${data.autoMoveCoords.lat}, ${data.autoMoveCoords.lon}]`);
                    await handleAiToolCall("move_to_location", data.autoMoveCoords);
                }

                // AI의 "함수 쓸게!"라는 메시지를 대화 기록에 추가
                contents.push(modelResponseContent);

                // [Standard] Gemini API expects "user" role with functionResponse parts. 
                contents.push({
                    role: "user",
                    parts: [...functionResponseParts, ...extraUserParts]
                });

                continue;
            }

            // 4-1b. Safety net: if backend detected AI skipped date or move_to_location, auto-execute it
            if (data.autoChangeDate) {
                const datePicker = document.getElementById("datePicker");
                if (datePicker && datePicker.value !== data.autoChangeDate) {
                    console.log(`[AI Safety Net] Auto-changing date to ${data.autoChangeDate}`);
                    await handleAiToolCall("change_date", { date: data.autoChangeDate });
                }
            }
            if (data.autoMoveCoords) {
                console.log(`[AI Safety Net] Auto-moving to [${data.autoMoveCoords.lat}, ${data.autoMoveCoords.lon}]`);
                await handleAiToolCall("move_to_location", data.autoMoveCoords);
            }

            // 4-2. 최종 일반 텍스트 대답일 경우 (모든 텍스트 파트를 합쳐서 반환)
            const textParts = parts.filter(p => p.text);
            if (textParts.length > 0) {
                const combinedText = textParts.map(p => p.text).join("");

                // 성공적으로 응답을 받았으므로, 현재 턴의 순수 질문과 최종 답변을 세션 히스토리에 저장
                // 중간 함수 호출 찌꺼기를 제거하여 다음 턴에서 Gemini 400 에러를 원천 방지하고 토큰을 80% 절약합니다.
                sessionHistory.push({
                    role: "user",
                    parts: [{ text: userMessage }]
                });
                sessionHistory.push({
                    role: "model",
                    parts: [{ text: combinedText }]
                });

                // 최근 10개 대화(5쌍)만 유지하여 토큰 최적화
                if (sessionHistory.length > 10) {
                    sessionHistory = sessionHistory.slice(sessionHistory.length - 10);
                }

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

