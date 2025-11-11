const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');

// Python TTS service configuration
const PYTHON_SERVICE_URL = process.env.PYTHON_TATR_SERVICE_URL || 'http://localhost:5000';

/**
 * Text-to-Speech Routes
 * Proxy to Python Gemini TTS service
 */

// Get available voices
router.get('/text-to-speech/voices', async (req, res, next) => {
  try {
    logger.info('📚 Fetching TTS voices catalog...');
    
    const response = await axios.get(`${PYTHON_SERVICE_URL}/api/tts/voices`, {
      timeout: 10000
    });
    
    res.json(response.data);
  } catch (error) {
    logger.error('Error fetching voices:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'TTS service unavailable',
        message: 'Python TTS service is not running. Please start the Python service.'
      });
    }
    
    next(error);
  }
});

// Get supported languages
router.get('/text-to-speech/languages', async (req, res, next) => {
  try {
    logger.info('🌍 Fetching TTS languages...');
    
    const response = await axios.get(`${PYTHON_SERVICE_URL}/api/tts/languages`, {
      timeout: 10000
    });
    
    res.json(response.data);
  } catch (error) {
    logger.error('Error fetching languages:', error.message);
    next(error);
  }
});

// Generate speech (single speaker)
router.post('/text-to-speech/generate', async (req, res, next) => {
  try {
    const { text, voice, style, language, temperature } = req.body;
    
    // Validate
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Empty text provided'
      });
    }
    
    logger.info(`🎤 TTS Generate: ${text.length} chars, voice=${voice || 'Kore'}`);
    
    // Call Python service
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/api/tts/generate`,
      {
        text,
        voice: voice || 'Kore',
        style: style || '',
        language: language || 'en-US',
        temperature: temperature || 0.7
      },
      {
        responseType: 'stream',
        timeout: 180000 // 3 minutes timeout (TTS can be slow for long text)
      }
    );
    
    // Forward headers
    res.set('Content-Type', 'audio/wav');
    res.set('Content-Disposition', response.headers['content-disposition']);
    
    // Copy custom headers
    if (response.headers['x-voice']) res.set('X-Voice', response.headers['x-voice']);
    if (response.headers['x-language']) res.set('X-Language', response.headers['x-language']);
    if (response.headers['x-duration']) res.set('X-Duration', response.headers['x-duration']);
    if (response.headers['x-char-count']) res.set('X-Char-Count', response.headers['x-char-count']);
    
    // Stream audio file
    response.data.pipe(res);
    
  } catch (error) {
    logger.error('Error generating TTS:', error.message);
    
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'TTS generation failed',
        message: error.response.data.error || error.message
      });
    }
    
    next(error);
  }
});

// Generate dialog (multi-speaker)
router.post('/text-to-speech/generate-dialog', async (req, res, next) => {
  try {
    const { speakers, transcript, language, temperature } = req.body;
    
    // Validate
    if (!speakers || !Array.isArray(speakers) || speakers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No speakers provided'
      });
    }
    
    if (!transcript || !transcript.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Empty transcript provided'
      });
    }
    
    logger.info(`🎭 Dialog TTS: ${speakers.length} speakers, ${transcript.length} chars`);
    
    // Call Python service
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/api/tts/generate-dialog`,
      {
        speakers,
        transcript,
        language: language || 'en-US',
        temperature: temperature || 0.7
      },
      {
        responseType: 'stream',
        timeout: 180000 // 3 minutes timeout (TTS can be slow for long text)
      }
    );
    
    // Forward headers
    res.set('Content-Type', 'audio/wav');
    res.set('Content-Disposition', response.headers['content-disposition']);
    
    // Copy custom headers
    if (response.headers['x-speakers']) res.set('X-Speakers', response.headers['x-speakers']);
    if (response.headers['x-voices']) res.set('X-Voices', response.headers['x-voices']);
    if (response.headers['x-language']) res.set('X-Language', response.headers['x-language']);
    if (response.headers['x-duration']) res.set('X-Duration', response.headers['x-duration']);
    
    // Stream audio file
    response.data.pipe(res);
    
  } catch (error) {
    logger.error('Error generating dialog:', error.message);
    
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'Dialog generation failed',
        message: error.response.data.error || error.message
      });
    }
    
    next(error);
  }
});

module.exports = router;
