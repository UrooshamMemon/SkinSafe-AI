from pathlib import Path
import json
import pandas as pd


# Project folders
PROJECT_DIR = Path(__file__).parent.parent
RAW_DIR = PROJECT_DIR / "data" / "raw"
PROCESSED_DIR = PROJECT_DIR / "data" / "processed"


def process_github_dataset():
    json_file = RAW_DIR / "ingredients.json"

    if not json_file.exists():
        print(f"ERROR: Dataset not found: {json_file}")
        return

    with json_file.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if isinstance(data, dict):
        records = data.get("ingredients", data)
        if isinstance(records, dict):
            records = list(records.values())
    elif isinstance(data, list):
        records = data
    else:
        print("ERROR: Unexpected JSON structure.")
        return

    if not isinstance(records, list) or not records:
        print("ERROR: No ingredient records found.")
        return

    df = pd.DataFrame(records)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    output_file = PROCESSED_DIR / "github_ingredients_processed.csv"
    df.to_csv(output_file, index=False, encoding="utf-8-sig")

    print("GitHub dataset processed successfully!")
    print(f"Original file: {json_file.name}")
    print(f"Total ingredient records: {len(df)}")
    print(f"Total columns: {len(df.columns)}")
    print(f"Saved to: {output_file}")
    print("\nAvailable columns:")
    print(df.columns.tolist())
    print("\nFirst 3 records:")
    print(df.head(3).to_string(index=False))


def inspect_indonesian_dataset():
    excel_files = [
        file for file in RAW_DIR.iterdir()
        if file.suffix.lower() in {".xlsx", ".xls"}
        and "indonesian" in file.name.lower()
    ]

    if not excel_files:
        print("ERROR: Indonesian dataset not found.")
        return

    excel_file = excel_files[0]
    df = pd.read_excel(excel_file)

    df.columns = df.columns.str.strip()
    df = df.dropna(how="all")

    df["ingredient_name"] = (
        df["ingredient_name"]
        .astype("string")
        .str.strip()
    )

    df = df[
        df["ingredient_name"].notna()
        & df["ingredient_name"].ne("")
    ].copy()

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    output_file = PROCESSED_DIR / "indonesian_ingredients_processed.csv"
    df.to_csv(output_file, index=False, encoding="utf-8-sig")

    print("\nINDONESIAN DATASET PROCESSED SUCCESSFULLY")
    print("Original file:", excel_file.name)
    print("Ingredient records:", len(df))
    print("Columns:", df.columns.tolist())
    print("Saved to:", output_file)
    print("\nFirst 5 records:")
    print(df.head().to_string(index=False))



def inspect_cosing_dataset():
    cosing_files = [
        file for file in RAW_DIR.iterdir()
        if file.suffix.lower() in {".xls", ".xlsx"}
        and "cosing" in file.name.lower()
    ]

    if not cosing_files:
        print("ERROR: CosIng file not found.")
        return

    cosing_file = cosing_files[0]

    df = pd.read_excel(
        cosing_file,
        header=None,
        engine="xlrd" if cosing_file.suffix.lower() == ".xls" else None
    )

    print("\nCOSING DATASET INSPECTION")
    print("Original file:", cosing_file.name)
    print("Worksheet shape:", df.shape)

    print("\nRows 6–12:")
    for index in range(6, min(13, len(df))):
        values = [
            f"{column}: {str(value).strip()}"
            for column, value in df.iloc[index].items()
            if pd.notna(value) and str(value).strip()
        ]
        if values:
            print(f"Row {index}: " + " | ".join(values))



