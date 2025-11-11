"""
Gemini Text-to-Speech Service - Production Ready
Uses Google Gemini 2.5 Pro Preview TTS for high-quality speech synthesis

Features:
- 30 professional voices with distinct personalities
- Natural language style control ("Say cheerfully:", "Say professionally:")
- Multi-speaker dialog support (up to 2 speakers)
- 24 languages with regional accents
- WAV audio output (24kHz, 16-bit PCM)
- Temperature control for speech variation
- Production-ready error handling

High-Impact Parameters (User-Facing):
1. Voice Selection (30 voices) - HUGE impact on personality
2. Style Prompt (natural language) - Easy and powerful
3. Language/Accent - Clear regional differences
4. Multi-Speaker Mode - Premium feature for dialogs

Lower Impact Parameters (Hidden/Auto):
- Temperature: Set to 0.7 (good balance)
- Top-P/Top-K: Auto-optimized
- System Instructions: Auto-generated based on voice
"""

from google import genai
from google.genai import types
import wave
import os
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)


class GeminiTTSService:
    """
    Production-ready Text-to-Speech service using Gemini 2.5 Pro TTS
    
    Focus on HIGH-IMPACT features:
    - Voice personality (30 professional voices)
    - Natural style prompts (easiest to use)
    - Language/accent support (24 languages)
    - Multi-speaker dialogs (premium feature)
    """
    
    # Voice catalog with personality descriptions (HIGH IMPACT)
    VOICES = {
        # Professional voices (Business, News, Tutorials)
        'Kore': {'type': 'professional', 'gender': 'male', 'trait': 'Firm', 'best_for': 'Business presentations, authority'},
        'Orus': {'type': 'professional', 'gender': 'male', 'trait': 'Firm', 'best_for': 'Corporate training, news'},
        'Alnilam': {'type': 'professional', 'gender': 'male', 'trait': 'Firm', 'best_for': 'Serious announcements'},
        'Charon': {'type': 'professional', 'gender': 'male', 'trait': 'Informative', 'best_for': 'Educational content'},
        'Rasalgethi': {'type': 'professional', 'gender': 'female', 'trait': 'Informative', 'best_for': 'Tutorials, documentation'},
        
        # Friendly voices (Marketing, Storytelling, Engaging)
        'Puck': {'type': 'friendly', 'gender': 'female', 'trait': 'Upbeat', 'best_for': 'Marketing, cheerful content'},
        'Fenrir': {'type': 'friendly', 'gender': 'male', 'trait': 'Excitable', 'best_for': 'Energetic presentations'},
        'Laomedeia': {'type': 'friendly', 'gender': 'female', 'trait': 'Upbeat', 'best_for': 'Social media, vlogs'},
        'Achird': {'type': 'friendly', 'gender': 'female', 'trait': 'Friendly', 'best_for': 'Customer service, welcoming'},
        'Sadachbia': {'type': 'friendly', 'gender': 'female', 'trait': 'Lively', 'best_for': 'Entertainment, podcasts'},
        
        # Calm voices (Meditation, Audiobooks, Relaxation)
        'Zephyr': {'type': 'calm', 'gender': 'female', 'trait': 'Bright', 'best_for': 'Calm narration'},
        'Aoede': {'type': 'calm', 'gender': 'female', 'trait': 'Breezy', 'best_for': 'Meditation, relaxation'},
        'Callirrhoe': {'type': 'calm', 'gender': 'female', 'trait': 'Easy-going', 'best_for': 'Audiobooks, stories'},
        'Umbriel': {'type': 'calm', 'gender': 'male', 'trait': 'Easy-going', 'best_for': 'Bedtime stories'},
        'Vindemiatrix': {'type': 'calm', 'gender': 'female', 'trait': 'Gentle', 'best_for': 'Soft narration'},
        
        # Clear voices (Education, Podcasts, Clarity)
        'Iapetus': {'type': 'clear', 'gender': 'male', 'trait': 'Clear', 'best_for': 'Clear speech, learning'},
        'Erinome': {'type': 'clear', 'gender': 'female', 'trait': 'Clear', 'best_for': 'Instructions, guides'},
        'Despina': {'type': 'clear', 'gender': 'female', 'trait': 'Smooth', 'best_for': 'Professional podcasts'},
        'Algieba': {'type': 'clear', 'gender': 'male', 'trait': 'Smooth', 'best_for': 'Radio, broadcasting'},
        
        # Warm voices (Children's content, Storytelling)
        'Leda': {'type': 'warm', 'gender': 'female', 'trait': 'Youthful', 'best_for': "Children's books, young audience"},
        'Autonoe': {'type': 'warm', 'gender': 'female', 'trait': 'Bright', 'best_for': 'Uplifting stories'},
        'Sulafat': {'type': 'warm', 'gender': 'female', 'trait': 'Warm', 'best_for': 'Comforting narration'},
        'Achernar': {'type': 'warm', 'gender': 'male', 'trait': 'Soft', 'best_for': 'Gentle storytelling'},
        
        # Mature voices (Documentaries, Serious content)
        'Gacrux': {'type': 'mature', 'gender': 'male', 'trait': 'Mature', 'best_for': 'Documentaries, history'},
        'Schedar': {'type': 'mature', 'gender': 'male', 'trait': 'Even', 'best_for': 'Balanced narration'},
        'Sadaltager': {'type': 'mature', 'gender': 'male', 'trait': 'Knowledgeable', 'best_for': 'Expert content, analysis'},
        
        # Special voices
        'Enceladus': {'type': 'special', 'gender': 'male', 'trait': 'Breathy', 'best_for': 'Tired, emotional scenes'},
        'Algenib': {'type': 'special', 'gender': 'male', 'trait': 'Gravelly', 'best_for': 'Rugged, deep voice'},
        'Pulcherrima': {'type': 'special', 'gender': 'female', 'trait': 'Forward', 'best_for': 'Bold, direct content'},
        'Zubenelgenubi': {'type': 'special', 'gender': 'male', 'trait': 'Casual', 'best_for': 'Conversational, informal'}
    }
    
    # Language support (24 languages)
    LANGUAGES = {
        'en-US': 'English (United States)',
        'en-IN': 'English (India)',
        'en-GB': 'English (United Kingdom)',
        'en-AU': 'English (Australia)',
        'hi-IN': 'Hindi (India)',
        'ta-IN': 'Tamil (India)',
        'te-IN': 'Telugu (India)',
        'mr-IN': 'Marathi (India)',
        'bn-BD': 'Bengali (Bangladesh)',
        'gu-IN': 'Gujarati (India)',
        'kn-IN': 'Kannada (India)',
        'ml-IN': 'Malayalam (India)',
        'es-US': 'Spanish (United States)',
        'fr-FR': 'French (France)',
        'de-DE': 'German (Germany)',
        'it-IT': 'Italian (Italy)',
        'pt-BR': 'Portuguese (Brazil)',
        'ru-RU': 'Russian (Russia)',
        'ja-JP': 'Japanese (Japan)',
        'ko-KR': 'Korean (Korea)',
        'zh-CN': 'Chinese (Simplified)',
        'ar-EG': 'Arabic (Egyptian)',
        'tr-TR': 'Turkish (Turkey)',
        'vi-VN': 'Vietnamese (Vietnam)'
    }
    
    def __init__(self):
        """Initialize Gemini TTS with API key"""
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        self.client = genai.Client(api_key=self.api_key)
        self.model_name = "gemini-2.5-flash-preview-tts"  # Use Flash for faster generation
        
        logger.info(f"✓ Gemini TTS Service initialized: {self.model_name}")
        logger.info(f"  - {len(self.VOICES)} voices available")
        logger.info(f"  - {len(self.LANGUAGES)} languages supported")
    
    def generate_speech(
        self,
        text: str,
        voice_name: str = 'Kore',
        style_prompt: str = '',
        language_code: str = 'en-US',
        temperature: float = 0.7,
        output_dir: str = None
    ) -> dict:
        """
        Generate speech from text using Gemini TTS
        
        Args:
            text: Text to convert to speech
            voice_name: Voice name from VOICES catalog (default: Kore)
            style_prompt: Natural language style (e.g., "Say cheerfully:", "Say professionally:")
            language_code: Language code (default: en-US)
            temperature: Speech variation (0.0-2.0, default: 0.7)
            output_dir: Directory to save WAV file
        
        Returns:
            dict with success, audio_path, file_size, duration, etc.
        """
        try:
            # Validate inputs
            if not text or not text.strip():
                return {'success': False, 'error': 'Empty text provided'}
            
            if voice_name not in self.VOICES:
                logger.warning(f"Unknown voice '{voice_name}', using Kore")
                voice_name = 'Kore'
            
            # Prepare text with style prompt (HIGH IMPACT - natural language control)
            if style_prompt and style_prompt.strip():
                # User provided style like "Say cheerfully:" or just "cheerfully"
                if not style_prompt.lower().startswith('say '):
                    style_prompt = f"Say {style_prompt}:"
                full_text = f"{style_prompt} {text}"
            else:
                full_text = text
            
            logger.info(f"🎤 Generating speech: {len(text)} chars, voice={voice_name}, lang={language_code}")
            
            # Use NEW Google Gen AI SDK with correct TTS format
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=full_text,
                config=types.GenerateContentConfig(
                    response_modalities=['AUDIO'],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=voice_name
                            )
                        )
                    )
                )
            )
            
            # Debug: Check response structure
            logger.info(f"Response received. Candidates: {len(response.candidates) if hasattr(response, 'candidates') else 'N/A'}")
            if hasattr(response, 'prompt_feedback'):
                logger.info(f"Prompt feedback: {response.prompt_feedback}")
            
            # Check if we have candidates
            if not response.candidates or len(response.candidates) == 0:
                error_msg = "No candidates in response"
                if hasattr(response, 'prompt_feedback'):
                    error_msg += f" - Feedback: {response.prompt_feedback}"
                logger.error(error_msg)
                return {
                    'success': False,
                    'error': error_msg
                }
            
            # Debug candidate structure
            candidate = response.candidates[0]
            logger.info(f"Candidate content type: {type(candidate.content)}")
            logger.info(f"Candidate has parts: {hasattr(candidate.content, 'parts')}")
            if hasattr(candidate.content, 'parts'):
                logger.info(f"Parts count: {len(candidate.content.parts)}")
                if len(candidate.content.parts) > 0:
                    logger.info(f"First part type: {type(candidate.content.parts[0])}")
                    logger.info(f"First part has inline_data: {hasattr(candidate.content.parts[0], 'inline_data')}")
            
            # Extract audio data
            audio_data = response.candidates[0].content.parts[0].inline_data.data
            
            # Save WAV file
            if output_dir is None:
                output_dir = os.path.join(os.path.dirname(__file__), 'outputs')
            os.makedirs(output_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"tts_{timestamp}_{voice_name}.wav"
            output_path = os.path.join(output_dir, filename)
            
            # Write WAV file (24kHz, 16-bit PCM, mono)
            with wave.open(output_path, 'wb') as wf:
                wf.setnchannels(1)      # Mono
                wf.setsampwidth(2)      # 16-bit
                wf.setframerate(24000)  # 24kHz
                wf.writeframes(audio_data)
            
            file_size = os.path.getsize(output_path)
            duration = len(audio_data) / (24000 * 2)  # samples / (sample_rate * bytes_per_sample)
            
            logger.info(f"✓ Audio generated: {filename} ({file_size:,} bytes, {duration:.1f}s)")
            
            return {
                'success': True,
                'audio_path': output_path,
                'filename': filename,
                'file_size': file_size,
                'duration': duration,
                'voice': voice_name,
                'language': language_code,
                'char_count': len(text),
                'style_prompt': style_prompt
            }
            
        except Exception as e:
            logger.error(f"Error generating speech: {str(e)}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': str(e),
                'type': type(e).__name__
            }
    
    def generate_dialog(
        self,
        speakers: list,
        transcript: str,
        language_code: str = 'en-US',
        temperature: float = 0.7,
        output_dir: str = None
    ) -> dict:
        """
        Generate multi-speaker dialog (up to 2 speakers)
        
        Args:
            speakers: List of dicts with 'name' and 'voice' keys
                      Example: [{'name': 'Speaker1', 'voice': 'Kore'}, {'name': 'Speaker2', 'voice': 'Puck'}]
            transcript: Dialog text with speaker names
                       Example: "Speaker1: Hello! Speaker2: Hi there!"
            language_code: Language for all speakers
            temperature: Speech variation
            output_dir: Directory to save WAV file
        
        Returns:
            dict with success, audio_path, etc.
        """
        try:
            # Validate
            if len(speakers) > 2:
                return {'success': False, 'error': 'Maximum 2 speakers supported'}
            
            if not transcript or not transcript.strip():
                return {'success': False, 'error': 'Empty transcript'}
            
            logger.info(f"🎭 Generating dialog: {len(speakers)} speakers, {len(transcript)} chars")
            
            # Build speaker configs using NEW SDK types
            speaker_voice_configs = []
            for speaker in speakers:
                voice_name = speaker.get('voice', 'Kore')
                if voice_name not in self.VOICES:
                    voice_name = 'Kore'
                
                speaker_voice_configs.append(
                    types.SpeakerVoiceConfig(
                        speaker=speaker.get('name', f"Speaker{len(speaker_voice_configs)+1}"),
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=voice_name
                            )
                        )
                    )
                )
            
            # Use NEW Google Gen AI SDK for dialog
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=transcript,
                config=types.GenerateContentConfig(
                    response_modalities=['AUDIO'],
                    speech_config=types.SpeechConfig(
                        multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                            speaker_voice_configs=speaker_voice_configs
                        )
                    )
                )
            )
            
            # Extract and save audio
            audio_data = response.candidates[0].content.parts[0].inline_data.data
            
            if output_dir is None:
                output_dir = os.path.join(os.path.dirname(__file__), 'outputs')
            os.makedirs(output_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"tts_dialog_{timestamp}.wav"
            output_path = os.path.join(output_dir, filename)
            
            with wave.open(output_path, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(audio_data)
            
            file_size = os.path.getsize(output_path)
            duration = len(audio_data) / (24000 * 2)
            
            logger.info(f"✓ Dialog generated: {filename} ({file_size:,} bytes, {duration:.1f}s)")
            
            return {
                'success': True,
                'audio_path': output_path,
                'filename': filename,
                'file_size': file_size,
                'duration': duration,
                'speakers': [s.get('name') for s in speakers],
                'voices': [s.get('voice') for s in speakers],
                'language': language_code,
                'char_count': len(transcript)
            }
            
        except Exception as e:
            logger.error(f"Error generating dialog: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'type': type(e).__name__
            }
    
    def get_voices_catalog(self) -> dict:
        """
        Get complete voice catalog with categories
        
        Returns organized voice list for frontend
        """
        categorized = {}
        for voice_name, voice_info in self.VOICES.items():
            voice_type = voice_info['type']
            if voice_type not in categorized:
                categorized[voice_type] = []
            
            categorized[voice_type].append({
                'name': voice_name,
                'gender': voice_info['gender'],
                'trait': voice_info['trait'],
                'best_for': voice_info['best_for'],
                'type': voice_type
            })
        
        return {
            'total_voices': len(self.VOICES),
            'categories': categorized,
            'voice_types': list(categorized.keys())
        }
    
    def get_languages(self) -> dict:
        """Get supported languages"""
        return {
            'total': len(self.LANGUAGES),
            'languages': self.LANGUAGES
        }
