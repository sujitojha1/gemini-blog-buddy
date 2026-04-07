Better MoE model inference with warp decode
By flipping the parallelism axis we achieve 1.8x faster and more accurate MoE model inference.
Most MoE inference systems organize the token generation path around experts. This mirrors how routing works and has been the standard approach at scale. For small-batch decode on Blackwell GPUs, however, we found that organizing the kernel around outputs rather than experts works better. We call this approach “warp decode.”
We arrived at warp decode by thinking about what the maximum achievable memory bandwidth for MoE decode on Blackwell actually is. That led us to flip the parallelism axis entirely. Instead of assigning warps to experts, we assign each warp to a single output value (neuron).
Kernels that improve both performance and accuracy are rare, and warp decode is one of them. On Blackwell, it delivers a 1.84x throughput improvement while also improving accuracy with outputs 1.4x closer to a full FP32 reference. This speeds up the research and training pipeline for Composer, letting us improve the model faster and ship new versions more often.
The conventional MoE path
Modern MoE models route each token through a subset of specialized expert networks, selecting, for example, 8 out of 128 at a given layer. The standard implementation organizes all computation around those experts by collecting the tokens each expert needs, running the math, and reassembling the results.
This works well for prefill and large batches, where the shared work per expert amortizes the overhead of organizing the data. But during the autoregressive decode step, where we only produce one token at a time, there isn’t enough shared work to justify it. Five of the eight stages in the traditional path exist purely to manage data layout for the expert-centric view and perform no actual computation.
What we changed
Warp decode eliminates those five “bookkeeping” steps by reorganizing the parallelism around outputs rather than experts.
Modern GPUs execute instructions in groups of 32 parallel processing lanes called a warp. In our new approach, each warp is assigned exactly one output value to compute. The warp streams the weight data it needs directly from memory, aggregates the totals across all eight routed experts in a single running total, and writes one result.
This warp independence lets warp decode run without any staging, handoffs, cross-warp sync points, or intermediate buffers. The entire MoE compute layer is compressed into two kernels, moe_gate_up_3d_batched
and moe_down_3d_batched
.
How the two kernels work
In the gate/up kernel, each cooperative thread array (CTA) is eight warps, and each warp owns one intermediate neuron for each pairing of a token and a routed expert. The warp loads the routed expert ID, reads the gate and up weight rows for that neuron, and streams over the input activation vector. MXFP8 weights are converted to FP32 on the fly, and both dot products accumulate in private registers.
Because the two kernels are fused into one pass, the activation vector is read once and reused immediately for both projections, without any shared memory staging. After a warp-level reduction, the warp applies SiLU(gate) × up and writes one intermediate value.
In the down kernel, each warp owns one output dimension for one token. It loops over all top-k routed experts, loading the relevant down-projection weight row and streaming over the intermediate activations, while folding each expert's routing weight into a single running FP32 accumulator.
After all experts are processed, we reduce the 32 lane-local partial sums with a warp-level butterfly reduction using __shfl_xor_sync
. This compiles directly to the PTX shfl.sync.bfly
instruction, which is a single hardware primitive that exchanges registers between lanes within the warp, bypassing shared memory entirely.
The payoff here is we don’t need L1 round-trips, bank conflicts, or explicit barriers because synchronization is baked into the instruction via the lane mask. Rather than a separate epilogue, the final weighted top-k combination becomes part of the projection itself.
Each warp in warp decode is independent and gets a single, stable assignment for its entire lifetime: produce one output scalar. This warp independence is what eliminates the shared memory staging, cross-warp synchronization, and intermediate buffers that the traditional path requires.
Pipeline simplification and acceleration
Warp decode achieves performance improvements through two main mechanisms: removing stages and buffers that the traditional path required, and by creating warp independence which allows for better scheduling and latency hiding.
Stage Elimination
Stage eliminations provide most of the throughput gain. We eliminate padding, scattering, and the combine step. Removing these stages requires reorganizing the parallelism from the ground up, rather than merely fusing stages of the traditional pipeline.
Elimination of padding
Traditional path: Pads each expert's token list to power-of-2, or 128 byte, boundaries to conform to grouped kernel requirements. At decode time with a single token this is non-amortizable overhead.
Warp decode path: Avoids this overhead entirely by never forming per-expert batches.
Elimination of scatter and combine
Traditional path: After each expert finishes, it writes eight intermediate results to GPU memory, then runs a separate reduction step to combine them.
Warp decode path: The routing weight for each expert is folded into the running accumulator within the warp. The eight intermediate results never materialize in memory, saving both the write and read costs of a subsequent reduction pass.
Buffer elimination
The reorganization also removes two intermediate memory buffers that the traditional path requires as a consequence of its expert-centric layout.
The first is an activation gather buffer, which is the input activation vector copied and rearranged into expert-major layout. At batch size 1, this is a full copy of data that already exists. The second is a per-expert output buffer. With eight experts and hidden dimension 2048, this is 8 × 2048 × 2 bytes = 32 KB per token in BF16, allocated, written, immediately read once, and discarded.
Warp decode eliminates both by folding the eight expert contributions into a register accumulator across 32 warp lanes, where nothing reaches global memory until the final single-scalar write. Removing 32+ KB of intermediate buffer traffic per token frees L2 cache capacity for the weight rows that actually determine performance.
Warp Independence
The reorganization also makes the retained computation faster because the kernel is “embarrassingly parallel” by design: every warp is completely independent of every other. Because each warp owns exactly one output scalar and reads only the weight rows it needs, there is no shared mutable state between warps.
At the level of a single warp, this independence is total. The input activations are read-only, the accumulator lives in private registers, and the output write lands at a unique address. From the hardware scheduler's perspective, the entire output dimension is a flat pool of independent work items.
The GPU's warp scheduler can issue any warp at any time, in any order, with no correctness constraint. When one warp stalls waiting on a memory load, the scheduler immediately switches to another. With thousands of warps in flight across a B200's 148 streaming multiprocessors, memory latency becomes almost entirely hidden behind useful computation from other warps.
The kernel also scales linearly, such that doubling the output dimension doubles the number of independent warps with no added synchronization. The same holds across the token batch dimension, so the scheduler sees one flat namespace of work with no edges between nodes. This stands in contrast to the traditional path, where expert-level GEMM kernels require intra-block coordination.
Results
End-to-end decode throughput at scale
Testing on our internal inference system running a Qwen-3 style model on NVIDIA B200 GPUs produced a consistent throughput gain. The throughput gain is flat across all context-length buckets, confirming this is a pure generation-time improvement that does not depend on prompt length.
Improved accuracy
Removing the intermediate activation quantization step has a measurable quality impact. Converting BF16 activations to MXFP8 and back introduces a rounding error floor that accumulates across the model's layers. Warp decode keeps activations in BF16 throughout and accumulators in FP32, so the reduction never operates on degraded inputs. The result is warp decode produces outputs 1.4x closer to full 32-bit ground truth than the classical path.
Hardware Efficiency
We started developing warp decode by asking how close we could get to the hardware's maximum throughput. The B200's measured peak for contiguous memory reads is 6.8 TB/s (measured using a copy kernel). Warp decode sustains 3.95 TB/s at B=32, or 58% of that peak. The remaining gap likely reflects the memory latency cost of the random access patterns that expert routing creates, since each token may route to non-adjacent experts like 5, 8, 14, 19 etc.
By contrast, peak throughput is measured using contiguous (0,1,2,3) memory reads. Correctness against the reference implementation was tight across all batch sizes: minimum cosine similarity > 0.999996, maximum absolute difference 0.001953.
Warp decode and Composer training
Warp decode is not a general replacement for expert-centric execution. Higher-volume workloads like prefill and large-batch inference still benefit from expert-centric packing because many tokens share the same expert, and the cost of organizing them is amortized over enough real computation to be worthwhile.
Warp decode wins when there isn't enough shared work per expert to justify that overhead, as is often the case with MoE decode. This makes it an important part of how we continually improve Composer. While investments in pretraining data and RL determine the quality of the model's outputs, inference investments like warp decode determine how quickly and accurately those outputs reach developers.