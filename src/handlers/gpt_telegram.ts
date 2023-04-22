import os from "os";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Telegraf, Context } from 'telegraf';
import { chatgpt } from "../providers/openai";
import * as cli from "../cli/ui";
import config from "../config";
import { splitSentences, splitParagraphs } from '../utils';
const { Readable } = require('stream');


// TTS
import { ttsRequest as speechTTSRequest } from "../providers/speech";
import { ttsRequest as awsTTSRequest } from "../providers/aws";
import { ttsRequest as azureTTSRequest } from "../providers/Azure_tts";
import { TTSMode } from "../types/tts-mode";
import { getTTSbyID } from "../Userverify";
// Moderation
import { moderateIncomingPrompt } from "./moderation";

// Mapping from number to last conversation id
const conversations = {};

const handleMessageGPT_telegram = async (message: Context, prompt: string) => {
	try {
		// Get last conversation
		const lastConversationId = conversations[message.from.id];

		cli.print(`[GPT] Received prompt from ${message.from.id}: ${prompt}`);

		// Prompt Moderation
		if (config.promptModerationEnabled) {
			try {
				await moderateIncomingPrompt(prompt);
			} catch (error: any) {
				message.reply(error.message);
				return;
			}
		}

		const start = Date.now();

		// Check if we have a conversation with the user
		let response: string;
		if (lastConversationId) {
			// Handle message with previous conversation
			response = await chatgpt.ask(prompt, lastConversationId);
		} else {
			// Create new conversation
			const convId = randomUUID();
			const conv = chatgpt.addConversation(convId);

			// Set conversation
			conversations[message.from.id] = conv.id;

			cli.print(`[GPT] New conversation for ${message.from.id} (ID: ${conv.id})`);

			// Pre prompt
			if (config.prePrompt != null && config.prePrompt.trim() != "") {
				cli.print(`[GPT] Pre prompt: ${config.prePrompt}`);
				const prePromptResponse = await chatgpt.ask(config.prePrompt, conv.id);
				cli.print("[GPT] Pre prompt response: " + prePromptResponse);
			}

			// Handle message with new conversation
			response = await chatgpt.ask(prompt, conv.id);
		}

		const end = Date.now() - start;

		cli.print(`[GPT] Answer to ${message.from.id}: ${response}  | OpenAI request took ${end}ms)`);

    		//Default: Text reply
    		message.reply(response);
		
		// TTS reply (Default: disabled)
		const ttsStatus = await getTTSbyID("telegram_id",message.from.id);
		if (ttsStatus) {
		  const extractedEnglish = extractEnglish(response);
		  if (extractedEnglish.length > 0) {
		    sendVoiceMessageReply(message, extractedEnglish);
		  }
		  //return;
		}

	} catch (error: any) {
		console.error("An error occured", error);
		message.reply("An error occured, please contact the administrator. (" + error.message + ")");
	}
};

const handleDeleteConversation_telegram = async (message: Context) => {
	// Delete conversation
	delete conversations[message.from.id];

	// Reply
	message.reply("Conversation context was resetted!");
};


function extractEnglish(str) {
    const englishRegEx = /[a-zA-Z0-9\s.,!?;:'"(){}[\]\\/@#$%^&*+=<>_-]+/g;
    const englishMatches = str.match(englishRegEx);

    if (englishMatches) {
        const result = englishMatches.join('');
        const hasLetter = /[a-zA-Z]/.test(result);
        return hasLetter ? result : '';
    } else {
        return '';
    }
}


async function sendVoiceMessageReply(message: Context, gptTextResponse: string) {
    // Maximum text length for each chunk
    const chunkSize = 500;

    // Split the text into chunks
    /*const chunks = [];
    for (let i = 0; i < gptTextResponse.length; i += chunkSize) {
        chunks.push(gptTextResponse.slice(i, i + chunkSize));
    }*/
	const chunks = splitParagraphs(gptTextResponse,chunkSize);

    // Process each chunk
    for (const chunk of chunks) {
        try {
			var logTAG = "[TTS]";
			var ttsRequest = async function (): Promise<Buffer | null> {
				return await speechTTSRequest(chunk);
			};

			switch (config.ttsMode) {
				case TTSMode.SpeechAPI:
					logTAG = "[SpeechAPI]";
					ttsRequest = async function (): Promise<Buffer | null> {
						return await speechTTSRequest(chunk);
					};
					break;

				case TTSMode.AWSPolly:
					logTAG = "[AWSPolly]";
					ttsRequest = async function (): Promise<Buffer | null> {
						return await awsTTSRequest(chunk);
					};
					break;

				case TTSMode.AZURE_TTS:
					logTAG = "[azure_tts]";
					ttsRequest = async function (): Promise<Buffer | null> {
						return await azureTTSRequest(chunk);
					};
					break;
				default:
					logTAG = "[SpeechAPI]";
					ttsRequest = async function (): Promise<Buffer | null> {
						return await speechTTSRequest(chunk);
					};
					break;
			}

			// Get audio buffer
			cli.print(`${logTAG} Generating audio from GPT response "${chunk}"...`);
			const audioBuffer = await ttsRequest();

	
            // Check if audio buffer is valid
            if (audioBuffer == null) {
                message.reply("Speech API couldn't generate audio, please contact the administrator.");
            } else if (audioBuffer.length > 0) {
            	cli.print(`${logTAG} Audio generated!`);
                // Send audio
                const audioStream = Readable.from(audioBuffer);
				await message.replyWithVoice({ source: audioStream });
            }

        } catch (error) {
            console.error("An error occurred:", error);
            console.error("Error message:", error.message)
            message.reply("An error occurred while processing your request. Please contact the administrator.");
            break;
        }
    }
}

export { handleMessageGPT_telegram, handleDeleteConversation_telegram };
