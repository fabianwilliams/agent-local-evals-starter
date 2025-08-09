#!/usr/bin/env python3
"""
Simple test to demonstrate eval functionality without full evals package
"""
import json
import os
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def test_time_query():
    """Test both implementations with a simple time query"""
    
    # Read the eval data
    with open('data/simple_time_eval.jsonl', 'r') as f:
        eval_data = json.loads(f.read().strip())
    
    print("=== Simple Eval Test ===")
    print(f"Test Query: {eval_data['input']}")
    print(f"Expected: {eval_data['ideal']}")
    
    # Test with OpenAI (simulating our TypeScript implementation)
    if os.getenv('OPENAI_API_KEY'):
        client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "user", "content": eval_data['input']}
                ]
            )
            
            result = response.choices[0].message.content
            print(f"OpenAI Result: {result}")
            
            # Improved scoring: check if response contains ISO-8601 patterns
            import re
            # Look for ISO-8601 patterns like YYYY-MM-DDTHH:MM:SSZ or similar
            iso_pattern = r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?'
            contains_iso = bool(re.search(iso_pattern, result))
            # Also check if it mentions ISO-8601 format or shows example format
            mentions_iso = 'iso' in result.lower() or 'ISO' in result
            # Award partial credit if it explains the format even without giving actual time
            score = 1 if contains_iso else (0.5 if mentions_iso else 0)
            print(f"Score: {score}/1 (contains actual timestamp: {contains_iso}, mentions ISO-8601: {mentions_iso})")
            
        except Exception as e:
            print(f"OpenAI test failed: {e}")
    else:
        print("OPENAI_API_KEY not set, skipping OpenAI test")

if __name__ == "__main__":
    test_time_query()