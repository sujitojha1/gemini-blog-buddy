Darwin-TTS: We Gave a TTS Model 3% of an LLM's Brain — It Started Showing Emotion
Today we release Darwin-TTS-1.7B-Cross, the world's first cross-modal LLM→TTS FFN transfer model. Built in one day, with zero training, zero data, and zero GPU hours for fine-tuning.
The Idea in 30 Seconds
Modern TTS models like Qwen3-TTS use an LLM backbone (called the "talker") to understand text before converting it to speech. We asked a simple question:
If the talker is just an LLM, what happens if we blend in weights from a better LLM?
The answer: at 3% blending, the TTS model starts expressing emotion. At 5%, emotion intensifies. At 10%, it breaks.
The Lucky Break: 100% Architecture Match
We discovered that Qwen3-1.7B (a general-purpose LLM) and Qwen3-TTS-1.7B's talker module share perfectly identical architecture:
Qwen3-1.7B (LLM) Qwen3-TTS talker
hidden_size 2048 2048 ✅
intermediate_size 6144 6144 ✅
num_hidden_layers 28 28 ✅
num_attention_heads 16 16 ✅
num_key_value_heads 8 8 ✅
Five for five. This means we can do a pure lerp
— no SVD compression, no dimension truncation, no layer mapping tricks. Just:
for n, p in tts_model.named_parameters():
if "talker" in n and "gate_proj" in n:
llm_weight = llm_ffn[n.replace("talker.", "")]
p.lerp_(llm_weight, alpha=0.03) # That's it.
84 FFN tensors (gate_proj + up_proj + down_proj × 28 layers), blended in under 10 seconds.
What We Tried Before This Worked
Science is about what fails as much as what succeeds. Here's our full timeline from April 15, 2026:
Attempt 1: TADA-1B (English emotion TTS) × Qwen3-TTS
- TADA uses Llama backbone, Qwen3-TTS uses Qwen3 backbone
- Different intermediate_size (8192 vs 6144)
- Result: Complete failure. Garbled noise at every blend ratio.
- Lesson: Same backbone architecture is non-negotiable.
Attempt 2: Same backbone, 100% FFN replacement
- Replaced all talker FFN weights with LLM weights
- Result: Buzzing noise. The model lost its speech generation ability entirely.
- Lesson: TTS models are far more sensitive than LLMs to weight perturbation.
Attempt 3: SLERP blending at 10/20/30%
- Spherical interpolation with TADA weights
- Result: Still broken. Cross-backbone + high ratio = double failure.
Attempt 4: Qwen3 LLM × Qwen3 TTS at 10%
- Same backbone, moderate ratio
- Result: 655-second output for a 3-second sentence. The LLM's "keep generating" pattern overwhelmed the TTS stop signal.
- Lesson: 10% is the collapse threshold for cross-modal transfer.
Attempt 5: Qwen3 LLM × Qwen3 TTS at 1/3/5% ✅
- Same backbone, very low ratios
- Result:
- 1% — No perceptible difference
- 3% — Emotion appears in Korean sentences
- 5% — Emotion intensifies further
- This is Darwin-TTS-1.7B-Cross.
Why Does 3% Work?
We don't have a definitive answer yet, but here's our hypothesis:
Qwen3-TTS's talker was initialized from Qwen3 weights and then fine-tuned for speech token prediction. During this fine-tuning, the FFN weights shifted away from "general language understanding" toward "speech code prediction."
By blending back 3% of the original LLM weights, we're partially restoring the language understanding patterns that were lost during TTS fine-tuning — particularly the patterns related to emotional semantics, emphasis, and prosody planning.
Think of it as giving the TTS model a faint memory of what words feel like, not just what they sound like.
The GPT-4o Connection
This experiment opens a fascinating bidirectional door:
Direction A (this work): LLM FFN → TTS talker = Emotionally smarter TTS
Direction B (next): TTS FFN → LLM = "Speaking" LLM
GPT-4o and Gemini achieve multimodal speech by training end-to-end with massive compute budgets. Darwin suggests a lightweight alternative: blend cross-modal weights at low ratios to transfer capabilities between modalities.
We're not claiming this replaces end-to-end training. But as a zero-cost, zero-data technique that takes 10 seconds to apply? It's a promising research direction.
How Qwen3-TTS Actually Works (and Where We Intervene)
Qwen3-TTS-1.7B has 4 modules:
┌────────────────────────────────────┐
│ talker (28-layer Qwen3 LM) │ ← We modify FFN here (3%)
│ "Understands text, plans speech" │
├────────────────────────────────────┤
│ code_predictor (5-layer) │ ← Untouched
│ "Converts LM output to codes" │
├────────────────────────────────────┤
│ speech_tokenizer (12Hz RVQ) │ ← Untouched
│ "Audio codec vocabulary" │
├────────────────────────────────────┤
│ encoder/decoder │ ← Untouched
│ "Waveform generation" │
└────────────────────────────────────┘
The key insight: only the talker is an LLM. The other three modules are audio-specific. By modifying only the talker's FFN and leaving everything else intact, we change how the model understands text without changing how it produces sound.
Quick Start
# Option 1: Pre-blended model (recommended)
from qwen_tts import Qwen3TTSModel
model = Qwen3TTSModel.from_pretrained(
"FINAL-Bench/Darwin-TTS-1.7B-Cross",
device_map="cuda:0", dtype=torch.bfloat16
)
wavs, sr = model.generate_voice_clone(
text="정말 기쁜 소식이에요!",
ref_audio="voice.wav", ref_text="ref",
x_vector_only_mode=True
)
# Option 2: Custom blend ratio
from darwin_tts_blend import blend_tts
model = blend_tts(alpha=0.05) # Try 1%, 3%, or 5%
Prior Art: Where This Fits
| Method | Training? | Cross-Modal? | Year |
|---|---|---|---|
| LLM merging (TIES, DARE, SLERP) | No | No (LLM×LLM) | 2023-2026 |
| TTS averaging (Murata et al.) | No | No (TTS×TTS) | 2024 |
| SmolTolk (adapter-based) | Yes | Yes | 2025 |
| CSLM (fine-tuning) | Yes | Yes | 2025 |
| GPT-4o (end-to-end) | Yes ($$$) | Yes | 2024 |
| Darwin-TTS (this work) | No | Yes | 2026 |
To our knowledge, this is the first public demonstration of training-free cross-modal weight transfer between an LLM and a TTS model.
The Darwin Framework
Darwin-TTS is part of the Darwin Evolutionary Merge Framework, originally developed for LLM merging. The framework has produced:
- Darwin LLM V7: GPQA Diamond 86.9% (World #5), surpassing the parent model through CMA-ES optimized FFN crossbreeding
- Darwin-4B-David: Cross-family breeding (Gemma4 × Qwen3.5) showing hybrid vigor
- Darwin-TTS-1.7B-Cross: First extension beyond LLMs into speech modality
The core principle: find models with compatible hidden dimensions, blend their FFN weights at optimized ratios, and preserve modality-specific components. This principle appears to generalize across modalities — we've identified compatible hidden_size groups spanning LLM, TTS, image generation, and video generation models.
What's Next
- Bidirectional experiment: LLM + TTS FFN → Can an LLM learn to "think in speech"?
- CMA-ES optimization: Automated search for optimal per-layer blend ratios (like Darwin LLM V7)
- Darwin-Video: Same principle applied to video generation models (HunyuanVideo × CogVideoX, both h=3072)
- Quantitative evaluation: WER + MOS + emotion classification scores
Limitations
- Emotion enhancement is subtle and subjective — we haven't yet quantified it with emotion classification models
- The 3~5% sweet spot was found empirically, not theoretically derived
- Only tested with Qwen3 family; generalization to other TTS architectures is unverified
- Voice cloning quality depends heavily on reference audio quality
Try It
📦 Model: FINAL-Bench/Darwin-TTS-1.7B-Cross
📦 Space: FINAL-Bench/Darwin-TTS-1.7B-Cross
Built by VIDRAFT (비드래프트) Apache 2.0. Use it, break it, improve it.
This research was conducted on April 15, 2026, using 1× H100 GPU for inference only. Total compute cost for the entire research: approximately $5 worth of electricity. The model merging itself requires only CPU and takes under 2 minutes.