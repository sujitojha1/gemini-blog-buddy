Mastering Tensor Dimensions in Transformers
Prerequisites
A solid grasp of valid shapes and dimensions for matrix multiplication is essential. Familiarity with this topic is strongly recommended before proceeding.
Setup
Most generative AI models are built using a decoder-only architecture. In this blog post, we’ll explore a simple text generation model, as illustrated below.
Let’s start with an input example for reference.
The sentence Hello world !
can be tokenized into three parts: Hello
, world
, and !
. Additionally, two auxiliary tokens, <bos>
and <eos>
, are appended to represent the beginning of sentence and end of sentence, respectively. This ensures the input is shifted correctly.
After tokenization, the input becomes a tensor like [12, 15496, 2159, 5145]
. When passed to the model in a batch, an extra dimension is added, resulting in [[12, 15496, 2159, 5145]]
. For simplicity, we’ll focus on tensor dimensionalities, representing the input as , where 1 is the batch size and 4 is the sequence length.
Embedding Layer
The input tensor undergoes transformations in each layer, affecting both its values and, in some cases, its shape. When the tensor reaches the embedding layer, its shape becomes , where 768 represents the embedding dimension.The embedding layer is critical to the architecture for two reasons:
- The embedding dimension propagates through the neural network and is heavily utilized in the attention layer.
- It converts tokens into high-dimensional vectors, capturing semantic relationships between words. For instance, while tokens like "king" and "man" may appear unrelated numerically (e.g., 8848 and 9584), their vector representations in high-dimensional space reveal meaningful similarities.
Positional Encoding
This layer does not alter the tensor dimensions but injects positional information into the input. This is crucial because the input undergoes parallel computations later in the architecture, and positional encoding ensures the model retains information about the order of tokens in the sequence.
Decoder Layer
A generative model typically consists of multiple consecutive decoder layers, each containing:
- A masked multi-head attention layer
- An add and normalize operation
- A feed-forward network
Masked Multi-Head Attention
The Multi-Head Attention layer enables the model to focus on different parts of the input, weighting and representing each token within the context of the entire sequence.
The Masked Multi-Head Attention restricts each token to attend only to itself and preceding tokens, achieved by masking future tokens from the attention weights.
The data first passes through three parallel linear layers, each with nn.Linear(768, 768)
, preserving the input shape. The outputs are termed Query (Q), Key (K), and Value (V), each with a tensor shape of .
The embedding dimension is then split according to , where 8 is the number of heads and 96 is the head size. This reshapes the tensor to . To align dimensions for matrix multiplication, the sequence length and head size are transposed, resulting in shapes of for Q, K, and V.
The attention mechanism, as defined in the original paper, is computed as:
First, is calculated:
- (transposed Key) has a shape of .
- results in a tensor of shape , computed as .
Refer to the matrix multiplication details above for a clearer understanding of the dimensional transformations.
- MASKING
The mask ensures each token attends only to itself and preceding tokens, preventing the model from accessing future tokens during generation.
Attention Weights
The attention weights are computed using:
where . Scaling by the head size prevents large value disparities, and the softmax ensures each token's vector representation sums to 1. This zeros out-inf
values while preserving positive values, affecting only the tensor values, not its shape.Calculate Attention
The attention weights are multiplied by the values:
Concat
The number of heads is restored by transposing dimensions:
Projection Layer
A linear layer withnn.Linear(768, 768)
maintains the tensor shape at .
Observation
The tensor shape has returned to , matching its initial shape before the attention mechanism. This consistency is essential to ensure compatibility with subsequent layers and calculations in the model.
Add and Normalize
This step involves a skip connection where the tensors before and after the attention layer are added together and normalized. The addition ensures the tensor values are updated rather than replaced, while normalization prevents exponential growth in values.
These add-and-normalize operations are applied after each layer to maintain the tensor's original characteristics.
Feed-Forward
The feed-forward network typically consists of two consecutive linear layers: one that expands the tensor and another that contracts it, often accompanied by a dropout layer for regularization. These layers introduce non-linear transformations, enabling the model to capture richer and more complex patterns within the embedding dimensions (number of heads and head size).
The expansion factor is usually , and the contraction factor is . This results in linear layers structured as:
nn.Linear(768, 3 * 768)
nn.Linear(3 * 768, 768)
The final output shape returns to the input shape, . Maintaining this shape allows for the application of an add-and-normalize layer after the feed-forward step.
Additionally, since the decoder's final shape matches its input shape, multiple consecutive decoder layers can be stacked seamlessly.
Language-Model Head
After passing through a series of decoder layers, the tensor reaches a final linear layer that transforms the embed_dim
vocab_size
.
This results in a tensor of shape (assuming a vocab size of 9735), where:
- 1: batch size
- 4: sequence length
- 9735: vocab size
Applying a softmax function and calculating the loss between the model output and the ground truth yields the error (or loss), which the optimizer uses to update the model weights.
In the Masked Multi-Head Attention Layer, each token's attention is computed using only the current INPUT token and its predecessors. Since the input is shifted right, generating a new token requires the model to consider the vector representations of all previous tokens, including their relationships with preceding tokens. This mechanism underpins how generative AI models function, as illustrated below:
Transformers and Cross-Attention
The transformer architecture typically consists of an encoder-decoder structure, commonly used in tasks where the context and output are not directly related, such as translation. However, decoder-only architectures are often preferred for such tasks today.
In the encoder layers, tensor shapes propagate similarly to the decoder, with one key difference: the attention layer does not apply a mask, allowing each token to attend to all other tokens in the sequence, both before and after.
For example, consider the context I am at home
and the target <bos> je suis à la maison
. The tensor shapes would be:
- Context (
I am at home
): - Target (
<bos> je suis à la maison
):
The sequence lengths of the input and target differ, which is handled by the cross-attention layer. The encoder output has a shape of , while the masked multi-head attention layer output from the decoder is . Here, the Key (K) and Value (V) come from the encoder, and the Query (Q) comes from the decoder.
It’s recommended to manually calculate the tensor dimensions for clarity, but the solution is provided below for verification.
[CLICK HERE FOR THE SOLUTION]
the attention formula is as follows :- Query :
- key & Value :
split and transpose dims :
- Query :
- Key & Value :
Calculate Attention :
- :
- :
Concat
Observation
The tensor shape has returned to , matching the output shape of the masked multi-head attention layer. This consistency ensures compatibility with subsequent layers.
Final Words
This blog post aimed to provide a clearer understanding of how attention mechanisms work and how tensor shapes propagate through the transformer architecture.
If you found this blogpost helpful, consider upvoting 🤗.
For feedback or questions, feel free to reach out through any of the contact methods listed on my portfolio: https://not-lain.github.io/.