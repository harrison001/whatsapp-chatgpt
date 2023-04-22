import { Telegraf, Context } from 'telegraf';
import { openai } from "../providers/openai";
import { aiConfig_telegram } from "../handlers/ai-config_telegram";
import { CreateImageRequestSizeEnum } from "openai";
import config from "../config";
import * as cli from "../cli/ui";
const { Readable } = require('stream');

// Moderation
import { moderateIncomingPrompt } from "./moderation";

const handleMessageDALLE_telegram = async (message: any, prompt: any) => {
	try {
		const start = Date.now();

		cli.print(`[DALL-E] Received prompt from ${message.from.id}: ${prompt}`);

		// Prompt Moderation
		if (config.promptModerationEnabled) {
			try {
				await moderateIncomingPrompt(prompt);
			} catch (error: any) {
				message.reply(error.message);
				return;
			}
		}

		// Send the prompt to the API
		const response = await openai.createImage({
			prompt: prompt,
			n: 1,
			size: aiConfig_telegram.dalle.size as CreateImageRequestSizeEnum,
			response_format: "b64_json"
		});

		//console.log(response); // Log the response object
		const end = Date.now() - start;
 		const imageData = response.data.data[0].b64_json;
  		// Convert base64 to buffer
  		const imageBuffer = Buffer.from(imageData, 'base64');
  		// Convert buffer to a readable stream
  		const imageStream = Readable.from(imageBuffer);
		cli.print(`[DALL-E] Answer to ${message.from.id} | OpenAI request took ${end}ms`);
		// Send image stream
		message.replyWithPhoto({ source: imageStream });

	} catch (error: any) {
		console.error("An error occured", error);
		message.reply("An error occured, please contact the administrator. (" + error.message + ")");
	}
};

export { handleMessageDALLE_telegram };
