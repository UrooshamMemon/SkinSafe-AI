from pathlib import Path
import pandas as pd

DATA_DIR = Path(__file__).parent.parent / "data" / "raw"


def main():
    cosing_files = [
        file for file in DATA_DIR.iterdir()
        if file.suffix.lower() in {".xls", ".xlsx"}
        and "cosing" in file.name.lower()
    ]

    if not cosing_files:
        print("ERROR: CosIng file not found.")
        return

    cosing_file = cosing_files[0]

    print("COSING FILE:", cosing_file.name)

    cosing_df = pd.read_excel(
        cosing_file,
        header=None,
        engine="xlrd" if cosing_file.suffix.lower() == ".xls" else None
    )

    print("Worksheet shape:", cosing_df.shape)
    print("\nCOSING: HEADER SEARCH — ROWS 0–19")

    for index in range(min(20, len(cosing_df))):
        row = cosing_df.iloc[index]

        values = [
            f"{column}={str(value).strip()}"
            for column, value in row.items()
            if pd.notna(value) and str(value).strip()
        ]

        if values:
            print(f"Row {index}: " + " | ".join(values))


if __name__ == "__main__":
    main()