def process_cosing_dataset():
    cosing_files = [
        file for file in RAW_DIR.iterdir()
        if file.suffix.lower() in {".xls", ".xlsx"}
        and "cosing" in file.name.lower()
    ]

    if not cosing_files:
        print("ERROR: CosIng file not found.")
        return

    cosing_file = cosing_files[0]

    df = pd.read_excel(
        cosing_file,
        header=None,
        engine="xlrd" if cosing_file.suffix.lower() == ".xls" else None
    )

    records = df.iloc[8:].copy()

    records.columns = [
        "reference_number",
        "chemical_name_inn",
        "common_ingredient_name",
        "cas_number",
        "ec_number",
        "product_type",
        "maximum_concentration",
        "other_conditions",
        "conditions_and_warnings",
        "regulation",
        "other_directives_regulations",
        "sccs_opinions",
        "chemical_iupac_name",
        "identified_ingredients",
        "cmr_information",
        "update_date",
    ]

    records = records.dropna(how="all")

    print("Unique restriction reference numbers:", records["reference_number"].nunique())
    print("Duplicate reference-number rows:", records["reference_number"].duplicated().sum())

    duplicate_refs = records[
        records["reference_number"].duplicated(keep=False)
    ].sort_values("reference_number")

    print("\nREPEATED COSING REFERENCE NUMBERS")
    print(
        duplicate_refs[
            [
                "reference_number",
                "chemical_name_inn",
                "common_ingredient_name",
                "product_type",
                "maximum_concentration",
            ]
        ].to_string(index=False)
    )

    print(
    "Rows with a common ingredient name:",
    records["common_ingredient_name"].notna().sum()
    )

    print(
        "Unique common ingredient names:",
        records["common_ingredient_name"].dropna().str.casefold().str.strip().nunique()
    )

    print(
        "Rows without a common ingredient name:",
        records["common_ingredient_name"].isna().sum()
    )

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    output_file = PROCESSED_DIR / "cosing_restrictions.csv"
    records.to_csv(output_file, index=False, encoding="utf-8-sig")
    print("CosIng restriction columns:", records.columns.tolist())

    print("\nCOSING RESTRICTIONS PROCESSED SUCCESSFULLY")
    print("Source file:", cosing_file.name)
    print("Restriction records:", len(records))
    print("Saved to:", output_file)
    print("\nFirst 3 restriction records:")
    print(records.head(3).to_string(index=False))



def build_ingredients_master():
    github_file = PROCESSED_DIR / "github_ingredients_processed.csv"
    indonesian_file = PROCESSED_DIR / "indonesian_ingredients_processed.csv"

    if not github_file.exists() or not indonesian_file.exists():
        print("ERROR: Process both ingredient datasets first.")
        return

    github_df = pd.read_csv(github_file)
    indonesian_df = pd.read_csv(indonesian_file)

    def normalize_name(value):
        if pd.isna(value):
            return ""
        return " ".join(str(value).casefold().strip().split())

    github_df["match_key"] = github_df["inci_name"].apply(normalize_name)
    indonesian_df["match_key"] = (
        indonesian_df["ingredient_name"].apply(normalize_name)
    )

    github_counts = github_df["match_key"].value_counts()
    indonesian_counts = indonesian_df["match_key"].value_counts()

    github_unique = github_df[
        github_df["match_key"].ne("")
        & github_df["match_key"].map(github_counts).eq(1)
    ].copy()

    indonesian_unique = indonesian_df[
        indonesian_df["match_key"].ne("")
        & indonesian_df["match_key"].map(indonesian_counts).eq(1)
    ].copy()

    merged = github_unique.merge(
        indonesian_unique,
        on="match_key",
        how="outer",
        suffixes=("_github", "_indonesian"),
        indicator=True
    )

    merged["ingredient_name"] = (
        merged["common_name"].combine_first(merged["ingredient_name"])
        if "common_name" in merged.columns
        else merged["ingredient_name"]
    )

    merged["source_name"] = merged["_merge"].map({
        "both": "GitHub dataset; Indonesian dataset",
        "left_only": "GitHub dataset",
        "right_only": "Indonesian dataset"
    })

    merged["source_url"] = merged["_merge"].map({
        "both": (
            "https://github.com/bsyilmaz/skincare-ingredients-dataset; "
            "Kaggle Indonesian ingredient dataset"
        ),
        "left_only": (
            "https://github.com/bsyilmaz/skincare-ingredients-dataset"
        ),
        "right_only": "Kaggle Indonesian ingredient dataset"
    })

    merged["match_status"] = merged["_merge"].map({
        "both": "exact_name_match",
        "left_only": "github_only",
        "right_only": "indonesian_only"
    })

    merged = merged.drop(columns=["match_key", "_merge"])
    def get_data_status(row):
        skin_analysis_fields = [
            "skin_types",
            "concerns",
            "irritancy",
            "comedogenic_rating",
        ]

        available_fields = sum(
            field in row.index
            and pd.notna(row[field])
            and str(row[field]).strip() != ""
            for field in skin_analysis_fields
        )

        if available_fields >= 2:
            return "skin_analysis_data_available"
        elif available_fields == 1:
            return "limited_skin_analysis_data"
        else:
            return "skin_analysis_data_missing"

    merged["data_status"] = merged.apply(get_data_status, axis=1)

    output_file = PROCESSED_DIR / "ingredients_master.csv"
    merged.to_csv(output_file, index=False, encoding="utf-8-sig")
    print("Master dataset columns:", merged.columns.tolist())

    print("\nINGREDIENTS MASTER CREATED")
    print("Total records:", len(merged))
    print("Exact name matches:", (merged["match_status"] == "exact_name_match").sum())
    print("GitHub-only records:", (merged["match_status"] == "github_only").sum())
    print("Indonesian-only records:", (merged["match_status"] == "indonesian_only").sum())
    print("Saved to:", output_file)
    


