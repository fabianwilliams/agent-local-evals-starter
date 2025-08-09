# 🔐 Security Guidelines

## ⚠️ CRITICAL: Never Commit Secrets to Git

This repository contains `.env` files with placeholder values. **NEVER** commit real API keys, connection strings, or other secrets to Git.

## 🛡️ Secure Setup Instructions

### 1. OpenAI API Key Setup

1. **Create a NEW API key** (the old one was compromised):
   - Go to https://platform.openai.com/api-keys
   - Delete any compromised keys
   - Create a new API key
   
2. **Update your local `.env` files**:
   ```bash
   # In agents-sdk-ts/.env
   OPENAI_API_KEY=sk-proj-YOUR-NEW-KEY-HERE
   
   # In evals/.env  
   OPENAI_API_KEY=sk-proj-YOUR-NEW-KEY-HERE
   ```

### 2. Azure Application Insights Setup

1. **Get your connection string** from Azure portal:
   - Navigate to your Application Insights resource
   - Go to "Overview" → copy the "Connection String"
   
2. **Update your local `.env` file**:
   ```bash
   # In agents-sdk-ts/.env
   AZURE_MONITOR_CONNECTION_STRING=InstrumentationKey=YOUR-KEY;IngestionEndpoint=https://YOUR-REGION.in.applicationinsights.azure.com/;LiveEndpoint=https://YOUR-REGION.livediagnostics.monitor.azure.com/;ApplicationId=YOUR-APP-ID
   ```

### 3. Verify Your `.env` Files Are Ignored

```bash
# Check that .env files are in .gitignore
cat .gitignore | grep -E "\.env"

# Should show:
# .env
# .env.local
# .env.development.local
# .env.test.local  
# .env.production.local
```

## 🚨 What to Do If Credentials Are Exposed

1. **Immediately rotate/delete the exposed credentials**
2. **Check your Git history** for any committed secrets
3. **Use GitHub's secret scanning** to find exposed secrets
4. **Consider using services like** `gitleaks` or `trufflehog` to scan your repos

## 🔧 Production Environment Variables

For production deployments, use:
- **GitHub Actions Secrets** for CI/CD
- **Azure Key Vault** for Azure resources  
- **Environment variables** set by your deployment platform
- **Never use `.env` files in production**

## 🎯 Best Practices

1. ✅ Use `.env.example` files with placeholder values
2. ✅ Always add `.env` to `.gitignore`
3. ✅ Use environment variables in production
4. ✅ Rotate credentials regularly
5. ✅ Use least-privilege access principles
6. ❌ Never commit secrets to Git
7. ❌ Never share API keys in plain text (messages, emails, etc.)
8. ❌ Never log sensitive information

## 📞 Emergency Contact

If you suspect a security breach:
1. Immediately rotate all credentials
2. Check Azure/OpenAI usage logs for anomalies
3. Review access patterns in your monitoring dashboards