Run Gemma 4 on Intel® Arc™ GPUs Out-Of-the-Box
Intel’s upstreaming first strategy on open-source AI frameworks like PyTorch
, Hugging Face transformers
, vLLM
and SGLang
builds a solid foundation for a day-0 experience on Intel® Xe GPUs. For years, Intel has been working closely with the open-source community on kernel optimizations and feature enabling. Here are the key features of Gemma 4 and how they are supported on Intel hardware:
Attention: Gemma 4 uses 2 variants of attention in different layers: sliding attention and full attention. On Intel® Xe GPUs,
vLLM
attention kernels inTriton
work out-of-box, and flash attention kernels optimized with Intel SYCL*TLA provide additional performance boost. For Hugging Facetransformers
, both variants are supported throughPyTorch
kernels out-of-the-box.Gemma4MoE: The MoE path leverages a highly optimized
FusedMoE
backend. Intel upstreamed optimizedFusedMoE
kernels for Intel Xe GPU invLLM
and Hugging Facetransformers
, so MoE layers can work out-of-the box.Vision Tower and Audio Tower: These are transformer models running on Hugging Face
transformers
as of now. With solid Hugging Facetransformers
support, these 2 towers are enabled on Intel® Xe GPUs.
Table of Contents
Getting started with vLLM
1. Environment Setup
Build Docker Images with latest vLLM main branch
Please make sure PR #38826 is merged when check out the vLLM.
$ git clone https://github.com/vllm-project/vllm.git
$ cd vllm
$ docker build -f docker/Dockerfile.xpu -t vllm-xpu-env --shm-size=4g .
Launch vLLM container
$ docker run -it \
--rm \
--network=host \
--device /dev/dri:/dev/dri \
-v /dev/dri/by-path:/dev/dri/by-path \
--ipc=host \
--privileged \
--entrypoint bash \
vllm-xpu-env
Install latest transformers main branch in container
uv pip uninstall transformers
uv pip install git+https://github.com/huggingface/transformers
2. Run
The following command lines are for demonstration purposes. You can try different model parallelism configurations per your requirements and Intel GPU type. We validated below configurations on Intel Arc® Pro B60:
gemma-4-E2B-it
on single cardgemma-4-E4B-it
on single cardgemma-4-31B-it
with tensor parallelism on 4 cardsgemma-4-26B-A4B-it
with tensor parallelism on 4 cards
Launch OpenAI-Compatible vLLM Server
vLLM provides an HTTP server that implements OpenAI's Completions API, Chat API, and more. This functionality lets you serve models and interact with them using an HTTP client.
You can use vllm serve
command to launch server with tensor parallelism.
$ vllm serve $<MODEL_PATH> --tensor-parallel-size $<TP_SIZE> --enforce-eager --attention-backend TRITON_ATTN
Text Generation
$ curl -X POST "http://localhost:8000/v1/chat/completions" \
-H "Content-Type: application/json" \
--data '{
"model": "$<MODEL_PATH>",
"messages": [
{
"role": "user",
"content": [
{
"type": "text",
"text": "How are you?"
}
]
}
]
}'
Image Captioning
$ curl -X POST "http://localhost:8000/v1/chat/completions" \
-H "Content-Type: application/json" \
--data '{
"model": "$<MODEL_PATH>",
"messages": [
{
"role": "user",
"content": [
{
"type": "text",
"text": "Describe this image in one sentence."
},
{
"type": "image_url",
"image_url": {
"url": "$<IMAGE_ADDRESS>"
}
}
]
}
]
}'
Audio Captioning
$ curl -X POST "http://localhost:8000/v1/chat/completions" \
-H "Content-Type: application/json" \
--data '{
"model": "$<MODEL_PATH>",
"messages": [
{
"role": "user",
"content": [
{
"type": "text",
"text": "Describe this audio in one sentence."
},
{
"type": "audio_url",
"audio_url": {
"url": "$<AUDIO_ADDRESS>"
}
}
]
}
]
}'
Getting started with Hugging Face Transformers
1. Environment Setup
Install latest transformers main branch
$ uv venv .my-env
$ source .my-env/bin/activate
$ git clone https://github.com/huggingface/transformers.git
$ cd transformers
$ uv pip install '.[torch]'
# install XPU PyTorch
$ uv pip install torch torchvision torchaudio torchao --index-url https://download.pytorch.org/whl/xpu --no-cache-dir
2. Run
The following command lines are for demonstration purposes. You can try different model parallelism configurations per your requirements and Intel GPU type. We validated below configurations on Intel Arc® Pro B60:
gemma-4-E2B-it
on single cardgemma-4-E4B-it
on single cardgemma-4-31B-it
with tensor parallelism on 4 cardsgemma-4-26B-A4B-it
with tensor parallelism on 2 cards
We use below test.py
python script to run text generation, image captioning and audio captioning tasks.
import os
import argparse
import torch
from transformers import AutoModelForCausalLM, AutoProcessor, AutoModelForImageTextToText
import torch.distributed as dist
def parse_args():
parser = argparse.ArgumentParser()
parser.add_argument("--model-id")
parser.add_argument("--task", choices=["text", "image", "audio"], default="text")
parser.add_argument("--dtype", default="bfloat16")
parser.add_argument("--device", default="xpu")
parser.add_argument("--max-new-tokens", type=int, default=1024)
parser.add_argument("--tp", action="store_true", help="Enable tensor parallel loading with tp_plan=auto")
parser.add_argument("--tp-size", type=int, default=None, help="Optional TP degree, defaults to WORLD_SIZE")
return parser.parse_args()
def get_dtype(dtype_name):
return getattr(torch, dtype_name.removeprefix("torch."))
def get_rank():
return int(os.environ.get("RANK", "0"))
def run_text_generation(model_id, dtype, device_str, max_new_tokens=1024, use_tp=False, tp_size=None):
load_kwargs = {
"dtype": dtype,
}
if use_tp:
load_kwargs["tp_plan"] = "auto"
if tp_size is not None:
load_kwargs["tp_size"] = tp_size
model = AutoModelForCausalLM.from_pretrained(model_id, **load_kwargs)
if not use_tp:
model = model.to(device_str)
model = model.eval()
messages = [
{"role": "user", "content": "hi, how is the weather today?"},
]
processor = AutoProcessor.from_pretrained(model_id, use_fast=False)
text = processor.apply_chat_template(
messages,
tokenize=False,
add_generation_prompt=True,
)
inputs = processor(text=text, return_tensors='pt').to(model.device)
with torch.no_grad():
outputs = model.generate(**inputs, max_new_tokens=max_new_tokens)
if get_rank() == 0:
generated_text = processor.batch_decode(outputs, skip_special_tokens=True)[0]
print(generated_text)
def run_text_image_generation(model_id, dtype, device_str, max_new_tokens=1024, use_tp=False, tp_size=None):
from PIL import Image
import requests
from io import BytesIO
load_kwargs = {
"dtype": dtype,
}
if use_tp:
load_kwargs["tp_plan"] = "auto"
if tp_size is not None:
load_kwargs["tp_size"] = tp_size
model = AutoModelForImageTextToText.from_pretrained(model_id, **load_kwargs)
if not use_tp:
model = model.to(device_str)
model = model.eval()
messages = [
{
"role": "user",
"content": [
{"type": "image"},
{"type": "text", "text": "Describe this image in one sentence."},
],
},
]
url = "http://images.cocodataset.org/val2017/000000077595.jpg"
image = Image.open(requests.get(url, stream=True).raw).convert("RGB")
processor = AutoProcessor.from_pretrained(model_id, use_fast=False)
text = processor.apply_chat_template(
messages,
tokenize=False,
add_generation_prompt=True,
)
inputs = processor(text=text, images=image, return_tensors='pt').to(model.device)
with torch.no_grad():
outputs = model.generate(**inputs, max_new_tokens=max_new_tokens)
if get_rank() == 0:
generated_text = processor.batch_decode(outputs, skip_special_tokens=True)[0]
print(generated_text)
def run_text_audio_generation(model_id, dtype, device_str, max_new_tokens=1024, use_tp=False, tp_size=None):
from io import BytesIO
from urllib.request import urlopen
import librosa
load_kwargs = {
"dtype": dtype,
}
if use_tp:
load_kwargs["tp_plan"] = "auto"
if tp_size is not None:
load_kwargs["tp_size"] = tp_size
model = AutoModelForCausalLM.from_pretrained(model_id, **load_kwargs)
if not use_tp:
model = model.to(device_str)
model = model.eval()
messages = [
{
"role": "user",
"content": [
{"type": "audio", "audio_url": "https://huggingface.co/datasets/eustlb/audio-samples/resolve/31a30e5cd27b5f87f2f5a9c2a9fae33d1ae1b29d/mary_had_lamb.mp3"},
{"type": "text", "text": "Describe this audio in one sentence."},
],
},
]
processor = AutoProcessor.from_pretrained(model_id, use_fast=False)
text = processor.apply_chat_template(
messages,
tokenize=False,
add_generation_prompt=True,
)
audio_url = messages[0]["content"][0]["audio_url"]
audio, sampling_rate = librosa.load(BytesIO(urlopen(audio_url).read()), sr=processor.feature_extractor.sampling_rate)
inputs = processor(text=text, audio=audio, sampling_rate=sampling_rate, return_tensors="pt")
inputs = inputs.to(model.device)
with torch.no_grad():
outputs = model.generate(**inputs, max_new_tokens=max_new_tokens)
if get_rank() == 0:
generated_ids = outputs[:, inputs.input_ids.shape[1] :]
generated_text = processor.batch_decode(generated_ids, skip_special_tokens=True, clean_up_tokenization_spaces=False)[0]
print(generated_text)
def main():
args = parse_args()
dtype = get_dtype(args.dtype)
runners = {
"text": run_text_generation,
"image": run_text_image_generation,
"audio": run_text_audio_generation,
}
runners[args.task](
args.model_id,
dtype,
args.device,
max_new_tokens=args.max_new_tokens,
use_tp=args.tp,
tp_size=args.tp_size,
)
if dist.is_available() and dist.is_initialized() and dist.get_world_size() > 1:
dist.barrier()
if __name__ == "__main__":
main()
For small models like gemma-4-E2B-it
and gemma-4-E4B-it
which can fit in single card, you can just run it with
$ python test.py --model-id <MODEL_PATH> --task <pick one from text, image, audio>
For large model like gemma-4-31B-it
and gemma-4-26B-A4B-it
, you can easily use tensor parallelism by specifying --tp
and proper --tp-size
in your command to leverage multiple cards. For example, we use --tp-size 2
in 2-card configuration:
$ torchrun --nproc-per-node 2 test.py --model-id <MODEL_PATH> --task <pick one from text, image, audio> --tp --tp-size 2
Take a try!