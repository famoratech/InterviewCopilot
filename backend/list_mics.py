import sounddevice as sd

print("\n🎤 AVAILABLE AUDIO DEVICES:")
print("-" * 40)
print(sd.query_devices())
print("-" * 40)
print("👉 Look for your microphone (e.g., 'MacBook Pro Microphone' or 'External Mic').")
print("   The number on the LEFT is the ID you need.")