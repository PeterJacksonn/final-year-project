import shutil
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException
from ingest import parse_csv, upsert_entities

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


@router.post("/upload")
async def ingest_upload(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        entities = parse_csv(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse CSV: {str(e)}")

    if not entities:
        raise HTTPException(status_code=422, detail="No valid observations found in CSV.")

    results = upsert_entities(entities)

    return {
        "filename": file.filename,
        "entities_parsed": results["total"],
        "created": results["created"],
        "updated": results["updated"],
        "failed": results["failed"],
    }
