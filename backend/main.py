
from pathlib import Path
import ast
import os

import pandas as pd
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from pydantic import BaseModel

app = FastAPI(title="SkinSafe AI")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_PATH = PROJECT_ROOT / "data" / "processed" / "ingredients_master.csv"

load_dotenv(PROJECT_ROOT / ".env")
OCR_SPACE_API_KEY = os.getenv("OCR_SPACE_API_KEY", "").strip()


class IngredientListRequest(BaseModel):
    ingredients: str


def load_ingredients():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Ingredient dataset not found: {DATASET_PATH}"
        )

    df = pd.read_csv(DATASET_PATH).fillna("")
    df.columns = df.columns.str.strip()
    return df


def normalize(value):
    return " ".join(str(value).casefold().split())


def parse_list(value):
    """Convert list-like CSV strings into Python lists."""
    if isinstance(value, list):
        return value

    if not isinstance(value, str) or not value.strip():
        return []

    try:
        parsed = ast.literal_eval(value)
        if isinstance(parsed, (list, tuple)):
            return list(parsed)
    except (ValueError, SyntaxError):
        pass

    return [value]


def find_ingredients(name, df):
    """Find exact matches first, then partial matches."""
    search_name = normalize(name)

    if not search_name:
        return []

    columns = ["ingredient_name", "inci_name", "common_name"]
    exact_indices = set()
    partial_indices = set()

    for column in columns:
        if column not in df.columns:
            continue

        for index, value in df[column].items():
            normalized_value = normalize(value)

            if normalized_value == search_name:
                exact_indices.add(index)
            elif search_name in normalized_value:
                partial_indices.add(index)

    if "also_known_as" in df.columns:
        for index, value in df["also_known_as"].items():
            aliases = parse_list(value)

            for alias in aliases:
                normalized_alias = normalize(alias)

                if normalized_alias == search_name:
                    exact_indices.add(index)
                elif search_name in normalized_alias:
                    partial_indices.add(index)

    matched_indices = exact_indices if exact_indices else partial_indices

    if not matched_indices:
        return []

    output_columns = [
        "ingredient_name",
        "inci_name",
        "common_name",
        "category",
        "description",
        "benefits",
        "function1",
        "function2",
        "skin_types",
        "concerns",
        "irritancy",
        "comedogenic_rating",
        "pregnancy_safe",
        "vegan",
        "origin",
        "typical_concentration",
        "ph_range",
        "time_of_use",
        "evidence_level",
        "pairs_well_with",
        "avoid_with",
        "also_known_as",
        "warning1",
        "warning2",
        "source_name",
        "source_url",
        "match_status",
        "data_status",
    ]

    available_columns = [
        column for column in output_columns if column in df.columns
    ]

    results = []

    for index in sorted(matched_indices):
        record = df.loc[index, available_columns].to_dict()

        names = [
            record.get("ingredient_name", ""),
            record.get("inci_name", ""),
            record.get("common_name", ""),
        ]

        aliases = parse_list(record.get("also_known_as", []))

        exact_match = any(
            normalize(value) == search_name
            for value in names
            if value
        ) or any(
            normalize(alias) == search_name
            for alias in aliases
        )

        record["match_type"] = "exact" if exact_match else "partial"

        for field in [
            "category",
            "benefits",
            "skin_types",
            "concerns",
            "also_known_as",
            "pairs_well_with",
            "avoid_with",
        ]:
            if field in record:
                record[field] = parse_list(record[field])

        results.append(record)

    return results


@app.get("/")
def root():
    return {"message": "SkinSafe AI API is running"}


@app.get("/ingredients")
def search_ingredients(
    name: str = Query(
        ...,
        min_length=1,
        description="Ingredient name",
    )
):
    df = load_ingredients()
    results = find_ingredients(name, df)

    if not results:
        raise HTTPException(
            status_code=404,
            detail="Ingredient not found in the current database.",
        )

    return {
        "query": name,
        "count": len(results),
        "results": results,
    }


@app.post("/analyze-ingredients")
def analyze_ingredients(request: IngredientListRequest):
    df = load_ingredients()

    # Split a comma-separated cosmetic ingredient list.
    ingredient_names = [
        item.strip()
        for item in request.ingredients.split(",")
        if item.strip()
    ]

    if not ingredient_names:
        raise HTTPException(
            status_code=400,
            detail="Please provide a comma-separated ingredient list.",
        )

    results = []

    for ingredient in ingredient_names:
        matches = find_ingredients(ingredient, df)

        if matches:
            results.append({
                "input": ingredient,
                "status": "identified",
                "count": len(matches),
                "data": matches,
            })
        else:
            results.append({
                "input": ingredient,
                "status": "unknown",
                "count": 0,
                "data": [],
            })

    return {
        "ingredient_count": len(ingredient_names),
        "identified_count": sum(
            item["status"] == "identified" for item in results
        ),
        "unknown_count": sum(
            item["status"] == "unknown" for item in results
        ),
        "results": results,
    }


@app.post("/ocr")
def extract_text_from_image(file: UploadFile = File(...)):
    """Extract text from a cosmetic label using OCR.space."""

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an image file.",
        )

    if not OCR_SPACE_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="OCR API key is not configured on the server.",
        )

    image_bytes = file.file.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty.",
        )

    if len(image_bytes) > 1_000_000:
        raise HTTPException(
            status_code=413,
            detail=(
                "This image exceeds 1 MB. Please choose a smaller "
                "image or reduce its size and try again."
            ),
        )

    try:
        response = requests.post(
            "https://api.ocr.space/parse/image",
            headers={"apikey": OCR_SPACE_API_KEY},
            files={
                "file": (
                    file.filename or "label.jpg",
                    image_bytes,
                    file.content_type,
                )
            },
            data={
                "language": "eng",
                "isOverlayRequired": "false",
                "detectOrientation": "true",
                "scale": "true",
                "OCREngine": "2",
            },
            timeout=60,
        )
        response.raise_for_status()
        ocr_data = response.json()

    except requests.RequestException:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the OCR service. Please try again.",
        )
    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="The OCR service returned an invalid response.",
        )
    finally:
        file.file.close()

    if ocr_data.get("IsErroredOnProcessing"):
        raise HTTPException(
            status_code=422,
            detail="OCR could not read this image. Try a clearer photo.",
        )

    parsed_results = ocr_data.get("ParsedResults") or []
    extracted_text = "\n".join(
        result.get("ParsedText", "").strip()
        for result in parsed_results
        if result.get("ParsedText", "").strip()
    )

    return {
        "text": extracted_text,
        "message": (
            "Text extracted successfully. Please review it for errors."
            if extracted_text
            else "No text was detected. Try a clearer photo."
        ),
    }
