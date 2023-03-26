import qrcode from "qrcode-terminal";
import { Client, Message, Events, LocalAuth } from "whatsapp-web.js";
import { Telegraf } from "telegraf";
import { Client as DiscordClient } from "discord.js";

// Constants
import constants from "./constants";

// CLI
import * as cli from "./cli/ui";
import { handleIncomingMessage } from "./handlers/message";
import { handleIncomingMessage_telegram } from "./handlers/message_telegram";
import { handleIncomingMessage_discord } from "./handlers/message_discord";

// Ready timestamp of the bot
let botReadyTimestamp: Date | null = null;

// Entrypoint
const start = async () => {
	cli.printIntro();

	// WhatsApp Client
	const client = new Client({
		puppeteer: {
			args: ["--no-sandbox"]
		},
		authStrategy: new LocalAuth({
			clientId: undefined,
			dataPath: constants.sessionPath
		})
	});

	// WhatsApp auth
	client.on(Events.QR_RECEIVED, (qr: string) => {
		qrcode.generate(qr, { small: true }, (qrcode: string) => {
			cli.printQRCode(qrcode);
		});
	});

	// WhatsApp loading
	client.on(Events.LOADING_SCREEN, (percent) => {
		if (percent == "0") {
			cli.printLoading();
		}
	});

	// WhatsApp authenticated
	client.on(Events.AUTHENTICATED, () => {
		cli.printAuthenticated();
	});

	// WhatsApp authentication failure
	client.on(Events.AUTHENTICATION_FAILURE, () => {
		cli.printAuthenticationFailure();
	});

	// WhatsApp ready
	client.on(Events.READY, () => {
		// Print outro
		cli.printOutro();

		// Set bot ready timestamp
		botReadyTimestamp = new Date();
	});

	// WhatsApp message
	client.on(Events.MESSAGE_RECEIVED, async (message: any) => {
		// Ignore if message is from status broadcast
		if (message.from == constants.statusBroadcast) return;

		// Ignore if it's a quoted message, (e.g. Bot reply)
		if (message.hasQuotedMsg) return;

		await handleIncomingMessage(message);
	});

	// Reply to own message
	client.on(Events.MESSAGE_CREATE, async (message: Message) => {
		// Ignore if message is from status broadcast
		if (message.from == constants.statusBroadcast) return;

		// Ignore if it's a quoted message, (e.g. Bot reply)
		if (message.hasQuotedMsg) return;

		// Ignore if it's not from me
		if (!message.fromMe) return;

		await handleIncomingMessage(message);
	});

	// WhatsApp initialization
	client.initialize();
	
	////////////////
	// Telegram bot
	const telegramBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

	// Handle incoming message
	telegramBot.on("message", async (ctx) => {
		const message = ctx.update.message;

		// Ignore if message is empty or from bot
		if (!message || message.from.is_bot) return;

		 // TODO: Handle incoming message
		 await handleIncomingMessage_telegram(ctx);
	});

	// Start bot
	telegramBot.launch();

	// Discord client
	const discordBot = new DiscordClient();

	// Handle incoming message
	discordBot.on("message", async (message) => {
		if (message.author.bot || message.webhookID) return;
	  	// Handle incoming message here
		await handleIncomingMessage_discord(message);
	});

	// Login to Discord
	discordBot.login(process.env.DISCORD_BOT_TOKEN);
	////////////////
	
};

start();

export { botReadyTimestamp };
