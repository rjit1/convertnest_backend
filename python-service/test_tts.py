"""
Quick test script for Gemini TTS Service
"""
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Import TTS service
from gemini_tts_service import GeminiTTSService

print("✓ TTS Service imported successfully")

# Initialize
tts = GeminiTTSService()
print(f"✓ TTS initialized with {len(tts.VOICES)} voices")

# Get voices catalog
catalog = tts.get_voices_catalog()
print(f"✓ Voice categories: {catalog['voice_types']}")

# Get languages
languages = tts.get_languages()
print(f"✓ Languages supported: {languages['total']}")

print("\n🎉 All tests passed! TTS service is ready.")
print("\nSample voices:")
for category in ['professional', 'friendly', 'calm']:
    voices = catalog['categories'].get(category, [])
    if voices:
        print(f"  {category.title()}: {', '.join([v['name'] for v in voices[:3]])}...")
