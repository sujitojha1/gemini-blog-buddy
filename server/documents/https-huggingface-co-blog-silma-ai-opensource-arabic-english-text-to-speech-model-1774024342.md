SILMA TTS: A Lightweight Open Bilingual Text to Speech Model
Model Features
Below are the main features of the model
| Feature | Description |
|---|---|
| High-Fidelity Audio | Superior speech synthesis with high-quality output |
| 150M Parameters | Lightweight and efficient, works well in low-resource environments |
| Instant Voice Cloning | Clone any voice with less than 8 seconds of reference audio |
| Ultra-Low Latency | Optimized for real-time applications with RTF around 0.12 (RTX 4090 GPU) |
| Bilingual Arabic & English Support | Native-level fluency for Arabic Fusha/MSA as well as English |
| Advanced Arabic Diacritization | Full support for Tashkeel to ensure precise pronunciation and context |
| Text Normalization | Utilizing NeMo Text Processing |
| Commercial-Friendly Licensing | Fully open-source under the Apache 2.0 License |
Why did we release SILMA TTS
SILMA AI has always been deeply committed to open-source development and community impact. However, the release of this specific model was driven by two key factors:
Filling the gap for a low-resource language: Arabic is spoken by over 400+ million people globally, yet it remains unsupported by many TTS models due to the scarcity of high-quality Arabic audio data on the internet.
Improving upon F5-TTS size and licensing constraints: Because the original F5-TTS model was only available in one size and restricted from commercial use, we wanted to give back to the community by providing a more lightweight model (150M parameters) under a highly permissive license (Apache-2.0).
How We Built the Model
Architecture Optimization: First, we reduced the number of parameters in the original F5-TTS architecture from over 300M to approximately 150M.
Extensive Pretraining: Next, we pretrained the weights from scratch over a full week using 8 GPUs, training on tens of thousands of hours of high-quality data.
Targeted Fine-Tuning: We followed pretraining with a specialized fine-tuning phase, using a smaller, curated dataset with more focus on Arabic.
Inference Enhancements: Finally, we introduced significant optimizations to the inference code to improve Arabic text handling, chunking, text normalization, overall robustness, and final audio quality.
Try it out
You can easily try SILMA TTS v1 using only 2 lines of code:
pip install silma-tts
silma-tts-app
Here are all the relevant links for you to learn more about the model:
- Github Repo: https://github.com/SILMA-AI/silma-tts
- Hugging Face Repo: https://huggingface.co/silma-ai/silma-tts
- Hugging Face Demo Space: https://huggingface.co/spaces/silma-ai/silma-tts-v1-demo