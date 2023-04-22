//index.ts
import qrcode from "qrcode-terminal";
import { Client, Message, Events, LocalAuth } from "whatsapp-web.js";
import { Telegraf } from "telegraf";
import { Client as DiscordClient, Intents } from "discord.js";

// Constants
import constants from "./constants";
// Config & Constants
import config from "./config";

// CLI
import * as cli from "./cli/ui";
import { handleIncomingMessage } from "./handlers/message";
import { handleIncomingMessage_telegram } from "./handlers/message_telegram";
import { handleIncomingMessage_discord } from "./handlers/message_discord";

//uservierify
import { getUserInfoById, updateUserInfoById, mergeUserInfoWithEmail, storeUserInfo, handleEmailVerification, checkVerificationCode, sendActiveNotification } from "./Userverify";
import { UserInfo, UserInput } from "./Userverify";



// Ready timestamp of the bot
let botReadyTimestamp: Date | null = null;

const  paymentinfo = "Dear user, thank you for using our chatbot service. Unfortunately, your free limit has been reached. To continue, please subscribe to our paid service at https://buy.stripe.com/cN28xDcK82Tl6QMaEE. We appreciate your understanding and look forward to serving you further."

const linkeemail = "If you have already completed your payment or are a subscribed user, please provide your email address by simplay type your email here. You will receive a verification code in your inbox. Use this code to activate your subscription. Thank you!"

const handleUserInfo = async (userId, platform) => {
    let fetchedUserInfo = await getUserInfoById(platform, userId);
    if (fetchedUserInfo && Object.keys(fetchedUserInfo).length > 0) {
    	console.log(fetchedUserInfo);
        fetchedUserInfo.remaining_questions = fetchedUserInfo.remaining_questions - 1;
        console.log(`User found: remaining_questions The number is ${fetchedUserInfo.remaining_questions}`);
    } else {
    	const user: UserInfo = {
			email: null,
			whatsapp_id: null,
			telegram_id: null,
			discord_id: null,
			line_id: null,
			remaining_questions: 1,
			is_subscribed: false,
			tts_on: true,
		};
        fetchedUserInfo = user;
        fetchedUserInfo[platform] = userId;
        console.log(`Can not find the user: ${fetchedUserInfo.remaining_questions}`);
        await storeUserInfo(fetchedUserInfo);

    }
    console.log(fetchedUserInfo);
    await updateUserInfoById(platform, userId, fetchedUserInfo);

    if (fetchedUserInfo.is_subscribed) {
    	console.log("fetchedUserInfo.is_subscribed is true")
        return true;
    } else if (fetchedUserInfo.remaining_questions > 0) {
    	console.log("fetchedUserInfo.remaining_questions  > 0")
        return true;
    }
    return false;
};


