#!/bin/bash
echo "🚀 Deploying Neon Voting App to Netlify..."

# Build step (if needed)
echo "📦 Building project..."

# Deploy using Netlify CLI
netlify deploy --prod

echo "✅ Deployment complete!"
echo "📱 App URL: https://your-app-name.netlify.app"