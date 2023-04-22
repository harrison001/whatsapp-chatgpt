const startsWithIgnoreCase = (str, prefix) => str.toLowerCase().startsWith(prefix.toLowerCase());
// 导入 compromise 库
const nlp = require("compromise");

function splitSentences(text) {
  const doc = nlp(text);
  const sentences = doc.sentences().out("array");
  return sentences;
}

function splitParagraphs(text, maxChars = 1000) {
  const sentences = splitSentences(text);
  const paragraphs = [];
  let currentParagraph = "";
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    if (currentParagraph.length + sentence.length > maxChars) {
      paragraphs.push(currentParagraph);
      currentParagraph = sentence;
    } else {
      if (currentParagraph.length > 0) {
        currentParagraph += " ";
      }
      
      currentParagraph += sentence;
    }
  }
  
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }
  
  return paragraphs;
}

export { startsWithIgnoreCase, splitSentences, splitParagraphs };
