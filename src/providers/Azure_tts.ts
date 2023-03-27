const sdk = require("microsoft-cognitiveservices-speech-sdk");
import config from "../config";
/**
 * @param text The sentence to be converted to speech
 * @returns Audio buffer
 */
async function ttsRequest(text,VoiceName="en-US-JennyNeural",rate = 1.0, style = "friendly") {
    const speechConfig = sdk.SpeechConfig.fromSubscription(config.azureKey, config.azureRegin);
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Ogg24Khz16BitMonoOpus;
    const speechSynthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
    const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
            <voice name="${VoiceName}">
                <prosody rate="${rate}">
                    <mstts:express-as style="${style}">
                        ${text}
                    </mstts:express-as>
                </prosody>
            </voice>
        </speak>
    `;


//console.log(ssml);
/*
  const ssml = `
<speak version="1.0" xmlns="https://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="en-US-JennyNeural">
    When you're on the freeway, it's a good idea to use a GPS.
  </voice>
</speak>`;*/


    return new Promise((resolve, reject) => {
        speechSynthesizer.speakSsmlAsync(
            ssml,
            result => {
                  if (result.errorDetails) {
                      console.error(result.errorDetails);
                  } else {
                      console.log(JSON.stringify(result));
                  }
                  const audioData = result.privAudioData;
                  speechSynthesizer.close();
                  resolve(Buffer.from(audioData));
              },
              error => {
                  console.log(error);
                  speechSynthesizer.close();
                  reject(error)
              });
    });
}

export { ttsRequest };