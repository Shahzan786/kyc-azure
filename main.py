from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="KYC Document Verification System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

AZURE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_ACCOUNT_NAME = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
AZURE_ACCOUNT_KEY = os.getenv("AZURE_STORAGE_ACCOUNT_KEY")
CONTAINER_NAME = os.getenv("AZURE_CONTAINER_NAME", "kyc-documents")

blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)


def get_blob_path(user_type: str, phone: str, doc_type: str) -> str:
    folder_map = {
        "user": "UserUploads",
        "provider": "ProviderUploads",
        "common": "CommonUploads",
    }
    folder = folder_map.get(user_type, "UserUploads")
    return f"{folder}/{phone}/{phone}_{doc_type}.jpg"


@app.post("/upload")
async def upload_kyc(
    phone: str = Form(...),
    user_type: str = Form(default="user"),
    aadhar: UploadFile = File(...),
    selfie: UploadFile = File(...),
):
    results = {}
    for doc_type, file in [("aadhar", aadhar), ("selfImage", selfie)]:
        blob_path = get_blob_path(user_type, phone, doc_type)
        blob_client = blob_service_client.get_blob_client(
            container=CONTAINER_NAME, blob=blob_path
        )
        content = await file.read()
        blob_client.upload_blob(
            content,
            overwrite=True,
            content_settings={"content_type": "image/jpeg"},
        )
        results[doc_type] = blob_path

    return {"status": "success", "phone": phone, "uploaded": results}


@app.get("/presigned-url")
async def get_presigned_url(phone: str, doc_type: str, user_type: str = "user"):
    blob_path = get_blob_path(user_type, phone, doc_type)
    sas_token = generate_blob_sas(
        account_name=AZURE_ACCOUNT_NAME,
        container_name=CONTAINER_NAME,
        blob_name=blob_path,
        account_key=AZURE_ACCOUNT_KEY,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(minutes=15),
    )
    url = f"https://{AZURE_ACCOUNT_NAME}.blob.core.windows.net/{CONTAINER_NAME}/{blob_path}?{sas_token}"
    return {"url": url, "expires_in": "15 minutes"}


@app.get("/admin/documents/{phone}")
async def list_user_documents(phone: str, user_type: str = "user"):
    folder_map = {"user": "UserUploads", "provider": "ProviderUploads"}
    prefix = f"{folder_map.get(user_type, 'UserUploads')}/{phone}/"
    container_client = blob_service_client.get_container_client(CONTAINER_NAME)
    blobs = [b.name for b in container_client.list_blobs(name_starts_with=prefix)]
    return {"phone": phone, "documents": blobs, "count": len(blobs)}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "KYC Verification API"}
