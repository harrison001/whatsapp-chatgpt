//Userverify.ts
import axios from "axios";
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';



import axios from "axios";
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';


// 创建 Redis 客户端实例
const redis = new Redis({
  port: 6379, // Redis 端口号
  host: '127.0.0.1', // Redis 地址
});



interface UserInput {
  email: string;
  platform: string;
  platform_id: string;
}


interface UserInfo {
  email: string | null;
  whatsapp_id: string | null;
  telegram_id: string | null;
  discord_id: string | null;
  line_id: string | null;
  remaining_questions: number;
  is_subscribed: boolean;
  tts_on: boolean;
}

async function hGetAllAsync(key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    redis.hgetall(key, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

/////////////////////////////////////////////////////////////////////////
const API_BASE_URL = 'http://127.0.0.1:8000';

async function handleEmailVerification = async (userId, platform, email) => {
  let fetchedUserInfo = await getUserInfoById(platform, userId);
  fetchedUserInfo.email = email.toLowerCase().replace(/\s+/g, ''); // Convert email to lowercase and remove spaces before storing
  await updateUserInfoById(platform, userId, fetchedUserInfo);
  console.log(`handleEmailVerification:${fetchedUserInfo.email}:${fetchedUserInfo.whatsapp_id}:${fetchedUserInfo.telegram_id}:${fetchedUserInfo.is_subscribed}`)

  // 在这里调用您的 FastAPI 后端以发送验证电子邮件
  const user_input:UserInput = {
    platform_id: userId,
    platform: platform,
    email: email
  };

  try {
    const response = await axios.post(`${API_BASE_URL}/send_verification_code/`, user_input);
    const verificationCode = response.data.verification_code;

    // 将验证码存储到 Redis，设置有效期为 10 分钟
    await redis.set(`verification_code:${fetchedUserInfo.email}`, verificationCode, 'EX', 600);

    // 初始化用户尝试次数为 0
    await redis.set(`attempt_count:${fetchedUserInfo.email}`, 0, 'EX', 600);

    return response.data;
  } catch (error) {
    console.error(`Error ${error.response.status}: ${error.response.data}`);
    return { error: `Error ${error.response.status}: ${error.response.data}` };
  }
};

async function checkVerificationCode = async (email, code) => {
  email = email.toLowerCase().replace(/\s+/g, ''); // Convert email to lowercase and remove spaces before checking

  // 获取 Redis 中的验证码
  const storedCode = await redis.get(`verification_code:${email}`);

  // 检查尝试次数
  const attemptCount = parseInt(await redis.get(`attempt_count:${email}`) || '0', 10);

  if (attemptCount >= 3) {
    // 超过尝试次数限制
    return { isValid: false, isLocked: true };
  }

  if (storedCode === code) {
    return { isValid: true, isLocked: false };
  } else {
    // 更新尝试次数
    await redis.incr(`attempt_count:${email}`);
    return { isValid: false, isLocked: false };
  }
};


async function sendActiveNotification(userInput: UserInput): Promise<boolean> {
  try {
    const response = await axios.post(`${API_BASE_URL}/update_user_info`, userInput);
    if (response.status === 200) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error while updating user info:", error);
    return false;
  }
}
//////////////////////////////////////////////////////////////////

async function storeUserInfo(userInfo: UserInfo) {
  try {
    console.log("storeUserInfo is called")
    const hashKey = `userinfo:${uuidv4()}`; // 唯一键，使用 UUID 作为标识符
    await redis.hmset(hashKey, {
      ...userInfo,
      remaining_questions: Number(userInfo.remaining_questions),
      is_subscribed: Boolean(userInfo.is_subscribed),
      tts_on: Boolean(userInfo.tts_on),
    });
    console.log("storeUserInfo: run 1")

    // 为 id 类型设置对应的键
    if (userInfo.whatsapp_id) {
      await redis.set(`whatsapp_id:${userInfo.whatsapp_id}`, hashKey);
    }
    if (userInfo.telegram_id) {
      await redis.set(`telegram_id:${userInfo.telegram_id}`, hashKey);
    }
    if (userInfo.discord_id) {
      await redis.set(`discord_id:${userInfo.discord_id}`, hashKey);
    }
    if (userInfo.line_id) {
      await redis.set(`line_id:${userInfo.line_id}`, hashKey);
    }
    console.log("storeUserInfo: run 6")
    if (userInfo.email) {
        await redis.sadd(`email:${userInfo.email}`, hashKey);
    }
  } catch (err) {
    console.error(`storeUserInfo error: ${err}`);
    throw err;
  }
}

async function updateUserInfoByIdEx( newUserInfo: UserInfo,mainHashKey:string) {
  try {
    if (newUserInfo.whatsapp_id) {
      await redis.set(`whatsapp_id:${newUserInfo.whatsapp_id}`, mainHashKey);
    }
    if (newUserInfo.telegram_id) {
      await redis.set(`telegram_id:${newUserInfo.telegram_id}`, mainHashKey);
    }
    if (newUserInfo.discord_id) {
      await redis.set(`discord_id:${newUserInfo.discord_id}`, mainHashKey);
    }
    if (newUserInfo.line_id) {
      await redis.set(`line_id:${newUserInfo.line_id}`, mainHashKey);
    }
    if (newUserInfo.email) {
        await redis.sadd(`email:${newUserInfo.email}`, mainHashKey);
    }
  } catch (err) {
    console.error(`updateUserInfoByIdEx error: ${err}`);
    throw err;
  }
}

async function getUserInfoById(idType: string, idValue: string): Promise<UserInfo | null> {
  try {
    const hashKey = await redis.get(`${idType}:${idValue}`);
    if (hashKey) {
      const userInfo = await hGetAllAsync(hashKey);
      const parsedUserInfo: UserInfo = {
        email: userInfo.email || null,
        whatsapp_id: userInfo.whatsapp_id || null,
        telegram_id: userInfo.telegram_id || null,
        discord_id: userInfo.discord_id || null,
        line_id: userInfo.line_id || null,
        remaining_questions: parseInt(userInfo.remaining_questions),
        is_subscribed: userInfo.is_subscribed === 'true',
        tts_on: userInfo.tts_on === 'true'
      };
      return parsedUserInfo;
    }
    return null;
  } catch (err) {
    console.error(`getUserInfoById error: ${err}`);
    throw err;
  }
}


async function updateUserInfoById(idType: string, idValue: string, newUserInfo: UserInfo) {
  try {
    const hashKey = await redis.get(`${idType}:${idValue}`);
    if (hashKey) {
      // 获取原始用户信息
      const oldUserInfo = await redis.hgetall(hashKey);

      // 如果电子邮件发生变化，需要更新集合
      if (newUserInfo.email && oldUserInfo.email !== newUserInfo.email) {
        // 从旧集合中移除 hashKey
        if (oldUserInfo.email) {
          await redis.srem(`email:${oldUserInfo.email}`, hashKey);
        }

        // 将 hashKey 添加到新集合中
        await redis.sadd(`email:${newUserInfo.email}`, hashKey);
      }

      // 更新用户信息
      await redis.hmset(hashKey, newUserInfo);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`updateUserInfoById error: ${err}`);
    throw err;
  }
}


async function mergeUserInfoWithEmail(email: string) {
  try {
    const emailSetKey = `email:${email}`;
    const emailSetMembers = await redis.smembers(emailSetKey);

    if (emailSetMembers.length > 0) {
      let mainHashKey;
      let mainUserInfo;
      let mainIndex;

      // 寻找第一个订阅状态为 true 的记录作为主记录
      for (let i = 0; i < emailSetMembers.length; i++) {
        const hashKey = emailSetMembers[i];
        const userInfo = await redis.hgetall(hashKey);
        if (userInfo.is_subscribed === 'true') {
          mainHashKey = hashKey;
          mainUserInfo = userInfo;
          mainIndex = i;
          break;
        }
      }

      if (mainUserInfo) {
        // 遍历具有相同电子邮件地址且 is_subscribed 为 true 的所有记录
        for (let i = 0; i < emailSetMembers.length; i++) {
          if (i !== mainIndex) {
            const hashKey = emailSetMembers[i];
            const userInfo = await redis.hgetall(hashKey);

            if (userInfo.is_subscribed === 'true') {
              // 合并非空的各个 ID
              if (userInfo.whatsapp_id) {
                mainUserInfo.whatsapp_id = userInfo.whatsapp_id;
              }
              if (userInfo.telegram_id) {
                mainUserInfo.telegram_id = userInfo.telegram_id;
              }
              if (userInfo.discord_id) {
                mainUserInfo.discord_id = userInfo.discord_id;
              }
              if (userInfo.line_id) {
                mainUserInfo.line_id = userInfo.line_id;
              }
              // 删除已合并的记录
              await redis.del(hashKey);
              await redis.srem(emailSetKey, hashKey);
            }
          }
        }
        // 更新主记录
        await redis.hmset(mainHashKey, mainUserInfo);
        // 更新 userInfoByIdEx
        await updateUserInfoByIdEx(mainUserInfo, mainHashKey);
      }
    }
  } catch (err) {
    console.error(`mergeUserInfoWithEmail error: ${err}`);
    throw err;
  }
}



// 获取用户的 TTS 开关状态
async function getTTSbyID(idType: string, idValue: string): Promise<boolean> {
  try {
    const userInfo: any = await getUserInfoById(idType, idValue);
    if (userInfo && Object.keys(userInfo).length > 0) {
      const boolValue = JSON.parse(userInfo.tts_on);
      return boolValue; 
    } else {
      console.warn("User info not found in Redis for key:", `${idType}:${idValue}`);
      throw new Error("User info not found");
    }
  } catch (err) {
    console.error("Error fetching user TTS status from Redis:", err);
    throw err;
  }
}

// 设置用户的 TTS 开关状态
async function setTTSbyID(idType: string, idValue: string, ttsStatus: boolean): Promise<void> {
  try {
    const userInfo: any = await getUserInfoById(idType, idValue);
    if (userInfo && Object.keys(userInfo).length > 0) {
      userInfo.tts_on = ttsStatus; 
      await updateUserInfoById(idType, idValue, userInfo);
    } else {
      console.warn("User info not found in Redis for key:", `${idType}:${idValue}`);
      throw new Error("User info not found");
    }
  } catch (err) {
    console.error("Error setting user TTS status in Redis:", err);
    throw err;
  }
}

export { getUserInfoById, updateUserInfoById, setTTSbyID, getTTSbyID, mergeUserInfoWithEmail, storeUserInfo, handleEmailVerification, checkVerificationCode,sendActiveNotification};
export { UserInfo, UserInput };
