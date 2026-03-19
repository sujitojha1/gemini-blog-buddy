# Benchmarking LLMs on AI-Generated CUDA Code with ComputeEval 2025.2

Over 100 new CUDA challenges added to test LLMs on modern CUDA features

<!-- image -->

- [L](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdeveloper.nvidia.com%2Fblog%2Fbenchmarking-llms-on-ai-generated-cuda-code-with-computeeval-2025-2%2F)
- [T](https://twitter.com/intent/tweet?text=Benchmarking+LLMs+on+AI-Generated+CUDA+Code+with+ComputeEval+2025.2+%7C+NVIDIA+Technical+Blog+https%3A%2F%2Fdeveloper.nvidia.com%2Fblog%2Fbenchmarking-llms-on-ai-generated-cuda-code-with-computeeval-2025-2%2F)
- [F](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdeveloper.nvidia.com%2Fblog%2Fbenchmarking-llms-on-ai-generated-cuda-code-with-computeeval-2025-2%2F)
- [R](https://www.reddit.com/submit?url=https%3A%2F%2Fdeveloper.nvidia.com%2Fblog%2Fbenchmarking-llms-on-ai-generated-cuda-code-with-computeeval-2025-2%2F&title=Benchmarking+LLMs+on+AI-Generated+CUDA+Code+with+ComputeEval+2025.2+%7C+NVIDIA+Technical+Blog)
- [E](mailto:?subject=I'd%20like%20to%20share%20a%20link%20with%20you&body=https%3A%2F%2Fdeveloper.nvidia.com%2Fblog%2Fbenchmarking-llms-on-ai-generated-cuda-code-with-computeeval-2025-2%2F)

AI-Generated Summary

Like

Dislike

- The ComputeEval benchmark has been expanded to include over 100 new CUDA challenges, bringing the total to 232 CUDA and CUDA Compute Core Libraries (CCCL) problems that test AI models' ability to use modern CUDA features.
- The new challenges require AI models to correctly utilize features like CUDA Graphs, Streams, and Events within real-world applications such as dynamic simulations, and to leverage modern CUDA features including Tensor Cores and advanced shared memory patterns.
- The evaluation of leading large language models (LLMs) on ComputeEval showed a decline in scores with the updated benchmark, indicating that the new challenges are more difficult and push AI to demonstrate a deeper understanding of accelerated computing nuances.

AI-generated content may summarize information incompletely. Verify important information. [Learn more](https://www.nvidia.com/en-us/agreements/trustworthy-ai/terms/)

Can AI coding assistants write efficient CUDA code? To help measure and improve their capabilities, we created [ComputeEval](https://github.com/NVIDIA/compute-eval) , a robust, open source benchmark for evaluating AI models and agents on CUDA programming tasks.

A few months ago, we announced the [first release](https://developer.nvidia.com/blog/announcing-computeeval-an-open-source-framework-for-evaluating-llms-on-cuda/) of ComputeEval and today, we're introducing its first major expansion by adding more than 100 new CUDA challenges.

With this release, the dataset has grown to a total of 232 of CUDA and CUDA Compute Core Libraries (CCCL) problems. We deliberately raised the bar by adding more difficult challenges that require LLMs to use modern CUDA features, such as Tensor Cores, advanced shared memory patterns, and warp-level primitives. The new problems test the ability to correctly orchestrate features like CUDA Graphs, Streams, and Events. All within the context of real-world applications like dynamic simulations.

## LLM performance on CUDA programming

Our team evaluated several leading LLMs on ComputeEval to establish baseline performance metrics and understand the current state of AI-assisted CUDA programming (Table 1).

We observed that scores for all models declined with the move to ComputeEval 2025.2. This doesn't indicate that the models are becoming less capable-rather, it reflects that the benchmark itself has become more challenging. With each release, we're raising the bar for AI, pushing it to demonstrate a deeper understanding of the nuances of accelerated computing.

## What's next and how to get involved

We'll continue expanding both the dataset and the capabilities of the evaluation framework. Work is already underway to extend ComputeEval's coverage to additional CUDA-X libraries, including cuBLAS, CUTLASS, cuDNN, RAPIDS, and more. We invite the broader HPC and AI communities to contribute and collaborate. Explore the code on [GitHub](https://github.com/NVIDIA/compute-eval) and access the dataset on [Hugging Face](https://huggingface.co/datasets/nvidia/compute-eval) .

[Discuss (0)](#entry-content-comments)

Like

## Tags

[Agentic AI / Generative AI](https://developer.nvidia.com/blog/category/generative-ai/) | [General](https://developer.nvidia.com/blog/recent-posts/?industry=General) | [CUDA](https://developer.nvidia.com/blog/recent-posts/?products=CUDA) | [Intermediate Technical](https://developer.nvidia.com/blog/recent-posts/?learning_levels=Intermediate+Technical) | [News](https://developer.nvidia.com/blog/recent-posts/?content_types=News) | [featured](https://developer.nvidia.com/blog/tag/featured/) | [LLMs](https://developer.nvidia.com/blog/tag/large-language-models/)

## About the Authors

Avatar photo

<!-- image -->

**About Daniel Rodriguez**

Avatar photo

<!-- image -->

**About Navyaa Sanan**

## Comments

## Related posts

<!-- image -->

### CUTLASS: Principled Abstractions for Handling Multidimensional Data Through Tensors and Spatial Microkernels

[CUTLASS: Principled Abstractions for Handling Multidimensional Data Through Tensors and Spatial Microkernels](https://developer.nvidia.com/blog/cutlass-principled-abstractions-for-handling-multidimensional-data-through-tensors-and-spatial-microkernels/)

<!-- image -->

### Announcing ComputeEval, an Open Source Framework for Evaluating LLMs on CUDA

[Announcing ComputeEval, an Open Source Framework for Evaluating LLMs on CUDA](https://developer.nvidia.com/blog/announcing-computeeval-an-open-source-framework-for-evaluating-llms-on-cuda/)

<!-- image -->

### Leverage AI Coding Assistants to Develop Quantum Applications at Scale with NVIDIA CUDA-Q

[Leverage AI Coding Assistants to Develop Quantum Applications at Scale with NVIDIA CUDA-Q](https://developer.nvidia.com/blog/leverage-ai-coding-assistants-to-develop-quantum-applications-at-scale-with-nvidia-cuda-q/)

Decorative image of light fields in green, purple, and blue.

<!-- image -->

### Constant Time Launch for Straight-Line CUDA Graphs and Other Performance Enhancements

[Constant Time Launch for Straight-Line CUDA Graphs and Other Performance Enhancements](https://developer.nvidia.com/blog/constant-time-launch-for-straight-line-cuda-graphs-and-other-performance-enhancements/)

<!-- image -->

### Optimizing llama.cpp AI Inference with CUDA Graphs

[Optimizing llama.cpp AI Inference with CUDA Graphs](https://developer.nvidia.com/blog/optimizing-llama-cpp-ai-inference-with-cuda-graphs/)

## Related posts

<!-- image -->

### NVIDIA ACE Adds Open Source Qwen3 SLM for On-Device Deployment in PC Games

[NVIDIA ACE Adds Open Source Qwen3 SLM for On-Device Deployment in PC Games](https://developer.nvidia.com/blog/nvidia-ace-adds-open-source-qwen3-slm-for-on-device-deployment-in-pc-games/)

<!-- image -->

### Just Released: NVIDIA HPC SDK v25.9

[Just Released: NVIDIA HPC SDK v25.9](https://developer.nvidia.com/nvidia-hpc-sdk-259-downloads#new_tab)

<!-- image -->

### Just Released: Warp 1.9

[Just Released: Warp 1.9](https://github.com/NVIDIA/warp/releases/tag/v1.9.0#new_tab)

<!-- image -->

### Run Google DeepMind's Gemma 3n on NVIDIA Jetson and RTX

[Run Google DeepMind's Gemma 3n on NVIDIA Jetson and RTX](https://developer.nvidia.com/blog/run-google-deepminds-gemma-3n-on-nvidia-jetson-and-rtx/)

<!-- image -->

### Join Us at We Are Developers World Congress 2025

[Join Us at We Are Developers World Congress 2025](https://www.nvidia.com/en-us/events/wearedevelopers-world-congress/)

- [L](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdeveloper.nvidia.com%2Fblog%2Fbenchmarking-llms-on-ai-generated-cuda-code-with-computeeval-2025-2%2F)
- [T](https://twitter.com/intent/tweet?text=Benchmarking+LLMs+on+AI-Generated+CUDA+Code+with+ComputeEval+2025.2+%7C+NVIDIA+Technical+Blog+https%3A%2F%2Fdeveloper.nvidia.com%2Fblog%2Fbenchmarking-llms-on-ai-generated-cuda-code-with-computeeval-2025-2%2F)
- [F](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdeveloper.nvidia.com%2Fblog%2Fbenchmarking-llms-on-ai-generated-cuda-code-with-computeeval-2025-2%2F)
- [R](https://www.reddit.com/submit?url=https%3A%2F%2Fdeveloper.nvidia.com%2Fblog%2Fbenchmarking-llms-on-ai-generated-cuda-code-with-computeeval-2025-2%2F&title=Benchmarking+LLMs+on+AI-Generated+CUDA+Code+with+ComputeEval+2025.2+%7C+NVIDIA+Technical+Blog)
- [E](mailto:?subject=I'd%20like%20to%20share%20a%20link%20with%20you&body=https%3A%2F%2Fdeveloper.nvidia.com%2Fblog%2Fbenchmarking-llms-on-ai-generated-cuda-code-with-computeeval-2025-2%2F)