# 🚀 Quick Start - MP4 Video Generation

## 1️⃣ Get Replicate API Key

1. Visit https://replicate.com/signin
2. Create free account
3. Go to **Account → API Tokens**
4. Copy your token

## 2️⃣ Setup Backend

```bash
# Navigate to server folder
cd server

# Install dependencies
npm install

# Create .env file with your key
echo 'REPLICATE_API_KEY=your_key_here' > .env
echo 'PORT=3000' >> .env

# Start server
npm start
```

Expect output:
```
🚀 Server running on http://localhost:3000
✅ REPLICATE_API_KEY: configured
```

## 3️⃣ Test Generation

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Beautiful sunset over ocean", "duration": 5}'
```

## 4️⃣ Open Dashboard

1. Open `dashboard.html` in browser (or use local server)
2. Create account / login
3. Write prompt: *"Drone flying over cyberpunk city at dawn, cinematic lighting"*
4. Click **Crear con IA**
5. Wait 30-90 seconds for video
6. Click **Descargar** to download MP4

## ✨ Features Ready

✅ **Video Generation** - Text to MP4 using Replicate  
✅ **Image Generation** - Text to image using FLUX  
✅ **Preview & Download** - Play video inline, download as MP4  
✅ **User Accounts** - Register, login, track usage  
✅ **Premium Plan** - Unlimited generations  

## 🔗 Deployment Options

### Deploy on Vercel (Recommended)
```bash
npm i -g vercel
cd server
vercel --prod
```

### Deploy on Railway
1. Connect GitHub repo to https://railway.app
2. Add `REPLICATE_API_KEY` environment variable
3. Deploy

### Deploy on Render
1. Go to https://render.com
2. Create Web Service from GitHub
3. Set environment variable
4. Deploy

## 🎬 Prompt Examples

```
"Cinematic drone shot of Tokyo neon-lit streets at night, cyberpunk aesthetic, rain, bokeh lights"

"Animated liquid gold flowing and morphing into geometric shapes, 4K, smooth, luxurious"

"Underwater scene with colorful coral reef, tropical fish swimming, sunlight rays, serene"

"Man walking through futuristic space station, sci-fi tech, blue and purple lighting, slow motion"
```

---

**Done!** Your AI video generator is ready! 🎬✨
