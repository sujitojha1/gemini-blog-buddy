If DSPy is So Great, Why Isn't Anyone Using It?
/ 11 min read
Table of Contents
For a framework that promises to solve the biggest challenges in AI engineering, this gap is suspicious. Still, companies using Dspy consistently report the same benefits.
They can test a new model quickly, even if their current prompt doesn't transfer well. Their systems are more maintainable. They are focusing on the context more than the plumbing.So why aren’t more people using it?
DSPy’s problem isn’t that it’s wrong. It’s that it’s hard. The abstractions are unfamiliar and force you to think a litle bit differently. And what you want right now is not to think differently; you just want the pain to go away.
But I keep watching the same thing happen: people end up implementing a worse version of Dspy. I like to jokingly say there’s a Khattab’s Law now (based off of Greenspun’s Law about Common Lisp):
Any sufficiently complicated AI system contains an ad hoc, informally-specified, bug-ridden implementation of half of DSPy.
You’re going to build these patterns anyway. You’ll just do it worse, after a lot of time, and through a lot of pain.
The evolution of every AI system
Let’s walk through how virtually every team ends up implementing their own “Dspy at home”. We’ll use a simple structured extraction task as an example throughout. Don’t let the simplicity of the example fool you though; these patterns only become more important as the system becomes more complex.
Stage 1: Ship it
Let’s say you need to extract company names from some text, you might start out with the OpenAI API:
It basically works. So you ship it and life is good.
Stage 2: “Can we tweak the prompt without deploying?”
But inevitably, Product will want to iterate faster. Redeploying for every prompt change is too annoying. So you decide to store prompts in a database:
Now you have a prompts table, a little admin UI to edit it. And of course you had to add version history after someone broke prod last Tuesday.
Stage 3: “It keeps returning garbage formats”
You notice the model sometimes returns "Company: Acme Corp"
instead of just "Acme Corp"
. So you add structured outputs:
You now have typed inputs and outputs and higher confidence the system is doing what it should.
Stage 4: “We need to handle failures”
After running for a while, you’ll notice transient failures like 529 errors or rare cases where parsing fails. So you add retries:
Now each call has a bit more resilience. Though, in practice you might fallback to a different provider because retrying against an overloaded service returning 529s is a recipe for… another 529 error.
Stage 5: “Now we need RAG”
Eventually, you might start parsing more esoteric company names, and the model might not be good enough to recognize an entity as a company name. So you want to add RAG against known company information to help improve the extraction:
Now we have two prompts: one to create the query and one to create parse the company. And we have also introduced other parameters like k
. It’s worth noting that not all of these parameters are independent. Since the retrieved documents feed into the final prompt, any changes here affect the overall performance.
Stage 6: “How do we know if this is getting better?”
You keep changing both prompts, the embedding model, k, and any parameter you can get your hands on to fix bugs as they are reported. But you’re never quite sure if your change completely fixed the issue. And you’re never quite sure if your changes broke something else. So you finally realize you need those “evals” everyone is talking about:
Data extraction tasks are amongst the easiest to evaluate because there’s a known “right” answer. But even here, we can imagine some of the complexity. First, we need to make sure that the dataset passed in is always representative of our real data. And generally: your data will shift over time as you get new users and those users start using your platform more completely. Keeping this dataset up to date is a key maintenance challenge of evals: making sure the eval measures something you actually (and still) care about.
Stage 7: “Let’s try Claude instead… oh no”
Inevitably, some company will release a new model that’s exciting that someone will want to try. Let’s say Anthropic releases a new model. Unfortunately, your code is full of openai.chat.completions.create
, which won’t exactly work for Anthropic. Your prompts might not even work well with the new model.
So you decide you need to refactor everything:
You now have typed signatures, composable modules, swappable backends, centralized retry logic, and prompt management separated from application code.
Congrats! You just built a worse version of Dspy.
What this looks like with DSPy
Here’s the same company extraction task — with RAG, evaluation, and model swapping — in DSPy:
That’s it. Typed I/O, RAG, chain-of-thought reasoning, model-agnostic. No prompt management table. No retry decorators. No get_prompt("extract_company_v3")
.
Now evaluation and optimization:
Want to try Claude instead? One line:
No refactor. No new API client. No re-tuning prompts by hand. The optimizer can even re-optimize for the new model automatically!
Dspy packages important patterns every serious AI system ends up needing:
Signatures
Typed inputs and outputs. What goes in, what comes out, with a schema.
Modules
Composable units you can chain, swap, and test independently.
Optimizers
Logic that improves prompts, separated from the logic that runs them.
These are just software engineering fundamentals. Separation of concerns. Composability. Declarative interfaces. But for some reason, many good engineers either forget about these or struggle to apply them to AI systems.
Why good engineers write bad AI code
Weird feedback loops
You can't step through a prompt. The output is probabilistic. When it finally works, you don't want to touch it.
Pressure to ship
Getting an LLM to work feels like an accomplishment. Clean architecture feels like a luxury for later.
Unclear boundaries
Where do you draw the boundaries? Your prompts are both code and data. Nothing is familiar.
So engineers do what works in the moment. Inline prompts. Copy-paste with tweaks. One-off solutions that become permanent.
But 6 months later, they are drowning in the complexity of their half-baked abstractions.
DSPy forces you to think about these abstractions upfront. That's why the learning curve feels steep. The alternative is discovering the patterns through pain.
What you should actually do
Option 1: Use DSPy
Accept the learning curve. Read the docs. Build a few toy projects until the abstractions click. Then use it for real work.
Option 2: Steal the ideas
Don't use DSPy, but build with its patterns from day one. See below.
If you're stealing the ideas, build with these patterns:
The point
DSPy has adoption problems because it asks you to think differently before you’ve actually felt the pain of thinking the same way everyone else does.
The patterns DSPy embodies aren’t optional. If your AI system gets complex enough, you will reinvent them. The only question is whether you do it deliberately or accidentally.
You don’t have to use DSPy. But you should build like someone who understands why it exists.
If this resonated, let’s continue the conversation on X or LinkedIn!