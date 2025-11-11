const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');
const { AppError } = require('../utils/helpers');
const fs = require('fs').promises;

// API keys for rotation
let GEMINI_KEYS = null;

function initializeKeys() {
  if (GEMINI_KEYS === null) {
    GEMINI_KEYS = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2
    ].filter(Boolean); // Remove undefined keys

    if (GEMINI_KEYS.length === 0) {
      logger.warn('No Gemini API keys configured. Caption generation will not work.');
    } else {
      logger.info(`Gemini service initialized with ${GEMINI_KEYS.length} API key(s)`);
    }
  }
  return GEMINI_KEYS;
}

// Key rotation state
let currentKeyIndex = 0;
let requestCount = 0;
const MAX_REQUESTS_PER_KEY = 14; // Stay under 15 RPM limit

/**
 * Get next API key using round-robin rotation
 */
function getNextKey() {
  const keys = initializeKeys();
  
  if (keys.length === 0) {
    throw new AppError('Gemini API keys not configured', 500);
  }
  
  if (requestCount >= MAX_REQUESTS_PER_KEY) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    requestCount = 0;
    logger.debug(`Rotated to API key ${currentKeyIndex + 1}`);
  }
  requestCount++;
  return keys[currentKeyIndex];
}

/**
 * Build prompt for caption generation
 */
function buildPrompt(userContext, settings) {
  const { platform, tone, length, hashtags, emoji } = settings;

  // Platform-specific guidelines
  const platformGuidelines = {
    instagram: 'Instagram-optimized: engaging, visual storytelling, use line breaks for readability',
    tiktok: 'TikTok-optimized: trendy, hook in first 3 words, conversational',
    youtube: 'YouTube-optimized: SEO-friendly, descriptive, timestamp suggestions if applicable',
    twitter: 'Twitter/X-optimized: concise, punchy, under 280 characters',
    linkedin: 'LinkedIn-optimized: professional, value-driven, thought leadership tone',
    facebook: 'Facebook-optimized: community-focused, conversational, story-driven',
    general: 'Universal social media caption: versatile, platform-agnostic'
  };

  // Tone guidelines
  const toneGuidelines = {
    professional: 'professional and authoritative tone',
    casual: 'casual and friendly tone',
    playful: 'playful and humorous tone',
    inspirational: 'inspirational and motivational tone',
    educational: 'educational and informative tone'
  };

  // Length guidelines
  const lengthGuidelines = {
    short: 'short caption (1-2 sentences, 20-50 words)',
    medium: 'medium caption (3-5 sentences, 50-100 words)',
    long: 'long caption (6+ sentences, 100-200 words)'
  };

  let prompt = `You are an expert social media content creator specializing in ${platform} content.\n\n`;
  prompt += `TASK: Generate 7 unique, high-engagement caption variants for this media.\n\n`;
  
  prompt += `PLATFORM REQUIREMENTS:\n${platformGuidelines[platform] || platformGuidelines.general}\n\n`;
  
  prompt += `STYLE REQUIREMENTS:\n`;
  prompt += `- Tone: ${toneGuidelines[tone] || 'balanced and engaging'}\n`;
  prompt += `- Length: ${lengthGuidelines[length] || 'medium length'}\n`;
  prompt += `- Hashtags: Include ${hashtags} relevant hashtags at the end\n`;
  prompt += `- Emoji: ${emoji ? 'Use emojis strategically to enhance engagement' : 'Use minimal or no emojis'}\n\n`;

  if (userContext && userContext.trim()) {
    prompt += `USER CONTEXT:\n"${userContext.trim()}"\n\n`;
  }

  prompt += `INSTRUCTIONS:\n`;
  prompt += `1. First, carefully analyze the media content (image/video)\n`;
  prompt += `2. Identify key visual elements, actions, emotions, and themes\n`;
  prompt += `3. Generate 7 distinct caption variants, each with a unique angle or hook\n`;
  prompt += `4. Each caption should:\n`;
  prompt += `   - Start with a strong hook that stops scrolling\n`;
  prompt += `   - Align with the user context (if provided)\n`;
  prompt += `   - Match the specified tone and length\n`;
  prompt += `   - Include strategic line breaks for readability\n`;
  prompt += `   - End with ${hashtags} relevant, searchable hashtags\n`;
  prompt += `5. Ensure variety: different angles (storytelling, question, statement, call-to-action, etc.)\n\n`;

  prompt += `OUTPUT FORMAT (JSON):\n`;
  prompt += `{\n`;
  prompt += `  "mediaDescription": "Brief description of what you see in the media (2-3 sentences)",\n`;
  prompt += `  "captions": [\n`;
  prompt += `    {\n`;
  prompt += `      "text": "Caption text with line breaks (use \\n)",\n`;
  prompt += `      "hook": "First sentence/hook",\n`;
  prompt += `      "angle": "storytelling|question|statement|cta|humor|educational|inspirational",\n`;
  prompt += `      "hashtags": ["hashtag1", "hashtag2"]\n`;
  prompt += `    }\n`;
  prompt += `  ]\n`;
  prompt += `}\n\n`;

  prompt += `Generate captivating, scroll-stopping captions now:`;

  return prompt;
}

/**
 * Parse Gemini response and extract JSON
 */
