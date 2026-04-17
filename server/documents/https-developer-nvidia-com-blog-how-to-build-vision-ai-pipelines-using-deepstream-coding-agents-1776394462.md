Developing real-time vision AI applications presents a significant challenge for developers, often demanding intricate data pipelines, countless lines of code, and lengthy development cycles.
NVIDIA DeepStream 9 removes these development barriers using coding agents, such as Claude Code or Cursor, to help you easily create deployable, optimized code that brings your vision AI applications to life faster.
This new approach simplifies the process of building complex multi-camera pipelines that ingest, process, and analyze massive volumes of real-time video, audio, and sensor data. Built on GStreamer and part of the NVIDIA Metropolis vision AI development platform, DeepStream accelerates a developer’s journey from concept to actionable insight across industries.
Video 1. How to use the NVIDIA DeepStream coding agents to generate complete vision AI pipelines from natural language prompts with Claude Code.
To watch a recording showing how to build a DeepStream vision AI pipeline using Claude Code or Cursor, click here.
Using NVIDIA Cosmos Reason 2 to build a video analytics app
It is possible to build a video analytics app that concurrently ingests hundreds of camera streams and analyzes the streams with a vision language model (VMA) using NVIDIA Cosmos Reason 2, the most accurate, open, reasoning VLM for physical AI.
The application scales dynamically with no wasted redeployment time to add cameras or swap models and no guessing at bottlenecks. The coding agent understands your hardware and generates an application optimized for it.
With just a few lines, a prompt can generate a complete production-grade microservice with REST APIs, health monitoring, deployment automation, and Kafka integration — all in one development session.
How to generate a VLM-powered vision AI application:
Step 1: Install the DeepStream Coding Agent skill for Claude Code or Cursor. You can generate code anywhere, but deployment requires the minimum hardware, listed on GitHub.
Step 2: Paste the prompt below into your agent to generate a scalable VLM pipeline with dynamic N stream ingestion and per-stream batching.
Implement a Python application that uses a multi-modal VLM to summarize video frames and sends summaries to a remote server via Kafka.
Architecture:
1. DeepStream Pipeline: Use DeepStream pyservicemaker APIs to receive N RTSP
streams, decode video, and convert frames to RGB format. Process each stream
independently — do not mux streams together.
2. Frame Sampling & Batching: Use MediaExtractor to sample frames at a
configurable interval (e.g. 1 frame every 10 seconds). When the VLM supports
multi-frame input, batch sampled frames over a configurable duration (e.g.
1 minute) before sending to the model. Each batch must contain frames from a
single stream only.
3. VLM Backend: Implement a module that receives a batch of decoded video frames
and returns a text summary from the multi-modal VLM.
4. Kafka Output: Send each text summary to a remote server using Kafka.
Constraints:
- Scalable to hundreds of RTSP streams across multiple GPUs on a single node.
Distribute processing load across all available GPUs.
- Never mix frames from different RTSP streams in a single batch.
Store output in the rtvi_app directory.
Also generate a README.md with instructions to setup kafka server, vLLM, and
how to run the application.
You can customize parameters such as the frame sampling interval (for example,, 1 frame every 10 seconds; Cosmos-Reason2-8B doesn’t impose a fixed frame limit, it uses a large context window (up to 256K tokens) and samples frames dynamically based on fps and resolution.
Step 3: Now that you have a working application, let’s make it deployment-ready.
With one more prompt, you can convert it into a full production microservice, complete with representational state transfer (REST) APIs to dynamically manage streams, health probes for orchestration, metrics for observability, a Dockerfile for containerization, and deployment scripts to get it running in minutes:
Need to create microservice for the app in @rtvi_app directory. Follow the
steps below to complete that.
- Create FastAPI based server and implement the endpoints mentioned in the
attached image @rtvi_vlm_openapi_spec.png.
- Create dockerfile to package the everything together which can later be used
to generate docker image.
- Create deployment guide to run the microservice.
IMPORTANT
- Need to generate production ready code and don't create dummy implementation for any of the endpoint.
- Update the code in @rtvi_app if it is required for having the working
implementation of the endpoints.
Step 4: The generated code will have the deployment scripts and access APIs via Swagger UI at http://localhost:8080/docs or curl
. You can expect a page similar to this page on GitHub.
Generating an efficient realtime CV application using any model
Now let’s take it further. Say you want to build a real-time application using an open-source model like YOLOv26. To plug any model into DeepStream, you need to know three things:
- Input tensor — shape and scaling (e.g.,
[batch, 3, 640, 640],
normalize pixels)
- Output tensor — name and shape of the output tensor(e.g.,
[batch, 300, 6] where each row is [x1, y1, x2, y2, conf, class_id]
) - Postprocessing — any operations needed to extract the final detections from raw model output, for example, is the non-maximum suppression (NMS) built within the model, or it’s needed as a postprocessing step after the final layer of the model.
You can get these from a model card, or use any model visualization/inspection tool such as Netron, VisualDL, Zetane, or simply run onnx.load()
and print the graph’s input/output shapes. Or skip all of that and feed the model file directly to the coding agent — it will inspect the model for you and will pull the right libs needed for model inspection.
Think of it this way: You bring a custom model to DeepStream’s hardware-optimized video analytics pipeline. You introduce the model — its input shape, output format — and DeepStream takes care of the rest; efficient buffer management that fully utilizes GPU decode, compute, and downstream processing to deliver the best latency your hardware can achieve.
The steps to generate a YOLOv26 detection app with the DeepStream coding agent are:
Step 1: Make sure you have the DeepStream Coding Agent skill installed and the minimum hardware for deployment. Install the DeepStream Coding Agent skill for Claude Code or Cursor. You can generate code anywhere, but deployment requires the minimum hardware, listed on GitHub.
Step 2: Paste this prompt into your agent:
Download the YOLO26s detection model using the ultralytics library, then convert the model to ONNX model that supports dynamic batch, in a Python virtual environment. Write a DeepStream custom parsing library for the model. Use DeepStream SDK pyservicemaker APIs to develop the python application that can do the following.
- Read from file, decode the video and infer using the model.
- The custom parsing library is used in nvinfer's configuration file.
- Display the bounding box around detected objects using OSD.
Save the generated code in yolo_detection directory.
The app should support RTSP streams as input.
Step 3: The agent generates a complete application with multiple files — model download scripts, the pipeline app, inference config file, and more.
Let’s focus on the files that matter for model integration: the inference config file. Here’s exactly where the three things you need to know (input tensor, output tensor, and postprocessing) show up in the inference config file:
Input tensor: This tells DeepStream how to preprocess the upstream GPU buffer — resize to 640×640 and scale pixel values by 1/255 — and feed it to TensorRT. The ONNX file is automatically converted to a TensorRT engine on first run, optimized for your exact GPU and batch size.
The inference config will have:
infer-dims=3;640;640
net-scale-factor=1/255
onnx-file=yolo26s.onnx
Output tensor and Post-Processing: The agent generates an NvDsInferParseCustomYolo
function that reads the output blob named example: output0
in yolo26s
— a [300, 6]
tensor where each row is [x1, y1, x2, y2, conf, class_id]
— and converts each detection into an NvDsInferObjectDetectionInfo
struct
.
extern "C" bool NvDsInferParseCustomYolo(
std::vector<NvDsInferLayerInfo> const &outputLayersInfo,
...
std::vector<NvDsInferObjectDetectionInfo> &objectList)
{
// Find output layer "output0" → [300, 6]
...
const float *det = data + i * 6;
// [x1, y1, x2, y2, conf, class_id]
obj.classId = static_cast<unsigned int>(det[5]);
obj.detectionConfidence = det[4];
obj.left = det[0]; obj.top = det[1];
obj.width = det[2] - det[0]; obj.height = det[3] - det[1];
...
objectList.push_back(obj);
}
This is what populates the ObjectMeta in the downstream NvDsBatchMeta. The inference config will have:
custom-lib-path=nvdsinfer_custom_impl_yolo/libnvdsinfer_custom_impl_yolo.so
parse-bbox-func-name=NvDsInferParseCustomYolo
output-blob-names=output0
Step 4: To convert this into a production microservice — just like the VLM app example above (step 3) — use a similar prompt to add FastAPI endpoints for stream management, health probes, metrics, a Dockerfile, and deployment scripts
Step 5: Deploy with the generated scripts and access APIs via Swagger UI at http://localhost:8080/docs or curl
.
These two applications are just the beginning. The same skills can generate any DeepStream pipeline — from multi-camera tracking to audio analytics to custom inference chains.
Check out more example prompts in the repository. Use these as a reference to write your own prompts for any vision AI application you can imagine:
- Multi-stream tracking with 4 RTSP cameras and tiled display
- Analytics — ROI filtering, line-crossing, overcrowding, and direction detection
- Video file inference with bounding box display
- Video inference with per-class object counting
- YOLOv26s detection with custom ONNX export and parser
- Multi-stream VLM video summarization with Kafka
- FastAPI microservice wrapper with Dockerfile and deployment
Redefining vision AI development
DeepStream accelerates vision AI development with agentic workflows, reducing coding time to hours from weeks. Using natural language prompts, developers can instantly plug in models, configure camera streams, and deploy analytics applications. Optimized for NVIDIA hardware, DeepStream delivers more streams and analytics per dollar than generic pipelines, maximizing performance from edge to cloud.
Getting started
Download the latest SDK on NGC for Jetson, data center GPUs, or the cloud to get started with DeepStream.