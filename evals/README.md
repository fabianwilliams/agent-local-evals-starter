# Evals quickstart

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install git+https://github.com/openai/evals.git

# OpenAI hosted
export OPENAI_API_KEY=sk-...
oaieval simple_eval data/simple_time_eval.jsonl -m gpt-4o-mini

# Or your local proxy (LiteLLM)
export OPENAI_API_BASE=http://localhost:4000/v1
oaieval simple_eval data/simple_time_eval.jsonl -m gpt-oss-120b
```
