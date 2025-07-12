# 🚀 Deployment Guide

## Prerequisites

Before deploying, ensure you have:
- [ ] MongoDB Atlas account
- [ ] Supabase account
- [ ] Google Cloud account (for Gemini API)
- [ ] Redis instance (optional)

## Environment Variables

Copy `env.example` to `.env` and fill in all required variables:

```bash
cp env.example .env
```

### Required Variables:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_BUCKET_NAME` - Storage bucket name
- `GEMINI_API_KEY` - Google Gemini API key

## Deployment Options

### 1. Railway (Recommended for Interviews)

**Pros**: Easy setup, Docker support, custom domains
**Cons**: $5/month after free trial

#### Steps:
1. Create account at [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Add environment variables in Railway dashboard
4. Deploy automatically

### 2. Render

**Pros**: Free tier available, Docker support
**Cons**: Sleeps after 15 minutes

#### Steps:
1. Create account at [render.com](https://render.com)
2. Create new Web Service
3. Connect GitHub repository
4. Add environment variables
5. Set build command: `npm install && npm run build`
6. Set start command: `npm start`

### 3. DigitalOcean App Platform

**Pros**: Reliable, good performance
**Cons**: $5/month minimum

#### Steps:
1. Create account at [digitalocean.com](https://digitalocean.com)
2. Create new App
3. Connect GitHub repository
4. Add environment variables
5. Deploy

## Docker Limitations

⚠️ **Important**: Your app uses Docker-in-Docker which is not supported on most free platforms.

### Solutions:

1. **Use Railway/Render paid plans** (recommended for interviews)
2. **Deploy without Docker features** (terminal won't work)
3. **Use a VPS** like DigitalOcean Droplet ($5/month)

## Production Checklist

- [ ] All environment variables set
- [ ] MongoDB Atlas configured
- [ ] Supabase storage bucket created
- [ ] CORS origins updated
- [ ] Frontend URL updated in environment
- [ ] Health check endpoint working
- [ ] SSL certificate configured
- [ ] Domain configured (optional)

## Testing Deployment

1. **Health Check**: `GET /api/health`
2. **Database**: `GET /api/v1/ping`
3. **Authentication**: Test register/login endpoints
4. **File Upload**: Test project creation
5. **Real-time**: Test Socket.IO connection

## Monitoring

- Set up logging (Railway/Render provide this)
- Monitor MongoDB Atlas dashboard
- Check Supabase storage usage
- Monitor API response times

## Troubleshooting

### Common Issues:

1. **Docker not available**: Terminal features won't work
2. **CORS errors**: Check ALLOWED_ORIGINS
3. **Database connection**: Verify MONGODB_URI
4. **File upload fails**: Check Supabase credentials

### Debug Commands:

```bash
# Check if app is running
curl https://your-app.railway.app/api/health

# Test database connection
curl https://your-app.railway.app/api/v1/ping

# Check environment variables
echo $MONGODB_URI
```

## Interview Preparation

1. **Deploy to Railway** (most professional)
2. **Create portfolio website** with live demo link
3. **Prepare 5-minute demo script**
4. **Document technical architecture**
5. **Have backup deployment** (Render free tier)

## Cost Estimation

- **Railway**: $5/month (recommended)
- **Render**: Free tier available
- **DigitalOcean**: $5/month minimum
- **MongoDB Atlas**: Free tier available
- **Supabase**: Free tier available

Total: $5-10/month for professional deployment 