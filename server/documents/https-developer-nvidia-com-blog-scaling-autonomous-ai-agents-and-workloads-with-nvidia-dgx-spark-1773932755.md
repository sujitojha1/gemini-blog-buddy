Autonomous AI agents are driving the next wave of AI innovation. These agents must often manage long-running tasks that use multiple communication channels and background subprocesses simultaneously to explore options, test solutions, and generate optimal results. This places extreme demands on local compute.
NVIDIA DGX Spark provides the performance necessary for autonomous agents to execute these complex workflows efficiently and locally. Now with NVIDIA NemoClaw, part of the NVIDIA Agent Toolkit, it installs the NVIDIA OpenShell runtime—a secure environment for running autonomous agents, and open source models like NVIDIA Nemotron.
This post discusses several important aspects of system capabilities and performance that are necessary to power always-on autonomous agents and explains why NVIDIA DGX Spark is an ideal desktop platform for autonomous AI.
Inference for autonomous AI agents
Agentic tools often need to process massive context windows. OpenClaw, for example, is an AI agent runtime that requires these large context windows to comprehend requests and environments, and to think through the best approach to a problem.
Prompt processing (prefill) throughput can be thought of as the reading comprehension phase of inference and can easily become a bottleneck with a slow GPU. It’s common to see autonomous agents easily using contexts of 30K-120K tokens (100K tokens is equivalent to reading Harry Potter and the Philosopher’s Stone), with some agents processing 250K tokens for complex requests.
Table 1 shows how a potential agent or subagent performs with a large context window, (128K/1K of ISL/OSL).
| Model | End-to-end latency (s) | Prompt processing latency (s) | Prompt processing throughput (tok/s) | Token generation throughput (tok/s) |
| NVIDIA Nemotron 3 Super 120B NVFP4 with TensorRT LLM | 99 | 44 | 2,855 | 18 |
| Qwen3.5 35B A3B FP8 with vLLM | 73 | 41 | 3,080 | 35.75 |
| Qwen3 Coder Next 80B FP8 with vLLM | 89 | 54 | 2,390 | 28.95 |
When moving from a single subagent to multiple subagents, simultaneous workloads must scale without impacting performance significantly. NVIDIA DGX Spark effectively handles high concurrency in this scenario.
Thanks to the power of the NVIDIA Grace Blackwell Superchip, the GPU can parallelize multiple subagents. Two, four, or even eight subagents concurrently working through requests can make use of the strong concurrency capabilities in DGX Spark.
With support from frameworks that handle concurrency well (such as NVIDIA TensorRT LLM, vLLM, and SGLang), multiagent workloads run smoothly on NVIDIA DGX Spark. For tasks with 32K ISL of 1K OSL, completing four times as many tasks requires only 2.6x more time, while prompt processing throughput increases by about 3x (Table 2).
NVIDIA DGX Spark is an ideal platform for OpenClaw development. With NVIDIA OpenShell, you can run autonomous, self-evolving agents more safely. Get started running OpenClaw locally on NVIDIA DGX Spark.
| Concurrency (# of simultaneous tasks) | End-to-end latency (s) | Median TTFT (s) | Prompt processing throughput (tok/s) | Token generation throughput (tok/s) |
| Lower is better | Higher is better | |||
| 1 | 35 | 9 | 3,261 | 38 |
| 2 | 54 | 12 | 5,363 | 47 |
| 4 | 91 | 15 | 9,616 | 53 |
Scale inference and fine-tuning on up to four NVIDIA DGX Spark nodes
Larger models and multiple subagents require more memory to load and execute. Until now, NVIDIA DGX Spark has supported scaling up to two nodes, increasing the available memory from 128 GB on one node to 256 GB on two nodes. This capability has now been increased to up to four DGX Spark nodes.
DGX Spark also now supports several execution topologies, each tailored to different goals through the low latency of RoCE communication enabled by ConnectX-7 NICs.
- One DGX Spark node: Ideal for low latency, large context size inference, fine-tuning up to 120B parameters, and local agentic workloads
- Two DGX Spark nodes: Balanced scaling for faster fine-tuning and larger models, as well as support for up to 400B-parameter inference
- Three DGX Spark nodes in a ring: Ideal for fine-tuning larger models or small training jobs
- Four DGX Spark nodes with RoCE 200 GbE switch: Local inference server ideal for state-of-the-art models up to 700B parameters, communication intensive workloads, and local AI factory operations
Inference can scale up linearly on DGX Spark when internode communication is minimal. When work is largely independent per GPU, the results are aggregated once at the end rather than continuously. In this case, DGX Spark nodes can run in parallel with low synchronization overhead.
For example, a reinforcement learning (RL) workload in NVIDIA Isaac Lab can run many simulations independently on each node. Results are collected in a single step, yielding near-linear scaling across multiple DGX Spark nodes.
Inference scaling is less than linear when the workload requires frequent, fine-grained communication between nodes. During LLM inference, model execution occurs layer by layer, with continuous synchronization required across nodes. Partial results from different DGX Spark nodes must be exchanged and merged repeatedly, which introduces significant communication overhead. As additional nodes are added, this overhead becomes increasingly dominant, limiting scaling efficiency.
Parallelism for AI agents: Inference at scale
Tensor parallelism enables efficient inference sharing across multiple nodes to fit the model while minimizing communication overhead. Scaling from two to four DGX Spark nodes provides excellent parallelism capabilities. This is thanks to the low-latency ConnectX-7 NICs, scaling in time per output token (TPOT) almost linearly with ~2x with TP2 (two nodes) and ~4x with TP4 (4 nodes) in inference use cases.
Table 3 shows how a single agent performs an inference job shared across multiple nodes.
| 1 DGX Spark node TP1 (ms) | 2 DGX Spark nodes TP2 (ms) | 4 DGX Spark nodes TP4 (ms) | |
| TTFT (lower is better) | 33,415 | 21,384 | 15,552 |
| TPOT (lower is better) | 269 | 133 | 72 |
Several models that are popular in the context of OpenClaw—including Qwen3.5 397B, GLM 5, and MiniMax M2.5 230B—can benefit from stacking multiple DGX Spark units, increasing the available memory.
Near-linear fine-tuning
Fine-tuning and similar workloads can be significantly parallelized with close-to-linear performance scaling when the model instance can fit on one GPU. This reduces the communication overhead to only gradient synchronization at the end of each step.
An RL workload in NVIDIA Isaac Lab or Nanochat can benefit from this performance scaling. Isaac Lab can accommodate several copies of each environment on each DGX Spark. For each step, Isaac Lab communicates to the other nodes to synchronize the training, achieving linear speedup through clustering.
| 1 DGX Spark node TP1 | 2 DGX Spark nodes TP2 | 4 DGX Spark nodes TP4 | |
| Collection time | 12.1 s | 11.4 s | 10.4 s |
| Learning time | 40.9 s | 41.4 s | 42.3 s |
| # environments | 1,024 | 1,024 | 1,024 |
| FPS | 630 | 1241 | 2,520 |
| HW configuration | Total token throughput (tok/s) | Speedup versus 1 DGX Spark node |
| 1 DGX Spark node | ~18,400 | 1 |
| 2 DGX Spark nodes | ~35,900 | 2 |
| 4 DGX Spark nodes | ~74,600 | 4 |
When using distributed data parallel (DDP), fine-tuning can similarly benefit from the low communication overhead. In this case, each node can fully host a copy of the model and communicate with the other nodes once per step.
| Nodes | Samples/step | Batch size | Samples/s | Speedup |
| 1 DGX Spark node | 15.73 | 32 | 2.03 | – |
| 3 DGX Spark nodes | 15.69 | 96 | 6.12 | 3x |
Develop on DGX Spark, deploy to the cloud: Cross-architecture workflows
Cloud solutions are required when moving from prototyping to large-scale production deployment. This section explains how workloads developed on DGX Spark can be deployed in the cloud.
Tile IR and cuTile Python enable seamless kernel portability from DGX Spark development environments to cloud deployment on NVIDIA Blackwell data center GPUs, with minimal code changes. Using TileGym, developers can:
- Write kernels once using cuTile Python DSL
- Test and validate on DGX Spark
- Deploy to NVIDIA Blackwell B300/B200, NVIDIA Hopper, or NVIDIA Ampere with minimal code changes
- Leverage TileGym preoptimized transformer kernels as drop-in replacements
End-to-end inference performance
Beyond kernel-level analysis, we benchmarked complete Qwen2 7B inference using cuTile kernels on both platforms to demonstrate cross-architecture performance portability. Table 7 shows the configuration; Table 8 shows the platform specification.
| Parameter | Value |
| Model | Qwen2 7B |
| Input length | 2,189 tokens |
| Output length | 128 tokens |
| Batch sizes | 1, 2, 4, 8, 16, 32, 64, 128 |
| Specification | NVIDIA DGX Spark (Dev) | NVIDIA Blackwell B200 (Cloud) |
| Compute capability | SM 12.1 | SM 10.0 |
| SM count | 48 | 148 |
| SM frequency | 2.14 GHz | ~1.0 GHz |
| Memory type | LPDDR5X (Unified) | HBM3e |
| Memory bandwidth | 273 GB/s | ~8 TB/s |
Platform-specific configuration
While the kernel source code remains identical across platforms, optimal performance is achieved through platform-specific configurations (Tile and Occupancy). For the FMHA kernel example, Table 9 shows how these configurations adapt to different hardware characteristics. Tile IR compiles to architecture-specific PTX/SASS at JIT, automatically leveraging platform-specific features like Tensor Memory Accelerator (TMA) using the appropriate configuration.
| Platform | TILE_M | TILE_N | Occupancy | Rationale |
| NVIDIA DGX Spark (SM 12.1) | 64 | 64 | 2 | Smaller tiles 48 SMs, unified memory |
| NVIDIA B200 (SM 10.0) | 256 | 128 | 1 | Large tiles maximize HBM3e throughput |
| NVIDIA B200 (alt) | 128 | 128 | 2 | Higher occupancy, balanced parallelism |
Roofline analysis and comparison of Tile IR kernel performance
Roofline analysis in NVIDIA Nsight Compute is a powerful visual performance framework used to determine how well an application is utilizing hardware capabilities. As a developer, roofline analysis helps you figure out whether your code is “slow” and shows why it may be hitting a performance ceiling.
Analysis of the roofline model suggests that the kernel scales effectively relative to the respective roofline, demonstrating that Tile IR is a viable option to scale workloads. The kernel considered is the attention decode kernel and the kernel is optimized using Tile IR.
Performance scaling and optimization headroom
In Figure 1, the vertical positioning of the data points on the y-axis confirms that the kernel achieves higher hardware utilization on NVIDIA B200. Specifically, the vertical proximity of the blue dot to the NVIDIA B200 GPU memory roofline is greater than that of the green dot to the Spark roofline.
This roofline analysis indicates additional opportunities for optimization, and that algorithmic or memory optimizations of NVIDIA DGX Spark will also benefit NVIDIA B200 GPUs.
Cache utilization and arithmetic intensity
Analysis of the x-axis reveals that the blue dot is positioned to the right of the green dot, signifying that the B200 achieves superior Hardware Arithmetic Intensity.
- Cache efficiency: While the larger cache capacity of NVIDIA B200 GPU provides the theoretical foundation for reducing DRAM traffic, hardware alone is insufficient. The software must be architected to exploit these resources.
- Kernel portability: The rightward shift indicates that Tile IR kernels successfully leverage the NVIDIA B200 expanded cache hierarchy on migration.
Future Tile IR kernel optimizations aimed at increasing arithmetic intensity on Spark—moving the data point further right along the x-axis—will inherently result in compounded performance benefits when running on various cloud GPUs.
Automated cross-platform autotuning
Currently, optimal configurations are selected based on platform characteristics. Future releases of cuTile will support fully automated cross-platform autotuning. The autotuner will discover optimal tile sizes and occupancy settings for each target architecture automatically, enabling transparent performance portability without any manual configuration.
Get started with NVIDIA DGX Spark
As AI systems become more sophisticated, NVIDIA DGX Spark provides the flexible, multitopology execution environment required to deploy them efficiently. From multiagent inference to trillion-parameter serving, from fine-tuning to Tile IR cross-cloud pipelines, DGX Spark delivers both scalability and efficiency.
The result is a unified platform where enterprises can deploy and scale AI workloads—without rewriting infrastructure for every model or runtime.