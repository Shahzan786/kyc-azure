// ─── CONFIG ──────────────────────────────────────────────────────────────────
// After deploying your backend, replace this with your actual URL.
// For Render.com free tier: https://kyc-backend.onrender.com
// For Azure App Service:    https://kyc-api-XXXXX.azurewebsites.net
// For local testing:        http://localhost:8000
const API_BASE = "http://localhost:8000";

// Update the API docs link in the UI
document.getElementById("apiDocsLink").textContent = `${API_BASE}/docs`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function setUserType(type, btn) {
  document.getElementById("userType").value = type;
  document.querySelectorAll(".toggle").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

function setFileLabel(inputId, labelId) {
  const file = document.getElementById(inputId).files[0];
  const label = document.getElementById(labelId);
  const drop = label.closest(".file-drop");
  if (file) {
    label.textContent = `✓ ${file.name}`;
    drop.classList.add("has-file");
  }
}

function loading(elId, msg = "Processing...") {
  document.getElementById(elId).innerHTML = `
    <div class="msg-loading">
      <div class="spinner"></div>${msg}
    </div>`;
}

function success(elId, html) {
  document.getElementById(elId).innerHTML = `<div class="msg-success">${html}</div>`;
}

function error(elId, msg) {
  document.getElementById(elId).innerHTML = `<div class="msg-error">❌ ${msg}</div>`;
}

// ─── UPLOAD KYC ──────────────────────────────────────────────────────────────
async function uploadKYC() {
  const phone    = document.getElementById("phone").value.trim();
  const userType = document.getElementById("userType").value;
  const aadhar   = document.getElementById("aadhar").files[0];
  const selfie   = document.getElementById("selfie").files[0];
  const btn      = document.getElementById("uploadBtn");

  if (!phone || phone.length < 10) return error("uploadStatus", "Enter a valid 10-digit phone number.");
  if (!aadhar) return error("uploadStatus", "Please upload your Aadhaar card image.");
  if (!selfie) return error("uploadStatus", "Please upload your selfie photo.");

  const formData = new FormData();
  formData.append("phone", phone);
  formData.append("user_type", userType);
  formData.append("aadhar", aadhar);
  formData.append("selfie", selfie);

  btn.disabled = true;
  loading("uploadStatus", "Uploading to Azure Blob Storage...");

  try {
    const res  = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed");

    success("uploadStatus", `
      ✅ Upload Successful!<br/>
      📱 Phone: ${data.phone}<br/>
      🪪 Aadhaar: ${data.uploaded.aadhar}<br/>
      🤳 Selfie: ${data.uploaded.selfImage}
    `);
  } catch (err) {
    error("uploadStatus", err.message);
  } finally {
    btn.disabled = false;
  }
}

// ─── PRESIGNED URL ───────────────────────────────────────────────────────────
async function getPresignedUrl() {
  const phone    = document.getElementById("urlPhone").value.trim();
  const docType  = document.getElementById("docType").value;
  const userType = document.getElementById("urlUserType").value;

  if (!phone) return error("urlResult", "Enter a phone number.");

  loading("urlResult", "Generating secure URL...");

  try {
    const res  = await fetch(`${API_BASE}/presigned-url?phone=${phone}&doc_type=${docType}&user_type=${userType}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to generate URL");

    document.getElementById("urlResult").innerHTML = `
      <a class="url-link" href="${data.url}" target="_blank" rel="noopener">
        🔗 Access Document · Expires in ${data.expires_in}
      </a>`;
  } catch (err) {
    error("urlResult", err.message);
  }
}

// ─── ADMIN LIST DOCS ─────────────────────────────────────────────────────────
async function listDocuments() {
  const phone    = document.getElementById("adminPhone").value.trim();
  const userType = document.getElementById("adminUserType").value;

  if (!phone) return error("adminResult", "Enter a phone number.");

  loading("adminResult", "Fetching document list...");

  try {
    const res  = await fetch(`${API_BASE}/admin/documents/${phone}?user_type=${userType}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Fetch failed");

    if (data.count === 0) {
      document.getElementById("adminResult").innerHTML =
        `<div class="msg-error">No documents found for this user.</div>`;
      return;
    }

    const items = data.documents.map(d => `<li>📄 ${d}</li>`).join("");
    document.getElementById("adminResult").innerHTML = `
      <div class="msg-success">
        Found ${data.count} document(s):<br/>
        <ul class="doc-list">${items}</ul>
      </div>`;
  } catch (err) {
    error("adminResult", err.message);
  }
}
