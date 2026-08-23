/**
 * Security, PII Masking, Prompt Injection Defense, and Output Sanitization Utilities
 */

// Masks only high-risk sensitive data (full street addresses, phone numbers, passwords, emails, URLs)
// while allowing educational self-introduction data (names, age, grade, hobbies, general cities like Hamamatsu).
export function maskHighRiskPII(text: string): { maskedText: string; hasHighRiskPII: boolean } {
  if (!text) return { maskedText: '', hasHighRiskPII: false };
  let masked = text;
  let hasHighRisk = false;

  // 1. Email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  if (emailRegex.test(masked)) {
    hasHighRisk = true;
    masked = masked.replace(emailRegex, '[email omitted]');
  }

  // 2. Phone numbers (e.g. 090-1234-5678, 080..., 053..., 03...)
  const phoneRegex = /(\b0\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{4}\b|\b\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{3,4}\b)/g;
  if (phoneRegex.test(masked)) {
    hasHighRisk = true;
    masked = masked.replace(phoneRegex, '[phone number omitted]');
  }

  // 3. Postal codes (e.g. 123-4567, 〒123-4567)
  const postalRegex = /(〒?\b\d{3}-\d{4}\b)/g;
  if (postalRegex.test(masked)) {
    hasHighRisk = true;
    masked = masked.replace(postalRegex, '[postal code omitted]');
  }

  // 4. URLs / Web links / Social media handles
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|(?:instagram|tiktok|twitter|x|discord)(?:\.com|\.gg)\/[^\s]+)/gi;
  if (urlRegex.test(masked)) {
    hasHighRisk = true;
    masked = masked.replace(urlRegex, '[link omitted]');
  }

  // 5. Passwords & PINs
  const passwordRegexEn = /\b(?:my\s+)?password\s+(?:is\s+)?([A-Za-z0-9@#$%^&*!_+=-]+)/gi;
  if (passwordRegexEn.test(masked)) {
    hasHighRisk = true;
    masked = masked.replace(passwordRegexEn, 'my password is [password omitted]');
  }
  const passwordRegexJa = /パスワード\s*(?:は|:|：)?\s*([^\s　]+)/gi;
  if (passwordRegexJa.test(masked)) {
    hasHighRisk = true;
    masked = masked.replace(passwordRegexJa, 'パスワードは [password omitted]');
  }

  // 6. Detailed street addresses (while preserving general cities like "in Hamamatsu", "in Shizuoka", "in Tokyo")
  const streetAddressRegexEn = /\b(?:my\s+address\s+is\s+|i\s+live\s+at\s+)(\d+[\w\s,.-]+)/gi;
  if (streetAddressRegexEn.test(masked)) {
    hasHighRisk = true;
    masked = masked.replace(streetAddressRegexEn, 'I live at [private address omitted]');
  }
  const addressNumberedEn = /\b\d{1,5}\s+[A-Za-z0-9\s]+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|building|apt|apartment|room)\b/gi;
  if (addressNumberedEn.test(masked)) {
    hasHighRisk = true;
    masked = masked.replace(addressNumberedEn, '[private address omitted]');
  }
  const addressJa = /([ぁ-んァ-ヶ一-龠]+(?:都|道|府|県)?[ぁ-んァ-ヶ一-龠]+(?:市|区|町|村)\s*[ぁ-んァ-ヶ一-龠0-9０-９\-ー丁目番地号]+)/g;
  if (addressJa.test(masked)) {
    hasHighRisk = true;
    masked = masked.replace(addressJa, '[private address omitted]');
  }

  return { maskedText: masked, hasHighRiskPII: hasHighRisk };
}

// Prompt Injection & System Disclosure Detector
export function detectPromptInjection(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  const injectionPatterns = [
    'system prompt',
    'show me your system',
    'show your system',
    'show me your prompt',
    'show me your instructions',
    'ignore previous instructions',
    'ignore all previous',
    'ignore instructions',
    'disregard previous',
    'tell me your secret',
    'tell me your rules',
    'what are your rules',
    'what is your prompt',
    'act as an unrestricted',
    'dan mode',
    'jailbreak',
    'developer mode',
    'reveal your prompt',
    'output your prompt',
    'プロンプトを見せて',
    'プロンプトを教えて',
    'システムプロンプト',
    '指示を無視',
    '以前の指示を無視',
    '秘密の指示',
    'ルールを教えて',
  ];

  return injectionPatterns.some((pattern) => lower.includes(pattern));
}

// Child Safety & Inappropriate Content Detector
export function detectInappropriateContent(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  const unsafeKeywords = [
    'kill', 'die', 'murder', 'suicide', 'gun', 'bomb', 'terrorist', 'shoot',
    'drug', 'cocaine', 'marijuana', 'weed', 'alcohol', 'beer', 'drunk',
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'porn', 'sex', 'nude',
    '死ね', '殺す', '自殺', '麻薬', '大麻', '銃', '爆弾', '暴力', 'エロ'
  ];

  return unsafeKeywords.some((kw) => lower.includes(kw));
}
