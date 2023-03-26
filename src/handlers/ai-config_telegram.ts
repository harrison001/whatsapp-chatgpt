import { Telegraf, Context } from 'telegraf';
import { aiConfigTarget, aiConfigTypes, aiConfigValues, IAiConfig } from "../types/ai-config";
import { dalleImageSize } from "../types/dalle-config";

const aiConfig_telegram: IAiConfig = {
	dalle: {
		size: dalleImageSize["512x512"]
	},
	ttsEnabled : true
	// chatgpt: {}
};

const handleMessageAIConfig_telegram = async (message: Context, prompt: any) => {
	try {
		console.log("[AI-Config] Received prompt from " + message.from + ": " + prompt);

		const args: string[] = prompt.split(" ");
		
		// Handle TTS yes/no command
		if (args.length === 2 && args[0].toLowerCase() === "tts" && (args[1].toLowerCase() === "yes" || args[1].toLowerCase() === "no")) {
		    aiConfig_telegram.ttsEnabled = args[1].toLowerCase() === "yes";
		    message.reply("TTS is now " + (aiConfig.ttsEnabled ? "enabled" : "disabled") + ".");
		    return;
		}

		/*
		    Available commands:
		    !config <target> <type> <value> - Set <target> <type> to <value>
		    !config tts yes - Turn on TTS and read English responses aloud for easier learning
		    !config tts no - Turn off TTS and receive text-only responses

		    Available targets and types:
		    dalle size: 256x256, 512x512, 1024x1024
		    ttsEnabled: yes, no

		    To get more information about the available targets, types, and values, type !config help.
		*/
		if (args.length === 1 || prompt === "help") {
		  let helpMessage = "Available commands:\n\n";
		  for (let target in aiConfigTarget) {
		    helpMessage += `  ${target}:\n`;
		    for (let type in aiConfigTypes[target]) {
		      helpMessage += `    !config ${target} ${type} <value> - Set ${target} ${type} to <value>\n`;
		    }
		    helpMessage += "\n";
		  }
		  helpMessage += "  !config tts yes - Turn on TTS and read English responses aloud for easier learning\n";
		  helpMessage += "  !config tts no - Turn off TTS and receive text-only responses\n\n";

		  helpMessage += "Available targets and types:\n";
		  for (let target in aiConfigTarget) {
		    helpMessage += `  ${target}:\n`;
		    for (let type in aiConfigTypes[target]) {
		      helpMessage += `    ${type}: ${Object.keys(aiConfigValues[target][type]).join(", ")}\n`;
		    }
		    helpMessage += "\n";
		  }

		  helpMessage += "To get more information about the available targets, types, and values, type !config help.";

		  message.reply(helpMessage);
		  return;
		}



		// !config <target> <type> <value>
		if (args.length !== 3) {
			message.reply(
				"Invalid number of arguments, please use the following format: <target> <type> <value> or type !config help for more information."
			);
			return;
		}

		const target: string = args[0];
		const type: string = args[1];
		const value: string = args[2];

		if (!(target in aiConfigTarget)) {
			message.reply("Invalid target, please use one of the following: " + Object.keys(aiConfigTarget).join(", "));
			return;
		}

		if (!(type in aiConfigTypes[target])) {
			message.reply("Invalid type, please use one of the following: " + Object.keys(aiConfigTypes[target]).join(", "));
			return;
		}

		if (!(value in aiConfigValues[target][type])) {
			message.reply("Invalid value, please use one of the following: " + Object.keys(aiConfigValues[target][type]).join(", "));
			return;
		}

		aiConfig_telegram[target][type] = value;

		message.reply("Successfully set " + target + " " + type + " to " + value);
	} catch (error: any) {
		console.error("An error occured", error);
		message.reply("An error occured, please contact the administrator. (" + error.message + ")");
	}
};

export { aiConfig_telegram, handleMessageAIConfig_telegram };