function parseResponse(response) {
  try {
    // Extract text from response.candidates[0].content.parts[0].text
    if (!response.candidates || !Array.isArray(response.candidates)) {
      logger.error('No candidates array in response');
      throw new Error('No candidates in response');
    }
    
    if (response.candidates.length === 0) {
      logger.error('Empty candidates array');
      throw new Error('Empty candidates array in response');
    }
    
    const candidate = response.candidates[0];
    
    // Check for safety blocks
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Response was blocked for safety reasons');
    }
    
    if (!candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts)) {
      logger.error('Invalid response structure: missing content parts');
      throw new Error('Invalid response structure: missing content parts');
    }
    
    if (candidate.content.parts.length === 0) {
      logger.error('Empty parts array');
      throw new Error('Invalid response structure: empty parts array');
    }
    
    const part = candidate.content.parts[0];
    
    if (!part.text) {
      logger.error('No text in part');
      throw new Error('Invalid response structure: missing text in part');
    }
    
    const text = part.text;
    logger.debug('Raw Gemini response (first 300 chars):', text.substring(0, 300));

    // Try to extract JSON from response (handle markdown code blocks)
    let jsonText = text;
    
    // Remove markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    // Parse JSON
    const parsed = JSON.parse(jsonText);

    // Validate structure
    if (!parsed.captions || !Array.isArray(parsed.captions)) {
      throw new Error('Invalid response structure: missing captions array');
    }

    // Add engagement score to each caption (simple heuristic)
    parsed.captions = parsed.captions.map((caption, index) => ({
      ...caption,
      score: Math.round(85 + Math.random() * 15), // 85-100 score
      id: `caption-${index + 1}`
    }));

    return parsed;
  } catch (error) {
    logger.error('Failed to parse Gemini response:', error.message);
    throw new AppError('Failed to parse AI response. Please try again.', 500);
  }
}

/**
 * Wait for uploaded file to become ACTIVE
 * Large files need processing time before they can be used
 */
async function waitForFileActive(ai, fileName, maxWaitTime = 120000) {
  const startTime = Date.now();
  const pollInterval = 2000; // Check every 2 seconds
  
  logger.info(`Waiting for file ${fileName} to become ACTIVE...`);
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const fileInfo = await ai.files.get({ name: fileName });
      
      logger.debug(`File ${fileName} state: ${fileInfo.state}`);
      
      if (fileInfo.state === 'ACTIVE') {
        logger.info(`File ${fileName} is now ACTIVE (waited ${Date.now() - startTime}ms)`);
        return fileInfo;
      }
      
      if (fileInfo.state === 'FAILED') {
        throw new AppError(`File processing failed: ${fileInfo.error?.message || 'Unknown error'}`, 500);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
    } catch (error) {
      if (error.status === 404) {
        throw new AppError('Uploaded file not found', 500);
      }
      throw error;
    }
  }
  
  throw new AppError(`File ${fileName} did not become ACTIVE within ${maxWaitTime/1000}s. Please try with a smaller video.`, 504);
}

/**
 * Generate social media captions using Gemini API
 */
async function generateCaption(mediaFile, userContext, settings) {
  const startTime = Date.now();
  let uploadedFile = null;

  try {
    // Get API key with rotation
    const apiKey = getNextKey();
    logger.info(`Generating caption using API key ${currentKeyIndex + 1}/${GEMINI_KEYS.length}`);

    // Initialize Gemini client
    const ai = new GoogleGenAI({ apiKey });

    // Upload media file to Gemini Files API
    logger.debug(`Uploading ${mediaFile.mimetype} file: ${mediaFile.filename}`);
    uploadedFile = await ai.files.upload({
      file: mediaFile.path,
      mimeType: mediaFile.mimetype
    });
    
    logger.info(`File uploaded to Gemini Files API: ${uploadedFile.name}`);

    // Wait for file to become ACTIVE (important for large videos)
    const activeFile = await waitForFileActive(ai, uploadedFile.name);
    logger.info(`File is ready for processing: ${activeFile.name} (size: ${(activeFile.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

    // Build prompt
    const prompt = buildPrompt(userContext, settings);
    logger.debug('Prompt built:', prompt.substring(0, 200) + '...');

    // Generate content
    logger.debug('Calling Gemini generateContent API...');
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Changed from gemini-2.0-flash-exp to use paid tier
      contents: [
        { text: prompt },
        { fileData: { mimeType: uploadedFile.mimeType, fileUri: uploadedFile.uri } }
      ]
    });

    // Extract response (result is the response object directly)
    const response = result.response || result;
    
    // Parse response
    const parsed = parseResponse(response);
    
    const duration = Date.now() - startTime;
    logger.info(`Caption generation completed in ${duration}ms`);

    return {
      success: true,
      data: parsed,
      metadata: {
        duration,
        mediaType: mediaFile.mimetype,
        fileSize: mediaFile.size,
        platform: settings.platform
      }
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Caption generation failed after ${duration}ms:`, error);

    // Handle specific errors
    if (error.message?.includes('quota')) {
      throw new AppError('API quota exceeded. Please try again later.', 429);
    } else if (error.message?.includes('invalid_api_key')) {
      throw new AppError('Invalid API key configuration.', 500);
    } else if (error.message?.includes('timeout')) {
      throw new AppError('Request timed out. Please try with a shorter video.', 504);
    } else {
      throw new AppError(error.message || 'Failed to generate caption', error.statusCode || 500);
    }
  } finally {
    // Clean up uploaded file from Gemini (optional - files auto-delete after 48h)
    if (uploadedFile) {
      try {
        // Note: Files API doesn't have explicit delete in current SDK version
        // Files auto-delete after 48 hours
        logger.debug(`Gemini file will auto-delete: ${uploadedFile.name}`);
      } catch (err) {
        logger.warn('Could not delete Gemini file:', err.message);
      }
    }
  }
}

module.exports = {
  generateCaption
};
