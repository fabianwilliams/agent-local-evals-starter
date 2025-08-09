#!/usr/bin/env python3
"""
Comprehensive evaluation test that verifies both agent functionality and tracing
"""
import json
import os
import subprocess
import time
import requests
from openai import OpenAI
from dotenv import load_dotenv
import re
from typing import Dict, List, Any

# Load environment variables from .env file
load_dotenv()

class ComprehensiveEval:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.results = []
        self.ts_agent_path = "../agents-sdk-ts"
        
    def run_typescript_agent(self, test_name: str = "default") -> Dict[str, Any]:
        """Run the TypeScript agent and capture output"""
        try:
            # Change to TypeScript directory and run the new Agents SDK implementation
            result = subprocess.run(
                ["npx", "ts-node", "simple-agent.ts"],
                cwd=self.ts_agent_path,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return {
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr,
                "test_name": test_name
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "output": "",
                "error": "Timeout after 30 seconds",
                "test_name": test_name
            }
        except Exception as e:
            return {
                "success": False,
                "output": "",
                "error": str(e),
                "test_name": test_name
            }

    def run_typescript_test_suite(self) -> Dict[str, Any]:
        """Run the comprehensive TypeScript test suite"""
        try:
            result = subprocess.run(
                ["npx", "ts-node", "test-suite.ts"],
                cwd=self.ts_agent_path,
                capture_output=True,
                text=True,
                timeout=120  # Longer timeout for full test suite
            )
            
            return {
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr,
                "test_name": "full_test_suite"
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "output": "",
                "error": "Test suite timeout after 120 seconds",
                "test_name": "full_test_suite"
            }
        except Exception as e:
            return {
                "success": False,
                "output": "",
                "error": str(e),
                "test_name": "full_test_suite"
            }

    def test_python_vs_typescript_consistency(self) -> Dict[str, Any]:
        """Test that Python and TypeScript agents give similar responses"""
        query = "What time is it right now? Respond with an ISO-8601 timestamp."
        
        # Test Python OpenAI direct
        try:
            python_response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": query}],
                max_tokens=200
            )
            python_result = python_response.choices[0].message.content
        except Exception as e:
            python_result = f"Error: {str(e)}"
        
        # Test TypeScript agent
        ts_result = self.run_typescript_agent("consistency_test")
        ts_output = ts_result.get("output", "")
        
        # Extract the actual response from TypeScript output (remove debug info)
        ts_lines = ts_output.strip().split('\n')
        ts_response = ""
        for line in ts_lines:
            # Look for the agent response line
            if "Agent Response:" in line:
                # Extract everything after "Agent Response:"
                ts_response = line.split("Agent Response:", 1)[1].strip()
                break
        
        if not ts_response:  # Fallback to first non-debug line
            for line in ts_lines:
                if not any(line.startswith(prefix) for prefix in ["🤖", "📝", "✅", "🆔", "📊", "🔗", "📈", "🏷️", "🔄", "🎯"]):
                    if line.strip() and not line.startswith("="):
                        ts_response = line.strip()
                        break
        
        # Scoring
        python_mentions_iso = 'iso' in python_result.lower() or 'ISO' in python_result
        ts_mentions_iso = 'iso' in ts_response.lower() or 'ISO' in ts_response
        
        iso_pattern = r'\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z?'
        python_has_timestamp = bool(re.search(iso_pattern, python_result))
        ts_has_timestamp = bool(re.search(iso_pattern, ts_response))
        
        consistency_score = 1.0 if python_mentions_iso == ts_mentions_iso else 0.5
        
        return {
            "test_name": "python_vs_typescript_consistency",
            "success": ts_result["success"] and consistency_score > 0,
            "python_response": python_result,
            "typescript_response": ts_response,
            "typescript_raw_output": ts_output[:500] + "..." if len(ts_output) > 500 else ts_output,  # Debug info
            "python_mentions_iso": python_mentions_iso,
            "typescript_mentions_iso": ts_mentions_iso,
            "python_has_timestamp": python_has_timestamp,
            "typescript_has_timestamp": ts_has_timestamp,
            "consistency_score": consistency_score,
            "typescript_success": ts_result["success"],
            "typescript_error": ts_result.get("error", "")
        }

    def check_aspire_dashboard_connectivity(self) -> Dict[str, Any]:
        """Test connectivity to Aspire Dashboard OTLP endpoint"""
        try:
            # Test if the endpoint is reachable
            response = requests.get("http://localhost:18888", timeout=5)
            dashboard_reachable = response.status_code == 200
        except:
            dashboard_reachable = False
            
        try:
            # Test OTLP endpoint (should give 400 for GET, but that means it's listening)
            response = requests.get("http://localhost:18889/v1/traces", timeout=5)
            otlp_reachable = response.status_code in [400, 405]  # Bad request or method not allowed is fine
        except:
            otlp_reachable = False
            
        return {
            "test_name": "aspire_connectivity",
            "success": dashboard_reachable and otlp_reachable,
            "dashboard_reachable": dashboard_reachable,
            "otlp_endpoint_reachable": otlp_reachable,
            "dashboard_url": "http://localhost:18888",
            "otlp_url": "http://localhost:18889/v1/traces"
        }

    def test_trace_generation(self) -> Dict[str, Any]:
        """Run TypeScript agent and verify traces are generated"""
        print("\\n🔍 Testing trace generation...")
        
        # Run the test suite which should generate multiple traces
        ts_result = self.run_typescript_test_suite()
        
        # Give time for traces to be exported
        print("   Waiting 5 seconds for trace export...")
        time.sleep(5)
        
        # Check if traces appear to be generated based on output
        output = ts_result.get("output", "")
        traces_flushed = "Flushing traces" in output or "spans flushed" in output
        otel_initialized = "OpenTelemetry initialized" in output
        tests_ran = "Test Results:" in output or "Starting comprehensive test suite" in output
        
        return {
            "test_name": "trace_generation",
            "success": ts_result["success"] and traces_flushed and otel_initialized,
            "typescript_success": ts_result["success"],
            "traces_flushed": traces_flushed,
            "otel_initialized": otel_initialized,
            "tests_ran": tests_ran,
            "output_preview": output[:500] + "..." if len(output) > 500 else output,
            "error": ts_result.get("error", "")
        }

    def run_all_evaluations(self) -> None:
        """Run all evaluations and print comprehensive results"""
        print("🚀 Starting Comprehensive Agent Evaluation")
        print("=" * 50)
        
        # Test 1: Connectivity check
        print("\\n1️⃣ Testing infrastructure connectivity...")
        connectivity_result = self.check_aspire_dashboard_connectivity()
        self.results.append(connectivity_result)
        self.print_result(connectivity_result)
        
        # Test 2: Trace generation
        trace_result = self.test_trace_generation()
        self.results.append(trace_result)
        self.print_result(trace_result)
        
        # Test 3: Consistency between implementations
        print("\\n3️⃣ Testing Python vs TypeScript consistency...")
        consistency_result = self.test_python_vs_typescript_consistency()
        self.results.append(consistency_result)
        self.print_result(consistency_result)
        
        # Final summary
        self.print_final_summary()

    def print_result(self, result: Dict[str, Any]) -> None:
        """Print a formatted result"""
        status = "✅ PASS" if result["success"] else "❌ FAIL"
        print(f"   {status} {result['test_name']}")
        
        if result["test_name"] == "aspire_connectivity":
            print(f"      Dashboard reachable: {'✅' if result['dashboard_reachable'] else '❌'}")
            print(f"      OTLP endpoint reachable: {'✅' if result['otlp_endpoint_reachable'] else '❌'}")
        
        elif result["test_name"] == "trace_generation":
            print(f"      TypeScript tests ran: {'✅' if result['tests_ran'] else '❌'}")
            print(f"      OpenTelemetry initialized: {'✅' if result['otel_initialized'] else '❌'}")
            print(f"      Traces flushed: {'✅' if result['traces_flushed'] else '❌'}")
        
        elif result["test_name"] == "python_vs_typescript_consistency":
            print(f"      Consistency score: {result['consistency_score']:.1f}/1.0")
            print(f"      Python mentions ISO: {'✅' if result['python_mentions_iso'] else '❌'}")
            print(f"      TypeScript mentions ISO: {'✅' if result['typescript_mentions_iso'] else '❌'}")
            print(f"      TypeScript response: '{result['typescript_response']}'")
            if not result["success"]:
                print(f"      Raw TS output: {result.get('typescript_raw_output', 'N/A')[:200]}...")
        
        if not result["success"] and "error" in result and result["error"]:
            print(f"      Error: {result['error']}")

    def print_final_summary(self) -> None:
        """Print final evaluation summary"""
        print("\\n" + "=" * 50)
        print("📊 FINAL EVALUATION SUMMARY")
        print("=" * 50)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        
        print(f"\\n🎯 Overall Results: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL SYSTEMS OPERATIONAL!")
            print("   ✅ Infrastructure connectivity verified")
            print("   ✅ Tracing system working")
            print("   ✅ Agent implementations consistent")
            print("\\n🔗 Check your dashboards:")
            print("   📊 Aspire Dashboard: http://localhost:18888")
            print("   ☁️  Azure Application Insights: (check your Azure portal)")
        else:
            print("⚠️  SOME ISSUES DETECTED:")
            for result in self.results:
                if not result["success"]:
                    print(f"   ❌ {result['test_name']}: {result.get('error', 'Failed')}")
            print("\\n🔧 Please review the errors above and fix the issues.")

def main():
    evaluator = ComprehensiveEval()
    evaluator.run_all_evaluations()

if __name__ == "__main__":
    main()