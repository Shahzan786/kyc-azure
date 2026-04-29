# KYC Document Verification System — Azure Deployment

**M.H. Saboo Siddik College of Engineering | AY 2025-26**

---

## Project Structure

```
kyc-azure/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── requirements.txt
│   ├── .env.example         # Copy to .env and fill values
│   ├── Dockerfile
│   └── render.yaml          # For free Render.com deployment
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── docker-compose.yml
└── README.md
```

---

## Local Testing (No Azure Needed)

```bash
# 1. Copy env file
cp backend/.env.example backend/.env
# Fill in your Azure credentials in .env

# 2. Install dependencies
cd backend
pip install -r requirements.txt

# 3. Run backend
uvicorn main:app --reload --port 8000

# 4. Open frontend/index.html in browser
```

API docs available at: http://localhost:8000/docs

---

## Azure Setup (One-time)

### Step 1 — Install Azure CLI
```bash
# Windows: download from https://aka.ms/installazurecliwindows
# Mac:
brew install azure-cli
# Linux:
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### Step 2 — Login & Create Resources
```bash
az login

# Create resource group
az group create --name kyc-rg --location eastus

# Create storage account (change kycstorageXXX to something unique)
az storage account create \
  --name kycstorageXXX \
  --resource-group kyc-rg \
  --location eastus \
  --sku Standard_LRS \
  --allow-blob-public-access false

# Get connection string (paste this into your .env)
az storage account show-connection-string \
  --name kycstorageXXX \
  --resource-group kyc-rg \
  --query connectionString -o tsv

# Create the blob container
az storage container create \
  --name kyc-documents \
  --account-name kycstorageXXX \
  --public-access off
```

### Step 3 — Deploy Backend (Azure App Service)
```bash
# Build and push Docker image to ACR
az acr create --resource-group kyc-rg --name kycregistryXXX --sku Basic --admin-enabled true
az acr login --name kycregistryXXX

docker build -t kyc-backend ./backend
docker tag kyc-backend kycregistryXXX.azurecr.io/kyc-backend:latest
docker push kycregistryXXX.azurecr.io/kyc-backend:latest

# Create App Service
az appservice plan create --name kyc-plan --resource-group kyc-rg --is-linux --sku B1
az webapp create \
  --resource-group kyc-rg \
  --plan kyc-plan \
  --name kyc-api-XXXXX \
  --deployment-container-image-name kycregistryXXX.azurecr.io/kyc-backend:latest

# Set environment variables
az webapp config appsettings set \
  --resource-group kyc-rg \
  --name kyc-api-XXXXX \
  --settings \
    AZURE_STORAGE_CONNECTION_STRING="<paste connection string>" \
    AZURE_STORAGE_ACCOUNT_NAME="kycstorageXXX" \
    AZURE_STORAGE_ACCOUNT_KEY="<your account key>" \
    AZURE_CONTAINER_NAME="kyc-documents"
```

Backend live at: https://kyc-api-XXXXX.azurewebsites.net

### Step 4 — Deploy Frontend (Azure Static Web Apps)
```bash
az staticwebapp create \
  --name kyc-frontend \
  --resource-group kyc-rg \
  --location eastus2 \
  --source ./frontend \
  --branch main \
  --app-location "/" \
  --output-location "/"
```

> Update `API_BASE` in `frontend/app.js` with your App Service URL before deploying.

---

## FREE Alternative (Render.com + Netlify)

### Backend → Render.com (Free)
1. Push this repo to GitHub
2. Go to https://render.com → New Web Service
3. Connect your GitHub repo, set root to `backend/`
4. Add environment variables from `.env.example`
5. Deploy! URL: https://kyc-backend.onrender.com

### Frontend → Netlify (Always Free)
1. Go to https://netlify.com → Add new site → Deploy manually
2. Drag and drop the `frontend/` folder
3. Done! URL: https://your-site.netlify.app

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload Aadhaar + selfie for a user |
| GET | `/presigned-url` | Get temporary 15-min access URL |
| GET | `/admin/documents/{phone}` | List all docs for a user |
| GET | `/health` | Health check |
| GET | `/docs` | Interactive Swagger UI |

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Backend | FastAPI (Python) |
| Cloud Storage | Azure Blob Storage |
| Access Control | Azure SAS Tokens |
| Containerization | Docker |
| Frontend | HTML5 + CSS3 + Vanilla JS |
| Deployment | Azure App Service / Render.com |