const handleVerificationCode = async (userId, platform, code, replyFunc) => {
    let fetchedUserInfo = await getUserInfoById(platform, userId);
    // 检查用户是否提供了邮箱地址
    if (fetchedUserInfo.email) {
        // 检查验证码是否匹配
        const isValidCode = await checkVerificationCode(fetchedUserInfo.email, code);
        if (isValidCode) {
            fetchedUserInfo.is_subscribed = true;
            await updateUserInfoById(platform, userId, fetchedUserInfo);
            // 调用 sendActiveNotification 函数以发送激活通知
		    const userInput: UserInput = {
		        email: fetchedUserInfo.email,
		        platform: platform,
		        platform_id: userId,
		     };
		     await sendActiveNotification(userInput);
            // 在这里向用户发送验证成功的消息
            await replyFunc("Your subscription has been activated successfully.");
            //merge duplucated record which identified by email.
            await mergeUserInfoWithEmail(fetchedUserInfo.email);
        } else {
            // 在这里向用户发送验证码错误的消息
            await replyFunc("The verification code you provided is incorrect. Please try again.");
        }
    } else {
        // 在这里向用户发送错误消息，要求先提供邮箱地址
        await replyFunc("Please provide your email address first.");
    }
};


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
		const userId = message.from;

	    const text = message.body || '';

	    if (text.includes("@")) {
	        const email = text;
	        await handleEmailVerification(userId, "whatsapp_id", email);
	        await message.reply("We've sent a verification code to your email. Please provide the code to activate your subscription.");
	    } else if (text.length === 6 && /^\d+$/.test(text)) {
	        const code = text;
	        await handleVerificationCode(userId, "whatsapp_id", code, (msg) => message.reply(msg));
	    } else {
			const canSendMessage = await handleUserInfo(userId, "whatsapp_id");
			if (canSendMessage) {
		        await handleIncomingMessage(message);
		    } else {
		        await message.reply(paymentinfo);
		        await message.reply(linkeemail);
		    }
		}
	});

	// Reply to own message
	client.on(Events.MESSAGE_CREATE, async (message: Message) => {
		// Ignore if message is from status broadcast
		if (message.from == constants.statusBroadcast) return;

		// Ignore if it's a quoted message, (e.g. Bot reply)
		if (message.hasQuotedMsg) return;

		// Ignore if it's not from me
		if (!message.fromMe) return;
		const userId = message.from;

	    const text = message.body || '';

	    if (text.includes("@")) {
	        const email = text;
	        await handleEmailVerification(userId, "whatsapp_id", email);
	        await message.reply("We've sent a verification code to your email. Please provide the code to activate your subscription.");
	    } else if (text.length === 6 && /^\d+$/.test(text)) {
	        const code = text;
	        await handleVerificationCode(userId, "whatsapp_id", code, (msg) => message.reply(msg));
	    } else {
			const canSendMessage = await handleUserInfo(userId, "whatsapp_id");
			if (canSendMessage) {
		        await handleIncomingMessage(message);
		    } else {
		        await message.reply(paymentinfo);
		        await message.reply(linkeemail);
		    }
		}
	});

	// WhatsApp initialization
	client.initialize();
	
	// Telegram bot
	const telegramBot = new Telegraf(config.telegramAPIKey);

	// Handle incoming message
	telegramBot.on("message", async (ctx) => {
	    const message = ctx.update.message;

	    // Ignore if message is empty or from bot
	    if (!message || message.from.is_bot) return;

	    const userId = ctx.from.id;
	    const text = message.text || '';

		if (text.includes("@")) {
		    const email = text;
		    await handleEmailVerification(userId, "telegram_id", email);
		    await ctx.reply("We've sent a verification code to your email. Please provide the code to activate your subscription.");
		} else if (text.length === 6 && /^\d+$/.test(text)) {
		    const code = text;
        	await handleVerificationCode(userId, "telegram_id", code, (msg) => ctx.reply(msg));
		} else {
		    const canSendMessage = await handleUserInfo(userId, "telegram_id");
		    if (canSendMessage) {
	            await handleIncomingMessage_telegram(ctx);
	        } else {
	            //await ctx.reply(paymentinfo);
	            await ctx.reply('Dear user, thank you for using our chatbot service. Unfortunately, your free limit has been reached. To continue, please subscribe to our paid service. We appreciate your understanding and look forward to serving you further.');

	            // 创建带有支付链接的按钮
	            const subscribeButton = {
	                text: 'Subscribe Now',
	                url: 'https://buy.stripe.com/cN28xDcK82Tl6QMaEE',
	            };

	            const keyboard = {
	                reply_markup: {
	                    inline_keyboard: [[subscribeButton]],
	                },
	            };

	            // 发送按钮
	            await ctx.reply('Click the button below to subscribe:', keyboard);
	            await ctx.reply(linkeemail);
	        }
	    }
	});


	// Start bot
	telegramBot.launch();

	// Discord client
	//const discordBot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
	//const discordBot = new DiscordClient();

	// Handle incoming message
	/*discordBot.on("message", async (message) => {
		if (message.author.bot || message.webhookID) return;
	  	// Handle incoming message here
		await handleIncomingMessage_discord(message);
	});

	// Login to Discord
	discordBot.login(process.env.DISCORD_BOT_TOKEN);*/
	////////////////
	cli.print("openaikey: " + config.openAIAPIKey);
	cli.print("telegramkey: " + config.telegramAPIKey);
	cli.print("azureKey:" + config.azureKey); 
	cli.print("azureRegin:" +config.azureRegin);
	
};

start();

export { botReadyTimestamp };