def check_master_dataset():
    master_file = PROCESSED_DIR / "ingredients_master.csv"
    df = pd.read_csv(master_file)

    print("\nMASTER DATASET QUALITY CHECK")
    print("Total rows:", len(df))
    print("Total columns:", len(df.columns))
    print("\nMissing values in important columns:")

    columns_to_check = [
        "ingredient_name",
        "inci_name",
        "category",
        "description",
        "skin_types",
        "concerns",
        "warning1",
        "warning2",
        "match_status",
    ]

    for column in columns_to_check:
        if column in df.columns:
            print(f"{column}: {df[column].isna().sum()} missing")

    print("\nSample records:")
    print(
        df[["ingredient_name", "inci_name", "match_status"]]
        .head(10)
        .to_string(index=False)
    )

    print("\nData status counts:")
    print(df["data_status"].value_counts(dropna=False))

    print("\nIndonesian dataset field coverage:")

    indonesian_rows = df[df["match_status"] == "indonesian_only"]

    for column in [
        "function1",
        "function2",
        "warning1",
        "warning2",
        "ingredient_origin",
        "ingredient_charge",
    ]:
        if column in indonesian_rows.columns:
            populated = indonesian_rows[column].notna().sum()
            print(f"{column}: {populated}/{len(indonesian_rows)} populated")


def check_cosing_name_coverage():
    master_file = PROCESSED_DIR / "ingredients_master.csv"
    cosing_file = PROCESSED_DIR / "cosing_restrictions.csv"

    master_df = pd.read_csv(master_file)
    cosing_df = pd.read_csv(cosing_file)

    def normalize_name(value):
        if pd.isna(value):
            return ""
        return " ".join(str(value).casefold().strip().split())

    master_names = set(
        master_df["ingredient_name"]
        .apply(normalize_name)
    ) - {""}

    cosing_names = set(
        cosing_df["common_ingredient_name"]
        .apply(normalize_name)
    ) - {""}

    matches = master_names & cosing_names

    print("\nCOSING NAME COVERAGE")
    print("Unique master ingredient names:", len(master_names))
    print("Unique CosIng restriction names:", len(cosing_names))
    print("Exact normalized name matches:", len(matches))
    print("\nSample matches:")
    for name in sorted(matches)[:15]:
        print("-", name)


def export_cosing_exact_matches():
    master_file = PROCESSED_DIR / "ingredients_master.csv"
    cosing_file = PROCESSED_DIR / "cosing_restrictions.csv"

    master_df = pd.read_csv(master_file)
    cosing_df = pd.read_csv(cosing_file)

    def normalize_name(value):
        if pd.isna(value):
            return ""
        return " ".join(str(value).casefold().strip().split())

    master_df["match_key"] = master_df["ingredient_name"].apply(normalize_name)
    cosing_df["match_key"] = cosing_df["common_ingredient_name"].apply(
        normalize_name
    )

    matches = master_df.merge(
        cosing_df,
        on="match_key",
        how="inner",
        suffixes=("_master", "_cosing")
    )

    output_file = PROCESSED_DIR / "cosing_exact_matches_review.csv"
    matches.to_csv(output_file, index=False, encoding="utf-8-sig")

    print("\nCOSING MATCH REVIEW FILE CREATED")
    print("Matched rows:", len(matches))
    print("Saved to:", output_file)


def display_cosing_matches():
    file_path = PROCESSED_DIR / "cosing_exact_matches_review.csv"
    df = pd.read_csv(file_path)

    columns = [
        "ingredient_name",
        "common_ingredient_name",
        "product_type",
        "maximum_concentration",
        "conditions_and_warnings",
        "other_conditions",
        "other_directives_regulations",
        "regulation",
    ]

    available_columns = [
        column for column in columns if column in df.columns
    ]

    print("\nCOSING RESTRICTIONS FOR REVIEW")
    print(df[available_columns].to_string(index=False))


if __name__ == "__main__":
    process_cosing_dataset()
