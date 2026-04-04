In vision AI systems, model throughput continues to improve. The surrounding pipeline stages must keep pace, including decode, preprocessing, and GPU scheduling. In the previous post, Build High-Performance Vision AI Pipelines with NVIDIA CUDA-Accelerated VC-6, this was described as the data-to-tensor gap—a performance mismatch between AI pipeline stages.
The SMPTE VC-6 (ST 2117-1) codec addresses this gap through a hierarchical, tile-based architecture. Images are encoded as progressively refinable Levels of Quality (LoQs), each adding incremental detail. This enables selective retrieval and decoding of only the required resolution, region of interest, or color plane, with random access to independently decodable frames. Pipelines can retrieve and decode only what the model needs.
However, efficient single-image execution does not automatically translate to efficient scaling. As batch sizes grow, the bottleneck shifts from single-image kernel efficiency to workload orchestration, launch cadence, and GPU occupancy.
This post focuses on the architectural changes required to scale VC-6 decoding for batched inference and training workloads. As NVIDIA Nsight Systems and NVIDIA Nsight Compute allow developers to identify system- and kernel-level constraints, they were leveraged to redesign the VC-6 CUDA implementation for batch throughput. The result is up to ~85% lower per-image decode time compared to the previous implementation, with submillisecond decode for LoQ-0 (~4K) in batch and ~0.2 ms for lower LoQs, with identical output quality. This significantly improves pipeline efficiency for production vision AI workloads.
Introducing the VC-6 batch mode implementation
The new implementation is built around several architectural changes, including batch mode and kernel-level optimizations.
Batch mode: From N to a single decoder
- Execution model redesign
- Algorithmic changes to decode multiple images simultaneously with a single decoder
- Improved parallelization
- Leveraging the new work dimension (images) next to existing parallelization dimensions (tiles, planes) to shift initial VC-6 tile hierarchy work to GPU.
- Minibatch pipelining
Kernel-level optimizations
- Nsight Compute driven range decoder kernel optimization
- The optimizations led to a ~20% kernel speedup
The following sections detail these changes to the VC-6 decoder in depth. As for any CUDA optimization, the plan was to start with a system-level profiler like Nsight Systems to identify and fix initial performance bottlenecks, and then use Nsight Compute to refine individual kernels.
Moving from N to a single decoder
The top part of Figure 1 shows the starting point, as detailed in Build High-Performance Vision AI Pipelines with NVIDIA CUDA-Accelerated VC-6.
The middle rows show heavy CUDA API usage, each corresponding to a separate decoder instance decoding a single image each. In All Streams, many small, concurrently running kernels on the GPU are shown in blue. The top row shows device utilization. Light orange is less than full utilization, dark orange indicates full load. In this example, even with enough dispatched work, full utilization is rarely indicated. The profiled algorithm is consequently not optimal.
This inefficiency is explained by the execution of numerous small kernels. Each kernel launch has several associated overheads, like scheduling and kernel resource management. In this setting, constant per-kernel overhead and little work per kernel lead to an unfavorable ratio between overhead and actual work.
Changing this requires altering the paradigm from many small kernels to a few larger kernels.
In this case, NVIDIA Nsight motivated an execution model redesign from N decoders for N images to a single decoder that decodes batches of N images at once. This new execution model redistributes the fixed amount of work into fewer kernels, each with more work. The bottom part of Figure 1 shows the effect of this reimplementation. It shows only two CUDA API timelines, only a handful of large kernels, and full GPU utilization, indicated by the dark orange GPU utilization.
Shifting more work to GPU
In the initial implementation, decoding the root and narrow levels of the VC-6 tile hierarchies were performed on the CPU. For single-image decoding, the amount of work in these narrower stages was too small to justify GPU execution. In the batched design, although the work per image remains small, the aggregation of multiple images provides sufficient parallelism to efficiently utilize the GPU.
Additionally, the algorithm was modified to eliminate host-side logic for handling variable image dimensions. With that embedded in GPU kernels, NVIDIA Nsight showed that this reduced both synchronization points and submission latency, while increasing pipeline fluidity.
Figures 2 and 3 show the utilization and CPU overhead overview of decoding images at LoQ-0 and LoQ-2, indicating more severe inefficiencies for LoQ-2.
However, with batch mode VC-6 (bottom of Figures 2 and 3), GPU execution of even the smallest LoQs is feasible because the aggregated workload of several images can be efficiently computed on GPU.
Minibatch pipelining
The new decoder design splits each batch into minibatches. These go through a pipeline consisting of CPU processing, PCIe transfer, and GPU decoding stages. Images of a minibatch reside in a pipeline stage simultaneously, while stages operate concurrently and hide each other’s costs.
Figure 4 illustrates this minibatch pipelining. Similar to Figure 1, the CUDA API calls are dispatched from two threads, UPLOAD and GPU, with minimal host-side resource usage. Work aggregation has clearly reduced CUDA API calls, memory operations, and synchronizations, while amortising kernel launch overhead across the batch.
Kernel-level optimizations
Nsight Systems revealed that the initial optimizations alleviated CPU overhead, and further improvements require kernel optimization. The terminal_decode kernel implementing a range decoder is noteworthy. Nsight Compute highlighted previously noncritical microarchitectural constraints. The following algorithmic issues were highlighted: typical low-level inefficiencies such as low streaming SM occupancy, warp divergence, noncoalesced memory accesses, and register pressure. These insights are essential for developers to then eliminate or minimize these algorithmic issues where possible.
The Nsight Compute source heatmap and Warp Stall Sampling (All Samples) highlight measured time spent per individual source line. They show that significant time is spent on integer divisions in the range update logic (Figure 5). Since GPUs are not optimized for integer division and accuracy is non-negotiable, these operations cannot be optimized.
For the decoder table lookup, implemented as binary search on shared memory, Nsight Compute also revealed significant short scoreboard stalls (Figure 6).
These stalls point to shared memory loads (LDS in Figure 6), as dynamic indexing into a local array would otherwise result in slow local memory access. Because the lookup tables are constant in size, it is possible to replace this approach with a local variable and an unrolled loop. Compared to the binary search, this exhaustive search enables constant indexing into a fixed-size array that can reside in registers. The combination of these two changes applied to both range decoders produced a ~20% speedup of this kernel.
Figure 7 shows the memory charts of Nsight Compute. Visually, it confirms that neither shared (last row) nor local memory (row 2) is used after the modification.
The trade-off is increased register usage, from 48 to 92 registers per thread. Here, it is acceptable given the per-thread limit of 255 registers and the relatively small grid dimensions of this kernel. Since targeting high block residency per SM is not a priority at this stage, the additional register pressure does not limit overall throughput.
Another optimization was to replace a custom selection routine with a cub::DeviceSelect function call. This simplifies the code, and off-loads the maintenance and optimization aspects for current and upcoming hardware to CUB.
Performance scaling and updated results
Figure 8 compares per-image decode time across batch sizes between the previous and improved implementation, evaluated at four LoQs (LoQ-0 ~4K, LoQ-1 ~2K, LoQ-2 ~1K, LoQ-3 ~0.5K) using the UHD-IQA dataset (available through V-Nova on Hugging Face).
Two distinct scaling behaviors emerge:
- The previous implementation plateaus beyond small batch sizes (approximately 1–16). Additional images do not translate into further per-image gains. In contrast, the optimized CUDA implementation continues to improve as batch size increases. For example, LoQ-0 (~4K) decode time drops below 1 ms per image at large batch sizes.
- The relative improvement grows at lower LoQs. Smaller per-image workloads expose more independent work that can be aggregated, resulting in better GPU utilization. At higher batch sizes, LoQ-2 decoding reaches ~0.2 ms per image and LoQ-3 ~0.14 ms.
Measured improvements include:
- ~36% lower per-image decode time at batch size 1 (LoQ-0)
- ~70–80% lower per-image decode time at batch sizes 16–32 for LoQ-2 and LoQ-3
- Up to ~85% lower per-image decode time at batch size 256
Figure 9 shows the performance of the redesigned implementation across batch sizes on NVIDIA H100 (Hopper), and NVIDIA B200 (Blackwell) GPUs. The results indicate that the performance gains are not silicon-specific but stem from the improved batch mode. This effectively exposes sufficient parallel work to saturate modern GPU architectures.
VC-6 for vision AI pipelines
Intelligent and tailored-to-fit decoding leveraging VC-6 random-access intra-only, LoQ decoding, and selective region-of-interest or color channel access can benefit training, inference, and video summarization workflows. This is an avenue for future work.
Get started with VC-6 decoding
Scaling VC-6 decoding requires more than kernel tuning. Nsight profiling reveals structural limits in launch cadence, occupancy, thread divergence, and memory behavior. By redesigning the CUDA execution model to expose more independent work and amortize overhead across batches, the new implementation achieves up to ~85% lower per-image decode time, reaching submillisecond decode for LoQ-0 (~4K) in batch and ~0.2 ms for lower LoQs, with identical output quality.
As vision AI workloads continue to scale, overall pipeline efficiency is determined at every step, including both the decode and preprocessing stages.
To get started, check out these resources:
- VC-6 samples
- Examples for VC-6 encoding and selective decoding
- Benchmark suite to reproduce our results with Hugging Face datasets
- VC-6 AI Blueprint
- Demo showcasing VC-6 selective decoding in vision AI pipelines
- Reference integration patterns for multiple use cases