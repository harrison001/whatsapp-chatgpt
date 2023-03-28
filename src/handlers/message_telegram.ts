import { Telegraf, Context } from 'telegraf';
import { startsWithIgnoreCase } from "../utils";

// Config & Constants
import config from "../config";

// CLI
import * as cli from "../cli/ui";

// ChatGPT & DALLE
import { handleMessageGPT_telegram, handleDeleteConversation_telegram } from "../handlers/gpt_telegram";
import { handleMessageDALLE_telegram } from "../handlers/dalle_telegram";
import { handleMessageAIConfig_telegram } from "../handlers/ai-config_telegram";

// Speech API & Whisper
import { TranscriptionMode } from "../types/transcription-mode";
import { transcribeRequest } from "../providers/speech";
import { transcribeAudioLocal } from "../providers/whisper-local";
import { transcribeWhisperApi } from "../providers/whisper-api";
import { transcribeOpenAI } from "../providers/openai";

// For deciding to ignore old messages
import { botReadyTimestamp } from "../index";

// Handles message
async function handleIncomingMessage_telegram(ctx: Context) {

	let messageString = ctx.message.text;
	const timestamp = ctx.message.date;

   // 将时间戳转换为本地日期时间格式
  	const localTime = new Date(timestamp * 1000).toLocaleString();
	// Prevent handling old messages
	if (ctx.message.date != null) {
		const messageTimestamp = new Date(ctx.message.date * 1000);

		// If startTimestamp is null, the bot is not ready yet
		if (botReadyTimestamp == null) {
			cli.print("Ignoring message because bot is not ready yet: " + messageString);
			return;
		}

		// Ignore messages that are sent before the bot is started
		if (messageTimestamp < botReadyTimestamp) {
			cli.print("Ignoring old message: " + messageString);
			return;
		}
	}

	// Ignore groupchats if disabled
	if ((ctx.message.chat.type === 'group' || ctx.message.chat.type === 'supergroup') && !config.groupchatsEnabled) return;
	//if ((await message.getChat()).isGroup && !config.groupchatsEnabled) return;

	// Transcribe audio
	if (ctx.message.voice) {

		      // 获取语音消息的文件信息
		      const file = await ctx.telegram.getFile(ctx.message.voice.file_id);
		      console.log(file)

		      const fileUrl = `https://api.telegram.org/file/bot${config.telegramAPIKey}/${file.file_path}`;

			  console.log(fileUrl);
			  //speech to text, url to text

			  const https = require('https');


			  // 发送 GET 请求获取数据流
			  https.get(fileUrl, async (response) => {
			    // 创建一个空的 Buffer 对象
			    let mediaBuffer = Buffer.alloc(0);

			    // 监听数据流的 data 事件
			    response.on('data', (chunk) => {
			      // 每次接收到数据时，将其添加到 Buffer 对象中
			      mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
			    });

			    // 监听数据流的 end 事件
			    response.on('end', async () => {
					console.log('已获取数据流');
					// Transcribe locally or with Speech API
					config.transcriptionMode = TranscriptionMode.SpeechAPI;
					cli.print(`[Transcription] Transcribing audio with "${config.transcriptionMode}" mode...`);

					let res;
					switch (config.transcriptionMode) {
						case TranscriptionMode.Local:
							res = await transcribeAudioLocal(mediaBuffer);
							break;
						case TranscriptionMode.OpenAI:
							res = await transcribeOpenAI(mediaBuffer);
							break;
						case TranscriptionMode.WhisperAPI:
							res = await transcribeWhisperApi(new Blob([mediaBuffer]));
							break;
						case TranscriptionMode.SpeechAPI:
							res = await transcribeRequest(new Blob([mediaBuffer]));
							break;
						default:
							cli.print(`[Transcription] Unsupported transcription mode: ${config.transcriptionMode}`);
							
					}
		
					const { text: transcribedText, language: transcribedLanguage } = res;

					// Check transcription is null (error)
					if (transcribedText == null) {
						message.reply("I couldn't understand what you said.");
						return;
					}

					// Check transcription is empty (silent voice message)
					if (transcribedText.length == 0) {
						message.reply("I couldn't understand what you said.");
						return;
					}

					// Log transcription
					cli.print(`[Transcription] Transcription response: ${transcribedText} (language: ${transcribedLanguage})`);

					// Reply with transcription
					const reply = `You said: ${transcribedText}${transcribedLanguage ? " (language: " + transcribedLanguage + ")" : ""}`;
					ctx.reply(reply);

					// Handle message GPT
					await handleMessageGPT_telegram(ctx, transcribedText);
					return;
			    });
			  }).on('error', (err) => {
			    console.error(err);
			  });
			  return;
		}


	// Clear conversation context (!reset)
	if (startsWithIgnoreCase(messageString, config.resetPrefix)) {
		await handleDeleteConversation_telegram(ctx);
		return;
	}

	// AiConfig (!config <args>)
	if (startsWithIgnoreCase(messageString, config.aiConfigPrefix)) {
		const prompt = messageString.substring(config.aiConfigPrefix.length + 1);
		await handleMessageAIConfig_telegram(ctx, prompt);
		return;
	}

	// DALLE (!dalle <prompt>)
	if (startsWithIgnoreCase(messageString, config.dallePrefix)) {
		const prompt = messageString.substring(config.dallePrefix.length + 1);
		await handleMessageDALLE_telegram(ctx, prompt);
		return;
	}
	//default handling
	await handleMessageGPT_telegram(ctx, messageString);

}

export { handleIncomingMessage_telegram };
