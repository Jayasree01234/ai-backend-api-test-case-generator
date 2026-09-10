import sqlite3


DATABASE_PATH = "app.db"


def add_column_if_missing(cursor, table_name, column_name, column_definition):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]

    if column_name not in columns:
        cursor.execute(
            f"ALTER TABLE {table_name} "
            f"ADD COLUMN {column_name} {column_definition}"
        )
        print(f"Added: {column_name} {column_definition}")
    else:
        print(f"Already exists: {column_name}")


def main():
    connection = sqlite3.connect(DATABASE_PATH)
    cursor = connection.cursor()

    try:
        # --------------------------------------------------------
        # API TABLE
        # --------------------------------------------------------

        add_column_if_missing(
            cursor,
            "apis",
            "openapi_details",
            "TEXT"
        )

        # --------------------------------------------------------
        # TEST CASE TABLE
        # --------------------------------------------------------

        add_column_if_missing(
            cursor,
            "test_cases",
            "test_code",
            "TEXT"
        )

        add_column_if_missing(
            cursor,
            "test_cases",
            "actual_result",
            "TEXT"
        )

        add_column_if_missing(
            cursor,
            "test_cases",
            "execution_status",
            "TEXT DEFAULT 'NOT RUN'"
        )

        add_column_if_missing(
            cursor,
            "test_cases",
            "expected_status_code",
            "INTEGER"
        )

        connection.commit()

        print()
        print("Database migration completed successfully.")

    except Exception as error:
        connection.rollback()
        print()
        print("Database migration failed:")
        print(error)

    finally:
        connection.close()


if __name__ == "__main__":
    main()